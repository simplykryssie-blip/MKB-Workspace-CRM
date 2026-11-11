/**
 * Text messaging through Twilio: one number per brand (MKB, Monarch), two-way
 * conversations in the Text inbox, and text campaigns.
 *
 * - The Twilio Account SID and Auth Token are entered in Campaigns → Settings;
 *   the token is stored encrypted and never shown again.
 * - Incoming texts and delivery updates come from Twilio's webhooks, checked
 *   with Twilio's signature. STOP / START replies update the person's consent
 *   (Twilio also blocks texts to anyone who replied STOP and answers HELP).
 * - Unknown numbers that text in become leads (MKB) or interested firms (Monarch).
 * - Local development without Twilio: texts are recorded and treated as sent.
 * Server-only.
 */
import { fmtPhone, type Brand } from "@/lib/campaigns/config";
import { all, badRequest, HttpError, isDev, json, notFound, now, one, run, type AppEnv } from "./core";
import { b64, decryptField, encryptField, randomId } from "./crypto";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";
import { linkOrigin } from "./books-intake";
import { notify } from "./notifications";
import { recordConsent } from "./campaigns";

const isBrand = (b: unknown): b is Brand => b === "mkb" || b === "monarch";
export const phone10 = (p: string) => p.replace(/\D/g, "").slice(-10);
const e164 = (p: string) => `+1${phone10(p)}`;
const NORM = "replace(replace(replace(replace(replace(replace(phone, '(', ''), ')', ''), '-', ''), ' ', ''), '+1', ''), '.', '')";
const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const START = new Set(["START", "UNSTOP", "SUBSCRIBE"]);

/* ================================================================ settings */
async function secret(env: AppEnv, key: string) {
  const r = await one<{ ciphertext: string; iv: string; last4: string | null }>(env.DB, "SELECT ciphertext, iv, last4 FROM integration_secrets WHERE key = ?", key);
  if (!r || !env.ENCRYPTION_KEY) return null;
  return { value: await decryptField(env.ENCRYPTION_KEY, r, `secret:${key}`), last4: r.last4 };
}
async function twilio(env: AppEnv) {
  const s = await one<{ twilio_sid: string }>(env.DB, "SELECT twilio_sid FROM campaign_settings WHERE brand = 'mkb'");
  const token = await secret(env, "twilio.auth_token");
  return s?.twilio_sid && token ? { sid: s.twilio_sid, token: token.value } : null;
}
export async function smsNumber(env: AppEnv, brand: Brand) {
  return (await one<{ sms_number: string }>(env.DB, "SELECT sms_number FROM campaign_settings WHERE brand = ?", brand))?.sms_number ?? "";
}
export const webhookUrls = (env: AppEnv) => ({ inbound: `${linkOrigin(env)}/api/public/sms/inbound`, status: `${linkOrigin(env)}/api/public/sms/status` });

export async function getSmsSettings(env: AppEnv, a: Actor) {
  requirePermission(a, "campaigns", "view");
  const rows = await all<{ brand: Brand; sms_number: string; twilio_sid: string }>(env.DB, "SELECT brand, sms_number, twilio_sid FROM campaign_settings");
  const tok = await one<{ last4: string | null; updated_at: string }>(env.DB, "SELECT last4, updated_at FROM integration_secrets WHERE key = 'twilio.auth_token'");
  return {
    accountSid: rows.find((r) => r.brand === "mkb")?.twilio_sid ?? "",
    tokenSaved: tok ? { last4: tok.last4 ?? "", at: tok.updated_at } : null,
    numbers: { mkb: rows.find((r) => r.brand === "mkb")?.sms_number ?? "", monarch: rows.find((r) => r.brand === "monarch")?.sms_number ?? "" },
    webhooks: webhookUrls(env),
    simulated: isDev(env),
  };
}
export async function saveSmsSettings(env: AppEnv, a: Actor, b: { accountSid?: unknown; authToken?: unknown; mkbNumber?: unknown; monarchNumber?: unknown }) {
  requirePermission(a, "campaigns", "settings");
  requireStaff(a);
  const sid = typeof b.accountSid === "string" ? b.accountSid.trim() : "";
  if (sid && !/^AC[0-9a-f]{32}$/i.test(sid)) throw badRequest("The Account SID starts with AC followed by 32 letters and numbers — copy it from your Twilio console.");
  const num = (v: unknown, label: string) => { const d = typeof v === "string" ? phone10(v) : ""; if (typeof v === "string" && v.trim() && d.length !== 10) throw badRequest(`${label} must be a 10-digit US number.`); return d ? e164(d) : ""; };
  const mkb = num(b.mkbNumber, "The MKB number"), monarch = num(b.monarchNumber, "The Monarch number");
  if (mkb && mkb === monarch) throw badRequest("MKB and Monarch need two different numbers.");
  const t = now();
  await run(env.DB, "UPDATE campaign_settings SET twilio_sid = ?, updated_at = ?, updated_by = ?", sid, t, a.member.id);
  await run(env.DB, "UPDATE campaign_settings SET sms_number = ? WHERE brand = 'mkb'", mkb);
  await run(env.DB, "UPDATE campaign_settings SET sms_number = ? WHERE brand = 'monarch'", monarch);
  const token = typeof b.authToken === "string" ? b.authToken.trim() : "";
  if (token) {
    if (!/^[0-9a-f]{32}$/i.test(token)) throw badRequest("The Auth Token is 32 letters and numbers — copy it from your Twilio console.");
    if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
    const e = await encryptField(env.ENCRYPTION_KEY, token, "secret:twilio.auth_token");
    await run(env.DB, "INSERT INTO integration_secrets (key, ciphertext, iv, key_version, last4, updated_at, updated_by) VALUES ('twilio.auth_token', ?, ?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, last4 = excluded.last4, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
      e.ciphertext, e.iv, Number(env.ENCRYPTION_KEY_VERSION ?? 1), token.slice(-4), t, a.member.id);
  }
  await audit(env.DB, a, { action: "Record update", resource: "Text messaging settings (Twilio)", meta: `Numbers: MKB ${mkb || "none"}, Monarch ${monarch || "none"}${token ? "; auth token replaced (value not logged)" : ""}` });
  return getSmsSettings(env, a);
}

/* ================================================================ sending */
/** Sends one text from the brand's number and records it. */
export async function sendText(env: AppEnv, x: { brand: Brand; to: string; body: string; memberId?: string | null; contact?: { type: string; id: string } | null; campaignId?: string; recipientId?: string }) {
  const from = await smsNumber(env, x.brand);
  const tw = await twilio(env);
  const to = phone10(x.to);
  const id = randomId("sms");
  const t = now();
  await run(env.DB, "INSERT INTO sms_messages (id, brand, direction, phone, body, status, contact_type, contact_id, campaign_id, recipient_id, member_id, created_at, updated_at) VALUES (?, ?, 'out', ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)",
    id, x.brand, to, x.body, x.contact?.type ?? null, x.contact?.id ?? null, x.campaignId ?? null, x.recipientId ?? null, x.memberId ?? null, t, t);
  if (!from || !tw) {
    if (isDev(env)) { await run(env.DB, "UPDATE sms_messages SET status = 'sent', provider_sid = ?, updated_at = ? WHERE id = ?", `SMdev${id}`, now(), id); return { ok: true, id, error: null }; }
    const error = !tw ? "Text messaging isn't set up — add your Twilio details in Campaigns → Settings." : `No text number set for ${x.brand === "monarch" ? "Monarch" : "MKB"}.`;
    await run(env.DB, "UPDATE sms_messages SET status = 'failed', error = ?, updated_at = ? WHERE id = ?", error, now(), id);
    return { ok: false, id, error };
  }
  try {
    const form = new URLSearchParams({ From: from, To: e164(to), Body: x.body, StatusCallback: webhookUrls(env).status });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`, { method: "POST", headers: { authorization: `Basic ${btoa(`${tw.sid}:${tw.token}`)}`, "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
    const out = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string; code?: number };
    const error = res.ok ? null : `${out.message ?? `HTTP ${res.status}`}${out.code ? ` (Twilio ${out.code})` : ""}`.slice(0, 300);
    await run(env.DB, "UPDATE sms_messages SET status = ?, provider_sid = ?, error = ?, updated_at = ? WHERE id = ?", res.ok ? out.status ?? "sent" : "failed", out.sid ?? null, error, now(), id);
    return { ok: res.ok, id, error };
  } catch (e) {
    await run(env.DB, "UPDATE sms_messages SET status = 'failed', error = ?, updated_at = ? WHERE id = ?", String(e).slice(0, 300), now(), id);
    return { ok: false, id, error: String(e).slice(0, 300) };
  }
}
export async function testText(env: AppEnv, a: Actor, b: { brand?: unknown; to?: unknown }) {
  requirePermission(a, "campaigns", "settings");
  requireStaff(a);
  if (!isBrand(b.brand)) throw badRequest("Unknown brand.");
  const to = typeof b.to === "string" ? phone10(b.to) : "";
  if (to.length !== 10) throw badRequest("Enter your 10-digit mobile number.");
  const r = await sendText(env, { brand: b.brand, to, body: `Test from your ${b.brand === "monarch" ? "Monarch Tax Suite" : "MKB Financial Group"} CRM — texting works.`, memberId: a.member.id });
  if (!r.ok) throw new HttpError(502, `The test didn't send: ${r.error}`);
  return { ok: true };
}

/* ================================================================ who is this number? */
export async function findContact(env: AppEnv, brand: Brand, phone: string): Promise<{ type: string; id: string; name: string; state: string } | null> {
  const d = phone10(phone);
  if (d.length !== 10) return null;
  if (brand === "mkb") {
    const c = await one<{ id: string; name: string; address: string | null }>(env.DB, `SELECT id, name, address FROM clients WHERE status NOT IN ('prospect', 'declined') AND ${NORM} LIKE ? LIMIT 1`, `%${d}`);
    if (c) return { type: "client", id: c.id, name: c.name, state: json<Record<string, string>>(c.address, {}).state ?? "" };
    const l = await one<{ id: string; name: string; address: string | null }>(env.DB, `SELECT id, name, address FROM leads WHERE ${NORM} LIKE ? ORDER BY status = 'open' DESC, last_activity_at DESC LIMIT 1`, `%${d}`);
    if (l) return { type: "lead", id: l.id, name: l.name, state: json<Record<string, string>>(l.address, {}).state ?? "" };
  } else {
    const o = await one<{ id: string; name: string; state: string }>(env.DB, `SELECT id, name, state FROM mon_offices WHERE ${NORM} LIKE ? LIMIT 1`, `%${d}`);
    if (o) return { type: "office", id: o.id, name: o.name, state: o.state };
    const r = await one<{ id: string; name: string }>(env.DB, `SELECT id, name FROM mon_resellers WHERE ${NORM} LIKE ? LIMIT 1`, `%${d}`);
    if (r) return { type: "reseller", id: r.id, name: r.name, state: "" };
  }
  return null;
}
export const contactHref = (c: { type: string; id: string } | null) => (!c ? null : c.type === "lead" ? `/leads/${c.id}` : c.type === "client" ? `/clients/${c.id}` : c.type === "office" ? `/monarch/offices/${c.id}` : c.type === "reseller" ? "/monarch/resellers" : null);

/** Someone new texted in: they become a lead (MKB) or an interested firm (Monarch). */
async function newContact(env: AppEnv, brand: Brand, phone: string) {
  const t = now();
  const label = `Text from ${fmtPhone(phone)}`;
  if (brand === "mkb") {
    const owner = await one<{ id: string }>(env.DB, "SELECT m.id FROM members m JOIN roles r ON r.id = m.role_id WHERE r.is_owner = 1 AND m.status = 'active' LIMIT 1");
    const stage = await one<{ id: string }>(env.DB, "SELECT id FROM lead_stages ORDER BY position LIMIT 1");
    if (!owner || !stage) return null;
    const id = `L-${randomId("t").slice(2)}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO leads (id, type, name, contact_name, email, phone, address, business, source, source_detail, interests, est_value, owner_id, stage_id, status, priority, tags, created_at, last_activity_at) VALUES (?, 'individual', ?, NULL, '', ?, NULL, NULL, 'Text message', 'Texted our number', '[]', 0, ?, ?, 'open', 'medium', '[\"Text message\"]', ?, ?)").bind(id, label, fmtPhone(phone), owner.id, stage.id, t, t),
      env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', 'Lead created from an incoming text', 'system', ?)").bind(randomId("x"), id, t),
    ]);
    return { type: "lead", id, name: label, state: "" };
  }
  const id = `off_${randomId("t").slice(2)}`;
  await run(env.DB, "INSERT INTO mon_offices (id, name, contact_name, email, phone, city, state, stage, notes, created_at, created_by, updated_at) VALUES (?, ?, '', '', ?, '', '', 'interested', 'Started by texting the Monarch number.', ?, NULL, ?)", id, label, fmtPhone(phone), t, t);
  return { type: "office", id, name: label, state: "" };
}
async function timeline(env: AppEnv, c: { type: string; id: string } | null, text: string) {
  if (!c) return;
  const t = now();
  if (c.type === "lead") await env.DB.batch([env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', ?, 'client', ?)").bind(randomId("x"), c.id, text, t), env.DB.prepare("UPDATE leads SET last_activity_at = ? WHERE id = ?").bind(t, c.id)]);
  else if (c.type === "client") await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, at) VALUES (?, ?, 'message', ?, 'client', ?)", randomId("x"), c.id, text, t);
}

/* ================================================================ Twilio webhooks */
/** Twilio's signature: HMAC-SHA1 of the webhook address plus the sorted form fields, with the Auth Token. */
async function verified(env: AppEnv, req: Request, url: string, params: URLSearchParams) {
  const tw = await twilio(env);
  if (!tw) return isDev(env); // local development: no Twilio, accept simulated posts
  const sig = req.headers.get("x-twilio-signature") ?? "";
  const data = url + [...params.keys()].sort().map((k) => k + params.get(k)).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(tw.token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))) === sig;
}
const twiml = () => new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { "content-type": "text/xml" } });

export async function inboundText(env: AppEnv, req: Request) {
  const params = new URLSearchParams(await req.text());
  if (!(await verified(env, req, webhookUrls(env).inbound, params))) return new Response("Forbidden", { status: 403 });
  const from = phone10(params.get("From") ?? "");
  const to = params.get("To") ?? "";
  const body = (params.get("Body") ?? "").slice(0, 1600);
  if (from.length !== 10) return twiml();
  const brand: Brand = (await one<{ brand: Brand }>(env.DB, "SELECT brand FROM campaign_settings WHERE sms_number = ? AND sms_number != ''", e164(to)))?.brand ?? "mkb";
  const word = body.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (STOP.has(word)) await recordConsent(env, brand, "sms", from, "unsubscribed", `Replied ${word} by text`, null);
  else if (START.has(word)) await recordConsent(env, brand, "sms", from, "subscribed", `Replied ${word} by text`, null);
  const c = (await findContact(env, brand, from)) ?? (word && (STOP.has(word) || START.has(word) || word === "HELP") ? null : await newContact(env, brand, from));
  const t = now();
  await run(env.DB, "INSERT INTO sms_messages (id, brand, direction, phone, body, status, provider_sid, contact_type, contact_id, created_at, updated_at) VALUES (?, ?, 'in', ?, ?, 'received', ?, ?, ?, ?, ?)", randomId("sms"), brand, from, body, params.get("MessageSid"), c?.type ?? null, c?.id ?? null, t, t);
  await timeline(env, c, STOP.has(word) ? "Replied STOP — opted out of texts" : `Text received: “${body.slice(0, 120)}”`);
  const base = brand === "monarch" ? "/monarch/texts" : "/texts";
  await notify(env, { module: brand === "monarch" ? "monarch" : "communication" }, { kind: "text", title: STOP.has(word) ? `${c?.name ?? fmtPhone(from)} opted out of texts` : `New text from ${c?.name ?? fmtPhone(from)}`, body: body.slice(0, 140), href: `${base}?phone=${from}` });
  return twiml();
}
export async function textStatus(env: AppEnv, req: Request) {
  const params = new URLSearchParams(await req.text());
  if (!(await verified(env, req, webhookUrls(env).status, params))) return new Response("Forbidden", { status: 403 });
  const sid = params.get("MessageSid") ?? "";
  const status = (params.get("MessageStatus") ?? "").slice(0, 20);
  const code = params.get("ErrorCode");
  if (sid && status) await run(env.DB, "UPDATE sms_messages SET status = ?, error = coalesce(?, error), updated_at = ? WHERE provider_sid = ?", status, code ? `Twilio error ${code}` : null, now(), sid);
  return new Response(null, { status: 204 });
}

/* ================================================================ Text inbox */
const inboxModule = (brand: Brand) => (brand === "monarch" ? "monarch" : "communication");
type Msg = { id: string; direction: "in" | "out"; phone: string; body: string; status: string; error: string | null; contact_type: string | null; contact_id: string | null; campaign_id: string | null; member_id: string | null; read_at: string | null; created_at: string };
export async function listThreads(env: AppEnv, a: Actor, brand: string) {
  if (!isBrand(brand)) throw badRequest("Unknown brand.");
  requirePermission(a, inboxModule(brand), "view");
  const last = await all<Msg>(env.DB, "SELECT m.* FROM sms_messages m JOIN (SELECT phone, max(created_at) AS mx FROM sms_messages WHERE brand = ? GROUP BY phone) t ON t.phone = m.phone AND t.mx = m.created_at WHERE m.brand = ? ORDER BY m.created_at DESC LIMIT 300", brand, brand);
  const unread = new Map((await all<{ phone: string; n: number }>(env.DB, "SELECT phone, count(*) AS n FROM sms_messages WHERE brand = ? AND direction = 'in' AND read_at IS NULL GROUP BY phone", brand)).map((r) => [r.phone, r.n]));
  const threads = [];
  for (const m of last) {
    const c = await findContact(env, brand, m.phone);
    threads.push({ phone: m.phone, name: c?.name ?? fmtPhone(m.phone), contact: c ? { type: c.type, id: c.id, href: contactHref(c) } : null, last: { body: m.body, direction: m.direction, at: m.created_at, status: m.status }, unread: unread.get(m.phone) ?? 0 });
  }
  return { threads, unread: [...unread.values()].reduce((n, x) => n + x, 0), configured: !!(await twilio(env)) && !!(await smsNumber(env, brand)), simulated: isDev(env) };
}
export async function getThread(env: AppEnv, a: Actor, brand: string, phone: string) {
  if (!isBrand(brand)) throw badRequest("Unknown brand.");
  requirePermission(a, inboxModule(brand), "view");
  const p = phone10(phone);
  if (p.length !== 10) throw notFound("Conversation not found.");
  const msgs = await all<Msg>(env.DB, "SELECT * FROM sms_messages WHERE brand = ? AND phone = ? ORDER BY created_at ASC LIMIT 500", brand, p);
  await run(env.DB, "UPDATE sms_messages SET read_at = ? WHERE brand = ? AND phone = ? AND direction = 'in' AND read_at IS NULL", now(), brand, p);
  const c = await findContact(env, brand, p);
  const consent = await one<{ status: string; source: string; at: string }>(env.DB, "SELECT status, source, at FROM marketing_consent WHERE brand = ? AND channel = 'sms' AND address = ?", brand, p);
  const staff = new Map((await all<{ id: string; name: string }>(env.DB, "SELECT id, name FROM members")).map((m) => [m.id, m.name]));
  return {
    phone: p, name: c?.name ?? fmtPhone(p), contact: c ? { type: c.type, id: c.id, href: contactHref(c) } : null,
    optedOut: consent?.status === "unsubscribed", consent: consent ?? null,
    messages: msgs.map((m) => ({ id: m.id, direction: m.direction, body: m.body, status: m.status, error: m.error, at: m.created_at, by: m.member_id ? staff.get(m.member_id) ?? "Staff" : m.campaign_id ? "Campaign" : undefined })),
  };
}
/** A staff reply (or a new conversation started from a lead/client). Never to someone who replied STOP. */
export async function replyText(env: AppEnv, a: Actor, b: { brand?: unknown; phone?: unknown; body?: unknown }) {
  requireStaff(a);
  if (!isBrand(b.brand)) throw badRequest("Unknown brand.");
  requirePermission(a, inboxModule(b.brand), "edit");
  const p = typeof b.phone === "string" ? phone10(b.phone) : "";
  if (p.length !== 10) throw badRequest("Enter a 10-digit US mobile number.");
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 1600) : "";
  if (!body) throw badRequest("Write a message.");
  const opted = await one<{ status: string }>(env.DB, "SELECT status FROM marketing_consent WHERE brand = ? AND channel = 'sms' AND address = ?", b.brand, p);
  if (opted?.status === "unsubscribed") throw badRequest("They replied STOP, so texts to this number are blocked. They can text START to opt back in.");
  const c = await findContact(env, b.brand, p);
  const r = await sendText(env, { brand: b.brand, to: p, body, memberId: a.member.id, contact: c });
  if (!r.ok) throw new HttpError(502, `The text didn't send: ${r.error}`);
  await timeline(env, c, `Text sent by ${a.member.name}: “${body.slice(0, 120)}”`);
  return getThread(env, a, b.brand, p);
}
export async function unreadTexts(env: AppEnv, a: Actor) {
  requireStaff(a);
  const rows = await all<{ brand: Brand; n: number }>(env.DB, "SELECT brand, count(*) AS n FROM sms_messages WHERE direction = 'in' AND read_at IS NULL GROUP BY brand");
  return { mkb: rows.find((r) => r.brand === "mkb")?.n ?? 0, monarch: rows.find((r) => r.brand === "monarch")?.n ?? 0 };
}
