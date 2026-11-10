/**
 * Client portal access (staff side): invite a client (creates their sign-in
 * account and emails a set-password link), resend, revoke. The client's
 * `portal` status on the record only changes here. Server-only.
 */
import { addMinutes, badRequest, HttpError, now, one, rateLimit, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { issueInviteToken, revokeAllSessions } from "./auth";
import { portalOrigin, sendTemplate } from "./email";

const INVITE_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });
type UserBits = { id: string; email: string; status: "pending" | "active" | "disabled"; last_login_at: string | null; created_at: string };

async function clientFor(env: AppEnv, a: Actor, id: string) {
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, id);
  if (!c || !(await canOpen(env, a, c))) throw new HttpError(404, "Client not found.", "not_found");
  if (c.status === "prospect" || c.status === "declined") throw badRequest("Accept this lead as a client first.");
  return c;
}
const userFor = (env: AppEnv, clientId: string) => one<UserBits>(env.DB, "SELECT id, email, status, last_login_at, created_at FROM users WHERE client_id = ?", clientId);

export async function portalStatus(env: AppEnv, a: Actor, clientId: string) {
  requirePermission(a, "crm", "view");
  await clientFor(env, a, clientId);
  const u = await userFor(env, clientId);
  return { access: u ? { email: u.email, status: u.status, lastLoginAt: u.last_login_at ?? undefined, invitedAt: u.created_at } : null };
}

/** { email? } — creates (or re-sends) the client's portal invitation. */
export async function invitePortal(env: AppEnv, a: Actor, clientId: string, b: { email?: unknown }) {
  requirePermission(a, "crm", "edit");
  requireStaff(a);
  const c = await clientFor(env, a, clientId);
  const email = (typeof b.email === "string" && b.email.trim() ? b.email : c.email).trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) throw badRequest("Add the client's email address first.");
  if (!(await rateLimit(env.DB, `portalinv:${clientId}`, 6, 60))) throw new HttpError(429, "Too many invitations for this client in the last hour.", "rate_limited");
  let u = await userFor(env, clientId);
  const t = now();
  if (u?.status === "active") throw badRequest("This client already uses the portal. They can reset their password from the sign-in page.");
  const other = await one<{ kind: string; client_id: string | null }>(env.DB, "SELECT kind, client_id FROM users WHERE email = ? AND (client_id IS NULL OR client_id != ?)", email, clientId);
  if (other) throw badRequest(other.kind === "staff" ? "That email belongs to a team member's sign-in. Use the client's own email." : "That email is already used by another client's portal.");
  if (!u) {
    const id = randomId("u");
    await run(env.DB, "INSERT INTO users (id, email, kind, client_id, status, created_at) VALUES (?, ?, 'client', ?, 'pending', ?)", id, email, clientId, t);
    u = { id, email, status: "pending", last_login_at: null, created_at: t };
  } else {
    // Re-invite (or re-enable after revoking): older invitation links stop working.
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET email = ?, status = 'pending', password_hash = NULL WHERE id = ?").bind(email, u.id),
      env.DB.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'invite' AND used_at IS NULL").bind(t, u.id),
    ]);
  }
  const { token } = await issueInviteToken(env, u.id, INVITE_DAYS);
  const url = `${portalOrigin(env)}/portal/welcome?token=${token}`;
  const first = (c.contact_name || c.name).trim().split(/\s+/)[0];
  const out = await sendTemplate(env, "portal_invite", { to: email, buttonUrl: url, vars: { firstName: first, staffName: a.member.name, expires: longDate(addMinutes(t, INVITE_DAYS * 1440)) } });
  await run(env.DB, "UPDATE clients SET portal = 'invited', updated_at = ? WHERE id = ?", t, clientId);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'staff', ?, ?)", randomId("x"), clientId, `Client portal invitation emailed to ${email}${out.sent ? "" : " (queued)"}`, a.member.id, t);
  await audit(env.DB, a, { action: "Invitation", resource: `Client ${clientId} — portal`, meta: `Invited ${email}` });
  return { emailed: out.sent, email, ...(await portalStatus(env, a, clientId)) };
}

/** Turns off the client's portal sign-in and signs them out everywhere. */
export async function revokePortal(env: AppEnv, a: Actor, clientId: string) {
  requirePermission(a, "crm", "edit");
  requireStaff(a);
  await clientFor(env, a, clientId);
  const u = await userFor(env, clientId);
  const t = now();
  if (u) {
    await run(env.DB, "UPDATE users SET status = 'disabled' WHERE id = ?", u.id);
    await revokeAllSessions(env, u.id);
  }
  await run(env.DB, "UPDATE clients SET portal = 'not_invited', updated_at = ? WHERE id = ?", t, clientId);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', 'Client portal access turned off', 'staff', ?, ?)", randomId("x"), clientId, a.member.id, t);
  await audit(env.DB, a, { action: "Permission change", resource: `Client ${clientId} — portal`, meta: "Portal access revoked; signed out" });
  return portalStatus(env, a, clientId);
}
