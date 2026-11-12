/**
 * Record Expungement — server side. Matters and cases hold criminal-history
 * details, so each record is stored encrypted (AES-GCM, bound to its id) and
 * every load of the module is written to the audit log. Reading needs Record
 * Expungement "view" plus access to the client; new matters and cases need
 * "create"; changing who is assigned needs "assign"; approving administrative
 * processing, internal quality approval and a granted or completed case need
 * "approve"; jurisdictions, services and prices need "settings"; anything else
 * needs "edit". A case is only "Submitted" with a verified filing confirmation
 * on file, only "Granted" with a verified court order, and only "Completed"
 * after it was granted. Document preparation can't start until the client
 * accepted the engagement letter (when that rule is on). History, reviews and
 * notes can only be added, and new entries are recorded as the signed-in
 * person. Nothing is filed with any court from here. Server-only.
 */
import { CASE_STATUSES, RELEASE_STATES, type ExpCase, type ExpMatter } from "@/lib/expunge/config";
import { fillLetter } from "@/lib/engagement/letters";
import { feeWords } from "@/lib/fees/config";
import { canDo, clientAccess } from "@/lib/team/policy";
import type { ServiceKey } from "@/lib/types";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, str, type AppEnv } from "./core";
import { decryptField, encryptField } from "./crypto";
import { assignmentSets } from "./clients";
import { currentLetters, letterVersion } from "./engagement";
import { audit, requirePermission, type Actor } from "./identity";
import { buildLetterPdf } from "./intake-pdf";
import { loadFees, loadTaxRules } from "./settings";
import { stampNew, storeClientPdf } from "./tax";

type Staff = Extract<Actor, { kind: "staff" }>;
export type ExpKind = "exp_matter" | "exp_case";
type Rec = ExpMatter | ExpCase;
type Row = { id: string; kind: ExpKind; client_id: string; data: string; encrypted: number; rev: number };
const MAX_JSON = 400_000;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,80}$/;
const LABEL: Record<ExpKind, string> = { exp_matter: "Expungement matter", exp_case: "Expungement case" };
const APPROVE_STATUSES = new Set(["Granted", "Completed"]);
const PREP_STATUSES = new Set(["Preparing", "Awaiting Client Approval", "Ready for Filing", "Submitted", "Awaiting Agency / Court Response", "Hearing Scheduled", "Additional Information Requested", "Granted", "Denied", "Completed"]);

const staffOnly = (a: Actor): Staff => { if (a.kind !== "staff") throw forbidden(); return a; };
const aad = (id: string) => `service_record:${id}`;
const key = (env: AppEnv) => { if (!env.ENCRYPTION_KEY) throw new HttpError(503, "Encryption isn't set up on the server."); return env.ENCRYPTION_KEY; };
async function seal(env: AppEnv, id: string, v: unknown) {
  const t = JSON.stringify(v ?? null);
  if (t.length > MAX_JSON) throw new HttpError(413, "This record is too large to save.");
  return JSON.stringify(await encryptField(key(env), t, aad(id)));
}
async function open<T>(env: AppEnv, r: Row): Promise<T> {
  if (!r.encrypted) return json<T>(r.data, {} as T);
  return JSON.parse(await decryptField(key(env), json<{ ciphertext: string; iv: string }>(r.data, { ciphertext: "", iv: "" }), aad(r.id))) as T;
}

async function accessible(env: AppEnv, a: Staff, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const uniq = [...new Set(ids)];
  const [rows, sets] = await Promise.all([
    all<{ id: string; services: string | null }>(env.DB, `SELECT c.id, (SELECT group_concat(service) FROM client_services s WHERE s.client_id = c.id) AS services FROM clients c WHERE c.id IN (${uniq.map(() => "?").join(",")})`, ...uniq),
    assignmentSets(env, a.member.id),
  ]);
  return new Set(rows.filter((c) => clientAccess(a.policy, a.member, { id: c.id, services: (c.services ? c.services.split(",") : []) as ServiceKey[] }, sets)).map((c) => c.id));
}

export async function listExp(env: AppEnv, a: Actor) {
  requirePermission(a, "exp", "view");
  const s = staffOnly(a);
  const rows = await all<Row>(env.DB, "SELECT id, kind, client_id, data, encrypted, rev FROM service_records WHERE kind IN ('exp_matter', 'exp_case') ORDER BY created_at DESC");
  const ok = await accessible(env, s, rows.map((r) => r.client_id));
  const mine = rows.filter((r) => ok.has(r.client_id));
  const out = await Promise.all(mine.map(async (r) => ({ kind: r.kind, rec: { ...(await open<Rec>(env, r)), rev: r.rev } })));
  if (mine.length) await audit(env.DB, s, { action: "Client record access", resource: "Record Expungement", department: "exp", meta: `Opened ${mine.filter((r) => r.kind === "exp_matter").length} matter(s) and ${mine.filter((r) => r.kind === "exp_case").length} case(s)` });
  return { matters: out.filter((x) => x.kind === "exp_matter").map((x) => x.rec), cases: out.filter((x) => x.kind === "exp_case").map((x) => x.rec), config: await loadExpConfig(env) };
}

async function loadRow(env: AppEnv, a: Staff, kind: ExpKind, id: string) {
  const r = await one<Row>(env.DB, "SELECT id, kind, client_id, data, encrypted, rev FROM service_records WHERE id = ? AND kind = ?", id, kind);
  if (!r) throw notFound(`${LABEL[kind]} not found.`);
  if (!(await accessible(env, a, [r.client_id])).has(r.client_id)) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  return r;
}
async function checkStaff(env: AppEnv, ids: (string | undefined)[]) {
  for (const id of [...new Set(ids.filter(Boolean))]) if (!(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", id))) throw badRequest("Assign the work to active team members.");
}
const assignees = (kind: ExpKind, r: Rec) => (kind === "exp_matter" ? Object.values((r as ExpMatter).assignments ?? {}) : [(r as ExpCase).assignedTo]);
function assignStmts(env: AppEnv, kind: ExpKind, r: Rec) {
  const src = kind === "exp_matter" ? "exp_matter" : "exp_case";
  return [
    env.DB.prepare("DELETE FROM record_assignments WHERE record_id = ? AND source = ?").bind(r.id, src),
    ...[...new Set(assignees(kind, r))].filter(Boolean).map((m) => env.DB.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, ?, ? FROM members WHERE id = ?").bind(r.clientId, src, r.id, m)),
  ];
}

/** Engagement acceptance on a matter: real letter versions, recorded once, stamped by the server. */
async function checkEngagement(env: AppEnv, a: Staff, cur: ExpMatter | null, next: ExpMatter): Promise<ExpMatter> {
  const e = next.engagement;
  const was = cur?.engagement;
  if (was) { if (JSON.stringify(e ?? null) !== JSON.stringify(was)) throw badRequest("An accepted engagement letter can't be changed or removed."); return next; }
  if (!e) return next;
  const name = str(e.acceptedName, 120);
  if (name.length < 2) throw badRequest("Enter the client's full name to accept the engagement letter.");
  const [l, t] = await Promise.all([letterVersion(env, "exp", Number(e.version)), letterVersion(env, "terms", Number(e.termsVersion))]);
  if (!l || !t) throw badRequest("That version of the engagement letter doesn't exist.");
  const method = e.method === "online" ? "online" : e.method === "paper" ? "paper" : "in_office";
  return { ...next, engagement: { letterKey: "exp", version: l.version, termsVersion: t.version, acceptedName: name, acceptedAt: now(), method, recordedBy: a.member.id } };
}

function stampMatter(me: string, cur: ExpMatter | null, next: ExpMatter): ExpMatter {
  return { ...next, notes: stampNew(cur?.notes, next.notes, (n) => ({ ...n, authorId: me, at: now() })), intake: next.intake?.reviewedBy && next.intake.reviewedBy !== cur?.intake?.reviewedBy ? { ...next.intake, reviewedBy: me } : next.intake };
}
function stampCase(me: string, cur: ExpCase | null, next: ExpCase): ExpCase {
  return {
    ...next,
    history: stampNew(cur?.history, next.history, (h) => (h.byId === "client" ? h : { ...h, byId: me, at: now() })),
    internalNotes: stampNew(cur?.internalNotes, next.internalNotes, (n) => ({ ...n, authorId: me, at: now() })),
    screening: { ...next.screening, reviews: stampNew(cur?.screening?.reviews, next.screening?.reviews, (r) => ({ ...r, byId: me, at: now() })) },
  };
}

async function checkCase(env: AppEnv, cur: ExpCase | null, next: ExpCase, need: (x: "edit" | "assign" | "approve", what: string) => void) {
  const changed: string[] = [];
  if (!(CASE_STATUSES as readonly string[]).includes(next.status)) throw badRequest("Unknown status.");
  if (cur) {
    if (next.matterId !== cur.matterId || next.clientId !== cur.clientId) throw badRequest("A case's matter and client can't change.");
    if (next.history.length < cur.history.length || cur.history.some((h, i) => JSON.stringify(h) !== JSON.stringify(next.history[i]))) throw badRequest("Case history can't be changed.");
    const reviews = cur.screening?.reviews ?? [];
    if (reviews.some((r) => !(next.screening?.reviews ?? []).some((x) => x.id === r.id && JSON.stringify(x) === JSON.stringify(r)))) throw badRequest("Screening reviews can't be changed or removed.");
    if ((cur.internalNotes ?? []).some((x) => !(next.internalNotes ?? []).some((y) => y.id === x.id))) throw badRequest("Notes can't be removed.");
    if (next.assignedTo !== cur.assignedTo) { need("assign", "reassign cases"); changed.push("assignment"); }
  }
  const newReviews = (next.screening?.reviews ?? []).filter((r) => !(cur?.screening?.reviews ?? []).some((x) => x.id === r.id));
  if (newReviews.some((r) => r.outcome === "Administrative Processing Approved")) { need("approve", "approve administrative processing"); changed.push("screening approval"); }
  if (next.prep?.status === "internally_approved" && cur?.prep?.status !== "internally_approved") { need("approve", "give internal quality approval"); changed.push("internal approval"); }
  const from = cur?.status ?? "Not Started";
  if (next.status !== from) {
    if (APPROVE_STATUSES.has(next.status)) need("approve", `mark a case ${next.status}`);
    if (next.status === "Submitted" && (!next.filing?.confirmationVerified || !str(next.filing.confirmationNumber, 120) || !next.filing.confirmationDocId)) throw badRequest("A case is only Submitted with a verified filing confirmation number and the confirmation document on file.");
    if (next.status === "Granted" && (!next.filing?.finalOrderVerified || !next.filing.finalOrderDocId)) throw badRequest("A case is only Granted with the court's signed order on file and verified.");
    if (next.status === "Completed" && (from !== "Granted" || !next.filing?.finalOrderDocId)) throw badRequest("Only a granted case with its order on file can be completed.");
    changed.push(`status → ${next.status}`);
  }
  return changed;
}

export async function createExp(env: AppEnv, a: Actor, kind: ExpKind, input: Rec) {
  requirePermission(a, "exp", "create");
  const s = staffOnly(a);
  if (!input || typeof input !== "object" || !ID_RE.test(String(input.id ?? ""))) throw badRequest("Invalid record ID.");
  let rec = { ...input } as Rec & { rev?: number };
  delete rec.rev;
  const clientId = str(rec.clientId, 80);
  if (!clientId || !(await accessible(env, s, [clientId])).has(clientId)) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  const ids = assignees(kind, rec);
  if (ids.some((x) => x && x !== s.member.id) && !canDo(s.policy, s.member, "exp", "assign")) throw forbidden("Your role can't assign work to someone else.");
  await checkStaff(env, ids);
  if (kind === "exp_case") {
    const m = await one<{ client_id: string }>(env.DB, "SELECT client_id FROM service_records WHERE id = ? AND kind = 'exp_matter'", (rec as ExpCase).matterId);
    if (!m || m.client_id !== clientId) throw badRequest("That matter doesn't exist yet.");
    const c = rec as ExpCase;
    if (c.status !== "Not Started") throw badRequest("A new case starts as Not Started.");
    await checkCase(env, null, c, () => { throw forbidden("A new case can't include approvals."); });
    rec = stampCase(s.member.id, null, c);
  } else rec = stampMatter(s.member.id, null, await checkEngagement(env, s, null, rec as ExpMatter));
  if (await one(env.DB, "SELECT 1 FROM service_records WHERE id = ?", rec.id)) throw new HttpError(409, "That record already exists. Reloading.", "exists");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO service_records (id, kind, client_id, data, encrypted, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)").bind(rec.id, kind, clientId, await seal(env, rec.id, rec), t, s.member.id, t),
    ...assignStmts(env, kind, rec),
  ]);
  await audit(env.DB, s, { action: "Record update", resource: `${LABEL[kind]} ${rec.number ?? rec.id}`, department: "exp", meta: "Created" });
  const row = await loadRow(env, s, kind, rec.id);
  return { ...(await open<Rec>(env, row)), rev: row.rev };
}

export async function saveExp(env: AppEnv, a: Actor, kind: ExpKind, id: string, input: Rec & { rev?: number }) {
  requirePermission(a, "exp", "view");
  const s = staffOnly(a);
  if (!input || typeof input !== "object" || input.id !== id) throw badRequest("Invalid record.");
  const row = await loadRow(env, s, kind, id);
  if (Number(input.rev) !== row.rev) throw new HttpError(409, "Someone else updated this record. Reloading the latest version.", "conflict");
  const cur = await open<Rec>(env, row);
  let next = { ...input } as Rec & { rev?: number };
  delete next.rev;
  if (next.clientId !== cur.clientId) throw badRequest("A record's client can't change.");
  const need = (x: "edit" | "assign" | "approve", what: string) => { if (!canDo(s.policy, s.member, "exp", x)) throw forbidden(`Your role can't ${what}.`); };
  const changed: string[] = [];
  if (kind === "exp_case") {
    const c = stampCase(s.member.id, cur as ExpCase, next as ExpCase);
    changed.push(...(await checkCase(env, cur as ExpCase, c, need)));
    if (PREP_STATUSES.has(c.status) && !PREP_STATUSES.has((cur as ExpCase).status) && (await loadTaxRules(env)).requireEngagement) {
      const m = await loadRow(env, s, "exp_matter", c.matterId);
      if (!(await open<ExpMatter>(env, m)).engagement) throw badRequest("The client needs to accept the engagement letter before document preparation starts.");
    }
    next = c;
  } else {
    const cm = cur as ExpMatter;
    let m = await checkEngagement(env, s, cm, next as ExpMatter);
    m = stampMatter(s.member.id, cm, m);
    if (cm.notes.some((x) => !m.notes.some((y) => y.id === x.id))) throw badRequest("Notes can't be removed.");
    if (JSON.stringify(m.assignments) !== JSON.stringify(cm.assignments)) { need("assign", "change who works on this matter"); changed.push("assignment"); }
    if (m.engagement && !cm.engagement) changed.push("engagement letter accepted");
    next = m;
  }
  if (JSON.stringify(next) === JSON.stringify(cur)) return { ...cur, rev: row.rev };
  const skip = new Set(["assignments", "assignedTo", "engagement", "history", "access"]);
  const other = Object.keys({ ...cur, ...next }).filter((k) => !skip.has(k) && JSON.stringify((next as Record<string, unknown>)[k] ?? null) !== JSON.stringify((cur as Record<string, unknown>)[k] ?? null));
  if (other.length || (kind === "exp_case" && (next as ExpCase).status !== (cur as ExpCase).status)) need("edit", "edit expungement records");
  changed.push(...other);
  if (changed.includes("assignment")) await checkStaff(env, assignees(kind, next));
  const res = await env.DB.batch([
    env.DB.prepare("UPDATE service_records SET data = ?, encrypted = 1, updated_at = ?, rev = rev + 1 WHERE id = ? AND kind = ? AND rev = ?").bind(await seal(env, id, next), now(), id, kind, row.rev),
    ...(changed.includes("assignment") ? assignStmts(env, kind, next) : []),
  ]);
  if (!res[0].meta.changes) throw new HttpError(409, "Someone else updated this record. Reloading the latest version.", "conflict");
  if (kind === "exp_matter" && changed.includes("engagement letter accepted")) await saveEngagementPdf(env, s, next as ExpMatter).catch(() => null);
  // Field names only — never criminal-history content — go to the audit log.
  const action = changed.includes("assignment") ? "Assignment change" : changed.some((c) => /approval|Granted|Completed/.test(c)) ? "Approval" : "Record update";
  await audit(env.DB, s, { action, resource: `${LABEL[kind]} ${next.number ?? id}`, department: "exp", meta: `Changed: ${[...new Set(changed)].slice(0, 12).join(", ") || "details"}` });
  const after = await loadRow(env, s, kind, id);
  return { ...(await open<Rec>(env, after)), rev: after.rev };
}

/* ---------------------------------------------------------------- settings */
export type ExpConfig = { jurisdictions: unknown[]; services: unknown[]; prices: unknown[] };
export async function loadExpConfig(env: AppEnv): Promise<(ExpConfig & { updatedAt: string }) | null> {
  const r = await one<{ data: string; updated_at: string }>(env.DB, "SELECT data, updated_at FROM service_settings WHERE key = 'exp'").catch(() => null);
  return r ? { ...json<ExpConfig>(r.data, { jurisdictions: [], services: [], prices: [] }), updatedAt: r.updated_at } : null;
}
export async function saveExpConfig(env: AppEnv, a: Actor, b: { config?: Partial<ExpConfig>; updatedAt?: string | null }) {
  requirePermission(a, "exp", "settings");
  const s = staffOnly(a);
  const c = b.config;
  if (!c || !Array.isArray(c.jurisdictions) || !Array.isArray(c.services) || !Array.isArray(c.prices)) throw badRequest("Invalid settings.");
  const cur = await loadExpConfig(env);
  if (cur && b.updatedAt !== cur.updatedAt) throw new HttpError(409, "Someone else changed these settings. Reloading the latest version.", "conflict");
  // Only the release states can be active.
  const jurisdictions = (c.jurisdictions as { state?: string; active?: boolean }[]).slice(0, 200).map((j) => ((RELEASE_STATES as readonly string[]).includes(String(j.state)) ? j : { ...j, active: false }));
  const clean: ExpConfig = { jurisdictions, services: c.services.slice(0, 100), prices: c.prices.slice(0, 500) };
  const t = JSON.stringify(clean);
  if (t.length > MAX_JSON) throw new HttpError(413, "These settings are too large to save.");
  await env.DB.prepare("INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('exp', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by").bind(t, now(), s.member.id).run();
  await audit(env.DB, s, { action: "Record update", resource: "Record Expungement settings", department: "exp", meta: "Jurisdictions, services or prices updated" });
  return { config: await loadExpConfig(env) };
}

/* ---------------------------------------------------------------- engagement letter */
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
async function letterVars(env: AppEnv, m: ExpMatter, at: string) {
  const c = await one<{ name: string; contact_name: string | null }>(env.DB, "SELECT name, contact_name FROM clients WHERE id = ?", m.clientId);
  return { ...feeWords(await loadFees(env)), clientName: c?.contact_name || c?.name || "Client", service: "Record expungement", fee: "", taxYear: "", date: longDate(at) };
}
async function saveEngagementPdf(env: AppEnv, a: Staff, m: ExpMatter) {
  const e = m.engagement;
  if (!e) return;
  const [l, t] = await Promise.all([letterVersion(env, "exp", e.version), letterVersion(env, "terms", e.termsVersion)]);
  if (!l || !t) return;
  const vars = await letterVars(env, m, e.acceptedAt);
  const recorder = (await one<{ name: string }>(env.DB, "SELECT name FROM members WHERE id = ?", e.recordedBy ?? ""))?.name;
  const pdf = await buildLetterPdf({ clientName: vars.clientName, parts: [{ title: fillLetter(l.title, vars), body: fillLetter(l.body, vars), version: l.version }, { title: fillLetter(t.title, vars), body: fillLetter(t.body, vars), version: t.version }], acceptedName: e.acceptedName, acceptedAt: e.acceptedAt, method: e.method, recordedBy: recorder });
  await storeClientPdf(env, a, m.clientId, pdf, { name: `${m.number} engagement letter — record expungement (accepted ${longDate(e.acceptedAt)})`, fileName: `MKB-Engagement-Letter-${m.number}.pdf`, category: "Engagement letter", service: "expunge", activity: `Saved the signed engagement letter for ${m.number} to Documents` });
}
export async function expLetter(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "exp", "view");
  const s = staffOnly(a);
  const row = await loadRow(env, s, "exp_matter", id);
  const m = await open<ExpMatter>(env, row);
  const e = m.engagement;
  const cur = await currentLetters(env);
  const letter = (e && (await letterVersion(env, "exp", e.version))) || cur.exp;
  const terms = (e && (await letterVersion(env, "terms", e.termsVersion))) || cur.terms;
  const vars = await letterVars(env, m, e?.acceptedAt ?? now());
  return { letter: { version: letter.version, title: fillLetter(letter.title, vars), body: fillLetter(letter.body, vars) }, terms: { version: terms.version, title: fillLetter(terms.title, vars), body: fillLetter(terms.body, vars) }, engagement: e ?? null };
}

/** Only a client-entered case that staff haven't reviewed yet can be removed. */
export async function deleteExpDraft(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "exp", "edit");
  const s = staffOnly(a);
  const row = await loadRow(env, s, "exp_case", id);
  const c = await open<ExpCase>(env, row);
  if (!c.draft) throw badRequest("Only an unreviewed case the client entered can be removed.");
  await env.DB.batch([env.DB.prepare("DELETE FROM service_records WHERE id = ? AND kind = 'exp_case'").bind(id), env.DB.prepare("DELETE FROM record_assignments WHERE record_id = ? AND source = 'exp_case'").bind(id)]);
  await audit(env.DB, s, { action: "Record update", resource: `${LABEL.exp_case} ${c.number}`, department: "exp", meta: "Removed an unreviewed client-entered case" });
  return { ok: true };
}
