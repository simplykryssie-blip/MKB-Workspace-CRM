/**
 * Private client links — a long random link that opens one form for one client
 * without a portal login. Reusable: `purpose` names the form ("books_intake"
 * today; tax interviews and other forms later).
 *
 * - The token is 256 bits of randomness; only its SHA-256 hash is stored.
 * - A link works for its own record only, expires (14 days by default),
 *   can be cancelled by staff at any time, and stops working once it's used.
 * - Sending a new link cancels the older ones for the same record.
 * Server-only.
 */
import { addMinutes, HttpError, now, one, rateLimit, run, type AppEnv } from "./core";
import { randomId, randomToken, sha256 } from "./crypto";

export type LinkPurpose = "books_intake" | "books_proposal" | "tax_interview";
export const LINK_DAYS = 14;

type Row = { id: string; token_hash: string; purpose: LinkPurpose; target_id: string; client_id: string; email: string; created_at: string; created_by: string; expires_at: string; revoked_at: string | null; revoked_by: string | null; used_at: string | null; first_opened_at: string | null; last_opened_at: string | null };
export type LinkState = "active" | "expired" | "cancelled" | "used";
/** What staff see about a link (never the token itself). */
export type LinkInfo = { id: string; email: string; state: LinkState; sentAt: string; sentBy: string; expiresAt: string; cancelledAt?: string; usedAt?: string; openedAt?: string; lastOpenedAt?: string };

const stateOf = (r: Row, t = now()): LinkState => (r.used_at ? "used" : r.revoked_at ? "cancelled" : r.expires_at <= t ? "expired" : "active");
const toInfo = (r: Row): LinkInfo => ({ id: r.id, email: r.email, state: stateOf(r), sentAt: r.created_at, sentBy: r.created_by, expiresAt: r.expires_at, cancelledAt: r.revoked_at ?? undefined, usedAt: r.used_at ?? undefined, openedAt: r.first_opened_at ?? undefined, lastOpenedAt: r.last_opened_at ?? undefined });

/** Creates a link (cancelling any earlier ones for the same record). Returns the raw token once — it's never stored. */
export async function createLink(env: AppEnv, l: { purpose: LinkPurpose; targetId: string; clientId: string; email: string; memberId: string; days?: number }) {
  const token = randomToken(32);
  const id = randomId("lnk");
  const t = now();
  const expires = addMinutes(t, (l.days ?? LINK_DAYS) * 24 * 60);
  await env.DB.batch([
    env.DB.prepare("UPDATE secure_links SET revoked_at = ?, revoked_by = ? WHERE purpose = ? AND target_id = ? AND revoked_at IS NULL AND used_at IS NULL").bind(t, `replaced:${id}`, l.purpose, l.targetId),
    env.DB.prepare("INSERT INTO secure_links (id, token_hash, purpose, target_id, client_id, email, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, await sha256(token), l.purpose, l.targetId, l.clientId, l.email, t, l.memberId, expires),
  ]);
  return { token, info: toInfo((await one<Row>(env.DB, "SELECT * FROM secure_links WHERE id = ?", id))!) };
}

/** The most recent link for a record (for the staff screen), or null. */
export async function latestLink(env: AppEnv, purpose: LinkPurpose, targetId: string) {
  const r = await one<Row>(env.DB, "SELECT * FROM secure_links WHERE purpose = ? AND target_id = ? ORDER BY created_at DESC LIMIT 1", purpose, targetId);
  return r ? toInfo(r) : null;
}

/** Cancels every open link for a record. Returns how many were cancelled. */
export async function cancelLinks(env: AppEnv, purpose: LinkPurpose, targetId: string, memberId: string) {
  const res = await run(env.DB, "UPDATE secure_links SET revoked_at = ?, revoked_by = ? WHERE purpose = ? AND target_id = ? AND revoked_at IS NULL AND used_at IS NULL", now(), memberId, purpose, targetId);
  return res.meta.changes ?? 0;
}

const GONE: Record<Exclude<LinkState, "active">, string> = {
  expired: "This link has expired. Please contact MKB Financial Group and we'll send you a new one.",
  cancelled: "This link is no longer active. If you still need it, please contact MKB Financial Group for a new one.",
  used: "This form has already been submitted — thank you. If you need to change something, please contact MKB Financial Group.",
};

/**
 * Opens a link from the token in the address. Throws a friendly error when it's
 * unknown, expired, cancelled or used. Rate-limited per address to stop guessing.
 */
export async function openLink(env: AppEnv, purpose: LinkPurpose, token: string, ip: string, opts: { touch?: boolean } = {}) {
  if (!(await rateLimit(env.DB, `link:${ip}`, 300, 10))) throw new HttpError(429, "Too many requests. Please wait a few minutes and try again.", "rate_limited");
  const miss = await one<{ count: number; window_start: string }>(env.DB, "SELECT count, window_start FROM rate_limits WHERE key = ?", `linkmiss:${ip}`);
  if (miss && miss.count >= 20 && addMinutes(miss.window_start, 60) > now()) throw new HttpError(429, "Too many invalid links from this connection. Please wait an hour and try again, or contact MKB Financial Group.", "rate_limited");
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new HttpError(404, "This link isn't valid. Please check that you copied the whole link from your email.", "not_found");
  const r = await one<Row>(env.DB, "SELECT * FROM secure_links WHERE token_hash = ? AND purpose = ?", await sha256(token), purpose);
  if (!r) {
    // Count misses separately and tightly: real visitors almost never miss.
    await rateLimit(env.DB, `linkmiss:${ip}`, 20, 60);
    throw new HttpError(404, "This link isn't valid. Please check that you copied the whole link from your email.", "not_found");
  }
  const st = stateOf(r);
  if (st !== "active") throw new HttpError(410, GONE[st], st);
  if (opts.touch) {
    const t = now();
    await run(env.DB, "UPDATE secure_links SET first_opened_at = coalesce(first_opened_at, ?), last_opened_at = ? WHERE id = ?", t, t, r.id);
  }
  return { id: r.id, targetId: r.target_id, clientId: r.client_id, email: r.email, expiresAt: r.expires_at, createdBy: r.created_by, firstOpen: !r.first_opened_at };
}

/** Marks a link used (it stops working). Only succeeds once. */
export async function useLink(env: AppEnv, id: string) {
  const res = await run(env.DB, "UPDATE secure_links SET used_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL", now(), id);
  return !!res.meta.changes;
}
