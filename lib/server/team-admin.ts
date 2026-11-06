/**
 * Team & Permissions — the rest of the administration actions, all enforced
 * here: team state for the screens, profiles, selected records, access reviews,
 * onboarding, offboarding (never deletes history), invitations (resend/cancel),
 * access requests, roles and departments. Server-only.
 */
import { ACTIONS, CAPABILITIES, MODULES, MODULE_DEPT, OFFBOARDING, ONBOARDING, OWNER_ONLY, SENSITIVE_KEYS, SENSITIVITY, WORKFLOW_LEVEL, type AccessRequest, type Department, type Invitation, type Member, type ModuleKey, type Role } from "@/lib/team/config";
import { canDo, canManage, clampRoleToActor, hasCap, roleOf } from "@/lib/team/policy";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, run, str, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { issueInviteToken, revokeAllSessions } from "./auth";
import { appOrigin, audit, loadMember, loadMembers, loadPolicy, loadSecurity, requireCap, requirePermission, requireStaff, sendEmail, type Actor, type ServerMember } from "./identity";

type Staff = Extract<Actor, { kind: "staff" }>;
async function target(env: AppEnv, id: string) {
  const m = await loadMember(env.DB, id);
  if (!m) throw notFound("Team member not found.");
  return m;
}
const uaShort = (ua: string | null) => {
  if (!ua) return "Unknown device";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} · ${os}` : b;
};

/* ---------------------------------------------------------------- state for the screens */
export async function teamState(env: AppEnv, a: Actor) {
  requireStaff(a);
  const db = env.DB;
  // Without Team access, a person still needs their own record, the roles and departments
  // (so menus and permissions display correctly) — but not anyone else's details.
  const full = canDo(a.policy, a.member, "team", "view");
  const [allMembers, users, invitations, requests, security, offb] = await Promise.all([
    loadMembers(db),
    all<{ id: string; member_id: string; mfa_enabled: number; last_login_at: string | null }>(db, "SELECT id, member_id, mfa_enabled, last_login_at FROM users WHERE member_id IS NOT NULL"),
    all<{ id: string; member_id: string; email: string; sent_at: string; expires_at: string; status: Invitation["status"]; invited_by: string; resent_at: string | null }>(db, "SELECT * FROM invitations ORDER BY sent_at DESC"),
    // Everyone sees their own requests; approvers see all.
    hasCap(a.policy, a.member, "access.approve") || hasCap(a.policy, a.member, "access.approveSensitive")
      ? all<{ id: string; member_id: string; kind: AccessRequest["kind"]; target: string; reason: string; status: AccessRequest["status"]; requested_at: string; decided_by: string | null; decided_at: string | null; note: string | null }>(db, "SELECT * FROM access_requests ORDER BY requested_at DESC")
      : all<{ id: string; member_id: string; kind: AccessRequest["kind"]; target: string; reason: string; status: AccessRequest["status"]; requested_at: string; decided_by: string | null; decided_at: string | null; note: string | null }>(db, "SELECT * FROM access_requests WHERE member_id = ? ORDER BY requested_at DESC", a.member.id),
    loadSecurity(db),
    all<{ id: string; offboarding: string | null }>(db, "SELECT id, offboarding FROM members WHERE offboarding IS NOT NULL"),
  ]);
  const members = full ? allMembers : allMembers.filter((m) => m.id === a.member.id);
  const t = now();
  // Sessions and sign-in history only for people this person manages, and themselves.
  const visible = members.filter((m) => m.id === a.member.id || canManage(a.policy, a.member, m, "archive")).map((m) => m.id);
  const userOf = new Map(users.map((u) => [u.member_id, u]));
  const vUsers = visible.map((id) => userOf.get(id)?.id).filter(Boolean) as string[];
  const q = vUsers.map(() => "?").join(",") || "''";
  const [sessions, logins] = await Promise.all([
    all<{ id_hash: string; user_id: string; created_at: string; last_seen_at: string; expires_at: string; revoked_at: string | null; ip: string | null; user_agent: string | null }>(db, `SELECT * FROM sessions WHERE user_id IN (${q}) AND expires_at > ? ORDER BY last_seen_at DESC LIMIT 200`, ...vUsers, t),
    all<{ actor_member_id: string; at: string; action: string; meta: string | null }>(db, `SELECT actor_member_id, at, action, meta FROM audit_events WHERE action IN ('Login', 'Failed login') AND actor_member_id IN (${visible.map(() => "?").join(",") || "''"}) ORDER BY at DESC LIMIT 300`, ...visible),
  ]);
  const out: Member[] = members.map((m) => {
    const u = userOf.get(m.id);
    const show = visible.includes(m.id);
    return {
      id: m.id, name: m.name, initials: m.initials, title: m.title, email: m.email, phone: m.phone, roleId: m.roleId, departments: m.departments, status: m.status, addedAt: m.addedAt,
      lastLoginAt: u?.last_login_at ?? undefined, managerId: m.managerId, grants: m.grants, selectedClientIds: m.selectedClientIds, mfa: u?.mfa_enabled ? "enabled" : "not_enrolled",
      onboarding: m.onboarding, offboarding: json(offb.find((o) => o.id === m.id)?.offboarding, undefined), lastAccessReviewAt: m.lastAccessReviewAt,
      sessions: show && u ? sessions.filter((s) => s.user_id === u.id).map((s) => ({ id: s.id_hash.slice(0, 16), device: uaShort(s.user_agent), location: s.ip ?? "", startedAt: s.created_at, lastActiveAt: s.last_seen_at, revokedAt: s.revoked_at ?? undefined })) : [],
      logins: show ? logins.filter((l) => l.actor_member_id === m.id).slice(0, 10).map((l) => ({ at: l.at, success: l.action === "Login", device: "", reason: l.action === "Login" ? undefined : l.meta ?? "Failed" })) : [],
    };
  });
  return {
    roles: a.policy.roles,
    departments: a.policy.departments,
    members: out,
    invitations: (full ? invitations : []).map((i): Invitation => {
      const m = members.find((x) => x.id === i.member_id);
      return { id: i.id, memberId: i.member_id, email: i.email, name: m?.name ?? i.email, roleId: m?.roleId ?? "", departments: m?.departments ?? [], managerId: m?.managerId, grants: m?.grants ?? [], sentAt: i.sent_at, expiresAt: i.expires_at, status: i.status === "pending" && i.expires_at < t ? "expired" : i.status, resentAt: i.resent_at ?? undefined, invitedBy: i.invited_by };
    }),
    requests: requests.map((r): AccessRequest => ({ id: r.id, memberId: r.member_id, kind: r.kind, target: r.target, reason: r.reason, status: r.status, requestedAt: r.requested_at, decidedBy: r.decided_by ?? undefined, decidedAt: r.decided_at ?? undefined, note: r.note ?? undefined })),
    security: full ? security : undefined,
  };
}

/* ---------------------------------------------------------------- profiles */
export async function updateProfile(env: AppEnv, a: Actor, id: string, b: Record<string, unknown>) {
  requireStaff(a);
  const t = await target(env, id);
  const self = a.member.id === id;
  const manage = canManage(a.policy, a.member, t);
  if (!self && !manage) throw forbidden();
  const name = str(b.name, 120) || t.name;
  const sets: string[] = ["name = ?", "initials = ?", "title = ?", "phone = ?"];
  const args: unknown[] = [name, name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase(), str(b.title, 120) || t.title, str(b.phone, 30)];
  // Email is the sign-in identity: only someone who manages this person can change it.
  const email = str(b.email, 200).toLowerCase();
  if (email && email !== t.email.toLowerCase()) {
    if (!manage) throw forbidden("Ask an administrator to change your sign-in email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest("Enter a valid email address.");
    if (await one(env.DB, "SELECT 1 FROM members WHERE email = ? AND id != ?", email, id)) throw new HttpError(409, "That email is already in use.", "duplicate");
    sets.push("email = ?"); args.push(email);
    await run(env.DB, "UPDATE users SET email = ? WHERE member_id = ?", email, id);
  }
  if ("managerId" in b) {
    const mgr = str(b.managerId, 60) || null;
    if (mgr !== (t.managerId ?? null)) {
      if (!canManage(a.policy, a.member, t, "assign")) throw forbidden("You can't change this person's manager.");
      if (mgr && (mgr === id || !(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", mgr)))) throw badRequest("Choose an active manager.");
      sets.push("manager_id = ?"); args.push(mgr);
    }
  }
  await run(env.DB, `UPDATE members SET ${sets.join(", ")} WHERE id = ?`, ...args, id);
  await audit(env.DB, a, { action: "Record update", resource: `${name}: profile`, meta: email && email !== t.email.toLowerCase() ? "Sign-in email changed" : undefined });
}

export async function setSelectedRecords(env: AppEnv, a: Actor, id: string, ids: unknown) {
  requireStaff(a);
  const t = await target(env, id);
  if (!canManage(a.policy, a.member, t, "assign")) throw forbidden();
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === "string").slice(0, 500))];
  if (list.length) {
    const found = await all<{ id: string }>(env.DB, `SELECT id FROM clients WHERE id IN (${list.map(() => "?").join(",")})`, ...list);
    if (found.length !== list.length) throw badRequest("Unknown client in the list.");
  }
  await run(env.DB, "UPDATE members SET selected_client_ids = ? WHERE id = ?", JSON.stringify(list), id);
  await audit(env.DB, a, { action: "Assignment change", resource: `${t.name}: individually selected records`, meta: `${list.length} client(s)` });
}

export async function markReviewed(env: AppEnv, a: Actor, id: string) {
  requireStaff(a);
  const t = await target(env, id);
  if (!canManage(a.policy, a.member, t, "assign")) throw forbidden();
  await run(env.DB, "UPDATE members SET last_access_review_at = ? WHERE id = ?", now(), id);
  await audit(env.DB, a, { action: "Permission change", resource: `${t.name}: access review completed` });
}

export async function toggleOnboarding(env: AppEnv, a: Actor, id: string, step: string) {
  requireStaff(a);
  if (!(ONBOARDING as readonly string[]).includes(step)) throw badRequest("Unknown step.");
  const t = await target(env, id);
  if (!canManage(a.policy, a.member, t)) throw forbidden();
  const o = { ...t.onboarding };
  if (o[step]) delete o[step]; else o[step] = now();
  await run(env.DB, "UPDATE members SET onboarding = ? WHERE id = ?", JSON.stringify(o), id);
  await audit(env.DB, a, { action: "Permission change", resource: `${t.name}: onboarding`, meta: step });
}

/* ---------------------------------------------------------------- offboarding */
type Offboarding = NonNullable<Member["offboarding"]>;
export async function offboarding(env: AppEnv, a: Actor, id: string, b: Record<string, unknown>) {
  requireStaff(a);
  const t = await target(env, id);
  if (!canManage(a.policy, a.member, t, "archive")) throw forbidden();
  const row = await one<{ offboarding: string | null }>(env.DB, "SELECT offboarding FROM members WHERE id = ?", id);
  let ob = json<Offboarding | null>(row?.offboarding, null);
  const action = str(b.action, 20);
  const user = await one<{ id: string }>(env.DB, "SELECT id FROM users WHERE member_id = ?", id);
  const at = now();
  if (action === "start") {
    ob ??= { startedAt: at, byId: a.member.id, steps: {} };
  } else if (action === "step") {
    const step = str(b.step, 60) as (typeof OFFBOARDING)[number];
    if (!ob) throw badRequest("Start offboarding first.");
    if (!OFFBOARDING.includes(step) || step === "Record offboarding date and administrator") throw badRequest("Unknown step.");
    ob = { ...ob, steps: { ...ob.steps, [step]: at } };
    if (step === "Suspend account") { await run(env.DB, "UPDATE members SET status = 'suspended' WHERE id = ?", id); if (user) await revokeAllSessions(env, user.id); }
    if (step === "Revoke active sessions" && user) await revokeAllSessions(env, user.id);
    if (step === "Remove department access") await env.DB.batch([env.DB.prepare("DELETE FROM member_departments WHERE member_id = ?").bind(id), env.DB.prepare("UPDATE members SET grants = '[]', selected_client_ids = '[]' WHERE id = ?").bind(id)]);
    const note = str(b.note, 200);
    await audit(env.DB, a, { action: step === "Suspend account" ? "Account suspension" : step === "Revoke active sessions" ? "Session revoked" : step.startsWith("Reassign") ? "Assignment change" : "Permission change", resource: `${t.name} — offboarding`, meta: note ? `${step}: ${note}` : step });
  } else if (action === "complete") {
    if (!ob || OFFBOARDING.some((s) => s !== "Record offboarding date and administrator" && !ob!.steps[s])) throw badRequest("Finish every offboarding step first.");
    ob = { ...ob, completedAt: at, steps: { ...ob.steps, "Record offboarding date and administrator": at } };
    // Deactivated, never deleted: their history stays attributed to them.
    await env.DB.batch([env.DB.prepare("UPDATE members SET status = 'deactivated' WHERE id = ?").bind(id), ...(user ? [env.DB.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").bind(user.id)] : [])]);
    if (user) await revokeAllSessions(env, user.id);
    await audit(env.DB, a, { action: "Account deactivation", resource: t.name, meta: "Offboarding completed; historical activity preserved" });
  } else throw badRequest("Unknown action.");
  await run(env.DB, "UPDATE members SET offboarding = ? WHERE id = ?", JSON.stringify(ob), id);
}

/* ---------------------------------------------------------------- invitations */
export async function invitationAction(env: AppEnv, req: Request, a: Actor, invId: string, action: string) {
  requirePermission(a, "team", "create");
  requireStaff(a);
  const inv = await one<{ id: string; member_id: string; email: string; status: string }>(env.DB, "SELECT * FROM invitations WHERE id = ?", invId);
  if (!inv) throw notFound("Invitation not found.");
  if (inv.status === "accepted" || inv.status === "cancelled") throw badRequest("This invitation is closed.");
  const t = await target(env, inv.member_id);
  if (!canManage(a.policy, a.member, t)) throw forbidden();
  const user = await one<{ id: string }>(env.DB, "SELECT id FROM users WHERE member_id = ?", inv.member_id);
  if (!user) throw notFound("Account not found.");
  if (action === "resend") {
    // Old links stop working; a new 7-day link is sent.
    await run(env.DB, "UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'invite' AND used_at IS NULL", now(), user.id);
    const tok = await issueInviteToken(env, user.id, 7);
    await run(env.DB, "UPDATE invitations SET status = 'pending', token_hash = ?, resent_at = ?, expires_at = (SELECT expires_at FROM auth_tokens WHERE token_hash = ?) WHERE id = ?", tok.hash, now(), tok.hash, invId);
    await sendEmail(env, { to: inv.email, template: "team_invite", subject: "Your MKB Business Suite invitation", text: `Here's your invitation link again (valid for 7 days):\n${appOrigin(env, req)}/login/invite?token=${tok.token}` });
    await audit(env.DB, a, { action: "Invitation", resource: t.name, meta: "Invitation resent (expires in 7 days)" });
  } else if (action === "cancel") {
    await env.DB.batch([
      env.DB.prepare("UPDATE invitations SET status = 'cancelled' WHERE id = ?").bind(invId),
      env.DB.prepare("UPDATE members SET status = 'deactivated' WHERE id = ? AND status = 'invited'").bind(inv.member_id),
      env.DB.prepare("UPDATE users SET status = 'disabled' WHERE id = ? AND status = 'pending'").bind(user.id),
      env.DB.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'invite' AND used_at IS NULL").bind(now(), user.id),
    ]);
    await audit(env.DB, a, { action: "Invitation", resource: t.name, meta: "Invitation cancelled" });
  } else throw badRequest("Unknown action.");
}

/* ---------------------------------------------------------------- access requests */
export async function requestAccess(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  requireStaff(a);
  const kind = str(b.kind, 20) as AccessRequest["kind"];
  const tgt = str(b.target, 80);
  const reason = str(b.reason, 1000);
  if (reason.length < 10) throw badRequest("Explain what the access is for (at least 10 characters).");
  const ok = kind === "sensitive" ? SENSITIVE_KEYS.includes(tgt) : kind === "module" ? MODULES.some((m) => m.key === tgt) : kind === "record" ? /^client:c-[A-Za-z0-9_-]{2,40}$/.test(tgt) : false;
  if (!ok) throw badRequest("Unknown access request.");
  if (await one(env.DB, "SELECT 1 FROM access_requests WHERE member_id = ? AND target = ? AND status = 'pending'", a.member.id, tgt)) throw new HttpError(409, "You already asked for this — it's waiting for review.", "duplicate");
  const id = randomId("ar");
  await run(env.DB, "INSERT INTO access_requests (id, member_id, kind, target, reason, status, requested_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)", id, a.member.id, kind, tgt, reason, now());
  await audit(env.DB, a, { action: "Access request", resource: tgt, meta: reason.slice(0, 200) });
  return { id };
}

export async function decideRequest(env: AppEnv, a: Actor, reqId: string, approve: boolean, note: string) {
  requireStaff(a);
  const r = await one<{ id: string; member_id: string; kind: AccessRequest["kind"]; target: string; status: string }>(env.DB, "SELECT * FROM access_requests WHERE id = ?", reqId);
  if (!r) throw notFound("Request not found.");
  if (r.status !== "pending") throw badRequest("This request was already decided.");
  if (r.member_id === a.member.id) throw forbidden("You can't decide your own request.");
  const allowed = r.kind === "sensitive" ? hasCap(a.policy, a.member, "access.approveSensitive") : hasCap(a.policy, a.member, "access.approve") || !!roleOf(a.policy.roles, a.member)?.isOwner;
  if (!allowed) throw forbidden(r.kind === "sensitive" ? "Only the Owner can approve sensitive-information access." : "You can't approve access requests.");
  const t = await target(env, r.member_id);
  const stmts = [env.DB.prepare("UPDATE access_requests SET status = ?, decided_by = ?, decided_at = ?, note = ? WHERE id = ?").bind(approve ? "approved" : "denied", a.member.id, now(), note || null, reqId)];
  if (approve && r.kind === "sensitive") stmts.push(env.DB.prepare("UPDATE members SET grants = ? WHERE id = ?").bind(JSON.stringify([...new Set([...t.grants, r.target])]), r.member_id));
  if (approve && r.kind === "record") stmts.push(env.DB.prepare("UPDATE members SET selected_client_ids = ? WHERE id = ?").bind(JSON.stringify([...new Set([...t.selectedClientIds, r.target.slice(7)])]), r.member_id));
  await env.DB.batch(stmts);
  await audit(env.DB, a, { action: "Approval", resource: `${approve ? "Approved" : "Denied"}: ${t.name} — ${r.target}`, meta: note || undefined });
}

/* ---------------------------------------------------------------- roles */
function canEditRole(a: Staff, r: Role) {
  const me = roleOf(a.policy.roles, a.member);
  if (!hasCap(a.policy, a.member, "roles.manage") || r.isOwner || r.isClient) return false;
  return !!me?.isOwner || r.level < (me?.level ?? 0);
}
function cleanRole(a: Staff, r: Role, base: Role): Role {
  const me = roleOf(a.policy.roles, a.member)!;
  const actions = ACTIONS.map((x) => x.key);
  const perms = Object.fromEntries(MODULES.map((m) => [m.key, ((r.perms?.[m.key] ?? []) as string[]).filter((x) => actions.includes(x as never))]).filter(([, v]) => (v as string[]).length)) as Role["perms"];
  const recordTypes = Object.fromEntries(Object.entries(r.recordTypes ?? {}).filter(([k, v]) => MODULES.some((m) => m.key === k) && Array.isArray(v)).map(([k, v]) => [k, (v as string[]).map((x) => str(x, 60))])) as Role["recordTypes"];
  const cleaned: Role = {
    ...base,
    name: str(r.name, 60) || base.name,
    description: str(r.description, 500),
    scope: ["all_departments", "assigned", "team", "selected"].includes(r.scope) ? r.scope : base.scope,
    maxSensitivity: (SENSITIVITY as readonly string[]).includes(r.maxSensitivity) ? r.maxSensitivity : base.maxSensitivity,
    allDepartments: !!r.allDepartments,
    perms,
    recordTypes,
    sensitive: (r.sensitive ?? []).filter((k) => SENSITIVE_KEYS.includes(k)),
    caps: (r.caps ?? []).filter((c) => CAPABILITIES.some((x) => x.key === c)),
  };
  // No escalation: never more than the editor holds; Owner-only capabilities stay with the Owner.
  const clamped = clampRoleToActor(a.policy, a.member, cleaned);
  return me.isOwner ? clamped : { ...clamped, caps: clamped.caps.filter((c) => !OWNER_ONLY.includes(c)), level: Math.min(base.level, me.level - 1) };
}
async function writeRole(env: AppEnv, r: Role, insert: boolean) {
  const t = now();
  if (insert)
    await run(env.DB, "INSERT INTO roles (id, name, description, kind, level, is_owner, is_client, all_departments, scope, max_sensitivity, perms, record_types, sensitive, caps, created_at, updated_at) VALUES (?, ?, ?, 'custom', ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)", r.id, r.name, r.description, r.level, r.allDepartments ? 1 : 0, r.scope, r.maxSensitivity, JSON.stringify(r.perms), JSON.stringify(r.recordTypes), JSON.stringify(r.sensitive), JSON.stringify(r.caps), t, t);
  else
    await run(env.DB, "UPDATE roles SET name = ?, description = ?, all_departments = ?, scope = ?, max_sensitivity = ?, perms = ?, record_types = ?, sensitive = ?, caps = ?, level = ?, updated_at = ? WHERE id = ?", r.name, r.description, r.allDepartments ? 1 : 0, r.scope, r.maxSensitivity, JSON.stringify(r.perms), JSON.stringify(r.recordTypes), JSON.stringify(r.sensitive), JSON.stringify(r.caps), r.level, t, r.id);
}
export async function saveRole(env: AppEnv, a: Actor, id: string, r: Role, summary: string) {
  requireStaff(a);
  const cur = a.policy.roles.find((x) => x.id === id);
  if (!cur) throw notFound("Role not found.");
  if (!canEditRole(a, cur)) throw forbidden("You can only edit roles below your own, with the roles & permissions capability.");
  if (a.policy.roles.some((x) => x.id !== id && x.name.toLowerCase() === str(r.name, 60).toLowerCase())) throw new HttpError(409, "A role with this name already exists.", "duplicate");
  const clean = cleanRole(a, r, cur);
  await writeRole(env, clean, false);
  await audit(env.DB, a, { action: "Permission change", resource: `Role: ${clean.name}`, meta: str(summary, 500) || "Role updated" });
  return clean;
}
export async function duplicateRole(env: AppEnv, a: Actor, fromId: string, newId: string, name: string) {
  requireCap(a, "roles.manage");
  requireStaff(a);
  const src = a.policy.roles.find((x) => x.id === fromId);
  if (!src || src.isOwner || src.isClient) throw badRequest("That role can't be copied.");
  if (!/^role-[A-Za-z0-9_-]{3,40}$/.test(newId) || a.policy.roles.some((x) => x.id === newId)) throw badRequest("Invalid role ID.");
  const nm = str(name, 60);
  if (!nm || a.policy.roles.some((x) => x.name.toLowerCase() === nm.toLowerCase())) throw new HttpError(409, "Choose a different name.", "duplicate");
  const copy = cleanRole(a, { ...src, name: nm, description: `Copy of ${src.name}. ${src.description}` }, { ...src, id: newId, kind: "custom", isOwner: false, isClient: false });
  await writeRole(env, copy, true);
  await audit(env.DB, a, { action: "Permission change", resource: `Role: ${nm}`, meta: `Duplicated from ${src.name}` });
  return copy;
}
export async function deleteRole(env: AppEnv, a: Actor, id: string) {
  requireStaff(a);
  const r = a.policy.roles.find((x) => x.id === id);
  if (!r) throw notFound("Role not found.");
  if (r.kind !== "custom" || !canEditRole(a, r)) throw forbidden();
  if (await one(env.DB, "SELECT 1 FROM members WHERE role_id = ?", id)) throw badRequest("Move its members to another role first.");
  await run(env.DB, "DELETE FROM roles WHERE id = ?", id);
  await audit(env.DB, a, { action: "Permission change", resource: `Role: ${r.name}`, meta: "Custom role deleted" });
}

/* ---------------------------------------------------------------- departments */
export async function saveDepartment(env: AppEnv, a: Actor, key: string, d: Partial<Department>) {
  requirePermission(a, "team", "settings");
  const cur = a.kind === "staff" ? a.policy.departments.find((x) => x.key === key) : undefined;
  if (!cur) throw notFound("Department not found.");
  const mods = (Array.isArray(d.modules) ? d.modules : []).filter((m): m is ModuleKey => (Object.keys(MODULE_DEPT) as string[]).includes(m));
  const levels = Object.keys(WORKFLOW_LEVEL);
  const workflow = Object.fromEntries(Object.entries(d.workflow ?? {}).filter(([k, v]) => k in cur.workflow || Object.keys(cur.workflow).length === 0 ? levels.includes(v as string) : false).map(([k, v]) => [str(k, 80), v]));
  const mgr = str(d.managerId, 60) || null;
  if (mgr && !(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", mgr))) throw badRequest("Choose an active manager.");
  await run(env.DB, "UPDATE departments SET manager_id = ?, reporting = ?, modules = ?, workflow = ? WHERE key = ?", mgr, d.reporting ? 1 : 0, JSON.stringify(mods), JSON.stringify({ ...cur.workflow, ...workflow }), key);
  await audit(env.DB, a, { action: "Permission change", resource: "Department settings", department: cur.key });
}

export { loadPolicy, type ServerMember };
