/**
 * Team & Permissions — server side. Every change is checked here against the
 * database, whatever the interface allowed. Server-only.
 */
import { DEPARTMENTS, HIGH_IMPACT, SENSITIVE_KEYS, type DeptKey, type SecuritySettings } from "@/lib/team/config";
import { assignableRoles, canManage, hasSensitive, roleOf } from "@/lib/team/policy";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, run, str, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { issueInviteToken, revokeAllSessions } from "./auth";
import { appOrigin, audit, loadMember, loadMembers, loadSecurity, requireCap, requirePermission, requireStaff, sendEmail, type Actor } from "./identity";

const DEPT_KEYS = DEPARTMENTS.map((d) => d.key) as DeptKey[];
const validDepts = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is DeptKey => DEPT_KEYS.includes(x as DeptKey)))] : []);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

async function target(env: AppEnv, id: string) {
  const m = await loadMember(env.DB, id);
  if (!m) throw notFound("Team member not found.");
  return m;
}

/* ---------------------------------------------------------------- read */
export async function listMembers(env: AppEnv, a: Actor) {
  requirePermission(a, "team", "view");
  const [members, users] = await Promise.all([loadMembers(env.DB), all<{ member_id: string; mfa_enabled: number; last_login_at: string | null; locked_until: string | null; status: string }>(env.DB, "SELECT member_id, mfa_enabled, last_login_at, locked_until, status FROM users WHERE member_id IS NOT NULL")]);
  const t = now();
  return members.map((m) => {
    const u = users.find((x) => x.member_id === m.id);
    return { ...m, roleName: roleOf(a.kind === "staff" ? a.policy.roles : [], m)?.name, mfa: u?.mfa_enabled ? "enabled" : "not_enrolled", lastLoginAt: u?.last_login_at ?? undefined, locked: !!u?.locked_until && u.locked_until > t };
  });
}

/* ---------------------------------------------------------------- invitations */
export async function invite(env: AppEnv, req: Request, a: Actor, b: Record<string, unknown>) {
  requirePermission(a, "team", "create");
  requireStaff(a);
  const name = str(b.name, 120);
  const email = str(b.email, 200).toLowerCase();
  const roleId = str(b.roleId, 80);
  const departments = validDepts(b.departments);
  const days = [3, 7, 14].includes(Number(b.expiresInDays)) ? Number(b.expiresInDays) : 7;
  if (!name) throw badRequest("Enter the person's name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest("Enter a valid email address.");
  if (!departments.length) throw badRequest("Choose at least one department.");
  // Owner and Client roles can never be assigned by invitation; only roles below the actor's.
  if (!assignableRoles(a.policy, a.member).some((r) => r.id === roleId)) throw forbidden("You can't invite someone with that role.");
  if (await one(env.DB, "SELECT 1 FROM members WHERE email = ? AND status != 'deactivated'", email)) throw new HttpError(409, "Someone with this email is already on the team.", "duplicate");
  const managerId = str(b.managerId, 80) || null;
  if (managerId && !(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", managerId))) throw badRequest("Manager not found.");
  // Only sensitive permissions the inviter holds can be granted.
  const grants = (Array.isArray(b.grants) ? b.grants : []).filter((g): g is string => typeof g === "string" && SENSITIVE_KEYS.includes(g) && hasSensitive(a.policy, a.member, g));

  // The screen may suggest the new member's ID (so it can open their page right away).
  const wanted = str(b.memberId, 60);
  const memberId = /^s-[A-Za-z0-9_-]{4,40}$/.test(wanted) && !(await one(env.DB, "SELECT 1 FROM members WHERE id = ?", wanted)) ? wanted : randomId("m");
  const userId = randomId("u");
  const invId = randomId("inv");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO members (id, name, initials, title, email, phone, role_id, status, manager_id, grants, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'invited', ?, ?, ?)").bind(memberId, name, initials(name), str(b.title, 120) || "Team member", email, str(b.phone, 30), roleId, managerId, JSON.stringify(grants), t),
    ...departments.map((d) => env.DB.prepare("INSERT INTO member_departments (member_id, dept) VALUES (?, ?)").bind(memberId, d)),
    env.DB.prepare("INSERT INTO users (id, email, kind, member_id, status, created_at) VALUES (?, ?, 'staff', ?, 'pending', ?)").bind(userId, email, memberId, t),
  ]);
  const tok = await issueInviteToken(env, userId, days);
  await run(env.DB, "INSERT INTO invitations (id, member_id, email, token_hash, sent_at, expires_at, status, invited_by) VALUES (?, ?, ?, ?, ?, (SELECT expires_at FROM auth_tokens WHERE token_hash = ?), 'pending', ?)", invId, memberId, email, tok.hash, t, tok.hash, a.member.id);
  await sendEmail(env, { to: email, template: "team_invite", subject: "You're invited to the MKB Business Suite", text: `${a.member.name} invited you to join MKB Financial Group's Business Suite.\n\nAccept within ${days} days:\n${appOrigin(env, req)}/login/invite?token=${tok.token}` });
  await audit(env.DB, a, { action: "Invitation", resource: `${name} (${roleOf(a.policy.roles, { roleId })?.name})`, department: departments[0], meta: `Invited ${email}; expires in ${days} days` });
  return { memberId, invitationId: invId };
}

/* ---------------------------------------------------------------- changes */
export async function changeRole(env: AppEnv, a: Actor, id: string, roleId: string) {
  requireStaff(a);
  const t = await target(env, id);
  if (!canManage(a.policy, a.member, t, "assign")) throw forbidden("You can only change roles for team members below your own role — never your own or the Owner's.");
  if (!assignableRoles(a.policy, a.member).some((r) => r.id === roleId)) throw forbidden("You can't assign that role.");
  const from = roleOf(a.policy.roles, t)?.name;
  await run(env.DB, "UPDATE members SET role_id = ? WHERE id = ?", roleId, id);
  await audit(env.DB, a, { action: "Role change", resource: `${t.name}: ${from} → ${roleOf(a.policy.roles, { roleId })?.name}` });
}

export async function setDepartments(env: AppEnv, a: Actor, id: string, depts: unknown) {
  requireStaff(a);
  const t = await target(env, id);
  if (!canManage(a.policy, a.member, t, "assign")) throw forbidden();
  const next = validDepts(depts);
  await env.DB.batch([env.DB.prepare("DELETE FROM member_departments WHERE member_id = ?").bind(id), ...next.map((d) => env.DB.prepare("INSERT INTO member_departments (member_id, dept) VALUES (?, ?)").bind(id, d))]);
  await audit(env.DB, a, { action: "Permission change", resource: `${t.name}: departments`, meta: `${t.departments.join(", ") || "none"} → ${next.join(", ") || "none"}` });
}

export async function setGrant(env: AppEnv, a: Actor, id: string, keyName: string, on: boolean) {
  requireStaff(a);
  if (!SENSITIVE_KEYS.includes(keyName)) throw badRequest("Unknown permission.");
  const t = await target(env, id);
  if (!canManage(a.policy, a.member, t, "assign")) throw forbidden();
  if (on && !hasSensitive(a.policy, a.member, keyName)) throw forbidden("You can only grant permissions you hold yourself.");
  const grants = on ? [...new Set([...t.grants, keyName])] : t.grants.filter((g) => g !== keyName);
  await run(env.DB, "UPDATE members SET grants = ? WHERE id = ?", JSON.stringify(grants), id);
  await audit(env.DB, a, { action: "Permission change", resource: `${t.name}: ${keyName}`, meta: `${on ? "Granted" : "Removed"}${HIGH_IMPACT.has(keyName) ? " — high-impact" : ""}` });
}

export async function setStatus(env: AppEnv, a: Actor, id: string, action: string, reason: string, sessionId = "") {
  requireStaff(a);
  const t = await target(env, id);
  const self = a.member.id === id;
  if (action === "revoke_sessions") {
    if (!self && !canManage(a.policy, a.member, t, "archive")) throw forbidden();
  } else if (action === "revoke_session") {
    if (!self && !canManage(a.policy, a.member, t, "archive")) throw forbidden();
  } else if (!canManage(a.policy, a.member, t, "archive")) throw forbidden();
  const user = await one<{ id: string }>(env.DB, "SELECT id FROM users WHERE member_id = ?", id);
  switch (action) {
    case "suspend":
      if (!reason) throw badRequest("Give a reason (it's recorded in the audit log).");
      await run(env.DB, "UPDATE members SET status = 'suspended' WHERE id = ?", id);
      if (user) await revokeAllSessions(env, user.id);
      await audit(env.DB, a, { action: "Account suspension", resource: t.name, meta: reason });
      return;
    case "reactivate":
      if (t.status !== "suspended") throw badRequest("Only suspended accounts can be reactivated.");
      await run(env.DB, "UPDATE members SET status = 'active' WHERE id = ?", id);
      await audit(env.DB, a, { action: "Account suspension", resource: t.name, meta: "Reactivated" });
      return;
    case "unlock":
      if (user) await run(env.DB, "UPDATE users SET locked_until = NULL, failed_attempts = 0 WHERE id = ?", user.id);
      await audit(env.DB, a, { action: "Security settings", resource: t.name, meta: "Sign-in lockout cleared" });
      return;
    case "revoke_session":
      if (!user || !/^[0-9a-f]{16}$/.test(sessionId)) throw badRequest("Unknown session.");
      await run(env.DB, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND substr(id_hash, 1, 16) = ? AND revoked_at IS NULL", now(), user.id, sessionId);
      await audit(env.DB, a, { action: "Session revoked", resource: `${t.name} — 1 session` });
      return;
    case "revoke_sessions":
      if (user) await revokeAllSessions(env, user.id);
      await audit(env.DB, a, { action: "Session revoked", resource: `${t.name} — all sessions` });
      return;
    default:
      throw badRequest("Unknown action.");
  }
}

/* ---------------------------------------------------------------- audit log (read-only) */
export async function listAudit(env: AppEnv, a: Actor, q: URLSearchParams) {
  requireCap(a, "audit.view");
  const where: string[] = [];
  const args: unknown[] = [];
  if (q.get("action")) { where.push("action = ?"); args.push(q.get("action")); }
  if (q.get("member")) { where.push("actor_member_id = ?"); args.push(q.get("member")); }
  if (q.get("result") === "fail") where.push("success = 0");
  if (q.get("result") === "ok") where.push("success = 1");
  if (q.get("q")) { where.push("(resource LIKE ? OR meta LIKE ?)"); args.push(`%${q.get("q")}%`, `%${q.get("q")}%`); }
  const limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 50));
  const offset = Math.max(0, Number(q.get("offset")) || 0);
  const sql = `SELECT * FROM audit_events ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY at DESC LIMIT ? OFFSET ?`;
  return all(env.DB, sql, ...args, limit, offset);
}

/* ---------------------------------------------------------------- security policy */
export async function getSecurity(env: AppEnv, a: Actor) {
  requirePermission(a, "team", "view");
  return loadSecurity(env.DB);
}
export async function saveSecurity(env: AppEnv, a: Actor, b: Partial<SecuritySettings>) {
  requireCap(a, "security.manage");
  requireStaff(a);
  const cur = await loadSecurity(env.DB);
  const clampN = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  const ownerRole = a.policy.roles.find((r) => r.isOwner)!.id;
  const next: SecuritySettings = {
    mfaRequiredFor: [...new Set([ownerRole, ...(Array.isArray(b.mfaRequiredFor) ? b.mfaRequiredFor.filter((x) => a.policy.roles.some((r) => r.id === x)) : cur.mfaRequiredFor)])],
    passwordMinLength: clampN(b.passwordMinLength, 12, 64, cur.passwordMinLength),
    passwordComplexity: typeof b.passwordComplexity === "boolean" ? b.passwordComplexity : cur.passwordComplexity,
    passwordRotationDays: [0, 90, 180].includes(Number(b.passwordRotationDays)) ? Number(b.passwordRotationDays) : cur.passwordRotationDays,
    sessionTimeoutMinutes: [15, 30, 60, 240].includes(Number(b.sessionTimeoutMinutes)) ? Number(b.sessionTimeoutMinutes) : cur.sessionTimeoutMinutes,
    maxFailedAttempts: [3, 5, 10].includes(Number(b.maxFailedAttempts)) ? Number(b.maxFailedAttempts) : cur.maxFailedAttempts,
    lockoutMinutes: [0, 15, 60].includes(Number(b.lockoutMinutes)) ? Number(b.lockoutMinutes) : cur.lockoutMinutes,
    recovery: Array.isArray(b.recovery) ? b.recovery.filter((x): x is string => typeof x === "string").slice(0, 5) : cur.recovery,
    reauthForSensitive: typeof b.reauthForSensitive === "boolean" ? b.reauthForSensitive : cur.reauthForSensitive,
  };
  await run(env.DB, "INSERT INTO security_settings (id, data, updated_at, updated_by) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", JSON.stringify(next), now(), a.member.id);
  await audit(env.DB, a, { action: "Security settings", resource: "Security policy", meta: "Policy updated" });
  return next;
}

export { json };
