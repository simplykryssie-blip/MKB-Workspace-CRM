/**
 * Development seed: loads the fictional sample data into the local database.
 * Refuses to run outside APP_ENV=development or on a database that already has data.
 * Server-only.
 */
import { DEFAULT_ROLES, DEPARTMENT_CONFIG, MEMBERS, SECURITY_DEFAULTS } from "@/lib/sample/team-seed";
import { CLIENTS } from "@/lib/sample/clients";
import { DEFAULT_SOURCES, DEFAULT_STAGES, LEADS } from "@/lib/sample/leads";
import { TAX_RETURNS } from "@/lib/sample/tax";
import { BOOKS_WORKSPACES } from "@/lib/sample/books";
import { BIZ_REQUESTS } from "@/lib/sample/biz-seed";
import { EXP_CASES, EXP_MATTERS } from "@/lib/sample/exp-seed";
import { HttpError, isDev, now, one, type AppEnv } from "./core";
import { encryptField, hashPassword, randomId } from "./crypto";

export async function seedDev(env: AppEnv) {
  if (!isDev(env)) throw new HttpError(404, "Not found.");
  if (!env.ENCRYPTION_KEY || !env.DEV_SEED_PASSWORD) throw new HttpError(500, "Set ENCRYPTION_KEY and DEV_SEED_PASSWORD in .dev.vars first.");
  if (await one(env.DB, "SELECT 1 FROM members LIMIT 1")) throw new HttpError(409, "Database already has data. Delete .wrangler/state and re-run the migrations to start over.");
  const db = env.DB;
  const t = now();
  const S: D1PreparedStatement[] = [];
  const add = (sql: string, ...args: unknown[]) => S.push(db.prepare(sql).bind(...args));

  for (const r of DEFAULT_ROLES)
    add("INSERT INTO roles (id, name, description, kind, level, is_owner, is_client, all_departments, scope, max_sensitivity, perms, record_types, sensitive, caps, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      r.id, r.name, r.description, r.kind, r.level, r.isOwner ? 1 : 0, r.isClient ? 1 : 0, r.allDepartments ? 1 : 0, r.scope, r.maxSensitivity, JSON.stringify(r.perms), JSON.stringify(r.recordTypes), JSON.stringify(r.sensitive), JSON.stringify(r.caps), t, t);
  // Members first without managers (foreign keys), then managers.
  for (const m of MEMBERS) {
    add("INSERT INTO members (id, name, initials, title, email, phone, role_id, status, grants, selected_client_ids, onboarding, offboarding, last_access_review_at, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      m.id, m.name, m.initials, m.title, m.email, m.phone, m.roleId, m.status, JSON.stringify(m.grants), JSON.stringify(m.selectedClientIds), JSON.stringify(m.onboarding), m.offboarding ? JSON.stringify(m.offboarding) : null, m.lastAccessReviewAt ?? null, m.addedAt);
    for (const d of m.departments) add("INSERT INTO member_departments (member_id, dept) VALUES (?, ?)", m.id, d);
  }
  for (const m of MEMBERS) if (m.managerId) add("UPDATE members SET manager_id = ? WHERE id = ?", m.managerId, m.id);
  for (const d of DEPARTMENT_CONFIG) add("INSERT INTO departments (key, manager_id, reporting, modules, workflow) VALUES (?, ?, ?, ?, ?)", d.key, d.managerId ?? null, d.reporting ? 1 : 0, JSON.stringify(d.modules), JSON.stringify(d.workflow));
  add("INSERT INTO security_settings (id, data, updated_at) VALUES (1, ?, ?)", JSON.stringify(SECURITY_DEFAULTS), t);

  // Sign-in accounts for active and suspended members (same dev password; MFA enrolled on first sign-in).
  const pw = await hashPassword(env.DEV_SEED_PASSWORD);
  for (const m of MEMBERS)
    if (m.status === "active" || m.status === "suspended")
      add("INSERT INTO users (id, email, password_hash, kind, member_id, status, created_at) VALUES (?, ?, ?, 'staff', ?, 'active', ?)", randomId("u"), m.email.toLowerCase(), pw, m.id, t);

  for (const c of CLIENTS) {
    add("INSERT INTO clients (id, type, name, contact_name, email, phone, preferred_contact, address, business, status, portal, tags, source, lead_id, since, last_activity_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      c.id, c.type, c.name, c.contactName ?? null, c.email, c.phone, c.preferredContact, JSON.stringify(c.address), c.business ? JSON.stringify({ ...c.business, einLast4: undefined, responsibleParty: c.business.responsibleParty ? { ...c.business.responsibleParty, taxIdLast4: undefined } : undefined }) : null, c.status, c.portal, JSON.stringify(c.tags), c.source, c.leadId ?? null, c.since, c.lastActivityAt, t, t);
    for (const s of new Set(c.enrollments.map((e) => e.service))) add("INSERT INTO client_services (client_id, service) VALUES (?, ?)", c.id, s);
    add("UPDATE clients SET module_data = ? WHERE id = ?", JSON.stringify({ documents: c.documents, messages: c.messages, appointments: c.appointments, invoices: c.invoices, signatures: c.signatures }), c.id);
    for (const e of c.enrollments) add("INSERT INTO client_enrollments (id, client_id, service, title, stage, progress, status, staff_id, started_at, due_at, fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", e.id, c.id, e.service, e.title, e.stage, e.progress, e.status, e.staffId, e.startedAt, e.dueAt ?? null, e.fee);
    for (const n of c.notes) add("INSERT INTO client_notes (id, client_id, author_id, body, service, pinned, at) VALUES (?, ?, ?, ?, ?, ?, ?)", n.id, c.id, n.authorId, n.body, n.service ?? null, n.pinned ? 1 : 0, n.at);
    for (const x of c.activity) add("INSERT OR IGNORE INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, ?, ?, ?, NULL, ?)", x.id, c.id, x.kind, x.text, x.actor, x.at);
    if (c.dob) add("INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, 'dob_year', '', '', 0, ?, NULL, ?, 's-mk')", c.id, c.dob.slice(0, 4), t);
    for (const sid of c.staffIds) add("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) VALUES (?, ?, 'client_team', '')", c.id, sid);
    // Sample identifiers use the never-issued 000 SSN area / 00 EIN prefix.
    const vault: [string, string, string | null][] = [];
    if (c.taxIdLast4) vault.push(["tax_id", `000-00-${c.taxIdLast4}`, c.taxIdLast4]);
    if (c.business?.einLast4) vault.push(["ein", `00-000${c.business.einLast4}`, c.business.einLast4]);
    if (c.business?.responsibleParty?.taxIdLast4) vault.push(["rp_tax_id", `000-00-${c.business.responsibleParty.taxIdLast4}`, c.business.responsibleParty.taxIdLast4]);
    if (c.dob) vault.push(["dob", c.dob, null]);
    for (const [field, value, last4] of vault) {
      const e = await encryptField(env.ENCRYPTION_KEY, value, `client:${c.id}:${field}`);
      add("INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, ?, ?, ?, 1, ?, ?, ?, 's-mk')", c.id, field, e.ciphertext, e.iv, last4, field === "tax_id" ? c.taxIdType ?? "SSN" : null, t);
    }
    // Client-portal sign-in for clients whose portal is active (same dev password).
    if (c.portal === "active") add("INSERT INTO users (id, email, password_hash, kind, client_id, status, created_at) VALUES (?, ?, ?, 'client', ?, 'active', ?)", randomId("u"), c.email.toLowerCase(), pw, c.id, t);
  }

  // Work assignments across modules feed "assigned records only" access.
  const assign = (clientId: string | undefined, memberId: string | undefined, source: string, recordId: string) => clientId && memberId && add("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) VALUES (?, ?, ?, ?)", clientId, memberId, source, recordId);
  for (const r of TAX_RETURNS) { assign(r.clientId, r.preparerId, "tax_preparer", r.id); assign(r.clientId, r.reviewerId, "tax_reviewer", r.id); }
  for (const w of BOOKS_WORKSPACES) { assign(w.clientId, w.bookkeeperId, "books_bookkeeper", w.id); assign(w.clientId, w.reviewerId, "books_reviewer", w.id); }
  for (const r of BIZ_REQUESTS) { assign(r.clientId, r.assignedTo, "biz_assigned", r.id); assign(r.clientId, r.reviewerId, "biz_reviewer", r.id); }
  for (const c of EXP_CASES) assign(c.clientId, c.assignedTo, "exp_case", c.id);
  for (const m of EXP_MATTERS) for (const [role, sid] of Object.entries(m.assignments)) assign(m.clientId, sid, `exp_${role}`, m.id);

  // Leads pipeline.
  DEFAULT_STAGES.forEach((st, i) => add("INSERT INTO lead_stages (id, name, position) VALUES (?, ?, ?)", st.id, st.name, i));
  DEFAULT_SOURCES.forEach((src, i) => add("INSERT INTO lead_sources (name, position) VALUES (?, ?)", src, i));
  for (const l of LEADS) {
    add("INSERT INTO leads (id, type, name, contact_name, email, phone, address, business, source, source_detail, interests, est_value, owner_id, stage_id, status, priority, tags, lost_reason, converted_client_id, converted_at, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      l.id, l.type, l.name, l.contactName ?? null, l.email, l.phone, l.address ? JSON.stringify(l.address) : null, l.business ? JSON.stringify(l.business) : null, l.source, l.sourceDetail ?? null, JSON.stringify(l.interests), l.estValue, l.ownerId, l.stageId, l.status, l.priority, JSON.stringify(l.tags), l.lostReason ?? null, l.convertedClientId ?? null, l.convertedAt ?? null, l.createdAt, l.lastActivityAt);
    for (const n of l.notes) add("INSERT INTO lead_notes (id, lead_id, author_id, body, pinned, at) VALUES (?, ?, ?, ?, ?, ?)", n.id, l.id, n.authorId, n.body, n.pinned ? 1 : 0, n.at);
    for (const r of l.reminders) add("INSERT INTO lead_reminders (id, lead_id, at, note, done, owner_id) VALUES (?, ?, ?, ?, ?, ?)", r.id, l.id, r.at, r.note, r.done ? 1 : 0, r.ownerId);
    for (const x of l.activity) add("INSERT OR IGNORE INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, ?, ?, ?, NULL, ?)", x.id, l.id, x.kind, x.text, x.actor, x.at);
  }

  // D1 batches run as one transaction.
  for (let i = 0; i < S.length; i += 90) await db.batch(S.slice(i, i + 90));
  return { statements: S.length, members: MEMBERS.length, clients: CLIENTS.length };
}
