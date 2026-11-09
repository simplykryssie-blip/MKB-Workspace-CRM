/**
 * Tax Preparation — server side. Reading needs Tax "view" and access to the
 * client; creating "create"; changing the preparer/reviewer "assign"; review
 * sign-off and e-file "approve"; everything else "edit". Sensitive interview
 * answers live in the encrypted vault (owner_type 'tax_return'). Server-only.
 */
import { STATUS_PATH, type FeeItem, type TaxReturn } from "@/lib/tax/config";
import { canDo, clientAccess } from "@/lib/team/policy";
import type { ServiceKey } from "@/lib/types";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, rateLimit, run, str, type AppEnv, type Db } from "./core";
import { decryptField, encryptField } from "./crypto";
import { audit, hasSensitivePerm, requirePermission, sendEmail, type Actor } from "./identity";
import { assignmentSets, setIdentifier } from "./clients";
import { notify } from "./notifications";
import { sendTemplate } from "./email";
import { buildIntakePdf, buildLetterPdf } from "./intake-pdf";
import { letterVersion } from "./engagement";
import { loadFees, loadTaxRules } from "./settings";
import { ddComplete } from "@/lib/tax/due-diligence";
import { roleOf } from "@/lib/team/policy";
import { ensure8821 } from "./f8821";
import { feeWords } from "@/lib/fees/config";
import { fillLetter, taxLetterFor } from "@/lib/engagement/letters";
import { randomId } from "./crypto";

type Row = { id: string; client_id: string; enrollment_id: string | null; tax_year: number; kind: TaxReturn["kind"]; form: TaxReturn["form"]; filing_status: string | null; states: string; status: TaxReturn["status"]; preparer_id: string; reviewer_id: string; due_at: string | null; extension: string | null; review_signoff: string | null; approval_signature_id: string | null; client_approved_at: string | null; organizer: string; checklist: string; efile: string; pricing: string; status_history: string; notes: string; activity: string; created_at: string; completed_at: string | null; rev: number; extra: string | null };
export type ReturnSnapshot = TaxReturn & { rev?: number };
type Staff = Extract<Actor, { kind: "staff" }>;
const MAX_JSON = 300_000;

const toReturn = (r: Row): ReturnSnapshot => ({
  id: r.id, clientId: r.client_id, enrollmentId: r.enrollment_id ?? undefined, taxYear: r.tax_year, kind: r.kind, form: r.form,
  filingStatus: (r.filing_status ?? undefined) as TaxReturn["filingStatus"], states: json(r.states, []), status: r.status, preparerId: r.preparer_id, reviewerId: r.reviewer_id,
  dueAt: r.due_at ?? undefined, extension: json(r.extension, undefined), reviewSignoff: json(r.review_signoff, undefined), approvalSignatureId: r.approval_signature_id ?? undefined,
  clientApprovedAt: r.client_approved_at ?? undefined, organizer: json(r.organizer, { status: "not_sent", answers: {} }), checklist: json(r.checklist, []), efile: json(r.efile, []),
  pricing: json(r.pricing, { lines: [], discount: 0 }), statusHistory: json(r.status_history, []), notes: json(r.notes, []), activity: json(r.activity, []),
  createdAt: r.created_at, completedAt: r.completed_at ?? undefined, rev: r.rev,
  ...json<Pick<TaxReturn, "ownerApproval" | "dueDiligence" | "amendsReturnId" | "extensionOnly">>(r.extra, {}),
});

/** Clients this staff member may open, decided by the same rules as the client list. */
async function accessibleClients(env: AppEnv, a: Staff, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const [rows, sets] = await Promise.all([
    all<{ id: string; services: string | null }>(env.DB, `SELECT c.id, (SELECT group_concat(service) FROM client_services s WHERE s.client_id = c.id) AS services FROM clients c WHERE c.id IN (${ids.map(() => "?").join(",")})`, ...ids),
    assignmentSets(env, a.member.id),
  ]);
  return new Set(rows.filter((c) => clientAccess(a.policy, a.member, { id: c.id, services: (c.services ? c.services.split(",") : []) as ServiceKey[] }, sets)).map((c) => c.id));
}

export async function listTax(env: AppEnv, a: Actor) {
  requirePermission(a, "tax", "view");
  if (a.kind !== "staff") throw forbidden();
  const [rows, fees] = await Promise.all([all<Row>(env.DB, "SELECT * FROM tax_returns ORDER BY tax_year DESC, created_at DESC"), all<FeeItem & { position: number }>(env.DB, "SELECT code, label, kind, price, unit, position FROM tax_fee_schedule ORDER BY position")]);
  const ok = await accessibleClients(env, a, [...new Set(rows.map((r) => r.client_id))]);
  return { returns: rows.filter((r) => ok.has(r.client_id)).map(toReturn), fees: fees.map(({ position: _p, unit, ...f }) => ({ ...f, unit: unit ?? undefined })) };
}

async function load(env: AppEnv, a: Staff, id: string) {
  const r = await one<Row>(env.DB, "SELECT * FROM tax_returns WHERE id = ?", id);
  if (!r) throw notFound("Return not found.");
  if (!(await accessibleClients(env, a, [r.client_id])).has(r.client_id)) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  return toReturn(r);
}

const big = (v: unknown) => { const t = JSON.stringify(v ?? null); if (t.length > MAX_JSON) throw new HttpError(413, "This return is too large to save."); return t; };
const assignmentStmts = (db: Db, r: TaxReturn) => [
  db.prepare("DELETE FROM record_assignments WHERE record_id = ? AND source IN ('tax_preparer', 'tax_reviewer')").bind(r.id),
  db.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, 'tax_preparer', ? FROM members WHERE id = ?").bind(r.clientId, r.id, r.preparerId),
  db.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, 'tax_reviewer', ? FROM members WHERE id = ?").bind(r.clientId, r.id, r.reviewerId),
];
async function checkStaff(db: Db, ...ids: string[]) {
  for (const id of ids) if (!(await one(db, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", id))) throw badRequest("Preparer and reviewer must be active team members.");
}
function fields(r: TaxReturn) {
  return [r.clientId, r.enrollmentId ?? null, r.taxYear, r.kind, r.form, r.filingStatus ?? null, big(r.states ?? []), r.status, r.preparerId, r.reviewerId, r.dueAt ?? null, r.extension ? big(r.extension) : null, r.reviewSignoff ? big(r.reviewSignoff) : null, r.approvalSignatureId ?? null, r.clientApprovedAt ?? null, big(r.organizer), big(r.checklist ?? []), big(r.efile ?? []), big(r.pricing), big(r.statusHistory ?? []), big(r.notes ?? []), big(r.activity ?? []), r.completedAt ?? null, big({ ownerApproval: r.ownerApproval, dueDiligence: r.dueDiligence, amendsReturnId: r.amendsReturnId, extensionOnly: r.extensionOnly || undefined })];
}

export async function createReturn(env: AppEnv, a: Actor, r: ReturnSnapshot) {
  requirePermission(a, "tax", "create");
  if (a.kind !== "staff") throw forbidden();
  if (!/^TR-[A-Za-z0-9_-]{3,80}$/.test(r.id ?? "")) throw badRequest("Invalid return ID.");
  if (!Number.isInteger(r.taxYear) || r.taxYear < 2000 || r.taxYear > 2100) throw badRequest("Invalid tax year.");
  if (!(await accessibleClients(env, a, [r.clientId])).has(r.clientId)) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  // Without "assign", you can only create returns you prepare yourself.
  if (r.preparerId !== a.member.id && !canDo(a.policy, a.member, "tax", "assign")) throw forbidden("Your role can't assign returns to someone else.");
  await checkStaff(env.DB, r.preparerId, r.reviewerId);
  if (r.amendsReturnId) {
    const orig = await one<{ client_id: string; tax_year: number; kind: string }>(env.DB, "SELECT client_id, tax_year, kind FROM tax_returns WHERE id = ?", r.amendsReturnId);
    if (!orig || orig.client_id !== r.clientId || orig.tax_year !== r.taxYear || orig.kind !== r.kind) throw badRequest("An amended return must point at the same client's original return for that year.");
  }
  if (r.ownerApproval || r.reviewSignoff) throw badRequest("A new return can't start out approved.");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO tax_returns (id, client_id, enrollment_id, tax_year, kind, form, filing_status, states, status, preparer_id, reviewer_id, due_at, extension, review_signoff, approval_signature_id, client_approved_at, organizer, checklist, efile, pricing, status_history, notes, activity, completed_at, extra, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(r.id, ...fields(r), t, t),
    ...assignmentStmts(env.DB, r),
  ]);
  await audit(env.DB, a, { action: "Record update", resource: `Tax return ${r.id}`, department: "tax", meta: "Return created" });
  await ensure8821(env, a, r.clientId);
  return load(env, a, r.id);
}

/** Saves a return. Each kind of change needs its own permission; a stale revision is refused. */
/** Applies `fn` to entries that weren't in `before` (matched by id, or by position for id-less lists). */
export function stampNew<T>(before: T[] | undefined, after: T[] | undefined, fn: (x: T) => T): T[] {
  const prev = before ?? [];
  const ids = new Set(prev.map((x) => (x as { id?: string }).id).filter(Boolean));
  return (after ?? []).map((x, i) => {
    const id = (x as { id?: string }).id;
    const isNew = id ? !ids.has(id) : i >= prev.length;
    return isNew ? fn(x) : x;
  });
}

export async function saveReturn(env: AppEnv, a: Actor, id: string, next: ReturnSnapshot) {
  requirePermission(a, "tax", "view");
  if (a.kind !== "staff") throw forbidden();
  const cur = await load(env, a, id);
  if (next.rev !== cur.rev) throw new HttpError(409, "Someone else updated this return. Reloading the latest version.", "conflict");
  // New notes and status steps are recorded as the signed-in person, whatever the browser says.
  next = { ...next, notes: stampNew(cur.notes, next.notes, (n) => ({ ...n, authorId: a.member.id })), statusHistory: stampNew(cur.statusHistory, next.statusHistory, (h) => (h.by === "client" || h.by === "system" ? h : { ...h, by: a.member.id })) };
  if (next.clientId !== cur.clientId || next.taxYear !== cur.taxYear || next.kind !== cur.kind) throw badRequest("A return's client, year and type can't change.");
  next = await checkEngagement(env, a, cur, next);
  const same = (k: keyof TaxReturn) => JSON.stringify(next[k] ?? null) === JSON.stringify(cur[k] ?? null);
  const need = (action: "edit" | "assign" | "approve", what: string) => { if (!canDo(a.policy, a.member, "tax", action)) throw forbidden(`Your role can't ${what}.`); };
  const changed: string[] = [];
  if (next.preparerId !== cur.preparerId || next.reviewerId !== cur.reviewerId) { need("assign", "change the preparer or reviewer"); await checkStaff(env.DB, next.preparerId, next.reviewerId); changed.push("assignment"); }
  if (!same("reviewSignoff")) { need("approve", "sign off returns"); changed.push("review sign-off"); }
  if (!same("efile")) { need("approve", "transmit or record e-file results"); changed.push("e-file"); }
  if (!same("ownerApproval")) {
    if (!isOwner(a)) throw forbidden("Only the Owner can give final approval.");
    if (next.ownerApproval && (!next.reviewSignoff || !next.clientApprovedAt)) throw badRequest("Final approval comes after the reviewer's sign-off and the client's approval.");
    if (next.ownerApproval) next = { ...next, ownerApproval: { by: a.member.id, at: now(), note: typeof next.ownerApproval.note === "string" ? next.ownerApproval.note.slice(0, 500) : undefined } };
    changed.push("final approval");
  }
  if (cur.kind === "individual" && next.reviewSignoff && !cur.reviewSignoff && !ddComplete(next.dueDiligence)) throw badRequest("Complete the due diligence checklist (or mark it not applicable) before signing off.");
  if (!same("dueDiligence") && next.dueDiligence?.completedAt && next.dueDiligence.completedAt !== cur.dueDiligence?.completedAt) next = { ...next, dueDiligence: { ...next.dueDiligence, completedBy: a.member.id, completedAt: now() } };
  if ((next.amendsReturnId ?? null) !== (cur.amendsReturnId ?? null)) throw badRequest("The amended-return link can't change.");
  const rules = await loadTaxRules(env);
  const efAt = STATUS_PATH.indexOf("Ready to E-file");
  const fromI = STATUS_PATH.indexOf(cur.status), toI = STATUS_PATH.indexOf(next.status);
  if (rules.requireOwnerApproval && !next.ownerApproval && ((toI >= efAt && fromI < efAt && fromI >= 0) || next.efile.length > cur.efile.length)) throw badRequest("This return needs the Owner's final approval before it can be e-filed.");
  const rest: (keyof TaxReturn)[] = ["form", "filingStatus", "states", "status", "dueAt", "extension", "approvalSignatureId", "clientApprovedAt", "organizer", "checklist", "pricing", "statusHistory", "notes", "completedAt", "enrollmentId", "dueDiligence", "extensionOnly"];
  const other = rest.filter((k) => !same(k));
  if (other.length) { need("edit", "edit returns"); changed.push(...other.map(String)); }
  const newActivity = !same("activity");
  if (!changed.length && !newActivity) return cur;
  // Timeline entries can only be added, never edited away.
  if (cur.activity.some((x) => !(next.activity ?? []).some((y) => y.id === x.id))) throw badRequest("History entries can't be removed.");
  const t = now();
  const res = await env.DB.batch([
    env.DB.prepare("UPDATE tax_returns SET client_id = ?, enrollment_id = ?, tax_year = ?, kind = ?, form = ?, filing_status = ?, states = ?, status = ?, preparer_id = ?, reviewer_id = ?, due_at = ?, extension = ?, review_signoff = ?, approval_signature_id = ?, client_approved_at = ?, organizer = ?, checklist = ?, efile = ?, pricing = ?, status_history = ?, notes = ?, activity = ?, completed_at = ?, extra = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?").bind(...fields(next), t, id, cur.rev!),
    ...(changed.includes("assignment") ? assignmentStmts(env.DB, next) : []),
  ]);
  if (!res[0].meta.changes) throw new HttpError(409, "Someone else updated this return. Reloading the latest version.", "conflict");
  if (changed.length) await audit(env.DB, a, { action: changed.includes("assignment") ? "Assignment change" : changed.includes("review sign-off") ? "Approval" : "Record update", resource: `Tax return ${id}`, department: "tax", meta: `Changed: ${[...new Set(changed)].join(", ")}` });
  await returnNotices(env, a, cur, next);
  return load(env, a, id);
}

const REVIEW_AT = STATUS_PATH.indexOf("Ready for Review");
/**
 * Engagement letter rules: an acceptance must point at letter versions that
 * exist for this kind of return, and is stamped with the server's time and the
 * staff member who recorded it. A return can't move into review without one.
 */
async function checkEngagement(env: AppEnv, a: Actor, cur: TaxReturn, next: ReturnSnapshot): Promise<ReturnSnapshot> {
  const e = next.organizer?.engagement;
  const was = cur.organizer?.engagement;
  if (e && JSON.stringify(e) !== JSON.stringify(was)) {
    if (was) throw badRequest("An accepted engagement letter can't be changed. Record a new acceptance on a new return if the terms changed.");
    const name = typeof e.acceptedName === "string" ? e.acceptedName.trim() : "";
    if (e.letterKey !== taxLetterFor(cur.kind)) throw badRequest("Wrong engagement letter for this return.");
    if (!["online", "in_office", "paper"].includes(e.method)) throw badRequest("Unknown acceptance method.");
    if (name.length < 2 || name.length > 120) throw badRequest("Enter the client's full name to accept the engagement letter.");
    const [l, t] = await Promise.all([letterVersion(env, e.letterKey, Number(e.version)), letterVersion(env, "terms", Number(e.termsVersion))]);
    if (!l || !t) throw badRequest("That version of the engagement letter doesn't exist.");
    const stamped = { letterKey: e.letterKey, version: l.version, termsVersion: t.version, title: fillLetter(l.title, { taxYear: String(cur.taxYear) }), acceptedName: name, acceptedAt: now(), method: e.method, recordedBy: a.kind === "staff" && e.method !== "online" ? a.member.id : undefined };
    next = { ...next, organizer: { ...next.organizer, engagement: stamped } };
  } else if (!e && was) {
    throw badRequest("An accepted engagement letter can't be removed.");
  }
  const from = STATUS_PATH.indexOf(cur.status), to = STATUS_PATH.indexOf(next.status);
  if ((await loadTaxRules(env)).requireEngagement && to >= REVIEW_AT && from < REVIEW_AT && from >= 0 && !next.organizer?.engagement) throw badRequest("The client needs to accept the engagement letter before this return can move to review.");
  return next;
}

/** Saves the signed engagement letter (service letter + standard terms) as a PDF in the client's Documents. */
async function saveEngagementPdf(env: AppEnv, a: Actor, r: TaxReturn, clientName: string) {
  const e = r.organizer?.engagement;
  if (!e || a.kind !== "staff") return null;
  const [l, t] = await Promise.all([letterVersion(env, e.letterKey, e.version), letterVersion(env, "terms", e.termsVersion)]);
  if (!l || !t) return null;
  const vars = { ...feeWords(await loadFees(env)), clientName, date: longDate(e.acceptedAt), taxYear: String(r.taxYear), service: "", fee: "" };
  const recorder = e.recordedBy ? (await one<{ name: string }>(env.DB, "SELECT name FROM members WHERE id = ?", e.recordedBy))?.name : undefined;
  const pdf = await buildLetterPdf({ clientName, parts: [{ title: fillLetter(l.title, vars), body: fillLetter(l.body, vars), version: l.version }, { title: fillLetter(t.title, vars), body: fillLetter(t.body, vars), version: t.version }], acceptedName: e.acceptedName, acceptedAt: e.acceptedAt, method: e.method, recordedBy: recorder });
  const fileName = `MKB-Engagement-Letter-${r.taxYear}-${clientName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  const doc = await storeClientPdf(env, a, r.clientId, pdf, { name: `${r.taxYear} engagement letter (accepted ${longDate(e.acceptedAt)})`, fileName, category: "Engagement letter", taxYear: r.taxYear, activity: `Saved the signed ${r.taxYear} engagement letter to Documents` });
  return { docId: doc, pdf, fileName };
}

/** Stores a generated PDF privately and lists it in the client's Documents. Returns the document id. */
export async function storeClientPdf(env: AppEnv, a: Actor, clientId: string, pdf: Uint8Array, d: { name: string; fileName: string; category: string; taxYear?: number; activity: string; service?: string }) {
  if (a.kind !== "staff") throw forbidden();
  const docId = randomId("d");
  const key = `clients/${clientId}/${docId}.pdf`;
  const t = now();
  await env.FILES.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });
  const c = await one<{ module_data: string | null }>(env.DB, "SELECT module_data FROM clients WHERE id = ?", clientId);
  const md = json<Record<string, unknown[]>>(c?.module_data, {});
  md.documents = [{ id: docId, name: d.name, fileName: d.fileName, service: d.service ?? "tax", category: d.category, status: "received", sensitive: true, requestedAt: t, uploadedAt: t, sizeKb: Math.max(1, Math.round(pdf.length / 1024)), uploadedBy: "staff", taxYear: d.taxYear, hasFile: true, deliveredAt: t }, ...((md.documents as unknown[]) ?? [])];
  await env.DB.batch([
    env.DB.prepare("INSERT INTO client_files (id, client_id, r2_key, name, content_type, size_bytes, sensitive, created_at, created_by) VALUES (?, ?, ?, ?, 'application/pdf', ?, 1, ?, ?)").bind(docId, clientId, key, d.fileName, pdf.length, t, a.member.id),
    env.DB.prepare("UPDATE clients SET module_data = ?, rev = rev + 1, updated_at = ? WHERE id = ?").bind(JSON.stringify(md), t, clientId),
    env.DB.prepare("INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'upload', ?, 'system', ?, ?)").bind(randomId("x"), clientId, d.activity, a.member.id, t),
  ]);
  return docId;
}

/** Staff recorded an acceptance outside the interview: make the PDF copy. */
export async function engagementPdf(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "tax", "edit");
  if (a.kind !== "staff") throw forbidden();
  const r = await load(env, a, id);
  if (!r.organizer?.engagement) throw badRequest("No engagement letter has been accepted on this return yet.");
  const c = await one<{ name: string }>(env.DB, "SELECT name FROM clients WHERE id = ?", r.clientId);
  const out = await saveEngagementPdf(env, a, r, c?.name ?? "Client");
  if (!out) throw badRequest("Couldn't build the engagement letter.");
  await audit(env.DB, a, { action: "Record update", resource: `Tax return ${id}`, department: "tax", meta: "Signed engagement letter saved to client documents" });
  return { docId: out.docId };
}

const isOwner = (a: Actor) => a.kind === "staff" && !!roleOf(a.policy.roles, a.member)?.isOwner;

/** Emails the client that their extension was filed (new due date + payment reminder). */
export async function emailExtension(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "tax", "edit");
  if (a.kind !== "staff") throw forbidden();
  const r = await load(env, a, id);
  if (!r.extension) throw badRequest("No extension is recorded on this return.");
  const c = await one<{ name: string; contact_name: string | null; email: string | null }>(env.DB, "SELECT name, contact_name, email FROM clients WHERE id = ?", r.clientId);
  if (!c?.email) throw badRequest("This client has no email address on file.");
  if (!(await rateLimit(env.DB, `extmail:${id}`, 5, 60))) throw new HttpError(429, "Too many emails for this return in the last hour.", "rate_limited");
  const pay = r.extension.payWithExtension;
  const payNote = pay ? `A payment of $${pay.toLocaleString("en-US", { maximumFractionDigits: 2 })} was made with the extension.` : "If you expect to owe, pay by the original due date to limit interest and penalties.";
  const docs = (r.checklist ?? []).filter((i) => i.required && !i.docId && !i.waivedReason && !i.archived).map((i) => i.name).slice(0, 40);
  const out = await sendTemplate(env, "tax_extension_filed", { to: c.email, vars: { firstName: firstName(c), taxYear: String(r.taxYear), dueDate: longDate(r.extension.dueAt), payNote }, documents: docs });
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'system', ?, ?)", randomId("x"), r.clientId, `Emailed: ${r.taxYear} extension filed — new due date ${longDate(r.extension.dueAt)}${out.sent ? "" : " (queued)"}`, a.member.id, now());
  await audit(env.DB, a, { action: "Record update", resource: `Tax return ${id}`, department: "tax", meta: `Extension email ${out.sent ? "sent" : "queued"}` });
  return { sent: out.sent };
}

/** Bell notifications for what just happened on a return (names only, never tax details). */
async function returnNotices(env: AppEnv, a: Actor, cur: TaxReturn, next: TaxReturn) {
  const client = (await one<{ name: string }>(env.DB, "SELECT name FROM clients WHERE id = ?", cur.clientId))?.name ?? "A client";
  const href = `/services/tax-preparation/returns/${cur.id}`;
  const except = a.kind === "staff" ? a.member.id : undefined;
  const year = cur.taxYear;
  if (!cur.organizer?.submittedAt && next.organizer?.submittedAt && next.organizer.interview?.enteredBy !== "staff")
    await notify(env, { module: "tax", exceptId: except }, { kind: "intake", title: `${client} submitted their ${year} tax interview`, href: `${href}#organizer` });
  const was = new Set((cur.organizer?.followUps ?? []).filter((f) => f.status === "answered").map((f) => f.id));
  const nowAnswered = (next.organizer?.followUps ?? []).filter((f) => f.status === "answered" && !was.has(f.id));
  if (nowAnswered.length)
    await notify(env, { module: "tax", exceptId: except }, { kind: "followup", title: `${client} answered ${nowAnswered.length === 1 ? "a follow-up question" : `${nowAnswered.length} follow-up questions`}`, href: `${href}#organizer` });
  if (cur.status !== "Awaiting Final Approval" && next.status === "Awaiting Final Approval")
    await notify(env, { module: "tax", ownersOnly: true, exceptId: except }, { kind: "approval", title: `${client} approved their ${year} return`, body: "It's waiting for your final approval before e-filing.", href: `${href}#review` });
  if (!cur.reviewSignoff && next.reviewSignoff)
    await notify(env, { module: "tax", ownersOnly: true, exceptId: except }, { kind: "signoff", title: `${client}'s ${year} return was signed off by the reviewer`, body: "It's waiting for your final approval before e-filing.", href: `${href}#review` });
}

export async function saveFees(env: AppEnv, a: Actor, fees: FeeItem[]) {
  requirePermission(a, "tax", "settings");
  if (!Array.isArray(fees) || !fees.length || fees.length > 200) throw badRequest("Invalid fee schedule.");
  const clean = fees.map((f) => ({ code: str(f.code, 20), label: str(f.label, 120), kind: (["individual", "business", "both"] as const).includes(f.kind) ? f.kind : "both", price: Math.max(0, Number(f.price) || 0), unit: str(f.unit, 30) || null }));
  if (new Set(clean.map((f) => f.code)).size !== clean.length || clean.some((f) => !f.code || !f.label)) throw badRequest("Each fee needs a unique code and a name.");
  await env.DB.batch([env.DB.prepare("DELETE FROM tax_fee_schedule"), ...clean.map((f, i) => env.DB.prepare("INSERT INTO tax_fee_schedule (code, label, kind, price, unit, position) VALUES (?, ?, ?, ?, ?, ?)").bind(f.code, f.label, f.kind, f.price, f.unit, i))]);
  await audit(env.DB, a, { action: "Record update", resource: "Tax fee schedule", department: "tax", meta: `${clean.length} fees` });
}

/* ---------------------------------------------------------------- sensitive interview answers */
type SecureKind = "ssn" | "ein" | "bank";
const REVEAL: Record<SecureKind, string> = { ssn: "tax.revealSsn", ein: "tax.ein", bank: "tax.bank" };
const validKey = (k: string) => /^[A-Za-z0-9_.-]{1,120}$/.test(k);

/** Stores a full SSN/EIN/bank number from the interview, encrypted. Only the last four stay in the answers. */
export async function setSecureAnswer(env: AppEnv, a: Actor, id: string, key: string, kind: SecureKind, value: string) {
  requirePermission(a, "tax", "edit");
  if (a.kind !== "staff") throw forbidden();
  await load(env, a, id);
  if (!validKey(key) || !(kind in REVEAL)) throw badRequest("Unknown answer.");
  const d = value.replace(/\D/g, "");
  if (kind === "bank" ? d.length < 4 || d.length > 17 : d.length !== 9) throw badRequest(kind === "bank" ? "Enter the full account or routing number." : "Enter all 9 digits.");
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  const e = await encryptField(env.ENCRYPTION_KEY, d, `tax_return:${id}:${key}`);
  await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('tax_return', ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, last4 = excluded.last4, kind = excluded.kind, updated_at = excluded.updated_at, updated_by = excluded.updated_by", id, key, e.ciphertext, e.iv, Number(env.ENCRYPTION_KEY_VERSION ?? 1), d.slice(-4), kind, now(), a.member.id);
  await audit(env.DB, a, { action: "Permission change", resource: `Tax return ${id} — interview ${kind.toUpperCase()} saved`, department: "tax", meta: "Value not logged" });
  return { last4: d.slice(-4) };
}

export async function revealSecureAnswer(env: AppEnv, a: Actor, id: string, key: string) {
  if (a.kind !== "staff") throw forbidden();
  await load(env, a, id);
  if (!validKey(key)) throw badRequest("Unknown answer.");
  const v = await one<{ ciphertext: string; iv: string; kind: SecureKind }>(env.DB, "SELECT ciphertext, iv, kind FROM vault WHERE owner_type = 'tax_return' AND owner_id = ? AND field = ?", id, key);
  if (!v) throw notFound("The full number wasn't entered.");
  if (!hasSensitivePerm(a, REVEAL[v.kind])) {
    await audit(env.DB, a, { action: "Sensitive reveal", resource: `Tax return ${id} — interview ${v.kind.toUpperCase()}`, department: "tax", meta: "Denied: missing reveal permission", success: false });
    throw forbidden("Your role can't reveal this — it needs the separate sensitive-information permission.");
  }
  if (!(await rateLimit(env.DB, `reveal:${a.member.id}`, 60, 60))) throw new HttpError(429, "Too many reveals in the last hour.", "rate_limited");
  const value = await decryptField(env.ENCRYPTION_KEY!, v, `tax_return:${id}:${key}`);
  await audit(env.DB, a, { action: "Sensitive reveal", resource: `Tax return ${id} — interview ${v.kind.toUpperCase()}`, department: "tax" });
  return { value };
}

/**
 * Emails the client the list of documents MKB still needs for this return.
 * Only document names are sent (never answers or numbers), and clients are
 * told not to email tax documents back.
 */
export async function emailDocumentRequest(env: AppEnv, a: Actor, id: string, names: unknown, reminder = false) {
  requirePermission(a, "tax", "edit");
  if (a.kind !== "staff") throw forbidden();
  const r = await load(env, a, id);
  // Document names only (the interview's list can arrive before the checklist finishes saving).
  const list = cleanNames(names);
  if (!list.length) throw badRequest("Choose at least one document.");
  const c = await one<{ name: string; contact_name: string | null; email: string | null }>(env.DB, "SELECT name, contact_name, email FROM clients WHERE id = ?", r.clientId);
  if (!c?.email) throw badRequest("This client has no email address on file.");
  if (!(await rateLimit(env.DB, `docreq:${id}`, 10, 60))) throw new HttpError(429, "Too many requests for this return in the last hour.", "rate_limited");
  const out = await sendTemplate(env, reminder ? "tax_document_reminder" : "tax_document_request", { to: c.email, vars: { firstName: firstName(c), taxYear: String(r.taxYear), count: `${list.length} document${list.length > 1 ? "s" : ""}` }, documents: list });
  await audit(env.DB, a, { action: "Record update", resource: `Tax return ${id}`, department: "tax", meta: `Emailed document ${reminder ? "reminder" : "request"} (${list.length} item${list.length > 1 ? "s" : ""})${out.sent ? "" : " — queued, not sent"}` });
  return { count: list.length, sent: out.sent };
}

const cleanNames = (names: unknown) => [...new Set((Array.isArray(names) ? names : []).map((x) => str(x, 200).replace(/[\r\n]+/g, " ")).filter(Boolean))].slice(0, 40);
const firstName = (c: { name: string; contact_name: string | null }) => (c.contact_name || c.name).trim().split(/\s+/)[0];
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });

/**
 * After an interview is submitted: saves a PDF copy to the client's Documents
 * (private file storage, visible in the portal) and emails the client the
 * "we received it" message with the PDF attached and any documents still needed.
 */
export async function completeIntake(env: AppEnv, a: Actor, id: string, b: { request?: unknown; email?: unknown }) {
  requirePermission(a, "tax", "edit");
  if (a.kind !== "staff") throw forbidden();
  const r = await load(env, a, id);
  const iv = r.organizer?.interview;
  if (!r.organizer?.submittedAt || !iv) throw badRequest("Submit the interview first.");
  if (!(await rateLimit(env.DB, `intake-pdf:${id}`, 6, 60))) throw new HttpError(429, "Too many copies made for this return in the last hour.", "rate_limited");
  const c = await one<{ name: string; contact_name: string | null; email: string | null; module_data: string | null; rev: number }>(env.DB, "SELECT name, contact_name, email, module_data, rev FROM clients WHERE id = ?", r.clientId);
  if (!c) throw notFound("Client not found.");
  const docs = cleanNames(b.request);
  const pdf = await buildIntakePdf({ clientName: c.name, taxYear: r.taxYear, form: r.form, returnId: r.id, answers: iv.answers, submittedAt: r.organizer.submittedAt, enteredBy: iv.enteredBy ?? "client", consentName: iv.consentName, documents: docs, engagement: r.organizer.engagement });
  const fileName = `MKB-Tax-Interview-${r.taxYear}-${c.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  const docId = await storeClientPdf(env, a, r.clientId, pdf, { name: `${r.taxYear} tax interview (submitted ${longDate(r.organizer.submittedAt)})`, fileName, category: "Intake", taxYear: r.taxYear, activity: `Saved a PDF copy of the ${r.taxYear} tax interview to Documents` });
  // The signed engagement letter travels with the intake.
  const letter = await saveEngagementPdf(env, a, r, c.name);
  let emailed = false;
  if (b.email !== false && c.email) {
    const out = await sendTemplate(env, "tax_intake_received", { to: c.email, vars: { firstName: firstName(c), taxYear: String(r.taxYear), date: longDate(r.organizer.submittedAt) }, documents: docs, attachments: [{ filename: fileName, content: pdf }, ...(letter ? [{ filename: letter.fileName, content: letter.pdf }] : [])] });
    emailed = out.sent;
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'system', ?, ?)", randomId("x"), r.clientId, `Emailed “we received your ${r.taxYear} tax interview”${docs.length ? ` with ${docs.length} document${docs.length > 1 ? "s" : ""} still needed` : ""}${out.sent ? "" : " (queued)"}`, a.member.id, now());
  }
  await audit(env.DB, a, { action: "Record update", resource: `Tax return ${id}`, department: "tax", meta: `Intake PDF saved to client documents${b.email !== false ? (emailed ? "; emailed to client" : "; email queued") : ""}` });
  return { docId, letterDocId: letter?.docId, emailed, noEmail: !c.email };
}

/**
 * After an intake is submitted: copies what the client confirmed onto their
 * profile — SSN/ITIN or EIN and date of birth (re-encrypted into the client's
 * vault, through the same permission checks and audit as editing the profile)
 * and, for individuals, phone, email and home address. Returns what changed.
 */
export async function syncProfileFromReturn(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "tax", "edit");
  if (a.kind !== "staff") throw forbidden();
  const r = await load(env, a, id);
  const ans = (r.organizer?.interview?.answers ?? {}) as Record<string, unknown>;
  const val = (k: string) => (typeof ans[k] === "string" ? (ans[k] as string).trim() : "");
  const updated: string[] = [];
  const skipped: string[] = [];
  const fromVault = async (key: string) => {
    const v = await one<{ ciphertext: string; iv: string; kind: SecureKind }>(env.DB, "SELECT ciphertext, iv, kind FROM vault WHERE owner_type = 'tax_return' AND owner_id = ? AND field = ?", id, key);
    return v ? decryptField(env.ENCRYPTION_KEY!, v, `tax_return:${id}:${key}`) : null;
  };
  const copy = async (label: string, run: () => Promise<unknown>) => {
    try { await run(); updated.push(label); } catch (e) { skipped.push(`${label}: ${e instanceof Error ? e.message : "not saved"}`); }
  };
  if (r.kind === "individual") {
    const ssn = await fromVault("you.ssn");
    if (ssn) await copy("SSN/ITIN", () => setIdentifier(env, a, r.clientId, "tax_id", ssn, ssn.startsWith("9") ? "ITIN" : "SSN"));
    if (/^\d{4}-\d{2}-\d{2}$/.test(val("dob"))) await copy("date of birth", () => setIdentifier(env, a, r.clientId, "dob", val("dob")));
    // Contact details the client confirmed (only fields they actually answered).
    const cur = await one<{ phone: string | null; email: string | null; address: string | null; rev: number }>(env.DB, "SELECT phone, email, address, rev FROM clients WHERE id = ?", r.clientId);
    if (cur) {
      const address = val("street") && val("city") && val("state") ? JSON.stringify({ line1: val("street"), city: val("city"), state: val("state"), zip: val("zip") }) : cur.address;
      const phone = val("phone") || cur.phone;
      const email = (val("email") || cur.email || "").toLowerCase();
      if (phone !== cur.phone || email !== cur.email || address !== cur.address) {
        if (!canDo(a.policy, a.member, "crm", "edit")) skipped.push("contact details: your role can't edit client details");
        else {
          await run(env.DB, "UPDATE clients SET phone = ?, email = ?, address = ?, rev = rev + 1, updated_at = ? WHERE id = ?", phone, email, address, now(), r.clientId);
          updated.push("contact details");
        }
      }
    }
  } else {
    const ein = await fromVault("entity.ein");
    if (ein) await copy("EIN", () => setIdentifier(env, a, r.clientId, "ein", ein));
  }
  if (updated.length) await audit(env.DB, a, { action: "Record update", resource: `Client ${r.clientId}`, department: "tax", meta: `Profile updated from tax intake ${id}: ${updated.join(", ")}` });
  return { updated, skipped };
}
