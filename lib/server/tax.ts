/**
 * Tax Preparation — server side. Reading needs Tax "view" and access to the
 * client; creating "create"; changing the preparer/reviewer "assign"; review
 * sign-off and e-file "approve"; everything else "edit". Sensitive interview
 * answers live in the encrypted vault (owner_type 'tax_return'). Server-only.
 */
import type { FeeItem, TaxReturn } from "@/lib/tax/config";
import { canDo, clientAccess } from "@/lib/team/policy";
import type { ServiceKey } from "@/lib/types";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, rateLimit, run, str, type AppEnv, type Db } from "./core";
import { decryptField, encryptField } from "./crypto";
import { audit, hasSensitivePerm, requirePermission, sendEmail, type Actor } from "./identity";
import { assignmentSets, setIdentifier } from "./clients";

type Row = { id: string; client_id: string; enrollment_id: string | null; tax_year: number; kind: TaxReturn["kind"]; form: TaxReturn["form"]; filing_status: string | null; states: string; status: TaxReturn["status"]; preparer_id: string; reviewer_id: string; due_at: string | null; extension: string | null; review_signoff: string | null; approval_signature_id: string | null; client_approved_at: string | null; organizer: string; checklist: string; efile: string; pricing: string; status_history: string; notes: string; activity: string; created_at: string; completed_at: string | null; rev: number };
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
  return [r.clientId, r.enrollmentId ?? null, r.taxYear, r.kind, r.form, r.filingStatus ?? null, big(r.states ?? []), r.status, r.preparerId, r.reviewerId, r.dueAt ?? null, r.extension ? big(r.extension) : null, r.reviewSignoff ? big(r.reviewSignoff) : null, r.approvalSignatureId ?? null, r.clientApprovedAt ?? null, big(r.organizer), big(r.checklist ?? []), big(r.efile ?? []), big(r.pricing), big(r.statusHistory ?? []), big(r.notes ?? []), big(r.activity ?? []), r.completedAt ?? null];
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
  const t = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO tax_returns (id, client_id, enrollment_id, tax_year, kind, form, filing_status, states, status, preparer_id, reviewer_id, due_at, extension, review_signoff, approval_signature_id, client_approved_at, organizer, checklist, efile, pricing, status_history, notes, activity, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(r.id, ...fields(r), t, t),
    ...assignmentStmts(env.DB, r),
  ]);
  await audit(env.DB, a, { action: "Record update", resource: `Tax return ${r.id}`, department: "tax", meta: "Return created" });
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
  const same = (k: keyof TaxReturn) => JSON.stringify(next[k] ?? null) === JSON.stringify(cur[k] ?? null);
  const need = (action: "edit" | "assign" | "approve", what: string) => { if (!canDo(a.policy, a.member, "tax", action)) throw forbidden(`Your role can't ${what}.`); };
  const changed: string[] = [];
  if (next.preparerId !== cur.preparerId || next.reviewerId !== cur.reviewerId) { need("assign", "change the preparer or reviewer"); await checkStaff(env.DB, next.preparerId, next.reviewerId); changed.push("assignment"); }
  if (!same("reviewSignoff")) { need("approve", "sign off returns"); changed.push("review sign-off"); }
  if (!same("efile")) { need("approve", "transmit or record e-file results"); changed.push("e-file"); }
  const rest: (keyof TaxReturn)[] = ["form", "filingStatus", "states", "status", "dueAt", "extension", "approvalSignatureId", "clientApprovedAt", "organizer", "checklist", "pricing", "statusHistory", "notes", "completedAt", "enrollmentId"];
  const other = rest.filter((k) => !same(k));
  if (other.length) { need("edit", "edit returns"); changed.push(...other.map(String)); }
  const newActivity = !same("activity");
  if (!changed.length && !newActivity) return cur;
  // Timeline entries can only be added, never edited away.
  if (cur.activity.some((x) => !(next.activity ?? []).some((y) => y.id === x.id))) throw badRequest("History entries can't be removed.");
  const t = now();
  const res = await env.DB.batch([
    env.DB.prepare("UPDATE tax_returns SET client_id = ?, enrollment_id = ?, tax_year = ?, kind = ?, form = ?, filing_status = ?, states = ?, status = ?, preparer_id = ?, reviewer_id = ?, due_at = ?, extension = ?, review_signoff = ?, approval_signature_id = ?, client_approved_at = ?, organizer = ?, checklist = ?, efile = ?, pricing = ?, status_history = ?, notes = ?, activity = ?, completed_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?").bind(...fields(next), t, id, cur.rev!),
    ...(changed.includes("assignment") ? assignmentStmts(env.DB, next) : []),
  ]);
  if (!res[0].meta.changes) throw new HttpError(409, "Someone else updated this return. Reloading the latest version.", "conflict");
  if (changed.length) await audit(env.DB, a, { action: changed.includes("assignment") ? "Assignment change" : changed.includes("review sign-off") ? "Approval" : "Record update", resource: `Tax return ${id}`, department: "tax", meta: `Changed: ${[...new Set(changed)].join(", ")}` });
  return load(env, a, id);
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
export async function emailDocumentRequest(env: AppEnv, a: Actor, id: string, names: unknown) {
  requirePermission(a, "tax", "edit");
  if (a.kind !== "staff") throw forbidden();
  const r = await load(env, a, id);
  // Document names only (the interview's list can arrive before the checklist finishes saving).
  const list = [...new Set((Array.isArray(names) ? names : []).map((x) => str(x, 200).replace(/[\r\n]+/g, " ")).filter(Boolean))].slice(0, 40);
  if (!list.length) throw badRequest("Choose at least one document.");
  const c = await one<{ name: string; contact_name: string | null; email: string | null }>(env.DB, "SELECT name, contact_name, email FROM clients WHERE id = ?", r.clientId);
  if (!c?.email) throw badRequest("This client has no email address on file.");
  if (!(await rateLimit(env.DB, `docreq:${id}`, 10, 60))) throw new HttpError(429, "Too many requests for this return in the last hour.", "rate_limited");
  const first = (c.contact_name || c.name).split(" ")[0];
  const text = [
    `Hi ${first},`,
    "",
    `Thank you for completing your ${r.taxYear} tax interview with MKB Financial Group. To finish your return, we still need:`,
    "",
    ...list.map((n) => `  • ${n}`),
    "",
    "Please drop them off at our office, or wait for your secure upload link. For your security, please do not email tax documents.",
    "",
    "Questions? Call us at 833-379-3320.",
    "",
    "MKB Financial Group",
  ].join("\n");
  const out = await sendEmail(env, { to: c.email, template: "tax_document_request", subject: `Documents needed for your ${r.taxYear} tax return`, text });
  await audit(env.DB, a, { action: "Record update", resource: `Tax return ${id}`, department: "tax", meta: `Emailed document request (${list.length} item${list.length > 1 ? "s" : ""})${out.sent ? "" : " — queued, not sent"}` });
  return { sent: out.sent, count: list.length };
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
