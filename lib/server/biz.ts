/**
 * Business Services — server side. Requests, business entities and compliance
 * deadlines are each saved as one record with a revision (a stale save is
 * refused). Reading needs Business Services "view" plus access to the client;
 * new records need "create"; changing who is assigned needs "assign";
 * approvals, completion and proceeding before payment need "approve"; the
 * service catalog, compliance rules and checklists need "settings"; anything
 * else needs "edit". History, notes and agency entries can only be added, and
 * new entries are recorded as the signed-in person whatever the browser says.
 * An agency approval needs a reference, a verified confirmation and the
 * confirmation document; work can't start until the client has accepted the
 * engagement letter (when that rule is on). Nothing is filed with any agency
 * from here. Server-only.
 */
import { REQUEST_STATUSES, type BizEntity, type ComplianceItem, type ServiceRequest } from "@/lib/biz/config";
import { fillLetter } from "@/lib/engagement/letters";
import { canDo, clientAccess, roleOf } from "@/lib/team/policy";
import type { ServiceKey } from "@/lib/types";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, str, type AppEnv } from "./core";
import { assignmentSets } from "./clients";
import { currentLetters, letterVersion } from "./engagement";
import { audit, requirePermission, type Actor } from "./identity";
import { buildLetterPdf } from "./intake-pdf";
import { loadFees, loadTaxRules } from "./settings";
import { stampNew, storeClientPdf } from "./tax";
import { feeWords } from "@/lib/fees/config";

type Staff = Extract<Actor, { kind: "staff" }>;
export type BizKind = "biz_request" | "biz_entity" | "biz_item";
type Rec = ServiceRequest | BizEntity | ComplianceItem;
type Row = { id: string; kind: BizKind; client_id: string | null; data: string; rev: number };
const MAX_JSON = 400_000;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,80}$/;
const LABEL: Record<BizKind, string> = { biz_request: "Business service request", biz_entity: "Business entity", biz_item: "Compliance deadline" };
/** Statuses only someone who can approve may move a request into. */
const APPROVE_STATUSES = new Set(["Approved", "Completed"]);
/** Work has started: the engagement letter must be accepted first. */
const WORK_STATUSES = new Set(["In Progress", "Submitted to Agency", "Awaiting Agency Response", "Approved", "Documents Delivered", "Completed"]);

const staffOnly = (a: Actor): Staff => { if (a.kind !== "staff") throw forbidden(); return a; };
const big = (v: unknown) => { const t = JSON.stringify(v ?? null); if (t.length > MAX_JSON) throw new HttpError(413, "This record is too large to save."); return t; };
const withRev = <T,>(r: Row): T & { rev: number } => ({ ...json<T>(r.data, {} as T), rev: r.rev });

/** Which clients (by id) this person may open. */
async function accessible(env: AppEnv, a: Staff, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const uniq = [...new Set(ids)];
  const [rows, sets] = await Promise.all([
    all<{ id: string; services: string | null }>(env.DB, `SELECT c.id, (SELECT group_concat(service) FROM client_services s WHERE s.client_id = c.id) AS services FROM clients c WHERE c.id IN (${uniq.map(() => "?").join(",")})`, ...uniq),
    assignmentSets(env, a.member.id),
  ]);
  return new Set(rows.filter((c) => clientAccess(a.policy, a.member, { id: c.id, services: (c.services ? c.services.split(",") : []) as ServiceKey[] }, sets)).map((c) => c.id));
}
/** A prospect's request (no client yet): the people on it, all-department roles and the Business Services department. */
function prospectOk(a: Staff, r: ServiceRequest) {
  if (r.assignedTo === a.member.id || r.reviewerId === a.member.id) return true;
  const role = roleOf(a.policy.roles, a.member);
  return !!role && (role.allDepartments || a.member.departments.includes("biz"));
}
async function visible(env: AppEnv, a: Staff, rows: Row[]) {
  const ok = await accessible(env, a, rows.map((r) => r.client_id).filter((x): x is string => !!x));
  return rows.filter((r) => (r.client_id ? ok.has(r.client_id) : r.kind === "biz_request" && prospectOk(a, json<ServiceRequest>(r.data, {} as ServiceRequest))));
}

export async function listBiz(env: AppEnv, a: Actor) {
  requirePermission(a, "biz", "view");
  const s = staffOnly(a);
  const rows = await visible(env, s, await all<Row>(env.DB, "SELECT id, kind, client_id, data, rev FROM service_records WHERE kind IN ('biz_request', 'biz_entity', 'biz_item') ORDER BY created_at DESC"));
  const of = <T,>(k: BizKind) => rows.filter((r) => r.kind === k).map((r) => withRev<T>(r));
  return { requests: of<ServiceRequest>("biz_request"), entities: of<BizEntity>("biz_entity"), items: of<ComplianceItem>("biz_item"), config: await loadBizConfig(env) };
}

async function loadRow(env: AppEnv, a: Staff, kind: BizKind, id: string) {
  const r = await one<Row>(env.DB, "SELECT id, kind, client_id, data, rev FROM service_records WHERE id = ? AND kind = ?", id, kind);
  if (!r) throw notFound(`${LABEL[kind]} not found.`);
  if (!(await visible(env, a, [r])).length) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  return r;
}

async function checkStaff(env: AppEnv, ...ids: (string | undefined)[]) {
  for (const id of ids) if (id && !(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", id))) throw badRequest("Assign the work to active team members.");
}
/** The client an entity, deadline or request belongs to (deadlines inherit their business's client). */
async function clientOf(env: AppEnv, kind: BizKind, rec: Rec): Promise<string | null> {
  if (kind === "biz_item") {
    const e = await one<{ client_id: string | null }>(env.DB, "SELECT client_id FROM service_records WHERE id = ? AND kind = 'biz_entity'", (rec as ComplianceItem).entityId);
    if (!e) throw badRequest("That business doesn't exist yet.");
    return e.client_id;
  }
  const c = (rec as ServiceRequest | BizEntity).clientId;
  return c ? str(c, 80) : null;
}

/** Engagement acceptance: points at a real letter version, is recorded once, and is stamped by the server. */
async function checkEngagement(env: AppEnv, a: Staff, cur: ServiceRequest | null, next: ServiceRequest): Promise<ServiceRequest> {
  const e = next.engagement;
  const was = cur?.engagement;
  if (was) {
    if (JSON.stringify(e ?? null) !== JSON.stringify(was)) throw badRequest("An accepted engagement letter can't be changed or removed.");
    return next;
  }
  if (!e) return next;
  const name = str(e.acceptedName, 120);
  if (name.length < 2) throw badRequest("Enter the client's full name to accept the engagement letter.");
  const [l, t] = await Promise.all([letterVersion(env, "biz", Number(e.version)), letterVersion(env, "terms", Number(e.termsVersion))]);
  if (!l || !t) throw badRequest("That version of the engagement letter doesn't exist.");
  const method = e.method === "online" ? "online" : e.method === "paper" ? "paper" : "in_office";
  return { ...next, engagement: { letterKey: "biz", version: l.version, termsVersion: t.version, acceptedName: name, acceptedAt: now(), method, recordedBy: a.member.id } };
}

function cleanRequest(r: ServiceRequest): ServiceRequest {
  if (!(REQUEST_STATUSES as readonly string[]).includes(r.status)) throw badRequest("Unknown status.");
  if (!str(r.businessName, 200)) throw badRequest("Enter the business name.");
  return { ...r, businessName: str(r.businessName, 200), description: str(r.description, 4000), serviceName: str(r.serviceName, 200), quote: { ...r.quote, lines: (r.quote?.lines ?? []).slice(0, 60).map((l) => ({ ...l, label: str(l.label, 200), amount: Math.round(Math.max(-1_000_000, Math.min(1_000_000, Number(l.amount) || 0)) * 100) / 100 })) } };
}

/** Request changes that need a specific permission (and the ones nobody may make). */
async function checkRequest(env: AppEnv, a: Staff, cur: ServiceRequest, next: ServiceRequest, need: (x: "edit" | "assign" | "approve", what: string) => void) {
  const changed: string[] = [];
  if (next.clientId !== cur.clientId) {
    if (cur.clientId) throw badRequest("A request's client can't change.");
    if (!(await accessible(env, a, [next.clientId!])).has(next.clientId!)) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
    changed.push("linked to client");
  }
  if (next.assignedTo !== cur.assignedTo || next.reviewerId !== cur.reviewerId) { need("assign", "change who is assigned"); await checkStaff(env, next.assignedTo, next.reviewerId); changed.push("assignment"); }
  if (next.history.length < cur.history.length || cur.history.some((h, i) => JSON.stringify(h) !== JSON.stringify(next.history[i]))) throw badRequest("Request history can't be changed.");
  if (cur.agency.some((x) => !next.agency.some((y) => y.id === x.id && JSON.stringify(x) === JSON.stringify(y)))) throw badRequest("Agency entries can't be changed or removed.");
  if (cur.notes.some((x) => !next.notes.some((y) => y.id === x.id))) throw badRequest("Notes can't be removed.");
  for (const ev of next.agency.filter((x) => !cur.agency.some((y) => y.id === x.id))) {
    if (ev.kind === "approved") {
      need("approve", "record an agency approval");
      if (!ev.verified || !str(ev.reference, 120) || !ev.confirmationDocId) throw badRequest("An approval needs the agency's reference number, a verified confirmation and the confirmation document.");
    }
  }
  if (next.status !== cur.status) {
    if (APPROVE_STATUSES.has(next.status)) need("approve", `move a request to ${next.status}`);
    if (WORK_STATUSES.has(next.status) && !WORK_STATUSES.has(cur.status) && !next.engagement && (await loadTaxRules(env)).requireEngagement && next.clientId)
      throw badRequest("The client needs to accept the engagement letter before work starts.");
    changed.push(`status → ${next.status}`);
  }
  if ((next.approvedBy ?? null) !== (cur.approvedBy ?? null) || (next.completedAt ?? null) !== (cur.completedAt ?? null)) { need("approve", "approve completion"); changed.push("completion"); }
  if ((next.paymentWaived ?? null) !== (cur.paymentWaived ?? null)) { need("approve", "let work proceed before payment"); changed.push("payment override"); }
  const reviewed = next.deliverables.some((d) => { const o = cur.deliverables.find((x) => x.id === d.id); return (d.status === "approved" && o?.status !== "approved") || (d.reviewedBy ?? null) !== (o?.reviewedBy ?? null) && !!d.reviewedBy; });
  if (reviewed) { need("approve", "approve deliverables"); changed.push("deliverable review"); }
  return changed;
}

/** New notes, history steps and agency entries are recorded as the signed-in person. */
function stampRequest(me: string, cur: ServiceRequest | null, next: ServiceRequest): ServiceRequest {
  return {
    ...next,
    notes: stampNew(cur?.notes, next.notes, (n) => ({ ...n, authorId: me, at: now() })),
    history: stampNew(cur?.history, next.history, (h) => (h.byId === "client" || h.byId === "system" ? h : { ...h, byId: me, at: now() })),
    agency: stampNew(cur?.agency, next.agency, (e) => ({ ...e, byId: me })),
    approvedBy: next.approvedBy && next.approvedBy !== cur?.approvedBy ? me : next.approvedBy,
    deliverables: next.deliverables.map((d) => { const o = cur?.deliverables.find((x) => x.id === d.id); return d.reviewedBy && d.reviewedBy !== o?.reviewedBy ? { ...d, reviewedBy: me } : d; }),
  };
}

export async function createBiz(env: AppEnv, a: Actor, kind: BizKind, input: Rec) {
  requirePermission(a, "biz", "create");
  const s = staffOnly(a);
  if (!input || typeof input !== "object" || !ID_RE.test(String(input.id ?? ""))) throw badRequest("Invalid record ID.");
  let rec = { ...input } as Rec & { rev?: number };
  delete rec.rev;
  const clientId = await clientOf(env, kind, rec);
  if (clientId && !(await accessible(env, s, [clientId])).has(clientId)) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  if (kind === "biz_request") {
    let r = cleanRequest(rec as ServiceRequest);
    if (!clientId && !r.prospect?.name) throw badRequest("Choose a client or enter the prospect's contact details.");
    if (r.assignedTo !== s.member.id && !canDo(s.policy, s.member, "biz", "assign")) throw forbidden("Your role can't assign requests to someone else.");
    await checkStaff(env, r.assignedTo, r.reviewerId);
    if (APPROVE_STATUSES.has(r.status) || r.approvedBy || r.paymentWaived) throw badRequest("A new request starts at intake.");
    r = stampRequest(s.member.id, null, await checkEngagement(env, s, null, r));
    rec = r;
  }
  if (kind === "biz_entity" && !str((rec as BizEntity).legalName, 200)) throw badRequest("Enter the business's legal name.");
  if (await one(env.DB, "SELECT 1 FROM service_records WHERE id = ?", rec.id)) throw new HttpError(409, "That record already exists. Reloading.", "exists");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO service_records (id, kind, client_id, data, encrypted, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)").bind(rec.id, kind, clientId, big(rec), t, s.member.id, t),
    ...assignStmts(env, kind, rec, clientId),
  ]);
  await audit(env.DB, s, { action: "Record update", resource: `${LABEL[kind]} ${"number" in rec ? rec.number : rec.id}`, department: "biz", meta: "Created" });
  return withRev<Rec>(await loadRow(env, s, kind, rec.id));
}

/** Request assignees get the client on their assignment list (so assigned-scope roles can open it). */
function assignStmts(env: AppEnv, kind: BizKind, rec: Rec, clientId: string | null) {
  if (kind !== "biz_request" || !clientId) return [];
  const r = rec as ServiceRequest;
  return [
    env.DB.prepare("DELETE FROM record_assignments WHERE record_id = ? AND source IN ('biz_assignee', 'biz_reviewer')").bind(r.id),
    env.DB.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, 'biz_assignee', ? FROM members WHERE id = ?").bind(clientId, r.id, r.assignedTo),
    env.DB.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, 'biz_reviewer', ? FROM members WHERE id = ?").bind(clientId, r.id, r.reviewerId),
  ];
}

export async function saveBiz(env: AppEnv, a: Actor, kind: BizKind, id: string, input: Rec & { rev?: number }) {
  requirePermission(a, "biz", "view");
  const s = staffOnly(a);
  if (!input || typeof input !== "object" || input.id !== id) throw badRequest("Invalid record.");
  const row = await loadRow(env, s, kind, id);
  if (Number(input.rev) !== row.rev) throw new HttpError(409, "Someone else updated this record. Reloading the latest version.", "conflict");
  const cur = json<Rec>(row.data, {} as Rec);
  let next = { ...input } as Rec & { rev?: number };
  delete next.rev;
  const need = (x: "edit" | "assign" | "approve", what: string) => { if (!canDo(s.policy, s.member, "biz", x)) throw forbidden(`Your role can't ${what}.`); };
  let changed: string[] = [];
  let clientId = row.client_id;
  if (kind === "biz_request") {
    const c = cur as ServiceRequest;
    let n = cleanRequest(next as ServiceRequest);
    n = await checkEngagement(env, s, c, n);
    n = stampRequest(s.member.id, c, n);
    changed = await checkRequest(env, s, c, n, need);
    if (n.engagement && !c.engagement) changed.push("engagement letter accepted");
    clientId = n.clientId ?? null;
    next = n;
  } else if (kind === "biz_entity") {
    if ((next as BizEntity).clientId !== (cur as BizEntity).clientId) throw badRequest("A business's client can't change.");
  } else if ((next as ComplianceItem).entityId !== (cur as ComplianceItem).entityId) throw badRequest("A deadline's business can't change.");
  const same = JSON.stringify(next) === JSON.stringify(cur);
  if (same) return withRev<Rec>(row);
  const other = Object.keys({ ...cur, ...next }).filter((k) => !["assignedTo", "reviewerId", "approvedBy", "completedAt", "paymentWaived", "history", "agency", "deliverables", "status", "engagement", "clientId"].includes(k) && JSON.stringify((next as Record<string, unknown>)[k] ?? null) !== JSON.stringify((cur as Record<string, unknown>)[k] ?? null));
  const delivChanged = kind === "biz_request" && JSON.stringify((next as ServiceRequest).deliverables) !== JSON.stringify((cur as ServiceRequest).deliverables);
  if (other.length || delivChanged || (kind === "biz_request" && (next as ServiceRequest).status !== (cur as ServiceRequest).status)) need("edit", "edit business service records");
  changed.push(...other);
  const res = await env.DB.batch([
    env.DB.prepare("UPDATE service_records SET client_id = ?, data = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND kind = ? AND rev = ?").bind(clientId, big(next), now(), id, kind, row.rev),
    ...(changed.includes("assignment") || changed.includes("linked to client") ? assignStmts(env, kind, next, clientId) : []),
  ]);
  if (!res[0].meta.changes) throw new HttpError(409, "Someone else updated this record. Reloading the latest version.", "conflict");
  if (kind === "biz_request" && changed.includes("engagement letter accepted")) await saveEngagementPdf(env, s, next as ServiceRequest).catch(() => null);
  const label = "number" in next ? (next as ServiceRequest).number : "legalName" in next ? (next as BizEntity).legalName : (next as ComplianceItem).title;
  const action = changed.includes("assignment") ? "Assignment change" : changed.some((c) => /Approved|Completed|completion|approval|deliverable review|payment override/.test(c)) ? "Approval" : "Record update";
  await audit(env.DB, s, { action, resource: `${LABEL[kind]} ${label}`, department: "biz", meta: `Changed: ${[...new Set(changed)].slice(0, 12).join(", ") || "details"}` });
  return withRev<Rec>(await loadRow(env, s, kind, id));
}

/* ---------------------------------------------------------------- settings */
export type BizConfig = { catalog: unknown[]; rules: unknown[]; checklists: unknown[]; reminderDefaults: number[] };
export async function loadBizConfig(env: AppEnv): Promise<(BizConfig & { updatedAt: string }) | null> {
  const r = await one<{ data: string; updated_at: string }>(env.DB, "SELECT data, updated_at FROM service_settings WHERE key = 'biz'").catch(() => null);
  return r ? { ...json<BizConfig>(r.data, { catalog: [], rules: [], checklists: [], reminderDefaults: [] }), updatedAt: r.updated_at } : null;
}
export async function saveBizConfig(env: AppEnv, a: Actor, b: { config?: Partial<BizConfig>; updatedAt?: string | null }) {
  requirePermission(a, "biz", "settings");
  const s = staffOnly(a);
  const c = b.config;
  if (!c || !Array.isArray(c.catalog) || !Array.isArray(c.rules) || !Array.isArray(c.checklists) || !Array.isArray(c.reminderDefaults)) throw badRequest("Invalid settings.");
  const cur = await loadBizConfig(env);
  if (cur && b.updatedAt !== cur.updatedAt) throw new HttpError(409, "Someone else changed these settings. Reloading the latest version.", "conflict");
  const clean: BizConfig = { catalog: c.catalog.slice(0, 200), rules: c.rules.slice(0, 500), checklists: c.checklists.slice(0, 300), reminderDefaults: c.reminderDefaults.map((d) => Math.round(Number(d))).filter((d) => d >= 0 && d <= 365).slice(0, 10) };
  await env.DB.prepare("INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('biz', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by").bind(big(clean), now(), s.member.id).run();
  await audit(env.DB, s, { action: "Record update", resource: "Business Services settings", department: "biz", meta: "Catalog, compliance rules or reminders updated" });
  return { config: await loadBizConfig(env) };
}

/* ---------------------------------------------------------------- engagement letter */
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
async function letterVars(env: AppEnv, r: ServiceRequest, at: string) {
  const client = r.clientId ? await one<{ name: string; contact_name: string | null }>(env.DB, "SELECT name, contact_name FROM clients WHERE id = ?", r.clientId) : null;
  return { ...feeWords(await loadFees(env)), clientName: client?.contact_name || client?.name || r.prospect?.name || "Client", service: r.serviceName, fee: "", taxYear: "", date: longDate(at) };
}
/** Saves the accepted letter (business-services letter + standard terms) as a PDF in the client's Documents. */
async function saveEngagementPdf(env: AppEnv, a: Staff, r: ServiceRequest) {
  const e = r.engagement;
  if (!e || !r.clientId) return;
  const [l, t] = await Promise.all([letterVersion(env, "biz", e.version), letterVersion(env, "terms", e.termsVersion)]);
  if (!l || !t) return;
  const vars = await letterVars(env, r, e.acceptedAt);
  const recorder = (await one<{ name: string }>(env.DB, "SELECT name FROM members WHERE id = ?", e.recordedBy ?? ""))?.name;
  const pdf = await buildLetterPdf({ clientName: vars.clientName, parts: [{ title: fillLetter(l.title, vars), body: fillLetter(l.body, vars), version: l.version }, { title: fillLetter(t.title, vars), body: fillLetter(t.body, vars), version: t.version }], acceptedName: e.acceptedName, acceptedAt: e.acceptedAt, method: e.method, recordedBy: recorder });
  await storeClientPdf(env, a, r.clientId, pdf, { name: `${r.number} engagement letter — ${r.serviceName} (accepted ${longDate(e.acceptedAt)})`, fileName: `MKB-Engagement-Letter-${r.number}.pdf`, category: "Engagement letter", service: "biz", activity: `Saved the signed engagement letter for ${r.number} to Documents` });
}
/** The business-services letter + standard terms, filled for this request (the accepted versions once accepted). */
export async function bizLetter(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "biz", "view");
  const s = staffOnly(a);
  const r = withRev<ServiceRequest>(await loadRow(env, s, "biz_request", id));
  const e = r.engagement;
  const cur = await currentLetters(env);
  const letter = (e && (await letterVersion(env, "biz", e.version))) || cur.biz;
  const terms = (e && (await letterVersion(env, "terms", e.termsVersion))) || cur.terms;
  const vars = await letterVars(env, r, e?.acceptedAt ?? now());
  return { letter: { version: letter.version, title: fillLetter(letter.title, vars), body: fillLetter(letter.body, vars) }, terms: { version: terms.version, title: fillLetter(terms.title, vars), body: fillLetter(terms.body, vars) }, engagement: e ?? null };
}
