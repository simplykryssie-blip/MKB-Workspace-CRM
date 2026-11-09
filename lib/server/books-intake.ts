/**
 * Bookkeeping intake — server side. Saved with the revision it started from;
 * submitting stores the PDF copy and signed engagement letter in Documents,
 * requests the documents the answers call for, emails the client and alerts
 * the bookkeeping team. Server-only.
 */
import { BOOKS_SECTIONS, recommendPlan } from "@/lib/books/intake";
import { fillLetter } from "@/lib/engagement/letters";
import { feeWords, money } from "@/lib/fees/config";
import { docsFor, type Answers } from "@/lib/tax/interview/engine";
import { all, badRequest, HttpError, json, notFound, now, one, run, type AppEnv } from "./core";
import { decryptField, encryptField, randomId } from "./crypto";
import { hasSensitivePerm } from "./identity";
import { rateLimit } from "./core";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { sendTemplate } from "./email";
import { letterVersion } from "./engagement";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";
import { buildIntakePdf, buildLetterPdf } from "./intake-pdf";
import { notify } from "./notifications";
import { loadFees } from "./settings";
import { storeClientPdf } from "./tax";

type Row = { id: string; client_id: string; status: "in_progress" | "submitted"; answers: string; step: number; entered_by: string; consent_name: string | null; engagement: string | null; submitted_at: string | null; workspace_id: string | null; history: string; created_at: string; updated_at: string; rev: number; c_name?: string };
export type BooksIntake = { id: string; clientId: string; clientName: string; status: Row["status"]; answers: Answers; step: number; enteredBy: string; consentName?: string; engagement?: { version: number; termsVersion: number; acceptedName: string; acceptedAt: string; method: string }; submittedAt?: string; workspaceId?: string; history: { at: string; by: string; text: string }[]; createdAt: string; updatedAt: string; rev: number };
const toIntake = (r: Row): BooksIntake => ({ id: r.id, clientId: r.client_id, clientName: r.c_name ?? "", status: r.status, answers: json(r.answers, {}), step: r.step, enteredBy: r.entered_by, consentName: r.consent_name ?? undefined, engagement: r.engagement ? json(r.engagement, undefined) : undefined, submittedAt: r.submitted_at ?? undefined, workspaceId: r.workspace_id ?? undefined, history: json(r.history, []), createdAt: r.created_at, updatedAt: r.updated_at, rev: r.rev });
const SQL = "SELECT i.*, c.name AS c_name FROM books_intakes i JOIN clients c ON c.id = i.client_id";
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
  for (const r of rows) { const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, r.client_id); if (c && (await canOpen(env, a, c))) out.push(toIntake(r)); }
  return { intakes: out };
}

export async function getIntake(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "books", "view");
  return { intake: toIntake(await row(env, a, id)) };
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
  const note = r.status === "submitted" && b.answers !== undefined && JSON.stringify(answers) !== r.answers ? "Answers updated by staff after submission" : ws !== r.workspace_id ? "Bookkeeping workspace started from this intake" : null;
  const res = await run(env.DB, "UPDATE books_intakes SET answers = ?, step = ?, workspace_id = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", JSON.stringify(answers), step, ws, note ? hist(r.history, a.member.id, note) : r.history, now(), id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Someone else updated this intake. Reloading the latest version.", "conflict");
  if (note) await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: note });
  return { intake: toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id))!) };
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });

/**
 * Submits the intake: engagement letter (bookkeeping letter + standard terms,
 * versions checked here), PDF copies to Documents, document requests, email, bell.
 */
export async function submitIntake(env: AppEnv, a: Actor, id: string, b: { answers?: unknown; rev?: unknown; consentName?: unknown; engagement?: { version?: unknown; termsVersion?: unknown }; request?: unknown; enteredBy?: unknown }) {
  requirePermission(a, "books", "edit");
  requireStaff(a);
  const r = await row(env, a, id);
  if (r.status === "submitted") throw badRequest("This intake was already submitted.");
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Someone else updated this intake. Reloading the latest version.", "conflict");
  const answers = cleanAnswers(b.answers);
  const consent = typeof b.consentName === "string" ? b.consentName.trim().slice(0, 120) : "";
  if (consent.length < 2) throw badRequest("Type the client's full name to confirm and accept.");
  const [l, terms] = await Promise.all([letterVersion(env, "books", Number(b.engagement?.version)), letterVersion(env, "terms", Number(b.engagement?.termsVersion))]);
  if (!l || !terms) throw badRequest("Accept the bookkeeping engagement letter to submit.");
  const c = await client(env, a, r.client_id);
  const fees = await loadFees(env);
  const plan = recommendPlan(answers, fees.books.plans);
  const t = now();
  const by = b.enteredBy === "client" ? "client" : "staff";
  const engagement = { version: l.version, termsVersion: terms.version, acceptedName: consent, acceptedAt: t, method: by === "client" ? "online" : "in_office" };
  // Document names come from the answers on the server — not from the browser.
  const docs = docsFor(BOOKS_SECTIONS, answers).map((d) => d.name).slice(0, 60);
  const bizName = (typeof answers.legalName === "string" && answers.legalName.trim()) || c.name;

  const res = await run(env.DB, "UPDATE books_intakes SET status = 'submitted', answers = ?, consent_name = ?, engagement = ?, entered_by = ?, submitted_at = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ? AND status = 'in_progress'", JSON.stringify(answers), consent, JSON.stringify(engagement), by, t, hist(r.history, a.member.id, `Submitted (${by === "client" ? "by the client" : "with staff"})`), t, id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Someone else updated this intake. Reloading the latest version.", "conflict");

  // PDF copy of the answers and the signed engagement letter, saved to Documents.
  const pdf = await buildIntakePdf({ clientName: bizName, taxYear: new Date().getFullYear(), form: "1065", returnId: id, answers, submittedAt: t, enteredBy: by, consentName: consent, documents: docs, sections: BOOKS_SECTIONS, title: "Bookkeeping Intake", engagement: { title: l.title, version: l.version, acceptedName: consent, acceptedAt: t } });
  const safe = bizName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const intakeFile = `MKB-Bookkeeping-Intake-${safe}.pdf`;
  await storeClientPdf(env, a, c.id, pdf, { name: `Bookkeeping intake (submitted ${longDate(t)})`, fileName: intakeFile, category: "Intake", service: "books", activity: "Saved a PDF copy of the bookkeeping intake to Documents" });
  const vars = { ...feeWords(fees), clientName: bizName, date: longDate(t), service: plan.key, fee: money(plan.fee), taxYear: "" };
  const letterPdf = await buildLetterPdf({ clientName: bizName, parts: [{ title: fillLetter(l.title, vars), body: fillLetter(l.body, vars), version: l.version }, { title: fillLetter(terms.title, vars), body: fillLetter(terms.body, vars), version: terms.version }], acceptedName: consent, acceptedAt: t, method: engagement.method as "online" | "in_office" });
  const letterFile = `MKB-Bookkeeping-Engagement-Letter-${safe}.pdf`;
  await storeClientPdf(env, a, c.id, letterPdf, { name: `Bookkeeping engagement letter (accepted ${longDate(t)})`, fileName: letterFile, category: "Engagement letter", service: "books", activity: `Bookkeeping engagement letter accepted by ${consent}` });

  // Request the documents (shown on the client's Documents tab as outstanding).
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
    const out = await sendTemplate(env, "books_intake_received", { to, vars: { firstName: contact, businessName: bizName, date: longDate(t), plan: `${plan.key} (${money(plan.fee)}/month)` }, documents: docs, attachments: [{ filename: intakeFile, content: pdf }, { filename: letterFile, content: letterPdf }] });
    emailed = out.sent;
  }
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, ?, ?, ?)", randomId("x"), c.id, `Bookkeeping intake submitted — ${docs.length} document${docs.length === 1 ? "" : "s"} requested; recommended plan ${plan.key}`, by === "client" ? "client" : "staff", a.member.id, t);
  await notify(env, { module: "books", exceptId: a.member.id }, { kind: "intake", title: `${bizName} submitted their bookkeeping intake`, body: `Recommended plan: ${plan.key}`, href: `/services/bookkeeping?intake=${id}` });
  await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping intake ${id}`, meta: `Submitted; engagement letter v${l.version} accepted; ${docs.length} documents requested${to ? (emailed ? "; emailed" : "; email queued") : ""}` });
  return { intake: toIntake((await one<Row>(env.DB, `${SQL} WHERE i.id = ?`, id))!), plan, documents: docs, emailed };
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
