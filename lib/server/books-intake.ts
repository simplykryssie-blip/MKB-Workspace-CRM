/**
 * Bookkeeping intake — server side. Saved with the revision it started from;
 * submitting stores the PDF copy and signed engagement letter in Documents,
 * requests the documents the answers call for, emails the client and alerts
 * the bookkeeping team. Server-only.
 */
import { BOOKS_SECTIONS, pickableAddOns, quoteFor } from "@/lib/books/intake";
import { proposalAsText, proposalFromQuote, proposalLetterVars, proposalTotals, type Proposal, type ProposalBilling, type ProposalLine } from "@/lib/books/proposal";
import { fillLetter } from "@/lib/engagement/letters";
import { feeWords, money } from "@/lib/fees/config";
import { docsFor, type Answers } from "@/lib/tax/interview/engine";
import { all, badRequest, HttpError, json, notFound, now, one, run, type AppEnv } from "./core";
import { decryptField, encryptField, randomId } from "./crypto";

import { sha256Bytes, signatureFrom } from "./signature";
import { hasSensitivePerm } from "./identity";
import { rateLimit } from "./core";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { sendTemplate } from "./email";
import { letterVersion } from "./engagement";
import { audit, requirePermission, requireStaff, type Actor, type LinkActor } from "./identity";
import { buildIntakePdf, buildLetterPdf } from "./intake-pdf";
import { notify } from "./notifications";
import { cancelLinks, createLink, latestLink, LINK_DAYS, openLink, useLink, type LinkInfo } from "./secure-links";
import { aad, vaultKey } from "./clients";
import { currentLetters } from "./engagement";
import { publicAssetOrigin } from "./email";
import { loadFees } from "./settings";
import { storeClientPdfAs } from "./tax";

type Row = { id: string; client_id: string; status: "in_progress" | "submitted"; answers: string; step: number; entered_by: string; consent_name: string | null; engagement: string | null; submitted_at: string | null; workspace_id: string | null; history: string; created_at: string; updated_at: string; rev: number; proposal: string | null; c_name?: string; c_status?: string; c_lead?: string | null };
export type BooksIntake = { id: string; clientId: string; clientName: string; status: Row["status"]; answers: Answers; step: number; enteredBy: string; consentName?: string; engagement?: { version: number; termsVersion: number; acceptedName: string; acceptedAt: string; method: string; signature?: { key: string; sha256: string; bytes: number } }; submittedAt?: string; workspaceId?: string; history: { at: string; by: string; text: string }[]; createdAt: string; updatedAt: string; rev: number; /** The latest private link sent for this intake (never the link itself). */ link?: LinkInfo | null; /** MKB's reviewed price (staff only until it is sent). */ proposal?: Proposal | null; /** Sent to a lead who isn't a client yet (accept them from the lead). */ prospect?: { leadId: string; declined: boolean } | null; /** The latest proposal link (never the link itself). */ proposalLink?: LinkInfo | null };
const toIntake = (r: Row): BooksIntake => ({ id: r.id, clientId: r.client_id, clientName: r.c_name ?? "", status: r.status, answers: json(r.answers, {}), step: r.step, enteredBy: r.entered_by, consentName: r.consent_name ?? undefined, engagement: r.engagement ? json(r.engagement, undefined) : undefined, submittedAt: r.submitted_at ?? undefined, workspaceId: r.workspace_id ?? undefined, history: json(r.history, []), createdAt: r.created_at, updatedAt: r.updated_at, rev: r.rev, proposal: r.proposal ? json<Proposal | null>(r.proposal, null) : null, prospect: (r.c_status === "prospect" || r.c_status === "declined") && r.c_lead ? { leadId: r.c_lead, declined: r.c_status === "declined" } : null });
const SQL = "SELECT i.*, c.name AS c_name, c.status AS c_status, c.lead_id AS c_lead FROM books_intakes i JOIN clients c ON c.id = i.client_id";
const hist = (h: string, by: string, text: string) => JSON.stringify([{ at: now(), by, text }, ...json<unknown[]>(h, [])].slice(0, 200));
const MAX = 200_000;

async function client(env: AppEnv, a: Actor, id: string) {
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, id);
  if (!c || !(await canOpen(env, a, c))) throw notFound("Client not found.");
  return c;
}
async function row(env: AppEnv, a: Actor, id: string) {
  const r = await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id);
  if (!r) throw notFound("Intake not found.");
  await client(env, a, r.client_id);
  return r;
}

export async function listIntakes(env: AppEnv, a: Actor) {
  requirePermission(a, "books", "view");
  requireStaff(a);
  const rows = await all<Row>(env.DB, `${SQL} ORDER BY i.updated_at DESC`);
  const out: BooksIntake[] = [];
  for (const r of rows) { const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, r.client_id); if (c && (await canOpen(env, a, c))) out.push({ ...toIntake(r), link: await latestLink(env, "books_intake", r.id), proposalLink: await latestLink(env, "books_proposal", r.id) }); }
  return { intakes: out };
}

export async function getIntake(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "books", "view");
  const r = await row(env, a, id);
  return { intake: { ...toIntake(r), link: await latestLink(env, "books_intake", r.id), proposalLink: await latestLink(env, "books_proposal", r.id) } };
}

/** Starts an intake for a client (one open intake at a time). */
export async function createIntake(env: AppEnv, a: Actor, b: { clientId?: unknown }) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const clientId = typeof b.clientId === "string" ? b.clientId : "";
  const c = await client(env, a, clientId);
  const open = await one<{ id: string }>(env.DB, "SELECT id FROM books_intakes WHERE client_id = ? AND status = 'in_progress'", clientId);
  if (open) return { intake: toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, open.id))!) };
  const id = randomId("bki");
  const t = now();
  await run(env.DB, "INSERT INTO books_intakes (id, client_id, status, answers, history, created_at, created_by, updated_at) VALUES (?, ?, 'in_progress', '{}', ?, ?, ?, ?)", id, clientId, hist("[]", a.member.id, "Intake started"), t, a.member.id, t);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'staff', ?, ?)", randomId("x"), c.id, "Bookkeeping intake started", a.member.id, t);
  return { intake: toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id))!) };
}

const cleanAnswers = (v: unknown): Answers => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw badRequest("Invalid answers.");
  const text = JSON.stringify(v);
  if (text.length > MAX) throw new HttpError(413, "These answers are too large to save.");
  return v as Answers;
};

/** Saves progress (or staff edits after submission, which are logged). */
export async function saveIntake(env: AppEnv, a: Actor, id: string, b: { answers?: unknown; step?: unknown; rev?: unknown; workspaceId?: unknown }) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const r = await row(env, a, id);
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Someone else updated this intake. Reloading the latest version.", "conflict");
  const answers = b.answers !== undefined ? cleanAnswers(b.answers) : json<Answers>(r.answers, {});
  const step = Number.isInteger(b.step) ? Math.max(0, Math.min(40, Number(b.step))) : r.step;
  const ws = typeof b.workspaceId === "string" ? b.workspaceId.slice(0, 120) : r.workspace_id;
  // Only link a workspace that really exists for this client (never a pointer to nothing).
  if (ws && ws !== r.workspace_id && !(await one(env.DB, "SELECT 1 FROM books_workspaces WHERE id = ? AND client_id = ?", ws, r.client_id))) throw badRequest("That bookkeeping workspace wasn't saved. Start bookkeeping again.");
  const note = r.status === "submitted" && b.answers !== undefined && JSON.stringify(answers) !== r.answers ? "Answers updated by staff after submission" : ws !== r.workspace_id ? "Bookkeeping workspace started from this intake" : null;
  const res = await run(env.DB, "UPDATE books_intakes SET answers = ?, step = ?, workspace_id = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", JSON.stringify(answers), step, ws, note ? hist(r.history, a.member.id, note) : r.history, now(), id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Someone else updated this intake. Reloading the latest version.", "conflict");
  if (note) await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: note });
  return { intake: toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id))!) };
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });

type SubmitBody = { answers?: unknown; rev?: unknown; consentName?: unknown; engagement?: { version?: unknown; termsVersion?: unknown }; request?: unknown; enteredBy?: unknown; /** Drawn signature: data:image/png;base64,… */ signature?: unknown };


/** Who is submitting: staff in the CRM, or the client through their private link. */
type Submitter =
  | { kind: "staff"; a: Extract<Actor, { kind: "staff" }>; enteredBy: "client" | "staff" }
  | { kind: "link"; actor: LinkActor; sentBy: string };

/**
 * Submits the intake: engagement letter (bookkeeping letter + standard terms,
 * versions checked here), PDF copies to Documents, document requests, email, bell.
 */
export async function submitIntake(env: AppEnv, a: Actor, id: string, b: SubmitBody) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const r = await row(env, a, id);
  const c = await client(env, a, r.client_id);
  return completeSubmit(env, { kind: "staff", a, enteredBy: b.enteredBy === "client" ? "client" : "staff" }, r, c, b);
}

async function completeSubmit(env: AppEnv, who: Submitter, r: Row, c: ClientRow, b: SubmitBody) {
  const id = r.id;
  if (r.status === "submitted") throw badRequest("This intake was already submitted.");
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "This intake was updated somewhere else. Reloading the latest version.", "conflict");
  const answers = cleanAnswers(b.answers);
  const consent = typeof b.consentName === "string" ? b.consentName.trim().slice(0, 120) : "";
  if (consent.length < 2) throw badRequest(who.kind === "link" ? "Type your full name to sign and submit." : "Type the client's full name.");
  // The client's drawn signature confirming the answers (required) — kept privately and printed on the intake PDF.
  const sigPng = signatureFrom(b.signature);
  const t = now();
  const by = who.kind === "link" ? "client" : who.enteredBy;
  // Who did it, for the records: the staff member, or the client on their link (credited to nobody on staff).
  const staffId = who.kind === "staff" ? who.a.member.id : null;
  const histBy = staffId ?? "client (secure link)";
  const auditActor = who.kind === "staff" ? who.a : who.actor;
  // No price goes to the client now. The automatic quote becomes a draft for MKB's review;
  // the reviewed proposal and the engagement letter are sent for signature afterwards.
  const fees = await loadFees(env);
  const draft = proposalFromQuote(quoteFor(answers, fees.books), t);
  const sigKey = `clients/${c.id}/signatures/${id}-intake.png`;
  // Document names come from the answers on the server — not from the browser.
  const docs = docsFor(BOOKS_SECTIONS, answers).map((d) => d.name).slice(0, 60);
  const bizName = (typeof answers.legalName === "string" && answers.legalName.trim()) || c.name;

  const res = await run(env.DB, "UPDATE books_intakes SET status = 'submitted', answers = ?, consent_name = ?, entered_by = ?, submitted_at = ?, proposal = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ? AND status = 'in_progress'", JSON.stringify(answers), consent, by, t, JSON.stringify(draft), hist(r.history, histBy, `Submitted and signed by ${consent} (${who.kind === "link" ? "online through their secure link" : by === "client" ? "by the client" : "with staff"}) — ready for review`), t, id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "This intake was updated somewhere else. Reloading the latest version.", "conflict");
  await env.FILES.put(sigKey, sigPng, { httpMetadata: { contentType: "image/png" }, customMetadata: { intake: id, signedBy: consent, signedAt: t, sha256: await sha256Bytes(sigPng) } });
  // A submitted intake can't be opened by a link any more.
  if (who.kind === "staff") await run(env.DB, "UPDATE secure_links SET revoked_at = ?, revoked_by = ? WHERE purpose = 'books_intake' AND target_id = ? AND revoked_at IS NULL AND used_at IS NULL", t, `submitted:${who.a.member.id}`, id);

  // PDF copy of the answers (with the signature), saved to Documents.
  const pdf = await buildIntakePdf({ clientName: bizName, taxYear: new Date().getFullYear(), form: "1065", returnId: id, answers, submittedAt: t, enteredBy: by, consentName: consent, documents: docs, sections: BOOKS_SECTIONS, title: "Bookkeeping Intake", signaturePng: sigPng });
  const safe = bizName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const intakeFile = `MKB-Bookkeeping-Intake-${safe}.pdf`;
  await storeClientPdfAs(env, staffId, c.id, pdf, { name: `Bookkeeping intake (submitted ${longDate(t)})`, fileName: intakeFile, category: "Intake", service: "books", activity: "Saved a PDF copy of the signed bookkeeping intake to Documents" });

  // Request the documents (shown on the client's Documents tab as outstanding) — they can upload while MKB reviews.
  if (docs.length) {
    const cur = await one<{ module_data: string | null }>(env.DB, "SELECT module_data FROM clients WHERE id = ?", c.id);
    const md = json<Record<string, { name?: string; service?: string; status?: string }[]>>(cur?.module_data, {});
    const have = new Set((md.documents ?? []).filter((d) => d.service === "books").map((d) => d.name));
    const sensitive = new Set(docsFor(BOOKS_SECTIONS, answers).filter((d) => d.sensitive).map((d) => d.name));
    const add = docs.filter((n) => !have.has(n)).map((n) => ({ id: randomId("d"), name: n, service: "books", category: "Bookkeeping intake", status: "requested", sensitive: sensitive.has(n), requestedAt: t }));
    md.documents = [...add, ...(md.documents ?? [])];
    await run(env.DB, "UPDATE clients SET module_data = ?, rev = rev + 1, updated_at = ? WHERE id = ?", JSON.stringify(md), t, c.id);
  }

  let emailed = false;
  const to = (typeof answers.email === "string" && answers.email) || c.email;
  if (to) {
    const contact = ((answers.owners as { name?: string }[] | undefined)?.[0]?.name || c.contact_name || c.name).trim().split(/\s+/)[0];
    const out = await sendTemplate(env, "books_intake_received", { to, vars: { firstName: contact, businessName: bizName, date: longDate(t) }, documents: docs, attachments: [{ filename: intakeFile, content: pdf }] });
    emailed = out.sent;
  }
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, ?, ?, ?)", randomId("x"), c.id, `Bookkeeping intake submitted${who.kind === "link" ? " by the client (secure link)" : ""} — ${docs.length} document${docs.length === 1 ? "" : "s"} requested; waiting for MKB's price review`, by === "client" ? "client" : "staff", staffId, t);
  await notify(env, { module: "books", exceptId: staffId ?? undefined }, { kind: "intake", title: `${bizName} submitted their bookkeeping intake`, body: `Ready for review — check the price and send the proposal${who.kind === "link" ? " · completed online by the client" : ""}${answers.qboInvite === "I need help with this" ? " · needs help inviting MKB to QuickBooks" : answers.qboInvite === "I'll do it after this intake" ? " · QuickBooks invite not sent yet" : ""}`, href: `/services/bookkeeping/intake/${id}` });
  await audit(env.DB, auditActor, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: `Submitted${who.kind === "link" ? " through secure link" : ""}; signed (drawn); ${docs.length} documents requested${to ? (emailed ? "; emailed" : "; email queued") : ""}; proposal draft ${draft.plan} for review` });
  return { intake: toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id))!), documents: docs, emailed };
}

/* ---------------------------------------------------------------- full account numbers */
const SECURE_KEY = /^(accounts|loans)\.\d{1,2}\.(acct|routing)$/;
/** ABA routing number checksum. */
const validRouting = (d: string) => d.length === 9 && (3 * (+d[0] + +d[3] + +d[6]) + 7 * (+d[1] + +d[4] + +d[7]) + (+d[2] + +d[5] + +d[8])) % 10 === 0;

/** Stores a full account or routing number encrypted. Returns the last four (all the answers keep). */
export async function setIntakeSecure(env: AppEnv, a: Actor, id: string, b: { key?: unknown; value?: unknown }) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  await row(env, a, id);
  const key = typeof b.key === "string" ? b.key : "";
  if (!SECURE_KEY.test(key)) throw badRequest("Unknown answer.");
  const d = typeof b.value === "string" ? b.value.replace(/\D/g, "") : "";
  if (key.endsWith(".routing") ? !validRouting(d) : d.length < 4 || d.length > 17) throw badRequest(key.endsWith(".routing") ? "That routing number isn't valid — check the 9 digits." : "Enter the full account number (4 to 17 digits).");
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  const e = await encryptField(env.ENCRYPTION_KEY, d, `books_intake:${id}:${key}`);
  await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('books_intake', ?, ?, ?, ?, ?, ?, 'bank', ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, last4 = excluded.last4, updated_at = excluded.updated_at, updated_by = excluded.updated_by", id, key, e.ciphertext, e.iv, Number(env.ENCRYPTION_KEY_VERSION ?? 1), d.slice(-4), now(), a.member.id);
  await audit(env.DB, a, { action: "Permission change", resource: `Bookkeeping intake ${id} — ${key.endsWith(".routing") ? "routing" : "account"} number saved`, meta: "Value not logged" });
  return { last4: d.slice(-4) };
}

/** Shows a full number to staff with the bank-number permission (audited, rate-limited). */
export async function revealIntakeSecure(env: AppEnv, a: Actor, id: string, b: { key?: unknown }) {
  requirePermission(a, "books", "view");
  requireStaff(a);
  await row(env, a, id);
  const key = typeof b.key === "string" ? b.key : "";
  if (!SECURE_KEY.test(key)) throw badRequest("Unknown answer.");
  if (!hasSensitivePerm(a, "books.bank")) {
    await audit(env.DB, a, { action: "Sensitive reveal", resource: `Bookkeeping intake ${id} — ${key}`, meta: "Denied: needs the bank-number permission", success: false });
    throw new HttpError(403, "Revealing full account numbers needs the Bookkeeping bank-number permission.", "forbidden");
  }
  if (!(await rateLimit(env.DB, `reveal:${a.member.id}`, 60, 60))) throw new HttpError(429, "Too many reveals in the last hour.", "rate_limited");
  const v = await one<{ ciphertext: string; iv: string }>(env.DB, "SELECT ciphertext, iv FROM vault WHERE owner_type = 'books_intake' AND owner_id = ? AND field = ?", id, key);
  if (!v) throw notFound("Not on file.");
  const value = await decryptField(env.ENCRYPTION_KEY!, v, `books_intake:${id}:${key}`);
  await audit(env.DB, a, { action: "Sensitive reveal", resource: `Bookkeeping intake ${id} — ${key}` });
  return { value };
}

/* ================================================================ private intake link
 * Staff email the client a private link to fill in the intake themselves — no
 * portal login. The link is long and random, opens only this intake, expires
 * after 14 days, can be cancelled, and stops working once the intake is
 * submitted. Full EIN / bank numbers go straight to encrypted storage and are
 * never sent back to the link, not even to the client.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Where clients open links: the public website's domain when there is one (the CRM's own address is staff-only). */
export const linkOrigin = (env: AppEnv) => ((env.WEBSITE_HOSTS ?? "").trim() ? publicAssetOrigin(env) : env.APP_ORIGIN ?? "https://app.mkbfinancialgroup.com");

/** { email } — emails the client a private link (replacing any earlier link). */
export async function sendIntakeLink(env: AppEnv, a: Actor, id: string, b: { email?: unknown }) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const r = await row(env, a, id);
  if (r.status !== "in_progress") throw badRequest("This intake was already submitted.");
  const c = await client(env, a, r.client_id);
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 200) : "";
  if (!EMAIL_RE.test(email)) throw badRequest("Enter the client's email address.");
  if (!(await rateLimit(env.DB, `intakelink:${id}`, 10, 60))) throw new HttpError(429, "Too many links sent for this intake in the last hour.", "rate_limited");
  const { token, info } = await createLink(env, { purpose: "books_intake", targetId: id, clientId: c.id, email, memberId: a.member.id });
  const url = `${linkOrigin(env)}/i/${token}`;
  const answers = json<Answers>(r.answers, {});
  const bizName = (typeof answers.legalName === "string" && answers.legalName.trim()) || c.name;
  const firstName = ((answers.owners as { name?: string }[] | undefined)?.[0]?.name || c.contact_name || c.name).trim().split(/\s+/)[0];
  const out = await sendTemplate(env, "books_intake_link", { to: email, buttonUrl: url, vars: { firstName, businessName: bizName, expires: longDate(info.expiresAt), days: String(LINK_DAYS), staffName: a.member.name } });
  const t = now();
  const text = `Secure intake link emailed to ${email} (expires ${longDate(info.expiresAt)})${out.sent ? "" : " — email queued"}`;
  await run(env.DB, "UPDATE books_intakes SET history = ?, updated_at = ? WHERE id = ?", hist(r.history, a.member.id, text), t, id);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'staff', ?, ?)", randomId("x"), c.id, `Bookkeeping intake: ${text}`, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: `Secure link sent to ${email}; expires ${info.expiresAt}` });
  return { link: info, emailed: out.sent, url };
}

/** Cancels the intake's link (it stops working at once). */
export async function cancelIntakeLink(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const r = await row(env, a, id);
  const n = await cancelLinks(env, "books_intake", id, a.member.id);
  if (n) {
    const t = now();
    await run(env.DB, "UPDATE books_intakes SET history = ?, updated_at = ? WHERE id = ?", hist(r.history, a.member.id, "Secure intake link cancelled"), t, id);
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'staff', ?, ?)", randomId("x"), r.client_id, "Bookkeeping intake: secure link cancelled", a.member.id, t);
    await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: "Secure link cancelled" });
  }
  return { link: await latestLink(env, "books_intake", id), cancelled: n > 0 };
}

/* ---------------------------------------------------------------- the client's side (no sign-in) */
async function fromLink(env: AppEnv, token: string, ip: string, touch = false) {
  const l = await openLink(env, "books_intake", token, ip, { touch });
  const r = await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, l.targetId);
  if (!r || r.client_id !== l.clientId) throw new HttpError(404, "This link isn't valid.", "not_found");
  if (r.status !== "in_progress") throw new HttpError(410, "This form has already been submitted — thank you. If you need to change something, please contact MKB Financial Group.", "used");
  const actor: LinkActor = { kind: "link", ip, clientId: l.clientId, linkId: l.id };
  return { l, r, actor };
}

/** What the link shows: this intake's answers (numbers only as the last 4), the engagement letter and prices. */
export async function publicIntake(env: AppEnv, token: string, ip: string) {
  const { l, r, actor } = await fromLink(env, token, ip, true);
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, r.client_id);
  if (!c) throw new HttpError(404, "This link isn't valid.", "not_found");
  if (l.firstOpen) {
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'client', NULL, ?)", randomId("x"), c.id, "Client opened their bookkeeping intake link", now());
    await audit(env.DB, actor, { action: "Record update", resource: `Bookkeeping intake ${r.id}`, meta: "Secure link opened for the first time" });
  }
  const fees = await loadFees(env);
  const answers = json<Answers>(r.answers, {});
  const firstName = ((answers.owners as { name?: string }[] | undefined)?.[0]?.name || c.contact_name || c.name).trim().split(/\s+/)[0];
  // Only what the form needs — no prices, internal history, staff names, client id or vault data.
  return {
    intake: { status: r.status, answers, step: r.step, rev: r.rev, businessName: (typeof answers.legalName === "string" && answers.legalName.trim()) || c.name, firstName },
    expiresAt: l.expiresAt,
    addOnOptions: pickableAddOns(fees.books).map((x) => x.name),
  };
}

/** Saves the client's progress (same revision check as staff saves). */
export async function publicSaveIntake(env: AppEnv, token: string, ip: string, b: { answers?: unknown; step?: unknown; rev?: unknown }) {
  const { r } = await fromLink(env, token, ip);
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Your intake was updated somewhere else. We loaded the latest version.", "conflict");
  const answers = b.answers !== undefined ? cleanAnswers(b.answers) : json<Answers>(r.answers, {});
  const step = Number.isInteger(b.step) ? Math.max(0, Math.min(40, Number(b.step))) : r.step;
  const res = await run(env.DB, "UPDATE books_intakes SET answers = ?, step = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ? AND status = 'in_progress'", JSON.stringify(answers), step, now(), r.id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Your intake was updated somewhere else. We loaded the latest version.", "conflict");
  return { rev: r.rev + 1 };
}

/** EIN questions (outside repeating sections) — saved to the client's encrypted record, like staff entries. */
const EIN_KEYS = new Set(BOOKS_SECTIONS.filter((s) => !s.repeat).flatMap((s) => s.questions.filter((q) => q.type === "ein").map((q) => `${s.id}.${q.id}`)));

/** { key, value } — stores a full EIN or bank number encrypted. Returns only the last 4; nothing is ever read back. */
export async function publicSecureIntake(env: AppEnv, token: string, ip: string, b: { key?: unknown; value?: unknown }) {
  const { r, actor } = await fromLink(env, token, ip);
  if (!(await rateLimit(env.DB, `linksecure:${actor.linkId}`, 60, 60))) throw new HttpError(429, "Too many changes in the last hour. Please try again later.", "rate_limited");
  const key = typeof b.key === "string" ? b.key : "";
  const d = typeof b.value === "string" ? b.value.replace(/\D/g, "") : "";
  const t = now();
  if (EIN_KEYS.has(key)) {
    if (d.length !== 9) throw badRequest("Enter all 9 digits of the EIN.");
    const value = `${d.slice(0, 2)}-${d.slice(2)}`;
    const { key: k, version } = vaultKey(env);
    const e = await encryptField(k, value, aad(r.client_id, "ein"));
    await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, 'ein', ?, ?, ?, ?, NULL, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, last4 = excluded.last4, kind = excluded.kind, updated_at = excluded.updated_at, updated_by = excluded.updated_by", r.client_id, e.ciphertext, e.iv, version, d.slice(-4), t, `link:${actor.linkId}`);
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'client', NULL, ?)", randomId("x"), r.client_id, "Client entered their EIN through the secure intake link (stored encrypted)", t);
    await audit(env.DB, actor, { action: "Permission change", resource: `Client ${r.client_id} — EIN saved through secure intake link`, meta: "Value not logged" });
    return { last4: d.slice(-4) };
  }
  if (!SECURE_KEY.test(key)) throw badRequest("Unknown answer.");
  if (key.endsWith(".routing") ? !validRouting(d) : d.length < 4 || d.length > 17) throw badRequest(key.endsWith(".routing") ? "That routing number isn't valid — check the 9 digits." : "Enter the full account number (4 to 17 digits).");
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  const e = await encryptField(env.ENCRYPTION_KEY, d, `books_intake:${r.id}:${key}`);
  await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('books_intake', ?, ?, ?, ?, ?, ?, 'bank', ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, last4 = excluded.last4, updated_at = excluded.updated_at, updated_by = excluded.updated_by", r.id, key, e.ciphertext, e.iv, Number(env.ENCRYPTION_KEY_VERSION ?? 1), d.slice(-4), t, `link:${actor.linkId}`);
  await audit(env.DB, actor, { action: "Permission change", resource: `Bookkeeping intake ${r.id} — ${key.endsWith(".routing") ? "routing" : "account"} number saved through secure link`, meta: "Value not logged" });
  return { last4: d.slice(-4) };
}

/** Accepts the engagement letter and submits — then the link stops working. */
export async function publicSubmitIntake(env: AppEnv, token: string, ip: string, b: SubmitBody) {
  const { l, r, actor } = await fromLink(env, token, ip);
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, r.client_id);
  if (!c) throw new HttpError(404, "This link isn't valid.", "not_found");
  const out = await completeSubmit(env, { kind: "link", actor, sentBy: l.createdBy }, r, c, b);
  await useLink(env, l.id);
  // Only what the thank-you screen needs.
  return { submitted: true, documents: out.documents, emailed: out.emailed };
}

/* ================================================================ review → proposal → signature
 * After submission MKB reviews the price (starting from the automatic quote),
 * then emails the client a private link to the proposal and the engagement
 * letter, which they sign with a drawn signature. Raising (or lowering) the
 * price after it was sent or signed creates a new version that must be signed
 * again; the earlier signed letter stays in Documents.
 */
const BILLINGS: ProposalBilling[] = ["monthly", "one_time", "quote"];
const proposalOf = (r: Row) => (r.proposal ? json<Proposal | null>(r.proposal, null) : null);

function cleanProposal(b: { plan?: unknown; lines?: unknown; message?: unknown }, plans: string[]): Pick<Proposal, "plan" | "lines" | "message"> {
  const plan = typeof b.plan === "string" ? b.plan.trim() : "";
  if (!plans.includes(plan)) throw badRequest("Choose one of the bookkeeping plans.");
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 40) throw badRequest("Add the plan and any add-ons (up to 40 lines).");
  const lines: ProposalLine[] = b.lines.map((x, i) => {
    const l = (x ?? {}) as Record<string, unknown>;
    const label = typeof l.label === "string" ? l.label.trim().slice(0, 140) : "";
    const billing = BILLINGS.includes(l.billing as ProposalBilling) ? (l.billing as ProposalBilling) : null;
    const amount = billing === "quote" ? 0 : Math.round(Number(l.amount) * 100) / 100;
    if (!label) throw badRequest(`Line ${i + 1} needs a description.`);
    if (!billing) throw badRequest(`Line ${i + 1}: choose monthly, one-time or custom quote.`);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) throw badRequest(`Line ${i + 1}: enter an amount between $0 and $1,000,000.`);
    return { id: typeof l.id === "string" && /^[\w-]{1,40}$/.test(l.id) ? l.id : randomId("pl"), label, billing, amount, startingAt: l.startingAt === true || undefined };
  });
  if (!lines.some((l) => l.billing === "monthly" && l.amount > 0)) throw badRequest("The proposal needs a monthly price.");
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 1500) : "";
  return { plan, lines, message: message || undefined };
}
const sameTerms = (x: Pick<Proposal, "plan" | "lines" | "message">, y: Pick<Proposal, "plan" | "lines" | "message">) => JSON.stringify([x.plan, x.lines.map((l) => [l.label, l.billing, l.amount, !!l.startingAt]), x.message ?? ""]) === JSON.stringify([y.plan, y.lines.map((l) => [l.label, l.billing, l.amount, !!l.startingAt]), y.message ?? ""]);

/** { plan, lines, message, rev } — saves MKB's reviewed price. Changing a sent or signed proposal starts a new version. */
export async function saveProposal(env: AppEnv, a: Actor, id: string, b: { plan?: unknown; lines?: unknown; message?: unknown; rev?: unknown }) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const r = await row(env, a, id);
  if (r.status !== "submitted") throw badRequest("The client needs to submit the intake first.");
  if (r.workspace_id) throw badRequest("Bookkeeping has already started from this intake — change the plan in the workspace.");
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Someone else updated this intake. Reloading the latest version.", "conflict");
  const fees = await loadFees(env);
  const next = cleanProposal(b, fees.books.plans.map((p) => p.key));
  const cur = proposalOf(r) ?? proposalFromQuote(quoteFor(json<Answers>(r.answers, {}), fees.books), now());
  if (sameTerms(cur, next)) return { intake: { ...toIntake(r), proposalLink: await latestLink(env, "books_proposal", id) }, unchanged: true };
  const t = now();
  const t0 = proposalTotals(cur), t1 = proposalTotals({ lines: next.lines });
  let p: Proposal;
  let note: string;
  if (cur.status === "draft") {
    p = { ...cur, ...next, updatedAt: t, updatedBy: a.member.id };
    note = `Price reviewed: ${next.plan}, ${money(t1.monthly)}/month${t1.oneTime ? ` + ${money(t1.oneTime)} one-time` : ""}`;
  } else {
    // A sent or signed proposal changed: new version, the client must sign again.
    const previous = cur.status === "signed" && cur.signedAt ? [...(cur.previous ?? []), { version: cur.version, signedAt: cur.signedAt, signedName: cur.signedName ?? "", monthlyTotal: t0.monthly, oneTimeTotal: t0.oneTime }] : cur.previous;
    p = { version: cur.version + 1, status: "draft", ...next, suggested: cur.suggested, updatedAt: t, updatedBy: a.member.id, previous };
    note = `Proposal revised to version ${p.version} (${money(t0.monthly)} → ${money(t1.monthly)}/month)${cur.status === "signed" ? " — the client must sign the new version" : ""}`;
    await cancelLinks(env, "books_proposal", id, a.member.id);
  }
  const res = await run(env.DB, "UPDATE books_intakes SET proposal = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", JSON.stringify(p), hist(r.history, a.member.id, note), t, id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Someone else updated this intake. Reloading the latest version.", "conflict");
  await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: note });
  return { intake: { ...toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id))!), proposalLink: await latestLink(env, "books_proposal", id) } };
}

/** { email } — emails the client a private link to the reviewed proposal and the engagement letter to sign. */
export async function sendProposal(env: AppEnv, a: Actor, id: string, b: { email?: unknown }) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const r = await row(env, a, id);
  const p = proposalOf(r);
  if (r.status !== "submitted" || !p) throw badRequest("Review the price before sending the proposal.");
  if (p.status === "signed") throw badRequest("The client already signed this proposal. Change the price to send a new version.");
  if (!p.updatedBy) throw badRequest("Review the price and save it before sending — the automatic quote is only a starting point.");
  const c = await client(env, a, r.client_id);
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 200) : "";
  if (!EMAIL_RE.test(email)) throw badRequest("Enter the client's email address.");
  if (!(await rateLimit(env.DB, `proposallink:${id}`, 10, 60))) throw new HttpError(429, "Too many proposals sent for this intake in the last hour.", "rate_limited");
  const { token, info } = await createLink(env, { purpose: "books_proposal", targetId: id, clientId: c.id, email, memberId: a.member.id });
  const url = `${linkOrigin(env)}/i/p/${token}`;
  const answers = json<Answers>(r.answers, {});
  const bizName = (typeof answers.legalName === "string" && answers.legalName.trim()) || c.name;
  const firstName = ((answers.owners as { name?: string }[] | undefined)?.[0]?.name || c.contact_name || c.name).trim().split(/\s+/)[0];
  const out = await sendTemplate(env, "books_proposal", { to: email, buttonUrl: url, vars: { firstName, businessName: bizName, expires: longDate(info.expiresAt), staffName: a.member.name } });
  const t = now();
  const next: Proposal = { ...p, status: "sent", sentAt: t, sentTo: email };
  const text = `Proposal v${p.version} and engagement letter emailed to ${email} for signature${out.sent ? "" : " — email queued"}`;
  await run(env.DB, "UPDATE books_intakes SET proposal = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(next), hist(r.history, a.member.id, text), t, id);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'staff', ?, ?)", randomId("x"), c.id, `Bookkeeping: ${text}`, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: `Proposal v${p.version} sent to ${email}; ${money(proposalTotals(p).monthly)}/month` });
  return { intake: { ...toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id))!), proposalLink: info }, emailed: out.sent, url };
}

/** Cancels the proposal link (it stops working). The proposal goes back to draft. */
export async function cancelProposalLink(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const r = await row(env, a, id);
  const n = await cancelLinks(env, "books_proposal", id, a.member.id);
  const p = proposalOf(r);
  if (p?.status === "sent") {
    await run(env.DB, "UPDATE books_intakes SET proposal = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify({ ...p, status: "draft" }), hist(r.history, a.member.id, "Proposal link cancelled"), now(), id);
    await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: "Proposal link cancelled" });
  }
  return { cancelled: n > 0, intake: { ...toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id))!), proposalLink: await latestLink(env, "books_proposal", id) } };
}

async function fromProposalLink(env: AppEnv, token: string, ip: string, touch = false) {
  const l = await openLink(env, "books_proposal", token, ip, { touch });
  const r = await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, l.targetId);
  const p = r ? proposalOf(r) : null;
  if (!r || r.client_id !== l.clientId || !p) throw new HttpError(404, "This link isn't valid.", "not_found");
  if (p.status === "signed") throw new HttpError(410, "This proposal is already signed — thank you. A copy was emailed to you.", "used");
  if (p.status !== "sent") throw new HttpError(410, "This proposal is being updated. MKB Financial Group will send you the new version.", "cancelled");
  const actor: LinkActor = { kind: "link", ip, clientId: l.clientId, linkId: l.id };
  return { l, r, p, actor };
}

/** What the proposal link shows: the reviewed price and the engagement letter (filled in with it). */
export async function publicProposal(env: AppEnv, token: string, ip: string) {
  const { l, r, p, actor } = await fromProposalLink(env, token, ip, true);
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, r.client_id);
  if (!c) throw new HttpError(404, "This link isn't valid.", "not_found");
  if (l.firstOpen) {
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'client', NULL, ?)", randomId("x"), c.id, "Client opened their bookkeeping proposal", now());
    await audit(env.DB, actor, { action: "Record update", resource: `Bookkeeping intake ${r.id}`, meta: "Proposal link opened for the first time" });
  }
  const [letters, fees] = await Promise.all([currentLetters(env), loadFees(env)]);
  const answers = json<Answers>(r.answers, {});
  const bizName = (typeof answers.legalName === "string" && answers.legalName.trim()) || c.name;
  const firstName = ((answers.owners as { name?: string }[] | undefined)?.[0]?.name || c.contact_name || c.name).trim().split(/\s+/)[0];
  const plan = fees.books.plans.find((x) => x.key === p.plan);
  const vars = { ...feeWords(fees), clientName: bizName, date: longDate(now()), taxYear: "", ...proposalLetterVars(p, plan?.includes ?? []) };
  return {
    businessName: bizName, firstName, expiresAt: l.expiresAt,
    proposal: { version: p.version, plan: p.plan, lines: p.lines.map(({ label, billing, amount, startingAt }) => ({ label, billing, amount, startingAt })), message: p.message, planIncludes: plan?.includes ?? [] },
    letters: { books: { ...letters.books, title: fillLetter(letters.books.title, vars), body: fillLetter(letters.books.body, vars) }, terms: { ...letters.terms, title: fillLetter(letters.terms.title, vars), body: fillLetter(letters.terms.body, vars) } },
  };
}

/** { name, signature, version, engagement: { version, termsVersion } } — the client signs the proposal and engagement letter. */
export async function publicSignProposal(env: AppEnv, token: string, ip: string, b: { name?: unknown; signature?: unknown; version?: unknown; engagement?: { version?: unknown; termsVersion?: unknown } }) {
  const { l, r, p, actor } = await fromProposalLink(env, token, ip);
  if (Number(b.version) !== p.version) throw new HttpError(409, "MKB updated this proposal. Please reload to see the latest version.", "conflict");
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  if (name.length < 2) throw badRequest("Type your full name to sign.");
  const sigPng = signatureFrom(b.signature);
  const [lt, terms] = await Promise.all([letterVersion(env, "books", Number(b.engagement?.version)), letterVersion(env, "terms", Number(b.engagement?.termsVersion))]);
  if (!lt || !terms) throw new HttpError(409, "The engagement letter was updated. Please reload to see the latest version.", "conflict");
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, r.client_id);
  if (!c) throw new HttpError(404, "This link isn't valid.", "not_found");
  const t = now();
  const fees = await loadFees(env);
  const answers = json<Answers>(r.answers, {});
  const bizName = (typeof answers.legalName === "string" && answers.legalName.trim()) || c.name;
  const plan = fees.books.plans.find((x) => x.key === p.plan);
  const vars = { ...feeWords(fees), clientName: bizName, date: longDate(t), taxYear: "", ...proposalLetterVars(p, plan?.includes ?? []) };
  const sigKey = `clients/${c.id}/signatures/${r.id}-proposal-v${p.version}.png`;
  const signed: Proposal = { ...p, status: "signed", signedAt: t, signedName: name, signature: { key: sigKey, sha256: await sha256Bytes(sigPng), bytes: sigPng.length }, letter: { version: lt.version, termsVersion: terms.version } };
  const engagement = { version: lt.version, termsVersion: terms.version, acceptedName: name, acceptedAt: t, method: "online", signature: signed.signature, proposalVersion: p.version };
  const res = await run(env.DB, "UPDATE books_intakes SET proposal = ?, engagement = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND proposal = ?", JSON.stringify(signed), JSON.stringify(engagement), hist(r.history, "client (secure link)", `Proposal v${p.version} and engagement letter signed by ${name} (drawn signature)`), t, r.id, r.proposal);
  if (!res.meta.changes) throw new HttpError(409, "MKB updated this proposal. Please reload to see the latest version.", "conflict");
  await env.FILES.put(sigKey, sigPng, { httpMetadata: { contentType: "image/png" }, customMetadata: { intake: r.id, proposalVersion: String(p.version), signedBy: name, signedAt: t } });
  await useLink(env, l.id);
  // Signed letter: the reviewed proposal, the bookkeeping letter and the standard terms, with the signature.
  const letterPdf = await buildLetterPdf({ clientName: bizName, parts: [{ title: `Your bookkeeping proposal — ${p.plan}`, body: proposalAsText(p), version: p.version }, { title: fillLetter(lt.title, vars), body: fillLetter(lt.body, vars), version: lt.version }, { title: fillLetter(terms.title, vars), body: fillLetter(terms.body, vars), version: terms.version }], acceptedName: name, acceptedAt: t, method: "online", signaturePng: sigPng });
  const safe = bizName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const letterFile = `MKB-Bookkeeping-Engagement-Letter-${safe}${p.version > 1 ? `-v${p.version}` : ""}.pdf`;
  await storeClientPdfAs(env, null, c.id, letterPdf, { name: `Bookkeeping proposal & engagement letter${p.version > 1 ? ` v${p.version}` : ""} (signed ${longDate(t)})`, fileName: letterFile, category: "Engagement letter", service: "books", activity: `Bookkeeping proposal v${p.version} and engagement letter signed by ${name} online` });
  const to = l.email || (typeof answers.email === "string" && answers.email) || c.email;
  let emailed = false;
  if (to) {
    const tt = proposalTotals(p);
    const out = await sendTemplate(env, "books_proposal_signed", { to, vars: { firstName: name.split(/\s+/)[0], businessName: bizName, date: longDate(t), plan: `${p.plan} — ${tt.startingAt ? "starting at " : ""}${money(tt.monthly)}/month${tt.oneTime ? ` plus ${money(tt.oneTime)} one-time` : ""}` }, attachments: [{ filename: letterFile, content: letterPdf }] });
    emailed = out.sent;
  }
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'client', NULL, ?)", randomId("x"), c.id, `Signed the bookkeeping proposal (${p.plan}) and engagement letter online`, t);
  await notify(env, { module: "books" }, { kind: "intake", title: `${bizName} signed their bookkeeping proposal`, body: `${p.plan} · ${money(proposalTotals(p).monthly)}/month — ready to start bookkeeping`, href: `/services/bookkeeping/intake/${r.id}` });
  await audit(env.DB, actor, { action: "Record update", resource: `Bookkeeping intake ${r.id}`, meta: `Proposal v${p.version} + engagement letter v${lt.version} signed (drawn) by ${name}${emailed ? "; copy emailed" : ""}` });
  return { signed: true, emailed };
}

/** A client's (or prospect's) intakes with their link status — for the lead page. */
export async function intakesForClient(env: AppEnv, a: Actor, clientId: string) {
  requirePermission(a, "books", "view");
  const rows = await all<Row>(env.DB, `${SQL} WHERE i.client_id = ? ORDER BY i.created_at DESC`, clientId);
  const out: BooksIntake[] = [];
  for (const r of rows) out.push({ ...toIntake(r), link: await latestLink(env, "books_intake", r.id), proposalLink: await latestLink(env, "books_proposal", r.id) });
  return out;
}
