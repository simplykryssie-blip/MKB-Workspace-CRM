/**
 * Leads — server side. Viewing needs Leads "view"; editing "edit"; changing the
 * owner "assign"; pipeline stages and sources "settings". Converting a lead needs
 * Leads "edit" plus permission to create (or edit) the client. Server-only.
 */
import type { ActivityItem, Lead, LeadReminder, LeadStage, Note, ServiceKey } from "@/lib/types";
import { canDo } from "@/lib/team/policy";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, type AppEnv, type Db } from "./core";
import { audit, requirePermission, type Actor } from "./identity";

const SERVICES: ServiceKey[] = ["tax", "books", "biz", "expunge"];
const PRIORITIES: Lead["priority"][] = ["low", "medium", "high", "urgent"];
const ENTITY = ["LLC", "S-Corp", "C-Corp", "Sole Prop", "Partnership", "Nonprofit"];
type LeadRow = { id: string; type: Lead["type"]; name: string; contact_name: string | null; email: string; phone: string; address: string | null; business: string | null; source: string; source_detail: string | null; interests: string; est_value: number; owner_id: string; stage_id: string; status: Lead["status"]; priority: Lead["priority"]; tags: string; lost_reason: string | null; converted_client_id: string | null; converted_at: string | null; created_at: string; last_activity_at: string; rev: number };
export type LeadSnapshot = Lead & { rev?: number };
const s = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const sOpt = (v: unknown, max = 300) => (typeof v === "string" && v ? v.slice(0, max) : undefined);
const sameJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function loadLeads(db: Db, where = "", ...args: unknown[]): Promise<LeadSnapshot[]> {
  const rows = await all<LeadRow>(db, `SELECT * FROM leads ${where} ORDER BY created_at DESC`, ...args);
  if (!rows.length) return [];
  const q = rows.map(() => "?").join(",");
  const ids = rows.map((r) => r.id);
  const [notes, rem, act] = await Promise.all([
    all<{ id: string; lead_id: string; author_id: string; body: string; pinned: number; at: string }>(db, `SELECT * FROM lead_notes WHERE deleted_at IS NULL AND lead_id IN (${q}) ORDER BY at DESC`, ...ids),
    all<{ id: string; lead_id: string; at: string; note: string; done: number; owner_id: string }>(db, `SELECT * FROM lead_reminders WHERE lead_id IN (${q}) ORDER BY at`, ...ids),
    all<{ id: string; lead_id: string; kind: ActivityItem["kind"]; text: string; actor: ActivityItem["actor"]; at: string }>(db, `SELECT * FROM lead_activity WHERE lead_id IN (${q}) ORDER BY at DESC`, ...ids),
  ]);
  return rows.map((r) => ({
    id: r.id, type: r.type, name: r.name, contactName: r.contact_name ?? undefined, email: r.email, phone: r.phone,
    address: json(r.address, undefined), business: json(r.business, undefined), source: r.source, sourceDetail: r.source_detail ?? undefined,
    interests: json(r.interests, []), estValue: r.est_value, ownerId: r.owner_id, stageId: r.stage_id, status: r.status, priority: r.priority, tags: json(r.tags, []),
    createdAt: r.created_at, lastActivityAt: r.last_activity_at, lostReason: r.lost_reason ?? undefined, convertedClientId: r.converted_client_id ?? undefined, convertedAt: r.converted_at ?? undefined,
    notes: notes.filter((n) => n.lead_id === r.id).map((n): Note => ({ id: n.id, authorId: n.author_id, body: n.body, at: n.at, pinned: !!n.pinned || undefined })),
    reminders: rem.filter((x) => x.lead_id === r.id).map((x): LeadReminder => ({ id: x.id, at: x.at, note: x.note, done: !!x.done, ownerId: x.owner_id })),
    activity: act.filter((x) => x.lead_id === r.id).map((x) => ({ id: x.id, kind: x.kind, text: x.text, at: x.at, actor: x.actor })),
    rev: r.rev,
  }));
}

export async function listLeads(env: AppEnv, a: Actor) {
  requirePermission(a, "leads", "view");
  const [leads, stages, sources] = await Promise.all([
    loadLeads(env.DB),
    all<LeadStage & { position: number }>(env.DB, "SELECT id, name, position FROM lead_stages ORDER BY position"),
    all<{ name: string }>(env.DB, "SELECT name FROM lead_sources ORDER BY position"),
  ]);
  return { leads, stages: stages.map(({ id, name }) => ({ id, name })), sources: sources.map((x) => x.name) };
}
async function getLead(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "leads", "view");
  const l = (await loadLeads(env.DB, "WHERE id = ?", id))[0];
  if (!l) throw notFound("Lead not found.");
  return l;
}

function cleanCore(l: Partial<Lead>) {
  if (l.type !== "individual" && l.type !== "business") throw badRequest("Invalid lead type.");
  const name = s(l.name, 200).trim();
  if (!name) throw badRequest("Name is required.");
  if (!PRIORITIES.includes(l.priority as Lead["priority"])) throw badRequest("Invalid priority.");
  return {
    type: l.type, name, contact_name: sOpt(l.contactName, 200) ?? null, email: s(l.email, 200).toLowerCase(), phone: s(l.phone, 40),
    address: l.address ? JSON.stringify({ line1: s(l.address.line1, 200), line2: sOpt(l.address.line2, 200), city: s(l.address.city, 100), state: s(l.address.state, 2), zip: s(l.address.zip, 10) }) : null,
    business: l.business ? JSON.stringify({ entityType: ENTITY.includes(l.business.entityType) ? l.business.entityType : "LLC", industry: s(l.business.industry, 100) }) : null,
    source: s(l.source, 100), source_detail: sOpt(l.sourceDetail, 200) ?? null,
    interests: JSON.stringify((l.interests ?? []).filter((x) => SERVICES.includes(x))),
    est_value: Math.max(0, Number(l.estValue) || 0), stage_id: s(l.stageId, 60), priority: l.priority as string,
    tags: JSON.stringify((l.tags ?? []).map((t) => s(t, 60)).slice(0, 30)),
  };
}
async function checkOwner(db: Db, ownerId: string) {
  if (!(await one(db, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", ownerId))) throw badRequest("The lead owner must be an active team member.");
}
async function checkStage(db: Db, stageId: string) {
  if (!(await one(db, "SELECT 1 FROM lead_stages WHERE id = ?", stageId))) throw badRequest("Unknown pipeline stage.");
}

function childStatements(db: Db, a: Extract<Actor, { kind: "staff" }>, leadId: string, l: Partial<Lead>, known: { notes: Set<string>; reminders: Set<string>; activity: Set<string> }) {
  const out: D1PreparedStatement[] = [];
  for (const n of l.notes ?? []) if (!known.notes.has(n.id)) out.push(db.prepare("INSERT INTO lead_notes (id, lead_id, author_id, body, pinned, at) VALUES (?, ?, ?, ?, ?, ?)").bind(s(n.id, 60), leadId, a.member.id, s(n.body, 10_000), n.pinned ? 1 : 0, now()));
  for (const r of l.reminders ?? []) if (!known.reminders.has(r.id)) out.push(db.prepare("INSERT INTO lead_reminders (id, lead_id, at, note, done, owner_id) VALUES (?, ?, ?, ?, ?, ?)").bind(s(r.id, 60), leadId, s(r.at, 40), s(r.note, 500), r.done ? 1 : 0, s(r.ownerId, 60)));
  for (const x of (l.activity ?? []).slice(0, 200)) if (!known.activity.has(x.id)) out.push(db.prepare("INSERT OR IGNORE INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(s(x.id, 60), leadId, s(x.kind, 30), s(x.text, 1000), ["client", "staff", "system"].includes(x.actor) ? x.actor : "staff", a.member.id, s(x.at, 40) || now()));
  return out;
}

export async function createLead(env: AppEnv, a: Actor, l: LeadSnapshot) {
  requirePermission(a, "leads", "create");
  if (a.kind !== "staff") throw forbidden();
  if (!/^L-[A-Za-z0-9_-]{2,40}$/.test(l.id ?? "")) throw badRequest("Invalid lead ID.");
  if (await one(env.DB, "SELECT 1 FROM leads WHERE id = ?", l.id)) throw new HttpError(409, "That lead already exists.", "exists");
  const c = cleanCore(l);
  await checkOwner(env.DB, s(l.ownerId, 60));
  await checkStage(env.DB, c.stage_id);
  if (l.ownerId !== a.member.id && !canDo(a.policy, a.member, "leads", "assign")) throw forbidden("Your role can't assign leads to someone else.");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO leads (id, type, name, contact_name, email, phone, address, business, source, source_detail, interests, est_value, owner_id, stage_id, status, priority, tags, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)")
      .bind(l.id, c.type, c.name, c.contact_name, c.email, c.phone, c.address, c.business, c.source, c.source_detail, c.interests, c.est_value, l.ownerId, c.stage_id, c.priority, c.tags, t, t),
    ...childStatements(env.DB, a, l.id, l, { notes: new Set(), reminders: new Set(), activity: new Set() }),
  ]);
  await audit(env.DB, a, { action: "Record update", resource: `Lead ${l.id}`, meta: "Lead created" });
  return getLead(env, a, l.id);
}

export async function saveLead(env: AppEnv, a: Actor, id: string, next: LeadSnapshot) {
  if (a.kind !== "staff") throw forbidden();
  const cur = await getLead(env, a, id);
  if (next.rev !== cur.rev) throw new HttpError(409, "Someone else updated this lead. Reloading the latest version.", "conflict");
  const db = env.DB;
  const need = (action: "edit" | "assign") => { if (!canDo(a.policy, a.member, "leads", action)) throw forbidden(action === "assign" ? "Your role can't reassign leads." : "Your role can't edit leads."); };
  const stmts: D1PreparedStatement[] = [];
  const changed: string[] = [];
  const core = cleanCore(next);
  if (!sameJSON(core, cleanCore(cur))) {
    need("edit"); changed.push("details");
    if (core.stage_id !== cur.stageId) await checkStage(db, core.stage_id);
    stmts.push(db.prepare("UPDATE leads SET type = ?, name = ?, contact_name = ?, email = ?, phone = ?, address = ?, business = ?, source = ?, source_detail = ?, interests = ?, est_value = ?, stage_id = ?, priority = ?, tags = ? WHERE id = ?").bind(core.type, core.name, core.contact_name, core.email, core.phone, core.address, core.business, core.source, core.source_detail, core.interests, core.est_value, core.stage_id, core.priority, core.tags, id));
  }
  if (next.ownerId !== cur.ownerId) {
    need("assign"); changed.push("owner");
    await checkOwner(db, s(next.ownerId, 60));
    stmts.push(db.prepare("UPDATE leads SET owner_id = ? WHERE id = ?").bind(next.ownerId, id));
  }
  if (next.status !== cur.status || (next.lostReason ?? null) !== (cur.lostReason ?? null)) {
    // Conversion only happens through the convert endpoint.
    if (next.status === "converted" || cur.status === "converted") throw badRequest("Use conversion to turn a lead into a client.");
    need("edit"); changed.push("status");
    stmts.push(db.prepare("UPDATE leads SET status = ?, lost_reason = ? WHERE id = ?").bind(next.status, next.status === "lost" ? s(next.lostReason, 200) : null, id));
  }
  // Notes, reminders, timeline.
  const known = { notes: new Set(cur.notes.map((n) => n.id)), reminders: new Set(cur.reminders.map((r) => r.id)), activity: new Set(cur.activity.map((x) => x.id)) };
  const kids = childStatements(db, a, id, next, known);
  if ((next.notes ?? []).some((n) => !known.notes.has(n.id)) || (next.reminders ?? []).some((r) => !known.reminders.has(r.id))) need("edit");
  stmts.push(...kids);
  for (const n of cur.notes) {
    const nn = (next.notes ?? []).find((x) => x.id === n.id);
    if (!nn) { need("edit"); stmts.push(db.prepare("UPDATE lead_notes SET deleted_at = ?, deleted_by = ? WHERE id = ? AND lead_id = ?").bind(now(), a.member.id, n.id, id)); }
    else if (!!nn.pinned !== !!n.pinned) { need("edit"); stmts.push(db.prepare("UPDATE lead_notes SET pinned = ? WHERE id = ? AND lead_id = ?").bind(nn.pinned ? 1 : 0, n.id, id)); }
  }
  for (const r of cur.reminders) {
    const nr = (next.reminders ?? []).find((x) => x.id === r.id);
    if (!nr) { need("edit"); stmts.push(db.prepare("DELETE FROM lead_reminders WHERE id = ? AND lead_id = ?").bind(r.id, id)); }
    else if (nr.done !== r.done) stmts.push(db.prepare("UPDATE lead_reminders SET done = ? WHERE id = ? AND lead_id = ?").bind(nr.done ? 1 : 0, r.id, id));
  }
  if (!stmts.length) return cur;
  const t = now();
  stmts.unshift(db.prepare("UPDATE leads SET rev = rev + 1, last_activity_at = ? WHERE id = ? AND rev = ?").bind(t, id, cur.rev!));
  const res = await db.batch(stmts);
  if (!res[0].meta.changes) throw new HttpError(409, "Someone else updated this lead. Reloading the latest version.", "conflict");
  if (changed.length) await audit(db, a, { action: changed.includes("owner") ? "Assignment change" : "Record update", resource: `Lead ${id}`, meta: `Changed: ${changed.join(", ")}` });
  return getLead(env, a, id);
}

/**
 * Marks a lead converted to a client that already exists (created from this
 * lead, or an existing client the lead was merged into).
 */
export async function markConverted(env: AppEnv, a: Actor, id: string, clientId: string, merged: boolean) {
  requirePermission(a, "leads", "edit");
  if (a.kind !== "staff") throw forbidden();
  requirePermission(a, "crm", merged ? "edit" : "create");
  const lead = await getLead(env, a, id);
  if (lead.status === "converted") return lead;
  const client = await one<{ id: string; lead_id: string | null }>(env.DB, "SELECT id, lead_id FROM clients WHERE id = ?", clientId);
  if (!client) throw notFound("Client not found.");
  if (!merged && client.lead_id !== id) throw badRequest("That client wasn't created from this lead.");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE leads SET status = 'converted', converted_client_id = ?, converted_at = ?, rev = rev + 1, last_activity_at = ? WHERE id = ?").bind(clientId, t, t, id),
    env.DB.prepare("UPDATE lead_reminders SET done = 1 WHERE lead_id = ?").bind(id),
    env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, 'lead', ?, 'staff', ?, ?)").bind(`x_${crypto.randomUUID()}`, id, merged ? `Merged into existing client ${clientId}` : `Converted to client ${clientId}`, a.member.id, t),
  ]);
  await audit(env.DB, a, { action: "Record update", resource: `Lead ${id}`, meta: merged ? `Merged into client ${clientId}` : `Converted to client ${clientId}` });
  return getLead(env, a, id);
}

/** Pipeline stages and sources. Removing a stage moves its leads to another stage. */
export async function saveSettings(env: AppEnv, a: Actor, b: { stages?: LeadStage[]; sources?: string[]; remap?: { from: string; to: string } }) {
  requirePermission(a, "leads", "settings");
  const stages = (Array.isArray(b.stages) ? b.stages : []).map((x) => ({ id: s(x.id, 60), name: s(x.name, 60).trim() })).filter((x) => x.id && x.name);
  const sources = [...new Set((Array.isArray(b.sources) ? b.sources : []).map((x) => s(x, 60).trim()).filter(Boolean))];
  if (!stages.length) throw badRequest("Keep at least one stage.");
  const keep = new Set(stages.map((x) => x.id));
  const db = env.DB;
  const stmts: D1PreparedStatement[] = [];
  if (b.remap && keep.has(b.remap.to)) {
    stmts.push(db.prepare("UPDATE leads SET stage_id = ?, rev = rev + 1 WHERE stage_id = ?").bind(b.remap.to, b.remap.from));
    // Forms that send new leads to the removed stage follow it too.
    stmts.push(db.prepare("UPDATE forms SET routing = json_set(routing, '$.stageId', ?) WHERE json_extract(routing, '$.stageId') = ?").bind(b.remap.to, b.remap.from));
  }
  const formOrphan = await one<{ n: number }>(db, `SELECT count(*) n FROM forms WHERE json_extract(routing, '$.stageId') NOT IN (${stages.map(() => "?").join(",")})${b.remap ? " AND json_extract(routing, '$.stageId') != ?" : ""}`, ...stages.map((x) => x.id), ...(b.remap ? [b.remap.from] : []));
  if (formOrphan && formOrphan.n > 0) throw badRequest("A form sends new leads to that stage — choose where they should go instead.");
  const orphan = await one<{ n: number }>(db, `SELECT count(*) n FROM leads WHERE stage_id NOT IN (${stages.map(() => "?").join(",")})${b.remap ? " AND stage_id != ?" : ""}`, ...stages.map((x) => x.id), ...(b.remap ? [b.remap.from] : []));
  if (orphan && orphan.n > 0) throw badRequest("Move leads out of a stage before removing it.");
  stmts.push(db.prepare("DELETE FROM lead_stages"), ...stages.map((x, i) => db.prepare("INSERT INTO lead_stages (id, name, position) VALUES (?, ?, ?)").bind(x.id, x.name, i)));
  stmts.push(db.prepare("DELETE FROM lead_sources"), ...sources.map((x, i) => db.prepare("INSERT INTO lead_sources (name, position) VALUES (?, ?)").bind(x, i)));
  await db.batch(stmts);
  await audit(db, a, { action: "Record update", resource: "Lead pipeline settings", meta: `${stages.length} stages, ${sources.length} sources` });
  return listLeads(env, a);
}
