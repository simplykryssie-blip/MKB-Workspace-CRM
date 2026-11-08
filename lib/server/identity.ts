/**
 * Team, roles, policy state, audit log, security settings and email — loaded
 * from the database on every request. Server-only.
 */
import type { AuditEvent, Capability, DeptKey, Department, Member, Role, SecuritySettings } from "@/lib/team/config";
import { SECURITY_DEFAULTS } from "@/lib/sample/team-seed";
import { canDo, hasCap, hasSensitive, type PolicyMember, type PolicyState } from "@/lib/team/policy";
import type { ActionKey, ModuleKey } from "@/lib/team/config";
import { all, forbidden, isDev, json, now, one, run, type AppEnv, type Db } from "./core";
import { randomId } from "./crypto";

/* ---------------------------------------------------------------- rows → objects */
type RoleRow = { id: string; name: string; description: string; kind: "system" | "custom"; level: number; is_owner: number; is_client: number; all_departments: number; scope: Role["scope"]; max_sensitivity: Role["maxSensitivity"]; perms: string; record_types: string; sensitive: string; caps: string };
export const toRole = (r: RoleRow): Role => ({ id: r.id, name: r.name, description: r.description, kind: r.kind, level: r.level, isOwner: !!r.is_owner, isClient: !!r.is_client, allDepartments: !!r.all_departments, scope: r.scope, maxSensitivity: r.max_sensitivity, perms: json(r.perms, {}), recordTypes: json(r.record_types, {}), sensitive: json(r.sensitive, []), caps: json(r.caps, []) });

export type MemberRow = { id: string; name: string; initials: string; title: string; email: string; phone: string; role_id: string; status: Member["status"]; manager_id: string | null; grants: string; selected_client_ids: string; onboarding: string; offboarding: string | null; last_access_review_at: string | null; added_at: string; depts: string | null };
/** Member as the server sees it (no sessions/logins — those live in their own tables). */
export type ServerMember = PolicyMember & { name: string; initials: string; title: string; email: string; phone: string; managerId?: string; addedAt: string; lastAccessReviewAt?: string; onboarding: Record<string, string> };
export const toMember = (r: MemberRow): ServerMember => ({ id: r.id, name: r.name, initials: r.initials, title: r.title, email: r.email, phone: r.phone, roleId: r.role_id, status: r.status, managerId: r.manager_id ?? undefined, grants: json(r.grants, []), selectedClientIds: json(r.selected_client_ids, []), departments: (r.depts ? r.depts.split(",") : []) as DeptKey[], addedAt: r.added_at, lastAccessReviewAt: r.last_access_review_at ?? undefined, onboarding: json(r.onboarding, {}) });
const MEMBER_SQL = "SELECT m.*, (SELECT group_concat(dept) FROM member_departments d WHERE d.member_id = m.id) AS depts FROM members m";

export async function loadPolicy(db: Db): Promise<PolicyState> {
  const [roles, depts] = await Promise.all([all<RoleRow>(db, "SELECT * FROM roles"), all<{ key: DeptKey; manager_id: string | null; reporting: number; modules: string; workflow: string }>(db, "SELECT * FROM departments")]);
  return {
    roles: roles.map(toRole),
    departments: depts.map((d): Department => ({ key: d.key, managerId: d.manager_id ?? undefined, reporting: !!d.reporting, modules: json(d.modules, []), workflow: json(d.workflow, {}) })),
  };
}
export async function loadMember(db: Db, id: string) {
  const r = await one<MemberRow>(db, `${MEMBER_SQL} WHERE m.id = ?`, id);
  return r ? toMember(r) : null;
}
export async function loadMembers(db: Db) {
  return (await all<MemberRow>(db, `${MEMBER_SQL} ORDER BY m.name`)).map(toMember);
}

export async function loadSecurity(db: Db): Promise<SecuritySettings> {
  const r = await one<{ data: string; updated_at: string | null; updated_by: string | null }>(db, "SELECT * FROM security_settings WHERE id = 1");
  return r ? { ...SECURITY_DEFAULTS, ...json(r.data, {}), updatedAt: r.updated_at ?? undefined, updatedBy: r.updated_by ?? undefined } : SECURITY_DEFAULTS;
}

/* ---------------------------------------------------------------- the signed-in actor */
export type Actor =
  | { kind: "staff"; userId: string; member: ServerMember; policy: PolicyState; ip: string }
  | { kind: "client"; userId: string; clientId: string; ip: string };

export function requireStaff(a: Actor): asserts a is Extract<Actor, { kind: "staff" }> {
  if (a.kind !== "staff") throw forbidden("Staff only.");
}
export function requirePermission(a: Actor, module: ModuleKey, action: ActionKey = "view") {
  requireStaff(a);
  if (!canDo(a.policy, a.member, module, action)) throw forbidden();
}
export function requireCap(a: Actor, cap: Capability) {
  requireStaff(a);
  if (!hasCap(a.policy, a.member, cap)) throw forbidden();
}
export const hasSensitivePerm = (a: Actor, key: string) => a.kind === "staff" && hasSensitive(a.policy, a.member, key);

/* ---------------------------------------------------------------- audit */
export type AuditInput = Omit<AuditEvent, "id" | "at" | "actorId" | "success"> & { success?: boolean };
/** Appends to the audit log (the table rejects updates and deletes). */
export async function audit(db: Db, actor: Actor | { kind: "anonymous"; ip: string; userId?: string; memberId?: string }, e: AuditInput) {
  await run(
    db,
    "INSERT INTO audit_events (id, at, actor_user_id, actor_member_id, actor_client_id, action, resource, department, meta, success, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomId("au"),
    now(),
    "userId" in actor ? actor.userId ?? null : null,
    actor.kind === "staff" ? actor.member.id : actor.kind === "anonymous" ? actor.memberId ?? null : null,
    actor.kind === "client" ? actor.clientId : null,
    e.action,
    e.resource,
    e.department ?? null,
    e.meta ?? null,
    e.success === false ? 0 : 1,
    actor.ip,
  );
}

/* ---------------------------------------------------------------- email */
/**
 * Sends through Resend when RESEND_API_KEY is set; otherwise only records it in
 * the outbox. Bodies are stored only in development (they can contain one-time links).
 */
export type EmailAttachment = { filename: string; content: Uint8Array };
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
export async function sendEmail(env: AppEnv, msg: { to: string; template: string; subject: string; text: string; html?: string; attachments?: EmailAttachment[] }) {
  const id = randomId("em");
  await run(env.DB, "INSERT INTO email_outbox (id, to_email, template, subject, body_dev, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, msg.to, msg.template, msg.subject, isDev(env) ? msg.text : null, now());
  if (!env.RESEND_API_KEY) return { id, sent: false };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM ?? "MKB Financial Group <no-reply@example.com>", to: [msg.to], subject: msg.subject, text: msg.text, ...(msg.html ? { html: msg.html } : {}), ...(msg.attachments?.length ? { attachments: msg.attachments.map((x) => ({ filename: x.filename, content: b64(x.content) })) } : {}) }),
    });
    const out = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    await run(env.DB, "UPDATE email_outbox SET sent_at = ?, provider_id = ?, error = ? WHERE id = ?", res.ok ? now() : null, out.id ?? null, res.ok ? null : (out.message ?? `HTTP ${res.status}`).slice(0, 300), id);
    return { id, sent: res.ok };
  } catch (e) {
    await run(env.DB, "UPDATE email_outbox SET error = ? WHERE id = ?", String(e).slice(0, 300), id);
    return { id, sent: false };
  }
}

export const appOrigin = (env: AppEnv, req: Request) => env.APP_ORIGIN ?? new URL(req.url).origin;
export type { Member };
