/**
 * Tax interview by private link — the same secure links as the bookkeeping
 * intake (`/i/t/<token>`): the client (or a lead, before they're a client)
 * fills in the guided interview, signs the tax engagement letter if it isn't
 * signed yet, and submits with a drawn signature. Submitting does on the
 * server what the in-office screen does: builds the document checklist and
 * requests the documents, sets the filing status, moves the return to
 * "Awaiting Documents", saves the signed PDFs, emails the client and rings
 * the tax team's bell. Server-only.
 */
import { DEFAULT_SERVICE_FEES, feeWords } from "@/lib/fees/config";
import { fillLetter, taxLetterFor } from "@/lib/engagement/letters";
import { docsFor, type Answers } from "@/lib/tax/interview/engine";
import { impliedFilingStatus, sectionsFor } from "@/lib/tax/interview/questions";
import { applyPrefill } from "@/lib/tax/interview/prefill";
import { STAGES } from "@/lib/sample/clients";
import type { ChecklistItem, TaxReturn } from "@/lib/tax/config";
import { all, badRequest, HttpError, json, now, one, rateLimit, run, type AppEnv } from "./core";
import { encryptField, randomId } from "./crypto";
import { audit, requirePermission, requireStaff, type Actor, type LinkActor } from "./identity";
import { cancelLinks, createLink, latestLink, openLink, useLink } from "./secure-links";
import { linkOrigin } from "./books-intake";
import { currentLetters, letterVersion } from "./engagement";
import { loadFees } from "./settings";
import { sendTemplate, nextStop } from "./email";
import { notify } from "./notifications";
import { buildIntakePdf, buildLetterPdf } from "./intake-pdf";
import { applyInterviewToProfile, storeClientPdfAs, loadReturn, toReturn, type TaxRow } from "./tax";
import { sha256Bytes, signatureFrom } from "./signature";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });
const act = (kind: string, text: string, actor: "client" | "staff" | "system", at = now()) => ({ id: randomId("x"), kind, text, at, actor });
type ClientBits = { id: string; type: "individual" | "business"; name: string; contact_name: string | null; email: string; phone: string; address: string; business: string | null; status: string };
const firstOf = (c: Pick<ClientBits, "name" | "contact_name">) => (c.contact_name || c.name).trim().split(/\s+/)[0];

/* ---------------------------------------------------------------- staff */
/** { email } — emails the client a private link to this return's interview (replacing any earlier link). */
export async function sendTaxInterviewLink(env: AppEnv, a: Actor, id: string, b: { email?: unknown }) {
  requirePermission(a, "tax", "edit");
  requireStaff(a);
  const r = await loadReturn(env, a, id);
  if (r.form === "990") throw badRequest("The nonprofit (990) interview isn't built yet.");
  if (r.organizer.status === "submitted" || r.organizer.status === "reviewed") throw badRequest("This interview was already submitted.");
  const c = (await one<ClientBits>(env.DB, "SELECT id, type, name, contact_name, email, phone, address, business, status FROM clients WHERE id = ?", r.clientId))!;
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().toLowerCase().slice(0, 200) : c.email.toLowerCase();
  if (!EMAIL_RE.test(email)) throw badRequest("Enter the client's email address.");
  if (!(await rateLimit(env.DB, `taxlink:${id}`, 10, 60))) throw new HttpError(429, "Too many links sent for this return in the last hour.", "rate_limited");
  const { token, info } = await createLink(env, { purpose: "tax_interview", targetId: id, clientId: c.id, email, memberId: a.member.id });
  const url = `${linkOrigin(env)}/i/t/${token}`;
  const out = await sendTemplate(env, "tax_interview_link", { to: email, buttonUrl: url, vars: { firstName: firstOf(c), taxYear: String(r.taxYear), expires: longDate(info.expiresAt), staffName: a.member.name } });
  const t = now();
  const organizer = { ...r.organizer, status: r.organizer.status === "not_sent" ? "sent" : r.organizer.status, sentAt: r.organizer.sentAt ?? t };
  const text = `Interview link emailed to ${email} (expires ${longDate(info.expiresAt)})${out.sent ? "" : " — email queued"}`;
  await run(env.DB, "UPDATE tax_returns SET organizer = ?, activity = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(organizer), JSON.stringify([...(r.activity ?? []), act("intake", text, "staff", t)]), t, id);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'staff', ?, ?)", randomId("x"), c.id, `${r.taxYear} tax interview: ${text}`, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `Tax return ${id}`, department: "tax", meta: `Interview link sent to ${email}` });
  return { link: info, url, emailed: out.sent };
}

export async function cancelTaxInterviewLink(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "tax", "edit");
  requireStaff(a);
  await loadReturn(env, a, id);
  const n = await cancelLinks(env, "tax_interview", id, a.member.id);
  if (n) await audit(env.DB, a, { action: "Record update", resource: `Tax return ${id}`, department: "tax", meta: "Interview link cancelled" });
  return { cancelled: n > 0, link: await latestLink(env, "tax_interview", id) };
}

export async function taxInterviewLinkStatus(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "tax", "view");
  requireStaff(a);
  await loadReturn(env, a, id);
  return { link: await latestLink(env, "tax_interview", id) };
}

/* ---------------------------------------------------------------- the client's side (no sign-in) */
async function fromLink(env: AppEnv, token: string, ip: string, touch = false) {
  const l = await openLink(env, "tax_interview", token, ip, { touch });
  const row = await one<TaxRow>(env.DB, "SELECT * FROM tax_returns WHERE id = ?", l.targetId);
  if (!row || row.client_id !== l.clientId) throw new HttpError(404, "This link isn't valid.", "not_found");
  const r = toReturn(row);
  if (r.organizer.status === "submitted" || r.organizer.status === "reviewed") throw new HttpError(410, "This interview has already been submitted — thank you. If you need to change something, please contact MKB Financial Group.", "used");
  const c = await one<ClientBits>(env.DB, "SELECT id, type, name, contact_name, email, phone, address, business, status FROM clients WHERE id = ?", r.clientId);
  if (!c) throw new HttpError(404, "This link isn't valid.", "not_found");
  const actor: LinkActor = { kind: "link", ip, clientId: c.id, linkId: l.id };
  return { l, r, c, actor };
}

/** What the profile already knows (asked once): name, contact, address, business — and only the last 4 of tax IDs. */
async function prefillFor(env: AppEnv, c: ClientBits) {
  const addr = json<Record<string, string>>(c.address, {});
  const biz = json<Record<string, string>>(c.business, {});
  const l4 = Object.fromEntries((await all<{ field: string; last4: string | null }>(env.DB, "SELECT field, last4 FROM vault WHERE owner_type = 'client' AND owner_id = ?", c.id)).map((x) => [x.field, x.last4 ?? ""]));
  const [first, ...rest] = (c.type === "individual" ? c.name : c.contact_name ?? "").split(" ");
  return {
    firstName: c.type === "individual" ? first : undefined, lastName: c.type === "individual" ? rest.join(" ") : undefined,
    taxId: l4.tax_id ? `•••-••-${l4.tax_id}` : undefined, phone: c.phone || undefined, email: c.email || undefined,
    street: [addr.line1, addr.line2].filter(Boolean).join(", ") || undefined, city: addr.city || undefined, state: addr.state || undefined, zip: addr.zip || undefined,
    bizName: biz.legalName || undefined, ein: l4.ein ? `••-•••${l4.ein}` : undefined, formed: biz.formedAt || undefined, bizState: biz.state || addr.state || undefined, activity: biz.industry || undefined,
  };
}

/** The interview, what the profile already answered, and the engagement letter if it isn't signed yet. */
export async function publicTaxInterview(env: AppEnv, token: string, ip: string) {
  const { l, r, c, actor } = await fromLink(env, token, ip, true);
  if (l.firstOpen) {
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'client', NULL, ?)", randomId("x"), c.id, `Opened their ${r.taxYear} tax interview link`, now());
    await audit(env.DB, actor, { action: "Record update", resource: `Tax return ${r.id}`, department: "tax", meta: "Interview link opened for the first time" });
  }
  const sections = sectionsFor(r.form);
  const saved = r.organizer.interview?.answers ?? {};
  const { answers, ids } = applyPrefill(sections, { ...saved }, await prefillFor(env, c));
  let letter = null;
  if (!r.organizer.engagement) {
    const [letters, fees] = await Promise.all([currentLetters(env), loadFees(env).catch(() => DEFAULT_SERVICE_FEES)]);
    const key = taxLetterFor(r.kind);
    const vars = { ...feeWords(fees), clientName: c.name, date: longDate(now()), taxYear: String(r.taxYear), service: "", fee: "" };
    letter = { key, service: { title: fillLetter(letters[key].title, vars), body: fillLetter(letters[key].body, vars), version: letters[key].version }, terms: { title: fillLetter(letters.terms.title, vars), body: fillLetter(letters.terms.body, vars), version: letters.terms.version } };
  }
  return { taxYear: r.taxYear, form: r.form, kind: r.kind, name: c.name, firstName: firstOf(c), expiresAt: l.expiresAt, answers, prefilled: [...ids], rev: r.rev, letter };
}

export async function publicSaveTaxInterview(env: AppEnv, token: string, ip: string, b: { answers?: unknown; rev?: unknown }) {
  const { r } = await fromLink(env, token, ip);
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Your interview was updated somewhere else. We loaded the latest version.", "conflict");
  const answers = cleanAnswers(b.answers);
  const t = now();
  const organizer = { ...r.organizer, status: "in_progress" as const, interview: { ...(r.organizer.interview ?? {}), answers, updatedAt: t, enteredBy: "client" as const } };
  const res = await run(env.DB, "UPDATE tax_returns SET organizer = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", JSON.stringify(organizer), t, r.id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Your interview was updated somewhere else. We loaded the latest version.", "conflict");
  return { rev: r.rev + 1 };
}

const cleanAnswers = (v: unknown): Answers => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw badRequest("Invalid answers.");
  if (JSON.stringify(v).length > 250_000) throw new HttpError(413, "These answers are too large to save.");
  const out = { ...(v as Answers) };
  delete out.__form; delete out.__year;
  return out;
};

/** { key, kind, value } — a full SSN/EIN/bank number, encrypted. Returns only the last 4; nothing is read back. */
export async function publicSecureTaxInterview(env: AppEnv, token: string, ip: string, b: { key?: unknown; kind?: unknown; value?: unknown }) {
  const { r, actor } = await fromLink(env, token, ip);
  if (!(await rateLimit(env.DB, `linksecure:${actor.linkId}`, 60, 60))) throw new HttpError(429, "Too many changes in the last hour. Please try again later.", "rate_limited");
  const key = typeof b.key === "string" ? b.key : "";
  const kind = b.kind === "ssn" || b.kind === "ein" || b.kind === "bank" || b.kind === "pin" ? b.kind : null;
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(key) || !kind) throw badRequest("Unknown answer.");
  const d = typeof b.value === "string" ? b.value.replace(/\D/g, "") : "";
  if (kind === "bank" ? d.length < 4 || d.length > 17 : d.length !== (kind === "pin" ? 6 : 9)) throw badRequest(kind === "bank" ? "Enter the full account or routing number." : kind === "pin" ? "Enter all 6 digits of the IP PIN." : "Enter all 9 digits.");
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  const e = await encryptField(env.ENCRYPTION_KEY, d, `tax_return:${r.id}:${key}`);
  await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('tax_return', ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, last4 = excluded.last4, kind = excluded.kind, updated_at = excluded.updated_at, updated_by = excluded.updated_by", r.id, key, e.ciphertext, e.iv, Number(env.ENCRYPTION_KEY_VERSION ?? 1), d.slice(-4), kind, now(), `link:${actor.linkId}`);
  await audit(env.DB, actor, { action: "Permission change", resource: `Tax return ${r.id} — interview ${kind.toUpperCase()} saved through secure link`, department: "tax", meta: "Value not logged" });
  return { last4: d.slice(-4) };
}

/**
 * { answers, rev, consentName, signature, engagement? } — submits the interview
 * (and signs the engagement letter if it isn't signed yet). The link then closes.
 */
export async function publicSubmitTaxInterview(env: AppEnv, token: string, ip: string, b: { answers?: unknown; rev?: unknown; consentName?: unknown; signature?: unknown; engagement?: { version?: unknown; termsVersion?: unknown } }) {
  const { l, r, c, actor } = await fromLink(env, token, ip);
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Your interview was updated somewhere else. We loaded the latest version.", "conflict");
  const answers = cleanAnswers(b.answers);
  const consent = typeof b.consentName === "string" ? b.consentName.trim().slice(0, 120) : "";
  if (consent.length < 2) throw badRequest("Type your full name to sign and submit.");
  const sigPng = signatureFrom(b.signature);
  const t = now();
  // Engagement letter: signed here if it wasn't already.
  let engagement = r.organizer.engagement;
  let letterParts: { l: { title: string; body: string; version: number }; t: { title: string; body: string; version: number } } | null = null;
  if (!engagement) {
    const key = taxLetterFor(r.kind);
    const [lt, terms] = await Promise.all([letterVersion(env, key, Number(b.engagement?.version)), letterVersion(env, "terms", Number(b.engagement?.termsVersion))]);
    if (!lt || !terms) throw new HttpError(409, "The engagement letter was updated. Please reload to see the latest version.", "conflict");
    engagement = { letterKey: key, version: lt.version, termsVersion: terms.version, title: fillLetter(lt.title, { taxYear: String(r.taxYear) }), acceptedName: consent, acceptedAt: t, method: "online" };
    letterParts = { l: lt, t: terms };
  }
  // The document checklist and requests (what the in-office screen does on submit).
  const meta = { ...answers, __form: r.form, __year: String(r.taxYear) };
  const docs = docsFor(sectionsFor(r.form), meta);
  const cur = await one<{ module_data: string | null }>(env.DB, "SELECT module_data FROM clients WHERE id = ?", c.id);
  const md = json<Record<string, Record<string, unknown>[]>>(cur?.module_data, {});
  const documents = md.documents ?? [];
  const requested: string[] = [];
  const request = (i: ChecklistItem): ChecklistItem => {
    if (i.docId || i.waivedReason || i.archived || !i.required) return i;
    const docId = randomId("d");
    documents.unshift({ id: docId, name: i.name, service: "tax", category: i.category, sensitive: i.sensitive, taxYear: r.taxYear, status: "requested", requestedAt: t });
    requested.push(i.name);
    return { ...i, docId };
  };
  const added: ChecklistItem[] = docs.filter((d) => !r.checklist.some((i) => i.name === d.name)).map((d) => ({ id: randomId("ci"), ...d, required: true, source: "organizer" as const }));
  const checklist = [...r.checklist.map(request), ...added.map(request)];
  md.documents = documents;
  const fs = r.kind === "individual" ? (impliedFilingStatus(answers) as TaxReturn["filingStatus"] | undefined) : undefined;
  const moving = r.status === "Intake";
  const status = moving ? "Awaiting Documents" : r.status;
  const organizer = { ...r.organizer, status: "submitted" as const, submittedAt: t, sentAt: r.organizer.sentAt ?? t, engagement, interview: { ...(r.organizer.interview ?? {}), answers, updatedAt: t, enteredBy: "client" as const, consentName: consent } };
  const activity = [...(r.activity ?? []), act("intake", `Tax interview submitted by the client online (signed by ${consent}) — ${added.length} document${added.length === 1 ? "" : "s"} added to the checklist`, "client", t), ...(letterParts ? [act("intake", `Engagement letter signed online by ${consent} (drawn signature)`, "client", t)] : []), ...(requested.length ? [act("upload", `Requested ${requested.length} document${requested.length > 1 ? "s" : ""} from the client`, "system", t)] : []), ...(moving ? [act("status", "Status → Awaiting Documents (interview submitted)", "system", t)] : [])];
  const history = moving ? [...(r.statusHistory ?? []), { status: "Awaiting Documents" as const, at: t, by: "client" }] : r.statusHistory;
  const res = await run(env.DB, "UPDATE tax_returns SET organizer = ?, checklist = ?, filing_status = ?, status = ?, status_history = ?, activity = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", JSON.stringify(organizer), JSON.stringify(checklist), fs ?? r.filingStatus ?? null, status, JSON.stringify(history), JSON.stringify(activity), t, r.id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Your interview was updated somewhere else. We loaded the latest version.", "conflict");
  await useLink(env, l.id);
  await run(env.DB, "UPDATE clients SET module_data = ?, rev = rev + 1, updated_at = ? WHERE id = ?", JSON.stringify(md), t, c.id);
  // Copy what they confirmed onto their profile: full SSN/EIN, date of birth, contact details (changes are flagged to staff).
  const fresh = toReturn((await one<TaxRow>(env.DB, "SELECT * FROM tax_returns WHERE id = ?", r.id))!);
  const profile = await applyInterviewToProfile(env, fresh, { actor, memberId: null, byClient: true, identifiers: true, contact: true }).catch((e) => { console.error("profile sync", e instanceof Error ? e.message : e); return null; });
  // Keep the client's Tax Preparation engagement in step with the return.
  if (moving && r.enrollmentId) await run(env.DB, "UPDATE client_enrollments SET stage = 'Awaiting Documents', status = 'waiting_on_client', progress = ? WHERE id = ?", Math.round((STAGES.tax.indexOf("Awaiting Documents") / (STAGES.tax.length - 1)) * 100), r.enrollmentId);
  await env.FILES.put(`clients/${c.id}/signatures/${r.id}-interview.png`, sigPng, { httpMetadata: { contentType: "image/png" }, customMetadata: { taxReturn: r.id, signedBy: consent, signedAt: t, sha256: await sha256Bytes(sigPng) } });

  // Signed PDFs to Documents (stays with a lead's record until they're accepted).
  const outstanding = checklist.filter((i) => i.required && !i.waivedReason && !i.archived && (i.docId ? requested.includes(i.name) : true)).map((i) => i.name);
  const pdf = await buildIntakePdf({ clientName: c.name, taxYear: r.taxYear, form: r.form, returnId: r.id, answers, submittedAt: t, enteredBy: "client", consentName: consent, documents: outstanding, engagement, signaturePng: sigPng });
  const safe = c.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fileName = `MKB-Tax-Interview-${r.taxYear}-${safe}.pdf`;
  await storeClientPdfAs(env, null, c.id, pdf, { name: `${r.taxYear} tax interview (submitted ${longDate(t)})`, fileName, category: "Intake", taxYear: r.taxYear, activity: `Saved a PDF copy of the ${r.taxYear} tax interview (signed online) to Documents` });
  const attachments = [{ filename: fileName, content: pdf }];
  if (letterParts) {
    const fees = await loadFees(env).catch(() => DEFAULT_SERVICE_FEES);
    const vars = { ...feeWords(fees), clientName: c.name, date: longDate(t), taxYear: String(r.taxYear), service: "", fee: "" };
    const letterPdf = await buildLetterPdf({ clientName: c.name, parts: [{ title: fillLetter(letterParts.l.title, vars), body: fillLetter(letterParts.l.body, vars), version: letterParts.l.version }, { title: fillLetter(letterParts.t.title, vars), body: fillLetter(letterParts.t.body, vars), version: letterParts.t.version }], acceptedName: consent, acceptedAt: t, method: "online", signaturePng: sigPng });
    const letterFile = `MKB-Engagement-Letter-${r.taxYear}-${safe}.pdf`;
    await storeClientPdfAs(env, null, c.id, letterPdf, { name: `${r.taxYear} engagement letter (signed ${longDate(t)})`, fileName: letterFile, category: "Engagement letter", taxYear: r.taxYear, activity: `Saved the signed ${r.taxYear} engagement letter to Documents` });
    attachments.push({ filename: letterFile, content: letterPdf });
  }
  let emailed = false;
  const to = l.email || c.email;
  if (to) {
    const out = await sendTemplate(env, "tax_intake_received", { to, vars: { firstName: firstOf(c), taxYear: String(r.taxYear), date: longDate(t) }, documents: outstanding, attachments });
    emailed = out.sent;
  }
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'client', NULL, ?)", randomId("x"), c.id, `Submitted the ${r.taxYear} tax interview online — ${requested.length} document${requested.length === 1 ? "" : "s"} requested`, t);
  const lead = c.status === "prospect";
  await notify(env, { module: "tax" }, { kind: "intake", title: `${c.name} submitted their ${r.taxYear} tax interview`, body: lead ? "A lead (not a client yet) — review it, then accept or decline on the lead" : `${requested.length} document${requested.length === 1 ? "" : "s"} requested · ready for your review`, href: lead ? `/leads/${(await one<{ lead_id: string | null }>(env.DB, "SELECT lead_id FROM clients WHERE id = ?", c.id))?.lead_id ?? ""}` : `/services/tax-preparation/returns/${r.id}`, ...{} });
  await audit(env.DB, actor, { action: "Record update", resource: `Tax return ${r.id}`, department: "tax", meta: `Interview submitted online and signed (drawn)${letterParts ? `; engagement letter v${engagement.version} signed` : ""}; ${requested.length} documents requested${to ? (emailed ? "; emailed" : "; email queued") : ""}` });
  return { submitted: true, documents: outstanding, emailed, profileUpdated: profile?.updated ?? [], next: await nextStop(env, c.id) };
}
