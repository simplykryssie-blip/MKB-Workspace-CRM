/**
 * Bookkeeping — server side. Reading needs Bookkeeping "view" and access to the
 * client; starting a workspace "create"; changing the bookkeeper/reviewer
 * "assign"; final approval and closing a month "approve"; the QuickBooks
 * connection status "settings"; everything else "edit". History can't be
 * removed, new notes and steps are recorded as the signed-in person, and bank
 * and card accounts keep only their last four digits. QuickBooks stays the
 * system of record: no transactions, balances of record or tokens are stored.
 * Server-only.
 */
import { MONTH_STAGES, REPORT_TYPES, type BooksMonth, type BooksWorkspace } from "@/lib/books/config";
import { canDo, clientAccess } from "@/lib/team/policy";
import type { ServiceKey } from "@/lib/types";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, str, type AppEnv, type Db } from "./core";
import { audit, requirePermission, type Actor } from "./identity";
import { assignmentSets } from "./clients";
import { stampNew } from "./tax";

type Row = { id: string; client_id: string; enrollment_id: string | null; business_name: string; entity_type: string; bookkeeper_id: string; reviewer_id: string; service: string; extras: string; qbo: string; accounts: string; months: string; tasks: string; notes: string; activity: string; started_at: string; rev: number };
export type WorkspaceSnapshot = BooksWorkspace & { rev?: number };
type Staff = Extract<Actor, { kind: "staff" }>;
const MAX_JSON = 600_000;

const toWorkspace = (r: Row): WorkspaceSnapshot => ({
  id: r.id, clientId: r.client_id, enrollmentId: r.enrollment_id ?? undefined, businessName: r.business_name, entityType: r.entity_type,
  bookkeeperId: r.bookkeeper_id, reviewerId: r.reviewer_id, service: json(r.service, { plan: "", monthlyFee: 0, reports: [], includes: [] }), extras: json(r.extras, []),
  qbo: json(r.qbo, { status: "not_connected", companyName: "", access: "qboa" }), accounts: json(r.accounts, []), months: json(r.months, []), tasks: json(r.tasks, []),
  notes: json(r.notes, []), activity: json(r.activity, []), startedAt: r.started_at, rev: r.rev,
});

async function accessibleClients(env: AppEnv, a: Staff, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const [rows, sets] = await Promise.all([
    all<{ id: string; services: string | null }>(env.DB, `SELECT c.id, (SELECT group_concat(service) FROM client_services s WHERE s.client_id = c.id) AS services FROM clients c WHERE c.id IN (${ids.map(() => "?").join(",")})`, ...ids),
    assignmentSets(env, a.member.id),
  ]);
  return new Set(rows.filter((c) => clientAccess(a.policy, a.member, { id: c.id, services: (c.services ? c.services.split(",") : []) as ServiceKey[] }, sets)).map((c) => c.id));
}

export async function listBooks(env: AppEnv, a: Actor) {
  requirePermission(a, "books", "view");
  if (a.kind !== "staff") throw forbidden();
  const rows = await all<Row>(env.DB, "SELECT * FROM books_workspaces ORDER BY business_name");
  const ok = await accessibleClients(env, a, [...new Set(rows.map((r) => r.client_id))]);
  return { workspaces: rows.filter((r) => ok.has(r.client_id)).map(toWorkspace) };
}

async function load(env: AppEnv, a: Staff, id: string) {
  const r = await one<Row>(env.DB, "SELECT * FROM books_workspaces WHERE id = ?", id);
  if (!r) throw notFound("Workspace not found.");
  if (!(await accessibleClients(env, a, [r.client_id])).has(r.client_id)) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  return toWorkspace(r);
}

const big = (v: unknown) => { const t = JSON.stringify(v ?? null); if (t.length > MAX_JSON) throw new HttpError(413, "This workspace is too large to save."); return t; };
const last4 = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-4);

/** Accounts keep only their last four digits; QuickBooks details are display-only (no tokens). */
function clean(w: BooksWorkspace): BooksWorkspace {
  const q = w.qbo ?? ({} as BooksWorkspace["qbo"]);
  return {
    ...w,
    businessName: str(w.businessName, 200),
    entityType: str(w.entityType, 60),
    service: { plan: str(w.service?.plan, 60), monthlyFee: Math.max(0, Math.min(1_000_000, Number(w.service?.monthlyFee) || 0)), reports: (w.service?.reports ?? []).filter((r) => (REPORT_TYPES as readonly string[]).includes(r)), includes: (w.service?.includes ?? []).map((x) => str(x, 200)).slice(0, 30) },
    qbo: { status: (["connected", "needs_reauth", "invite_pending", "not_connected"] as const).includes(q.status) ? q.status : "not_connected", companyName: str(q.companyName, 200), access: q.access === "client_authorized" ? "client_authorized" : "qboa", realmMasked: q.realmMasked ? `•••• ${last4(q.realmMasked)}` : undefined, connectedAt: q.connectedAt ? str(q.connectedAt, 40) : undefined, lastSyncAt: q.lastSyncAt ? str(q.lastSyncAt, 40) : undefined, authorizedBy: q.authorizedBy ? str(q.authorizedBy, 120) : undefined },
    accounts: (w.accounts ?? []).slice(0, 40).map((x) => ({ id: str(x.id, 60), name: str(x.name, 120), kind: x.kind === "credit_card" ? "credit_card" : "bank", mask: last4(x.mask), institution: str(x.institution, 120) })),
    months: (w.months ?? []).map((m) => ({ ...m, stage: (MONTH_STAGES as readonly string[]).includes(m.stage) ? m.stage : "Waiting on Client Items" })),
  };
}
const assignmentStmts = (db: Db, w: BooksWorkspace) => [
  db.prepare("DELETE FROM record_assignments WHERE record_id = ? AND source IN ('books_bookkeeper', 'books_reviewer')").bind(w.id),
  db.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, 'books_bookkeeper', ? FROM members WHERE id = ?").bind(w.clientId, w.id, w.bookkeeperId),
  db.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, 'books_reviewer', ? FROM members WHERE id = ?").bind(w.clientId, w.id, w.reviewerId),
];
async function checkStaff(db: Db, ...ids: string[]) {
  for (const id of ids) if (!(await one(db, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", id))) throw badRequest("The bookkeeper and reviewer must be active team members.");
}
const fields = (w: BooksWorkspace) => [w.clientId, w.enrollmentId ?? null, w.businessName, w.entityType ?? "", w.bookkeeperId, w.reviewerId, big(w.service), big(w.extras ?? []), big(w.qbo), big(w.accounts ?? []), big(w.months ?? []), big(w.tasks ?? []), big(w.notes ?? []), big(w.activity ?? []), w.startedAt];

export async function createWorkspace(env: AppEnv, a: Actor, input: WorkspaceSnapshot) {
  requirePermission(a, "books", "create");
  if (a.kind !== "staff") throw forbidden();
  if (!/^bw-[A-Za-z0-9_-]{3,80}$/.test(input.id ?? "")) throw badRequest("Invalid workspace ID.");
  const w = clean(input);
  if (!w.businessName) throw badRequest("Enter the business name.");
  if (!(await accessibleClients(env, a, [w.clientId])).has(w.clientId)) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  if (w.bookkeeperId !== a.member.id && !canDo(a.policy, a.member, "books", "assign")) throw forbidden("Your role can't assign workspaces to someone else.");
  await checkStaff(env.DB, w.bookkeeperId, w.reviewerId);
  if (await one(env.DB, "SELECT 1 FROM books_workspaces WHERE id = ?", w.id)) throw new HttpError(409, "That workspace already exists.", "exists");
  const t = now();
  const stamped = { ...w, notes: stampNew([], w.notes, (n) => ({ ...n, authorId: a.member.id })) };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO books_workspaces (id, client_id, enrollment_id, business_name, entity_type, bookkeeper_id, reviewer_id, service, extras, qbo, accounts, months, tasks, notes, activity, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(w.id, ...fields(stamped), t, t),
    ...assignmentStmts(env.DB, w),
  ]);
  await audit(env.DB, a, { action: "Record update", resource: `Bookkeeping workspace ${w.businessName}`, department: "books", meta: "Workspace started" });
  return load(env, a, w.id);
}

/** Month-level approval facts that need "approve". */
const approvalOf = (m: BooksMonth | undefined) => JSON.stringify(m ? { fa: m.finalApproval ?? null, closed: m.closedAt ?? null, isClosed: m.stage === "Month Closed" } : null);

/** Saves a workspace. Each kind of change needs its own permission; a stale revision is refused. */
export async function saveWorkspace(env: AppEnv, a: Actor, id: string, input: WorkspaceSnapshot) {
  requirePermission(a, "books", "view");
  if (a.kind !== "staff") throw forbidden();
  const cur = await load(env, a, id);
  if (input.rev !== cur.rev) throw new HttpError(409, "Someone else updated this workspace. Reloading the latest version.", "conflict");
  let next = clean(input);
  if (next.clientId !== cur.clientId) throw badRequest("A workspace's client can't change.");
  // New notes and month steps are recorded as the signed-in person, whatever the browser says.
  const me = a.member.id;
  next = {
    ...next,
    notes: stampNew(cur.notes, next.notes, (n) => ({ ...n, authorId: me })),
    months: next.months.map((m) => {
      const old = cur.months.find((x) => x.id === m.id);
      return { ...m, reviewNotes: stampNew(old?.reviewNotes, m.reviewNotes, (n) => ({ ...n, authorId: me })), history: stampNew(old?.history, m.history, (h) => (h.by === "client" || h.by === "system" ? h : { ...h, by: me })) };
    }),
  };
  // Compare against the stored version cleaned the same way, so formatting alone never counts as a change.
  const base = clean(cur);
  const same = (k: keyof BooksWorkspace) => JSON.stringify(next[k] ?? null) === JSON.stringify(base[k] ?? null);
  const need = (action: "edit" | "assign" | "approve" | "settings", what: string) => { if (!canDo(a.policy, a.member, "books", action)) throw forbidden(`Your role can't ${what}.`); };
  const changed: string[] = [];
  if (next.bookkeeperId !== cur.bookkeeperId || next.reviewerId !== cur.reviewerId) { need("assign", "change the bookkeeper or reviewer"); await checkStaff(env.DB, next.bookkeeperId, next.reviewerId); changed.push("assignment"); }
  if (!same("qbo")) { need("settings", "change the QuickBooks connection"); changed.push("QuickBooks"); }
  const approvals = next.months.some((m) => approvalOf(m) !== approvalOf(cur.months.find((x) => x.id === m.id)));
  if (approvals) { need("approve", "approve or close months"); changed.push("month approval"); }
  // History can't be rewritten: months, steps, timeline entries and notes are only added.
  for (const m of cur.months) {
    const n = next.months.find((x) => x.id === m.id);
    if (!n) throw badRequest("Months can't be removed.");
    if (n.history.length < m.history.length) throw badRequest("Month history can't be removed.");
  }
  if (cur.activity.some((x) => !(next.activity ?? []).some((y) => y.id === x.id))) throw badRequest("History entries can't be removed.");
  const rest: (keyof BooksWorkspace)[] = ["businessName", "entityType", "service", "extras", "accounts", "months", "tasks", "notes", "enrollmentId", "startedAt"];
  const other = rest.filter((k) => !same(k));
  if (other.length) { need("edit", "edit bookkeeping workspaces"); changed.push(...other.map(String)); }
  if (!changed.length && same("activity")) return cur;
  const t = now();
  const res = await env.DB.batch([
    env.DB.prepare("UPDATE books_workspaces SET client_id = ?, enrollment_id = ?, business_name = ?, entity_type = ?, bookkeeper_id = ?, reviewer_id = ?, service = ?, extras = ?, qbo = ?, accounts = ?, months = ?, tasks = ?, notes = ?, activity = ?, started_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?").bind(...fields(next), t, id, cur.rev!),
    ...(changed.includes("assignment") ? assignmentStmts(env.DB, next) : []),
  ]);
  if (!res[0].meta.changes) throw new HttpError(409, "Someone else updated this workspace. Reloading the latest version.", "conflict");
  if (changed.length) await audit(env.DB, a, { action: changed.includes("assignment") ? "Assignment change" : approvals ? "Approval" : "Record update", resource: `Bookkeeping workspace ${next.businessName}`, department: "books", meta: `Changed: ${[...new Set(changed)].join(", ")}` });
  return load(env, a, id);
}
