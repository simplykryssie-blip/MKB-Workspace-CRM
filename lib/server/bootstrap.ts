/**
 * First-time setup of a new (empty) database: system roles, departments,
 * security policy, lead pipeline, tax fee schedule — and the Owner account.
 * Works only with the OWNER_SETUP_TOKEN secret and only while the database
 * has no team members; after the Owner exists it is permanently disabled.
 * No sample or client data is created. Server-only.
 */
import { DEFAULT_ROLES, DEPARTMENT_CONFIG, SECURITY_DEFAULTS } from "@/lib/sample/team-seed";
import { DEFAULT_SOURCES, DEFAULT_STAGES } from "@/lib/sample/leads";
import { DEFAULT_FEE_SCHEDULE } from "@/lib/tax/config";
import { badRequest, clientIp, HttpError, now, one, rateLimit, str, type AppEnv } from "./core";
import { hashPassword, passwordProblem, randomId, safeEqual } from "./crypto";
import { audit } from "./identity";

export async function setupStatus(env: AppEnv) {
  return { needed: !(await one(env.DB, "SELECT 1 FROM members LIMIT 1")) };
}

export async function createOwner(env: AppEnv, req: Request, b: Record<string, unknown>) {
  if (!(await rateLimit(env.DB, `setup:${clientIp(req)}`, 10, 60))) throw new HttpError(429, "Too many attempts. Try again later.");
  const token = str(b.token, 200);
  if (!env.OWNER_SETUP_TOKEN || !token || !safeEqual(token, env.OWNER_SETUP_TOKEN)) throw new HttpError(403, "This setup link isn't valid.", "bad_token");
  if (await one(env.DB, "SELECT 1 FROM members LIMIT 1")) throw new HttpError(410, "Setup is already complete. Sign in instead.", "done");
  const name = str(b.name, 120);
  const email = str(b.email, 200).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  if (!name) throw badRequest("Enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest("Enter a valid email address.");
  const problem = passwordProblem(password, SECURITY_DEFAULTS);
  if (problem) throw badRequest(problem);
  const db = env.DB;
  const t = now();
  const S: D1PreparedStatement[] = [];
  const add = (sql: string, ...args: unknown[]) => S.push(db.prepare(sql).bind(...args));
  for (const r of DEFAULT_ROLES)
    add("INSERT INTO roles (id, name, description, kind, level, is_owner, is_client, all_departments, scope, max_sensitivity, perms, record_types, sensitive, caps, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      r.id, r.name, r.description, r.kind, r.level, r.isOwner ? 1 : 0, r.isClient ? 1 : 0, r.allDepartments ? 1 : 0, r.scope, r.maxSensitivity, JSON.stringify(r.perms), JSON.stringify(r.recordTypes), JSON.stringify(r.sensitive), JSON.stringify(r.caps), t, t);
  const id = randomId("s");
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  add("INSERT INTO members (id, name, initials, title, email, phone, role_id, status, onboarding, added_at) VALUES (?, ?, ?, 'Owner', ?, '', 'role-owner', 'active', '{}', ?)", id, name, initials, email, t);
  for (const d of ["tax", "books", "biz", "exp", "admin", "support"]) add("INSERT INTO member_departments (member_id, dept) VALUES (?, ?)", id, d);
  // Departments start with no manager (assign them in Team & Permissions).
  for (const d of DEPARTMENT_CONFIG) add("INSERT INTO departments (key, manager_id, reporting, modules, workflow) VALUES (?, NULL, ?, ?, ?)", d.key, d.reporting ? 1 : 0, JSON.stringify(d.modules), JSON.stringify(d.workflow));
  add("INSERT INTO security_settings (id, data, updated_at, updated_by) VALUES (1, ?, ?, ?)", JSON.stringify(SECURITY_DEFAULTS), t, id);
  DEFAULT_STAGES.forEach((st, i) => add("INSERT INTO lead_stages (id, name, position) VALUES (?, ?, ?)", st.id, st.name, i));
  DEFAULT_SOURCES.forEach((src, i) => add("INSERT INTO lead_sources (name, position) VALUES (?, ?)", src, i));
  DEFAULT_FEE_SCHEDULE.forEach((f, i) => add("INSERT INTO tax_fee_schedule (code, label, kind, price, unit, position) VALUES (?, ?, ?, ?, ?, ?)", f.code, f.label, f.kind, f.price, f.unit ?? null, i));
  add("INSERT INTO users (id, email, password_hash, kind, member_id, status, created_at, password_changed_at) VALUES (?, ?, ?, 'staff', ?, 'active', ?, ?)", randomId("u"), email, await hashPassword(password), id, t, t);
  await db.batch(S); // one transaction: all or nothing
  await audit(db, { kind: "anonymous", ip: clientIp(req), memberId: id }, { action: "Security settings", resource: "MKB Business Suite", meta: "First-time setup: Owner account created" });
  return { ok: true };
}
