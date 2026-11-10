/**
 * Sign-in: sessions, lockout, MFA (authenticator app for staff; a 6-digit code
 * emailed at every sign-in for client-portal accounts), password reset,
 * invitation acceptance. Staff and client accounts each sign in only on their
 * own screens. Server-only.
 *
 * - Session tokens: 256-bit random, sent only as an HttpOnly, SameSite=Lax
 *   cookie (Secure on HTTPS); the database stores a SHA-256 hash.
 * - Idle timeout comes from the security policy; absolute lifetime is 12 hours.
 * - A session that still needs its MFA step can only reach the MFA endpoints.
 */
import { addMinutes, clientIp, HttpError, isDev, now, one, rateLimit, run, type AppEnv } from "./core";
import { decryptField, encryptField, hashPassword, newTotpSecret, otpauthUrl, passwordProblem, randomId, randomToken, sha256, verifyPassword, verifyTotp } from "./crypto";
import { appOrigin, audit, loadMember, loadPolicy, loadSecurity, sendEmail, type Actor } from "./identity";
import { portalOrigin } from "./email";

const ABSOLUTE_HOURS = 12;
const RESET_MINUTES = 30;

export type UserRow = { id: string; email: string; password_hash: string | null; kind: "staff" | "client"; member_id: string | null; client_id: string | null; status: "pending" | "active" | "disabled"; mfa_secret_enc: string | null; mfa_secret_iv: string | null; mfa_enabled: number; mfa_last_step: number; failed_attempts: number; locked_until: string | null };
type SessionRow = { id_hash: string; user_id: string; created_at: string; last_seen_at: string; expires_at: string; mfa_verified: number; revoked_at: string | null };

const cookieName = (env: AppEnv) => (isDev(env) ? "mkb_session" : "__Host-mkb_session");
function cookie(env: AppEnv, req: Request, value: string, maxAge?: number) {
  const secure = appOrigin(env, req).startsWith("https://");
  return [`${cookieName(env)}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", secure ? "Secure" : "", maxAge !== undefined ? `Max-Age=${maxAge}` : ""].filter(Boolean).join("; ");
}
export const clearCookie = (env: AppEnv, req: Request) => cookie(env, req, "", 0);
function readCookie(env: AppEnv, req: Request) {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${cookieName(env)}=`));
  return m ? m.slice(cookieName(env).length + 1) : null;
}

function key(env: AppEnv) {
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  return env.ENCRYPTION_KEY;
}

async function createSession(env: AppEnv, req: Request, userId: string, mfaVerified: boolean, token = randomToken()) {
  const t = now();
  await run(env.DB, "INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at, mfa_verified, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", await sha256(token), userId, t, t, addMinutes(t, ABSOLUTE_HOURS * 60), mfaVerified ? 1 : 0, clientIp(req), (req.headers.get("user-agent") ?? "").slice(0, 200));
  return cookie(env, req, token, ABSOLUTE_HOURS * 3600);
}

/** Loads the current session and user; null if missing, revoked, expired or idle too long. */
export async function readSession(env: AppEnv, req: Request) {
  const token = readCookie(env, req);
  if (!token) return null;
  const hash = await sha256(token);
  const s = await one<SessionRow>(env.DB, "SELECT * FROM sessions WHERE id_hash = ?", hash);
  if (!s || s.revoked_at) return null;
  const t = now();
  const sec = await loadSecurity(env.DB);
  if (s.expires_at < t || addMinutes(s.last_seen_at, sec.sessionTimeoutMinutes) < t) {
    await run(env.DB, "UPDATE sessions SET revoked_at = ? WHERE id_hash = ? AND revoked_at IS NULL", t, hash);
    return null;
  }
  const user = await one<UserRow>(env.DB, "SELECT * FROM users WHERE id = ?", s.user_id);
  if (!user || user.status !== "active") return null;
  // Refresh "last seen" at most once a minute.
  if (addMinutes(s.last_seen_at, 1) < t) await run(env.DB, "UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?", t, hash);
  return { session: s, user, hash };
}

/** The signed-in actor for a request. Throws 401 when not signed in (or MFA not finished). */
export async function authenticate(env: AppEnv, req: Request, opts: { allowPartial?: boolean } = {}): Promise<Actor & { mfaPending: boolean }> {
  const r = await readSession(env, req);
  if (!r) throw new HttpError(401, "Please sign in.", "unauthenticated");
  const pending = !r.session.mfa_verified;
  if (pending && !opts.allowPartial) throw new HttpError(401, "Finish two-step verification.", "mfa_required");
  const ip = clientIp(req);
  if (r.user.kind === "client") return { kind: "client", userId: r.user.id, clientId: r.user.client_id!, ip, mfaPending: pending };
  const member = await loadMember(env.DB, r.user.member_id!);
  // Suspended or deactivated staff are signed out everywhere, immediately.
  if (!member || member.status !== "active") {
    await run(env.DB, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", now(), r.user.id);
    throw new HttpError(401, "This account can't sign in.", "account_inactive");
  }
  return { kind: "staff", userId: r.user.id, member, policy: await loadPolicy(env.DB), ip, mfaPending: pending };
}

async function mfaRequiredFor(env: AppEnv, user: UserRow) {
  // Client portal: always a second step (an emailed code).
  if (user.kind === "client") return true;
  const [sec, member] = await Promise.all([loadSecurity(env.DB), loadMember(env.DB, user.member_id!)]);
  return !!user.mfa_enabled || (!!member && sec.mfaRequiredFor.includes(member.roleId));
}

/* ---------------------------------------------------------------- login */
export type LoginResult = { next: "done" | "mfa" | "mfa_setup" | "email_code"; setCookie?: string };
const GENERIC = "Email or password is incorrect.";

/** `audience`: the staff sign-in only signs in staff accounts; the portal sign-in only client accounts. */
export async function login(env: AppEnv, req: Request, email: string, password: string, audience: "staff" | "client" = "staff"): Promise<LoginResult> {
  const ip = clientIp(req);
  const db = env.DB;
  if (!(await rateLimit(db, `login-ip:${ip}`, 100, 15))) throw new HttpError(429, "Too many attempts. Try again in a few minutes.", "rate_limited");
  const sec = await loadSecurity(db);
  const user = await one<UserRow>(db, "SELECT * FROM users WHERE email = ?", email.toLowerCase());
  const t = now();
  if (user?.locked_until && user.locked_until > t) {
    await audit(db, { kind: "anonymous", ip, userId: user.id, memberId: user.member_id ?? undefined }, { action: "Failed login", resource: "MKB Business Suite", meta: "Account locked", success: false });
    throw new HttpError(423, "This account is temporarily locked. Try again later or ask an administrator.", "locked");
  }
  const ok = await verifyPassword(password, user?.password_hash);
  if (!user || !ok || user.status !== "active") {
    if (user) {
      const fails = user.failed_attempts + 1;
      const lock = fails >= sec.maxFailedAttempts ? (sec.lockoutMinutes ? addMinutes(t, sec.lockoutMinutes) : "9999-12-31T00:00:00.000Z") : null;
      await run(db, "UPDATE users SET failed_attempts = ?, locked_until = COALESCE(?, locked_until) WHERE id = ?", lock ? 0 : fails, lock, user.id);
      await audit(db, { kind: "anonymous", ip, userId: user.id, memberId: user.member_id ?? undefined }, { action: "Failed login", resource: "MKB Business Suite", meta: lock ? "Wrong password — account locked" : "Wrong password", success: false });
    }
    throw new HttpError(401, GENERIC, "bad_credentials");
  }
  // Each account signs in only on its own screen (never says which kind exists).
  if (user.kind !== audience) throw new HttpError(401, GENERIC, "bad_credentials");
  if (user.kind === "staff") {
    const m = await loadMember(db, user.member_id!);
    if (!m || m.status !== "active") throw new HttpError(401, GENERIC, "bad_credentials");
  }
  await run(db, "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?", user.id);
  const needMfa = await mfaRequiredFor(env, user);
  const token = randomToken();
  const setCookie = await createSession(env, req, user.id, !needMfa, token);
  if (!needMfa) await finishLogin(env, req, user);
  if (user.kind === "client") { await sendLoginCode(env, user, await sha256(token)); return { next: "email_code", setCookie }; }
  return { next: !needMfa ? "done" : user.mfa_enabled ? "mfa" : "mfa_setup", setCookie };
}

async function finishLogin(env: AppEnv, req: Request, user: UserRow) {
  await run(env.DB, "UPDATE users SET last_login_at = ? WHERE id = ?", now(), user.id);
  await audit(env.DB, { kind: "anonymous", ip: clientIp(req), userId: user.id, memberId: user.member_id ?? undefined }, { action: "Login", resource: "MKB Business Suite", meta: user.kind === "client" ? "Client portal" : undefined });
}

/* ---------------------------------------------------------------- client portal: emailed sign-in code */
const CODE_MINUTES = 10;
const codeHash = (sessionHash: string, code: string) => sha256(`${sessionHash}:${code}`);

/** Emails a fresh 6-digit code for this session (replacing any earlier one). */
async function sendLoginCode(env: AppEnv, user: UserRow, sessionHash: string) {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  const code = String(n).padStart(6, "0");
  const t = now();
  await run(env.DB, "INSERT INTO login_codes (session_hash, user_id, code_hash, created_at, expires_at, attempts, sends) VALUES (?, ?, ?, ?, ?, 0, 1) ON CONFLICT(session_hash) DO UPDATE SET code_hash = excluded.code_hash, created_at = excluded.created_at, expires_at = excluded.expires_at, attempts = 0, sends = sends + 1", sessionHash, user.id, await codeHash(sessionHash, code), t, addMinutes(t, CODE_MINUTES));
  const text = `Your MKB Financial Group sign-in code is:\n\n${code}\n\nIt expires in ${CODE_MINUTES} minutes. If you didn't try to sign in, you can ignore this email — and consider changing your password.\n\nMKB will never ask you for this code by phone, text or email.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:480px;margin:0 auto;padding:24px"><p style="font:600 18px Georgia,serif;margin:0 0 12px">MKB Financial Group</p><p>Your sign-in code is:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:12px 0">${code}</p><p style="color:#555;font-size:13px">It expires in ${CODE_MINUTES} minutes. If you didn't try to sign in, you can ignore this email — and consider changing your password. MKB will never ask you for this code by phone, text or email.</p></div>`;
  await sendEmail(env, { to: user.email, template: "portal_code", subject: "Your MKB sign-in code", text, html });
}

/** Checks the emailed code and finishes the client's sign-in. */
export async function verifyLoginCode(env: AppEnv, req: Request, code: string) {
  const r = await readSession(env, req);
  if (!r) throw new HttpError(401, "Please sign in again.", "unauthenticated");
  if (r.session.mfa_verified) return;
  if (r.user.kind !== "client") throw new HttpError(400, "Use your authenticator app.", "bad_code");
  const row = await one<{ code_hash: string; expires_at: string; attempts: number }>(env.DB, "SELECT code_hash, expires_at, attempts FROM login_codes WHERE session_hash = ?", r.hash);
  if (!row || row.expires_at < now()) throw new HttpError(401, "That code has expired. Send a new one.", "code_expired");
  if (row.attempts >= 5) throw new HttpError(429, "Too many tries. Send a new code.", "rate_limited");
  if (!/^\d{6}$/.test(code.trim()) || (await codeHash(r.hash, code.trim())) !== row.code_hash) {
    await run(env.DB, "UPDATE login_codes SET attempts = attempts + 1 WHERE session_hash = ?", r.hash);
    await audit(env.DB, { kind: "anonymous", ip: clientIp(req), userId: r.user.id }, { action: "Failed login", resource: "Client portal", meta: "Wrong sign-in code", success: false });
    throw new HttpError(401, "That code didn't work. Check the newest email from us and try again.", "bad_code");
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_codes WHERE session_hash = ?").bind(r.hash),
    env.DB.prepare("UPDATE sessions SET mfa_verified = 1 WHERE id_hash = ?").bind(r.hash),
  ]);
  await finishLogin(env, req, r.user);
}

/** Sends another code (rate-limited). */
export async function resendLoginCode(env: AppEnv, req: Request) {
  const r = await readSession(env, req);
  if (!r) throw new HttpError(401, "Please sign in again.", "unauthenticated");
  if (r.session.mfa_verified || r.user.kind !== "client") return;
  const row = await one<{ sends: number }>(env.DB, "SELECT sends FROM login_codes WHERE session_hash = ?", r.hash);
  if ((row?.sends ?? 0) >= 5 || !(await rateLimit(env.DB, `code:${r.user.id}`, 8, 60))) throw new HttpError(429, "Too many codes sent. Wait a while, then sign in again.", "rate_limited");
  await sendLoginCode(env, r.user, r.hash);
}

/* ---------------------------------------------------------------- MFA */
export async function mfaVerify(env: AppEnv, req: Request, code: string) {
  const r = await readSession(env, req);
  if (!r) throw new HttpError(401, "Please sign in again.", "unauthenticated");
  if (r.session.mfa_verified) return;
  if (!(await rateLimit(env.DB, `mfa:${r.user.id}`, 10, 15))) throw new HttpError(429, "Too many attempts. Sign in again in a few minutes.", "rate_limited");
  if (!r.user.mfa_enabled || !r.user.mfa_secret_enc) throw new HttpError(400, "Set up two-step verification first.", "mfa_setup");
  const secret = await decryptField(key(env), { ciphertext: r.user.mfa_secret_enc, iv: r.user.mfa_secret_iv! }, `user:${r.user.id}:mfa`);
  const step = await verifyTotp(secret, code.trim(), r.user.mfa_last_step);
  if (step === null) {
    await audit(env.DB, { kind: "anonymous", ip: clientIp(req), userId: r.user.id, memberId: r.user.member_id ?? undefined }, { action: "Failed login", resource: "MKB Business Suite", meta: "Wrong two-step code", success: false });
    throw new HttpError(401, "That code didn't work. Check your authenticator app and try again.", "bad_code");
  }
  await run(env.DB, "UPDATE users SET mfa_last_step = ? WHERE id = ?", step, r.user.id);
  await run(env.DB, "UPDATE sessions SET mfa_verified = 1 WHERE id_hash = ?", r.hash);
  await finishLogin(env, req, r.user);
}

/** Starts authenticator-app setup: returns the secret to show as a QR code / setup key. */
export async function mfaSetupStart(env: AppEnv, req: Request) {
  const r = await readSession(env, req);
  if (!r) throw new HttpError(401, "Please sign in.", "unauthenticated");
  // Already-enrolled users must pass MFA before they can replace their authenticator.
  if (r.user.mfa_enabled && !r.session.mfa_verified) throw new HttpError(403, "Verify your current code first.", "mfa_required");
  const secret = newTotpSecret();
  const e = await encryptField(key(env), secret, `user:${r.user.id}:mfa-pending`);
  await run(env.DB, "UPDATE users SET mfa_secret_enc = ?, mfa_secret_iv = ?, mfa_enabled = CASE WHEN mfa_enabled = 1 THEN 1 ELSE 0 END WHERE id = ?", `pending:${e.ciphertext}`, e.iv, r.user.id);
  return { secret, otpauth: otpauthUrl(secret, r.user.email) };
}
export async function mfaSetupConfirm(env: AppEnv, req: Request, code: string) {
  const r = await readSession(env, req);
  if (!r) throw new HttpError(401, "Please sign in.", "unauthenticated");
  if (!r.user.mfa_secret_enc?.startsWith("pending:")) throw new HttpError(400, "Start setup first.");
  if (!(await rateLimit(env.DB, `mfa:${r.user.id}`, 10, 15))) throw new HttpError(429, "Too many attempts.", "rate_limited");
  const secret = await decryptField(key(env), { ciphertext: r.user.mfa_secret_enc.slice(8), iv: r.user.mfa_secret_iv! }, `user:${r.user.id}:mfa-pending`);
  const step = await verifyTotp(secret, code.trim(), 0);
  if (step === null) throw new HttpError(401, "That code didn't work. Make sure your phone's clock is correct and try again.", "bad_code");
  const e = await encryptField(key(env), secret, `user:${r.user.id}:mfa`);
  await run(env.DB, "UPDATE users SET mfa_secret_enc = ?, mfa_secret_iv = ?, mfa_enabled = 1, mfa_last_step = ? WHERE id = ?", e.ciphertext, e.iv, step, r.user.id);
  await run(env.DB, "UPDATE sessions SET mfa_verified = 1 WHERE id_hash = ?", r.hash);
  await audit(env.DB, { kind: "anonymous", ip: clientIp(req), userId: r.user.id, memberId: r.user.member_id ?? undefined }, { action: "Security settings", resource: "Two-step verification", meta: "Authenticator app enrolled" });
  if (!r.session.mfa_verified) await finishLogin(env, req, r.user);
}

/* ---------------------------------------------------------------- logout / revoke */
export async function logout(env: AppEnv, req: Request) {
  const r = await readSession(env, req);
  if (!r) return;
  await run(env.DB, "UPDATE sessions SET revoked_at = ? WHERE id_hash = ?", now(), r.hash);
  await audit(env.DB, { kind: "anonymous", ip: clientIp(req), userId: r.user.id, memberId: r.user.member_id ?? undefined }, { action: "Logout", resource: "MKB Business Suite" });
}
export async function revokeAllSessions(env: AppEnv, userId: string) {
  await run(env.DB, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", now(), userId);
}

/* ---------------------------------------------------------------- password reset */
/** Always answers the same way, whether or not the email exists. */
export async function forgotPassword(env: AppEnv, req: Request, email: string) {
  if (!(await rateLimit(env.DB, `forgot-ip:${clientIp(req)}`, 10, 60))) throw new HttpError(429, "Too many requests. Try again later.", "rate_limited");
  const user = await one<UserRow>(env.DB, "SELECT * FROM users WHERE email = ? AND status = 'active'", email.toLowerCase());
  if (!user) return;
  const token = randomToken();
  const t = now();
  await run(env.DB, "INSERT INTO auth_tokens (token_hash, user_id, purpose, created_at, expires_at) VALUES (?, ?, 'reset', ?, ?)", await sha256(token), user.id, t, addMinutes(t, RESET_MINUTES));
  // Client accounts reset on the portal; staff on the CRM.
  const link = user.kind === "client" ? `${portalOrigin(env)}/portal/reset?token=${token}` : `${appOrigin(env, req)}/login/reset?token=${token}`;
  await sendEmail(env, { to: user.email, template: "password_reset", subject: "Reset your MKB password", text: `Use this link within ${RESET_MINUTES} minutes to choose a new password:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.` });
  await audit(env.DB, { kind: "anonymous", ip: clientIp(req), userId: user.id, memberId: user.member_id ?? undefined }, { action: "Password change", resource: user.email, meta: "Reset link requested" });
}

async function useToken(env: AppEnv, token: string, purpose: "reset" | "invite") {
  const hash = await sha256(token);
  const row = await one<{ user_id: string; expires_at: string; used_at: string | null }>(env.DB, "SELECT user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND purpose = ?", hash, purpose);
  if (!row || row.used_at || row.expires_at < now()) throw new HttpError(400, "This link has expired or was already used. Ask for a new one.", "bad_token");
  return { userId: row.user_id, hash };
}

export async function resetPassword(env: AppEnv, req: Request, token: string, password: string) {
  const { userId, hash } = await useToken(env, token, "reset");
  const problem = passwordProblem(password, await loadSecurity(env.DB));
  if (problem) throw new HttpError(400, problem, "weak_password");
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, password_changed_at = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?").bind(await hashPassword(password), t, userId),
    env.DB.prepare("UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?").bind(t, hash),
    env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(t, userId),
  ]);
  const u = await one<UserRow>(env.DB, "SELECT * FROM users WHERE id = ?", userId);
  await audit(env.DB, { kind: "anonymous", ip: clientIp(req), userId, memberId: u?.member_id ?? undefined }, { action: "Password change", resource: u?.email ?? userId, meta: "Password reset; all sessions signed out" });
}

/* ---------------------------------------------------------------- invitations */
export async function issueInviteToken(env: AppEnv, userId: string, days: number) {
  const token = randomToken();
  const t = now();
  await run(env.DB, "INSERT INTO auth_tokens (token_hash, user_id, purpose, created_at, expires_at) VALUES (?, ?, 'invite', ?, ?)", await sha256(token), userId, t, addMinutes(t, days * 1440));
  return { token, hash: await sha256(token) };
}

/** The invitee chooses a password; the account and team member become active. */
export async function acceptInvite(env: AppEnv, req: Request, token: string, password: string): Promise<LoginResult> {
  const { userId, hash } = await useToken(env, token, "invite");
  const problem = passwordProblem(password, await loadSecurity(env.DB));
  if (problem) throw new HttpError(400, problem, "weak_password");
  const u = await one<UserRow>(env.DB, "SELECT * FROM users WHERE id = ?", userId);
  if (!u || u.status === "disabled") throw new HttpError(400, "This invitation is no longer valid.", "bad_token");
  const t = now();
  const stmts = [
    env.DB.prepare("UPDATE users SET password_hash = ?, password_changed_at = ?, status = 'active' WHERE id = ?").bind(await hashPassword(password), t, userId),
    env.DB.prepare("UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?").bind(t, hash),
  ];
  if (u.member_id) {
    stmts.push(env.DB.prepare("UPDATE members SET status = 'active', onboarding = json_set(onboarding, '$.\"Invitation accepted\"', ?, '$.\"Account created\"', ?) WHERE id = ? AND status = 'invited'").bind(t, t, u.member_id));
    stmts.push(env.DB.prepare("UPDATE invitations SET status = 'accepted' WHERE member_id = ? AND status = 'pending'").bind(u.member_id));
  }
  if (u.client_id) stmts.push(env.DB.prepare("UPDATE clients SET portal = 'active', updated_at = ? WHERE id = ?").bind(t, u.client_id));
  await env.DB.batch(stmts);
  await audit(env.DB, { kind: "anonymous", ip: clientIp(req), userId, memberId: u.member_id ?? undefined }, { action: "Invitation", resource: u.email, meta: u.kind === "client" ? "Client portal invitation accepted" : "Invitation accepted" });
  // A client just proved their email by opening the invitation: sign them straight in.
  if (u.kind === "client") {
    const setCookie = await createSession(env, req, u.id, true);
    await finishLogin(env, req, { ...u, status: "active" });
    return { next: "done", setCookie };
  }
  return login(env, req, u.email, password, "staff");
}

export { randomId };
