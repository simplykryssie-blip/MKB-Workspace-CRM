/**
 * Full client records: load, create, and save changes. Each kind of change is
 * permission-checked separately on the server (details, team assignments,
 * services, notes), whatever the interface sent. Server-only.
 */
import { invoicesByClient } from "./billing";
import type { ActivityItem, Client, Enrollment, Note, ServiceKey } from "@/lib/types";
import { canDo, clientAccess } from "@/lib/team/policy";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, rateLimit, type AppEnv, type Db } from "./core";
import { portalUrl, sendTemplate } from "./email";
import { encryptField } from "./crypto";
import { audit, requirePermission, type Actor } from "./identity";
import { CLIENT_SQL, assignmentSets, canOpen, last4Map, type ClientRow } from "./clients";

const SERVICES: ServiceKey[] = ["tax", "books", "biz", "expunge"];
const ENROLL_STATUS: Enrollment["status"][] = ["active", "waiting_on_client", "in_review", "complete", "on_hold", "cancelled"];
const MAX_MODULE_DATA = 400_000;
type FullRow = ClientRow & { rev: number; module_data: string };
type ModuleData = Pick<Client, "documents" | "messages" | "appointments" | "invoices" | "signatures">;
export type ClientSnapshot = Client & { rev?: number };

const s = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const sOpt = (v: unknown, max = 300) => (typeof v === "string" && v ? v.slice(0, max) : undefined);

/* ---------------------------------------------------------------- load */
async function loadParts(db: Db, ids: string[]) {
  if (!ids.length) return { enr: [], notes: [], act: [], team: [], inv: new Map() };
  const q = ids.map(() => "?").join(",");
  const [enr, notes, act, team] = await Promise.all([
    all<{ id: string; client_id: string; service: ServiceKey; title: string; stage: string; progress: number; status: Enrollment["status"]; staff_id: string; started_at: string; due_at: string | null; fee: number }>(db, `SELECT * FROM client_enrollments WHERE client_id IN (${q}) ORDER BY started_at`, ...ids),
    all<{ id: string; client_id: string; author_id: string; body: string; service: ServiceKey | null; pinned: number; at: string }>(db, `SELECT * FROM client_notes WHERE deleted_at IS NULL AND client_id IN (${q}) ORDER BY at DESC`, ...ids),
    all<{ id: string; client_id: string; kind: ActivityItem["kind"]; text: string; actor: ActivityItem["actor"]; at: string }>(db, `SELECT * FROM client_activity WHERE client_id IN (${q}) ORDER BY at DESC LIMIT 5000`, ...ids),
    all<{ client_id: string; member_id: string }>(db, `SELECT client_id, member_id FROM record_assignments WHERE source = 'client_team' AND client_id IN (${q})`, ...ids),
  ]);
  // Invoices are their own server records (billing); never taken from the browser.
  const inv = await invoicesByClient({ DB: db } as AppEnv, ids);
  return { enr, notes, act, team, inv };
}

function assemble(r: FullRow, parts: Awaited<ReturnType<typeof loadParts>>, l4: Record<string, string | null>, dobYear?: string): ClientSnapshot {
  const md = json<Partial<ModuleData>>(r.module_data, {});
  const business = json<Client["business"] | null>(r.business, null) ?? undefined;
  return {
    id: r.id, type: r.type, name: r.name, contactName: r.contact_name ?? undefined, email: r.email, phone: r.phone, preferredContact: r.preferred_contact as Client["preferredContact"],
    address: json(r.address, { line1: "", city: "", state: "", zip: "" }),
    // Only masked identifiers ever leave the server outside the audited reveal endpoint.
    dob: dobYear ? `${dobYear}-••-••` : undefined,
    taxIdType: (l4.tax_id_kind as "SSN" | "ITIN" | null) ?? undefined,
    taxIdLast4: l4.tax_id ?? undefined,
    business: business ? { ...business, einLast4: l4.ein ?? undefined, responsibleParty: business.responsibleParty ? { ...business.responsibleParty, taxIdLast4: l4.rp_tax_id ?? undefined } : undefined } : undefined,
    staffIds: parts.team.filter((t) => t.client_id === r.id).map((t) => t.member_id),
    status: r.status as Client["status"], portal: r.portal as Client["portal"], tags: json(r.tags, []), source: r.source, leadId: r.lead_id ?? undefined, since: r.since, lastActivityAt: r.last_activity_at,
    enrollments: parts.enr.filter((e) => e.client_id === r.id).map((e) => ({ id: e.id, service: e.service, title: e.title, stage: e.stage, progress: e.progress, status: e.status, staffId: e.staff_id, startedAt: e.started_at, dueAt: e.due_at ?? undefined, fee: e.fee })),
    documents: md.documents ?? [], messages: md.messages ?? [], appointments: md.appointments ?? [], invoices: parts.inv.get(r.id) ?? [], signatures: md.signatures ?? [],
    notes: parts.notes.filter((n) => n.client_id === r.id).map((n): Note => ({ id: n.id, authorId: n.author_id, body: n.body, at: n.at, service: n.service ?? undefined, pinned: !!n.pinned || undefined })),
    activity: parts.act.filter((x) => x.client_id === r.id).map((x) => ({ id: x.id, kind: x.kind, text: x.text, at: x.at, actor: x.actor })),
    rev: r.rev,
  };
}

async function identifierInfo(db: Db, ids: string[]) {
  const l4 = await last4Map({ DB: db } as AppEnv, ids);
  if (!ids.length) return { l4, years: new Map<string, string>() };
  const kinds = await all<{ owner_id: string; kind: string | null }>(db, `SELECT owner_id, kind FROM vault WHERE owner_type = 'client' AND field = 'tax_id' AND owner_id IN (${ids.map(() => "?").join(",")})`, ...ids);
  kinds.forEach((k) => l4.set(k.owner_id, { ...l4.get(k.owner_id), tax_id_kind: k.kind }));
  // The birth year is shown masked in the interface (••/••/YYYY); it's kept as its own non-secret field.
  const years = await all<{ owner_id: string; last4: string | null }>(db, `SELECT owner_id, last4 FROM vault WHERE owner_type = 'client' AND field = 'dob_year' AND owner_id IN (${ids.map(() => "?").join(",")})`, ...ids);
  return { l4, years: new Map(years.map((y) => [y.owner_id, y.last4 ?? ""])) };
}

/** Every client this actor may open, as full records (staff only). */
export async function listFull(env: AppEnv, a: Actor) {
  requirePermission(a, "crm", "view");
  if (a.kind !== "staff") throw forbidden();
  // Prospects (leads sent intake forms) and declined prospects are not clients.
  const rows = await all<FullRow>(env.DB, `${CLIENT_SQL} WHERE c.status NOT IN ('prospect', 'declined') ORDER BY c.name`);
  // Assignments are loaded once, then every client is checked against the same rules.
  const sets = await assignmentSets(env, a.member.id);
  const visible = rows.filter((r) => clientAccess(a.policy, a.member, { id: r.id, services: (r.services ? r.services.split(",") : []) as ServiceKey[] }, sets));
  const ids = visible.map((r) => r.id);
  const [parts, info] = await Promise.all([loadParts(env.DB, ids), identifierInfo(env.DB, ids)]);
  return visible.map((r) => assemble(r, parts, info.l4.get(r.id) ?? {}, info.years.get(r.id)));
}

export async function getFull(env: AppEnv, a: Actor, id: string) {
  const r = await one<FullRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, id);
  if (!r) throw notFound("Client not found.");
  if (!(await canOpen(env, a, r))) throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  const [parts, info] = await Promise.all([loadParts(env.DB, [id]), identifierInfo(env.DB, [id])]);
  return assemble(r, parts, info.l4.get(id) ?? {}, info.years.get(id));
}

/* ---------------------------------------------------------------- validation */
function cleanCore(c: Partial<Client>) {
  if (c.type !== "individual" && c.type !== "business") throw badRequest("Invalid client type.");
  const name = s(c.name, 200).trim();
  if (!name) throw badRequest("Name is required.");
  const addr = (c.address ?? {}) as Client["address"];
  const biz = c.business;
  return {
    type: c.type,
    name,
    contact_name: sOpt(c.contactName, 200) ?? null,
    email: s(c.email, 200).toLowerCase(),
    phone: s(c.phone, 40),
    preferred_contact: ["Email", "Phone", "Text", "Portal"].includes(c.preferredContact as string) ? (c.preferredContact as string) : "Email",
    address: JSON.stringify({ line1: s(addr.line1, 200), line2: sOpt(addr.line2, 200), city: s(addr.city, 100), state: s(addr.state, 2), zip: s(addr.zip, 10) }),
    // Identifier digits never go into the business JSON — they live in the vault.
    business: biz ? JSON.stringify({ legalName: s(biz.legalName, 200), entityType: biz.entityType, state: s(biz.state, 10), formedAt: sOpt(biz.formedAt, 30), industry: s(biz.industry, 100), fiscalYearEnd: s(biz.fiscalYearEnd, 30), responsibleParty: biz.responsibleParty ? { name: s(biz.responsibleParty.name, 200), title: s(biz.responsibleParty.title, 100), taxIdType: biz.responsibleParty.taxIdType } : undefined }) : null,
    status: s(c.status, 30) || "active",
    portal: s(c.portal, 30) || "not_invited",
    tags: JSON.stringify((Array.isArray(c.tags) ? c.tags : []).map((t) => s(t, 60)).slice(0, 30)),
    source: s(c.source, 100),
  };
}
const cleanEnrollment = (e: Enrollment): Enrollment => {
  if (!SERVICES.includes(e.service) || !ENROLL_STATUS.includes(e.status)) throw badRequest("Invalid service enrollment.");
  return { id: s(e.id, 60), service: e.service, title: s(e.title, 200), stage: s(e.stage, 100), progress: Math.max(0, Math.min(100, Math.round(Number(e.progress) || 0))), status: e.status, staffId: s(e.staffId, 60), startedAt: s(e.startedAt, 40), dueAt: sOpt(e.dueAt, 40), fee: Math.max(0, Number(e.fee) || 0) };
};
function moduleData(c: Partial<Client>) {
  // Invoices live in the billing tables, so they're left out of the client record.
  const md: ModuleData = { documents: c.documents ?? [], messages: c.messages ?? [], appointments: c.appointments ?? [], invoices: [], signatures: c.signatures ?? [] };
  const text = JSON.stringify(md);
  if (text.length > MAX_MODULE_DATA) throw new HttpError(413, "This client record is too large to save.");
  return text;
}
const sameJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------- create */
export type NewIdentifiers = { taxId?: string; taxIdType?: "SSN" | "ITIN"; ein?: string; dob?: string; rpTaxId?: string };

async function vaultStatements(env: AppEnv, a: Extract<Actor, { kind: "staff" }>, clientId: string, ids: NewIdentifiers) {
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  const out: D1PreparedStatement[] = [];
  const put = async (field: string, value: string, last4: string | null, kind: string | null) => {
    const e = await encryptField(env.ENCRYPTION_KEY!, value, `client:${clientId}:${field}`);
    out.push(env.DB.prepare("INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, last4 = excluded.last4, kind = excluded.kind, updated_at = excluded.updated_at, updated_by = excluded.updated_by").bind(clientId, field, e.ciphertext, e.iv, Number(env.ENCRYPTION_KEY_VERSION ?? 1), last4, kind, now(), a.member.id));
  };
  const digits9 = (v?: string) => { const d = (v ?? "").replace(/\D/g, ""); if (v && d.length !== 9) throw badRequest("Tax ID numbers must have 9 digits."); return d; };
  const t = digits9(ids.taxId);
  if (t) await put("tax_id", `${t.slice(0, 3)}-${t.slice(3, 5)}-${t.slice(5)}`, t.slice(-4), ids.taxIdType ?? "SSN");
  const e = digits9(ids.ein);
  if (e) await put("ein", `${e.slice(0, 2)}-${e.slice(2)}`, e.slice(-4), null);
  const r = digits9(ids.rpTaxId);
  if (r) await put("rp_tax_id", `${r.slice(0, 3)}-${r.slice(3, 5)}-${r.slice(5)}`, r.slice(-4), null);
  if (ids.dob) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ids.dob)) throw badRequest("Date of birth must be YYYY-MM-DD.");
    await put("dob", ids.dob, null, null);
    out.push(env.DB.prepare("INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, 'dob_year', '', '', 0, ?, NULL, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET last4 = excluded.last4, updated_at = excluded.updated_at").bind(clientId, ids.dob.slice(0, 4), now(), a.member.id));
  }
  return out;
}

function partStatements(env: AppEnv, a: Extract<Actor, { kind: "staff" }>, c: ClientSnapshot) {
  const db = env.DB;
  const out: D1PreparedStatement[] = [];
  for (const e of (c.enrollments ?? []).map(cleanEnrollment))
    out.push(db.prepare("INSERT INTO client_enrollments (id, client_id, service, title, stage, progress, status, staff_id, started_at, due_at, fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(e.id, c.id, e.service, e.title, e.stage, e.progress, e.status, e.staffId, e.startedAt, e.dueAt ?? null, e.fee));
  for (const sv of new Set((c.enrollments ?? []).map((e) => e.service))) out.push(db.prepare("INSERT OR IGNORE INTO client_services (client_id, service) VALUES (?, ?)").bind(c.id, sv));
  for (const sid of new Set(c.staffIds ?? [])) out.push(db.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, 'client_team', '' FROM members WHERE id = ?").bind(c.id, s(sid, 60)));
  for (const n of c.notes ?? []) out.push(db.prepare("INSERT INTO client_notes (id, client_id, author_id, body, service, pinned, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(s(n.id, 60), c.id, a.member.id, s(n.body, 10_000), n.service ?? null, n.pinned ? 1 : 0, s(n.at, 40) || now()));
  for (const x of (c.activity ?? []).slice(0, 500)) out.push(db.prepare("INSERT OR IGNORE INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(s(x.id, 60), c.id, s(x.kind, 30), s(x.text, 1000), ["client", "staff", "system"].includes(x.actor) ? x.actor : "staff", a.member.id, s(x.at, 40) || now()));
  return out;
}

/** Creates a client. The ID comes from the interface (so screens can link to it immediately) and must be new. */
export async function createClient(env: AppEnv, a: Actor, c: ClientSnapshot, ids: NewIdentifiers, opts: { fromLeadId?: string } = {}) {
  requirePermission(a, "crm", "create");
  if (a.kind !== "staff") throw forbidden();
  if (!/^c-[A-Za-z0-9_-]{3,40}$/.test(c.id ?? "")) throw badRequest("Invalid client ID.");
  if (await one(env.DB, "SELECT 1 FROM clients WHERE id = ?", c.id)) throw new HttpError(409, "That client already exists.", "exists");
  const core = cleanCore(c);
  const dupe = core.email && (await one<{ id: string; name: string }>(env.DB, "SELECT id, name FROM clients WHERE email = ? LIMIT 1", core.email));
  if (dupe) throw new HttpError(409, `${dupe.name} already uses this email.`, "duplicate");
  const t = now();
  const stmts = [
    env.DB.prepare("INSERT INTO clients (id, type, name, contact_name, email, phone, preferred_contact, address, business, status, portal, tags, source, lead_id, since, last_activity_at, created_at, updated_at, module_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(c.id, core.type, core.name, core.contact_name, core.email, core.phone, core.preferred_contact, core.address, core.business, core.status, core.portal, core.tags, core.source, opts.fromLeadId ?? null, s(c.since, 40) || t.slice(0, 10), t, t, t, moduleData(c)),
    ...partStatements(env, a, c),
    ...(await vaultStatements(env, a, c.id, ids)),
  ];
  return { stmts, finish: async () => { await audit(env.DB, a, { action: "Record update", resource: `Client ${c.id}`, meta: opts.fromLeadId ? `Created from lead ${opts.fromLeadId}` : "Client created" }); } };
}
export async function createClientNow(env: AppEnv, a: Actor, c: ClientSnapshot, ids: NewIdentifiers) {
  const { stmts, finish } = await createClient(env, a, c, ids);
  await env.DB.batch(stmts);
  await finish();
  return getFull(env, a, c.id);
}

/* ---------------------------------------------------------------- save changes */
/**
 * Saves an edited client. `rev` must match the stored revision (otherwise someone
 * else saved first: 409). Each changed part needs its own permission.
 */
export async function saveClient(env: AppEnv, a: Actor, id: string, next: ClientSnapshot) {
  if (a.kind !== "staff") throw forbidden();
  const cur = await getFull(env, a, id);
  if (next.rev !== cur.rev) throw new HttpError(409, "Someone else updated this client. Reloading the latest version.", "conflict");
  const db = env.DB;
  const changed: string[] = [];
  const need = (action: "edit" | "assign") => { if (!canDo(a.policy, a.member, "crm", action)) throw forbidden(action === "assign" ? "Your role can't change who is assigned to this client." : "Your role can't edit client records."); };
  const stmts: D1PreparedStatement[] = [];

  // Portal access is changed only through invite / revoke (it creates or disables a real account).
  const core = cleanCore({ ...next, id, portal: cur.portal });
  const curCore = cleanCore(cur);
  if (!sameJSON(core, curCore)) {
    need("edit");
    changed.push("details");
    stmts.push(db.prepare("UPDATE clients SET type = ?, name = ?, contact_name = ?, email = ?, phone = ?, preferred_contact = ?, address = ?, business = ?, status = ?, portal = ?, tags = ?, source = ? WHERE id = ?").bind(core.type, core.name, core.contact_name, core.email, core.phone, core.preferred_contact, core.address, core.business, core.status, core.portal, core.tags, core.source, id));
  }
  const curStaff = [...cur.staffIds].sort();
  const nextStaff = [...new Set(next.staffIds ?? [])].sort();
  if (!sameJSON(curStaff, nextStaff)) {
    need("assign");
    changed.push("team");
    stmts.push(db.prepare("DELETE FROM record_assignments WHERE client_id = ? AND source = 'client_team'").bind(id));
    for (const sid of nextStaff) stmts.push(db.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) SELECT ?, id, 'client_team', '' FROM members WHERE id = ?").bind(id, s(sid, 60)));
  }
  const nextEnr = (next.enrollments ?? []).map(cleanEnrollment);
  if (!sameJSON(cur.enrollments, nextEnr)) {
    need("edit");
    changed.push("services");
    stmts.push(db.prepare("DELETE FROM client_enrollments WHERE client_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM client_services WHERE client_id = ?").bind(id));
    for (const e of nextEnr) stmts.push(db.prepare("INSERT INTO client_enrollments (id, client_id, service, title, stage, progress, status, staff_id, started_at, due_at, fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(e.id, id, e.service, e.title, e.stage, e.progress, e.status, e.staffId, e.startedAt, e.dueAt ?? null, e.fee));
    for (const sv of new Set(nextEnr.map((e) => e.service))) stmts.push(db.prepare("INSERT INTO client_services (client_id, service) VALUES (?, ?)").bind(id, sv));
  }
  // Notes: new ones are added (authored by the signed-in person), pins updated, removed ones hidden.
  const curNotes = new Map(cur.notes.map((n) => [n.id, n]));
  const nextNotes = next.notes ?? [];
  for (const n of nextNotes) {
    const old = curNotes.get(n.id);
    if (!old) { need("edit"); changed.push("notes"); stmts.push(db.prepare("INSERT INTO client_notes (id, client_id, author_id, body, service, pinned, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(s(n.id, 60), id, a.member.id, s(n.body, 10_000), n.service ?? null, n.pinned ? 1 : 0, now())); }
    else if (!!old.pinned !== !!n.pinned) { need("edit"); stmts.push(db.prepare("UPDATE client_notes SET pinned = ? WHERE id = ? AND client_id = ?").bind(n.pinned ? 1 : 0, n.id, id)); }
  }
  for (const n of cur.notes) if (!nextNotes.some((x) => x.id === n.id)) { need("edit"); changed.push("notes"); stmts.push(db.prepare("UPDATE client_notes SET deleted_at = ?, deleted_by = ? WHERE id = ? AND client_id = ?").bind(now(), a.member.id, n.id, id)); }
  // Module data (documents, messages, appointments, invoices, signatures).
  const md = moduleData(next);
  const curMd = moduleData(cur);
  if (md !== curMd) { need("edit"); changed.push("records"); stmts.push(db.prepare("UPDATE clients SET module_data = ? WHERE id = ?").bind(md, id)); }
  // Timeline: only new entries are appended.
  const known = new Set(cur.activity.map((x) => x.id));
  const fresh = (next.activity ?? []).filter((x) => !known.has(x.id)).slice(0, 50);
  for (const x of fresh) stmts.push(db.prepare("INSERT OR IGNORE INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(s(x.id, 60), id, s(x.kind, 30), s(x.text, 1000), ["client", "staff", "system"].includes(x.actor) ? x.actor : "staff", a.member.id, now()));

  if (!stmts.length) return cur;
  const t = now();
  // The revision check is repeated inside the write, so two saves can't both win.
  stmts.unshift(db.prepare("UPDATE clients SET rev = rev + 1, updated_at = ?, last_activity_at = ? WHERE id = ? AND rev = ?").bind(t, t, id, cur.rev!));
  const res = await db.batch(stmts);
  if (!res[0].meta.changes) throw new HttpError(409, "Someone else updated this client. Reloading the latest version.", "conflict");
  if (changed.length) await audit(db, a, { action: changed.includes("team") ? "Assignment change" : "Record update", resource: `Client ${id}`, meta: `Changed: ${[...new Set(changed)].join(", ")}` });
  // A new staff message for a client who uses the portal: email them a notice (never the message itself).
  const before = new Set((cur.messages ?? []).map((m) => m.id));
  if (cur.portal === "active" && cur.email && (next.messages ?? []).some((m) => m.from === "staff" && !before.has(m.id))) {
    if (await rateLimit(db, `portalmsgmail:${id}`, 1, 15)) {
      await sendTemplate(env, "portal_message", { to: cur.email, vars: { firstName: (cur.contactName || cur.name).trim().split(/\s+/)[0] }, buttonUrl: portalUrl(env) + "#messages" }).catch((e) => console.error("portal message notice failed", e));
    }
  }
  return getFull(env, a, id);
}
