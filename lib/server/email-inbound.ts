/**
 * Client email replies, received through Resend on a receive-only reply
 * address (e.g. replies@replies.mkbfinancialgroup.com). Outgoing CRM emails
 * set that address as Reply-To once receiving is connected, so a client's
 * reply lands in Messages instead of a personal mailbox.
 *
 * - Resend calls /api/public/email/inbound for each received email; the call
 *   is verified with the webhook signing secret (Svix format) saved in
 *   Settings (stored encrypted, never shown again).
 * - The webhook only carries metadata, so the body is fetched from Resend
 *   and stored encrypted, matched to the client by their email address.
 * - Staff with Communication access get a bell notification.
 * Server-only.
 */
import { all, badRequest, HttpError, isDev, json, notFound, now, one, run, type AppEnv } from "./core";
import { decryptField, encryptField, randomId, safeEqual } from "./crypto";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";
import { notify } from "./notifications";

const SECRET_KEY = "resend.inbound_secret";
const key = (env: AppEnv) => { if (!env.ENCRYPTION_KEY) throw new HttpError(503, "Encryption isn't set up on the server."); return env.ENCRYPTION_KEY; };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The reply address outgoing emails use once receiving is connected (null until then). */
export async function replyToAddress(env: AppEnv): Promise<string | null> {
  if (!env.INBOUND_REPLY_TO) return null;
  const saved = await one(env.DB, "SELECT 1 FROM integration_secrets WHERE key = ?", SECRET_KEY).catch(() => null);
  return saved ? env.INBOUND_REPLY_TO : null;
}

/* ---------------------------------------------------------------- settings */
export async function inboundSettings(env: AppEnv, a: Actor, origin: string) {
  requirePermission(a, "communication", "settings");
  requireStaff(a);
  const s = await one<{ last4: string | null; updated_at: string }>(env.DB, "SELECT last4, updated_at FROM integration_secrets WHERE key = ?", SECRET_KEY);
  const last = await one<{ received_at: string }>(env.DB, "SELECT received_at FROM email_inbox ORDER BY received_at DESC LIMIT 1");
  return { webhookUrl: `${origin}/api/public/email/inbound`, replyTo: env.INBOUND_REPLY_TO ?? null, secretSaved: s ? { last4: s.last4, at: s.updated_at } : null, lastReceivedAt: last?.received_at ?? null };
}
export async function saveInboundSettings(env: AppEnv, a: Actor, origin: string, b: { secret?: unknown; disconnect?: unknown }) {
  requirePermission(a, "communication", "settings");
  requireStaff(a);
  if (b.disconnect === true) {
    await run(env.DB, "DELETE FROM integration_secrets WHERE key = ?", SECRET_KEY);
    await audit(env.DB, a, { action: "Record update", resource: "Email replies", meta: "Disconnected" });
    return inboundSettings(env, a, origin);
  }
  const secret = typeof b.secret === "string" ? b.secret.trim() : "";
  if (!/^whsec_[A-Za-z0-9+/=]{20,}$/.test(secret)) throw badRequest("Paste the webhook signing secret from Resend (it starts with whsec_).");
  const e = await encryptField(key(env), secret, `secret:${SECRET_KEY}`);
  await run(env.DB, "INSERT INTO integration_secrets (key, ciphertext, iv, key_version, last4, updated_at, updated_by) VALUES (?, ?, ?, 1, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, last4 = excluded.last4, updated_at = excluded.updated_at, updated_by = excluded.updated_by", SECRET_KEY, e.ciphertext, e.iv, secret.slice(-4), now(), a.member.id);
  await audit(env.DB, a, { action: "Record update", resource: "Email replies", meta: "Webhook signing secret saved" });
  return inboundSettings(env, a, origin);
}

/* ---------------------------------------------------------------- webhook */
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
/** Svix signature: base64 HMAC-SHA256 of "id.timestamp.body" with the secret after "whsec_". */
async function verified(secret: string, id: string, ts: string, raw: string, header: string) {
  const t = Number(ts);
  if (!id || !t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${ts}.${raw}`)));
  return header.split(" ").some((part) => { const [, sig] = part.split(","); return !!sig && safeEqual(sig, expected); });
}
/** Drops the quoted thread under a reply ("On … wrote:" and "> " lines) so Messages shows what the client wrote. */
export function stripQuoted(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^On .+ wrote:\s*$/.test(l.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(l.trim()) || /^From: .+/.test(l.trim()) && out.length) break;
    if (l.startsWith(">")) continue;
    out.push(l);
  }
  return out.join("\n").trim().slice(0, 20_000);
}

export async function inboundEmail(env: AppEnv, req: Request) {
  const raw = await req.text();
  const sec = await one<{ ciphertext: string; iv: string }>(env.DB, "SELECT ciphertext, iv FROM integration_secrets WHERE key = ?", SECRET_KEY);
  if (!sec) throw new HttpError(503, "Email replies aren't connected.");
  const secret = await decryptField(key(env), sec, `secret:${SECRET_KEY}`);
  if (!(await verified(secret, req.headers.get("svix-id") ?? "", req.headers.get("svix-timestamp") ?? "", raw, req.headers.get("svix-signature") ?? ""))) throw new HttpError(400, "Bad signature.");
  const ev = json<{ type?: string; data?: { email_id?: string; from?: string; subject?: string; created_at?: string } }>(raw, {});
  if (ev.type !== "email.received" || !ev.data?.email_id) return { ignored: true };
  const providerId = String(ev.data.email_id).slice(0, 100);
  if (await one(env.DB, "SELECT 1 FROM email_inbox WHERE provider_id = ?", providerId)) return { duplicate: true };
  // The webhook carries metadata only — fetch the message itself.
  let text = "", fromName: string | null = null, subject = String(ev.data.subject ?? "").slice(0, 300);
  if (env.RESEND_API_KEY) {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(providerId)}`, { headers: { authorization: `Bearer ${env.RESEND_API_KEY}` } });
    const m = (await res.json().catch(() => ({}))) as { text?: string; html?: string; subject?: string; headers?: Record<string, string> };
    text = m.text || (m.html ? m.html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "");
    subject = (m.subject ?? subject).slice(0, 300);
    const hf = m.headers?.from ?? m.headers?.From;
    if (hf) fromName = hf.replace(/<[^>]*>/, "").replace(/"/g, "").trim().slice(0, 120) || null;
  }
  const from = String(ev.data.from ?? "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(from)) return { ignored: true };
  const client = await one<{ id: string; name: string }>(env.DB, "SELECT id, name FROM clients WHERE lower(email) = ? AND status NOT IN ('prospect', 'declined') LIMIT 1", from);
  const id = randomId("ein");
  const body = stripQuoted(text) || "(no message text)";
  const enc = await encryptField(key(env), body, `email_inbox:${id}`);
  const t = now();
  await run(env.DB, "INSERT INTO email_inbox (id, provider_id, from_email, from_name, subject, body_enc, client_id, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, providerId, from, fromName, subject, JSON.stringify(enc), client?.id ?? null, t);
  if (client) await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'client', NULL, ?)", randomId("x"), client.id, `Email received: “${subject.slice(0, 120)}”`, t);
  await notify(env, { module: "communication" }, { kind: "text", title: `Email from ${client?.name ?? fromName ?? from}`, body: subject || "New email", href: client ? `/messages?c=${client.id}` : "/messages" });
  return { received: true };
}

/* ---------------------------------------------------------------- reading */
type Row = { id: string; from_email: string; from_name: string | null; subject: string; body_enc: string | null; client_id: string | null; read_at: string | null; received_at: string };
async function open(env: AppEnv, r: Row) {
  try { return r.body_enc ? await decryptField(key(env), json(r.body_enc, { ciphertext: "", iv: "" }), `email_inbox:${r.id}`) : ""; } catch { return "(couldn't open this message)"; }
}
/** A client's received emails (opening them marks them read). */
export async function clientInboundEmails(env: AppEnv, a: Actor, clientId: string) {
  requirePermission(a, "communication", "view");
  requireStaff(a);
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
  if (!c || !(await canOpen(env, a, c))) throw notFound("Client not found.");
  const rows = await all<Row>(env.DB, "SELECT * FROM email_inbox WHERE client_id = ? ORDER BY received_at DESC LIMIT 200", clientId);
  await run(env.DB, "UPDATE email_inbox SET read_at = ? WHERE client_id = ? AND read_at IS NULL", now(), clientId);
  return Promise.all(rows.map(async (r) => ({ id: r.id, from: r.from_email, subject: r.subject, body: await open(env, r), at: r.received_at, unread: !r.read_at })));
}
/** Unread counts per client, plus emails from addresses that don't match a client. */
export async function emailInboxSummary(env: AppEnv, a: Actor) {
  requirePermission(a, "communication", "view");
  requireStaff(a);
  const unread = await all<{ client_id: string; n: number; last: string; subject: string }>(env.DB, "SELECT client_id, count(*) AS n, max(received_at) AS last, (SELECT subject FROM email_inbox e2 WHERE e2.client_id = e.client_id ORDER BY received_at DESC LIMIT 1) AS subject FROM email_inbox e WHERE client_id IS NOT NULL AND read_at IS NULL GROUP BY client_id");
  const latest = await all<{ client_id: string; last: string; subject: string }>(env.DB, "SELECT client_id, max(received_at) AS last, subject FROM email_inbox WHERE client_id IS NOT NULL GROUP BY client_id");
  const unmatched = await all<Row>(env.DB, "SELECT * FROM email_inbox WHERE client_id IS NULL ORDER BY received_at DESC LIMIT 50");
  return {
    clients: latest.map((l) => ({ clientId: l.client_id, last: l.last, subject: l.subject, unread: unread.find((u) => u.client_id === l.client_id)?.n ?? 0 })),
    unmatched: await Promise.all(unmatched.map(async (r) => ({ id: r.id, from: r.from_email, name: r.from_name, subject: r.subject, body: await open(env, r), at: r.received_at, unread: !r.read_at }))),
    simulated: isDev(env),
  };
}
export async function markUnmatchedRead(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "communication", "view");
  requireStaff(a);
  await run(env.DB, "UPDATE email_inbox SET read_at = ? WHERE id = ? AND client_id IS NULL AND read_at IS NULL", now(), id);
  return { ok: true };
}
