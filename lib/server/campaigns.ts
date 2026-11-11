/**
 * Campaigns — marketing email to MKB leads and clients, and Monarch firms and
 * resellers. (Text messages come in a later phase.)
 *
 * Rules that always apply:
 *  - Consent is per brand, channel and address. Anyone who unsubscribed is never
 *    sent to; every email carries an unsubscribe link (one click, also offered to
 *    mail apps through the List-Unsubscribe header) and the mailing address.
 *  - Sending stays inside the email provider's daily cap, keeping a reserve for
 *    intake links, receipts and other system emails. What doesn't fit today goes
 *    out with the next runs (every 15 minutes) as the cap allows.
 *  - Only staff with Campaigns "Approve" can send or schedule (the Owner by default).
 * Server-only.
 */
import { BRANDS, DEFAULT_FILTERS, EMPTY_CONTENT, renderCampaign, type Brand, type Campaign, type CampaignSettings, type Content, type Filters } from "@/lib/campaigns/config";
import { all, badRequest, HttpError, isDev, json, notFound, now, one, run, type AppEnv } from "./core";
import { randomId, sha256 } from "./crypto";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";
import { linkOrigin } from "./books-intake";
import { publicAssetOrigin } from "./email";

type Contact = { type: "lead" | "client" | "office" | "reseller"; id: string; name: string; firstName: string; businessName: string; email: string; phone: string; state: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isBrand = (b: unknown): b is Brand => b === "mkb" || b === "monarch";
const arr = (v: unknown, max = 50) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 80)).slice(0, max) : undefined);
const firstOf = (s: string) => (s.trim().split(/\s+/)[0] ?? "");

/* ================================================================ signing (links in emails) */
async function hmacKey(env: AppEnv) {
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  const raw = new TextEncoder().encode(await sha256(`campaign-links:${env.ENCRYPTION_KEY}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
async function sign(env: AppEnv, s: string) {
  return b64u(await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(s))).slice(0, 32);
}
/** Unsubscribe token: brand|channel|address|recipient, signed. */
export async function unsubscribeToken(env: AppEnv, brand: Brand, address: string, recipientId = "") {
  const payload = b64u(new TextEncoder().encode(`${brand}|email|${address}|${recipientId}`));
  return `${payload}.${await sign(env, payload)}`;
}
async function readToken(env: AppEnv, token: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || (await sign(env, payload)) !== sig) throw new HttpError(404, "This unsubscribe link isn't valid.", "not_found");
  const [brand, channel, address, rid] = unb64u(payload).split("|");
  if (!isBrand(brand) || channel !== "email" || !address) throw new HttpError(404, "This unsubscribe link isn't valid.", "not_found");
  return { brand, address, rid: rid || null };
}

/* ================================================================ settings */
type SettingsRow = { brand: Brand; from_name: string; from_email: string; reply_to: string; mailing_address: string; daily_limit: number; reserve: number };
const toSettings = (r: SettingsRow): CampaignSettings => ({ brand: r.brand, fromName: r.from_name, fromEmail: r.from_email, replyTo: r.reply_to, mailingAddress: r.mailing_address, dailyLimit: r.daily_limit, reserve: r.reserve });
async function settingsFor(env: AppEnv, brand: Brand) {
  const r = await one<SettingsRow>(env.DB, "SELECT * FROM campaign_settings WHERE brand = ?", brand);
  if (!r) throw new HttpError(500, "Campaign settings are missing.");
  return toSettings(r);
}
export async function getSettings(env: AppEnv, a: Actor) {
  requirePermission(a, "campaigns", "view");
  const rows = await all<SettingsRow>(env.DB, "SELECT * FROM campaign_settings");
  return { settings: rows.map(toSettings), usage: await usageToday(env) };
}
export async function saveSettings(env: AppEnv, a: Actor, brand: string, b: Partial<CampaignSettings>) {
  requirePermission(a, "campaigns", "settings");
  requireStaff(a);
  if (!isBrand(brand)) throw badRequest("Unknown brand.");
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const fromEmail = s(b.fromEmail, 200).toLowerCase();
  if (!EMAIL_RE.test(fromEmail)) throw badRequest("Enter the address campaigns are sent from.");
  const replyTo = s(b.replyTo, 200).toLowerCase();
  if (replyTo && !EMAIL_RE.test(replyTo)) throw badRequest("The reply-to address isn't valid.");
  const limit = Math.max(1, Math.min(100_000, Math.round(Number(b.dailyLimit) || 100)));
  const reserve = Math.max(0, Math.min(limit - 1, Math.round(Number(b.reserve) || 0)));
  await run(env.DB, "UPDATE campaign_settings SET from_name = ?, from_email = ?, reply_to = ?, mailing_address = ?, daily_limit = ?, reserve = ?, updated_at = ?, updated_by = ? WHERE brand = ?",
    s(b.fromName, 100) || BRANDS[brand].label, fromEmail, replyTo, s(b.mailingAddress, 400), limit, reserve, now(), a.member.id, brand);
  // The daily cap belongs to the email account, which both brands share.
  await run(env.DB, "UPDATE campaign_settings SET daily_limit = ?, reserve = ? WHERE brand != ?", limit, reserve, brand);
  await audit(env.DB, a, { action: "Record update", resource: `Campaign settings (${BRANDS[brand].label})` });
  return getSettings(env, a);
}

/** Emails sent today (all kinds) against the daily cap. */
async function usageToday(env: AppEnv) {
  const start = `${now().slice(0, 10)}T00:00:00`;
  const sent = (await one<{ n: number }>(env.DB, "SELECT count(*) AS n FROM email_outbox WHERE created_at >= ?", start))?.n ?? 0;
  const s = await one<SettingsRow>(env.DB, "SELECT * FROM campaign_settings WHERE brand = 'mkb'");
  const limit = s?.daily_limit ?? 100, reserve = s?.reserve ?? 20;
  return { sentToday: sent, dailyLimit: limit, reserve, campaignRoom: Math.max(0, limit - reserve - sent) };
}

/* ================================================================ consent */
export async function consentFor(env: AppEnv, brand: Brand, email: string, phone: string) {
  const rows = await all<{ channel: string; address: string; status: string; source: string; at: string }>(env.DB, "SELECT channel, address, status, source, at FROM marketing_consent WHERE brand = ? AND ((channel = 'email' AND address = ?) OR (channel = 'sms' AND address = ?))", brand, email.toLowerCase(), phone.replace(/\D/g, "").slice(-10));
  const e = rows.find((r) => r.channel === "email"), s = rows.find((r) => r.channel === "sms");
  return {
    email: e ? { status: e.status, source: e.source, at: e.at } : { status: email ? "allowed" : "none", source: email ? "Existing contact — can unsubscribe anytime" : "" },
    sms: s ? { status: s.status, source: s.source, at: s.at } : { status: "none", source: "No text opt-in recorded" },
  };
}
export async function getConsent(env: AppEnv, a: Actor, q: { brand?: string; email?: string; phone?: string }) {
  requireStaff(a);
  if (!isBrand(q.brand)) throw badRequest("Unknown brand.");
  return consentFor(env, q.brand, (q.email ?? "").trim(), q.phone ?? "");
}
/** Staff record a choice: unsubscribe (any time), or subscribe with a note saying how the person agreed. */
export async function setConsent(env: AppEnv, a: Actor, b: { brand?: unknown; channel?: unknown; address?: unknown; status?: unknown; note?: unknown }) {
  requireStaff(a);
  requirePermission(a, "leads", "edit");
  if (!isBrand(b.brand) || (b.channel !== "email" && b.channel !== "sms") || (b.status !== "subscribed" && b.status !== "unsubscribed")) throw badRequest("Choose the brand, channel and choice.");
  const address = b.channel === "email" ? String(b.address ?? "").trim().toLowerCase() : String(b.address ?? "").replace(/\D/g, "").slice(-10);
  if (b.channel === "email" ? !EMAIL_RE.test(address) : address.length !== 10) throw badRequest("Enter a valid email address or 10-digit phone.");
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) : "";
  if (b.status === "subscribed" && note.length < 4) throw badRequest("Say how they agreed (for example: “Asked in person on Nov 12”).");
  await recordConsent(env, b.brand, b.channel, address, b.status, b.status === "subscribed" ? `Recorded by staff: ${note}` : `Unsubscribed by staff${note ? `: ${note}` : ""}`, a.member.id);
  await audit(env.DB, a, { action: "Record update", resource: `Marketing consent (${b.brand} ${b.channel})`, meta: `${b.status}${note ? ` — ${note}` : ""}` });
  return consentFor(env, b.brand, b.channel === "email" ? address : "", b.channel === "sms" ? address : "");
}
export async function recordConsent(env: AppEnv, brand: Brand, channel: "email" | "sms", address: string, status: "subscribed" | "unsubscribed", source: string, by: string | null) {
  await run(env.DB, "INSERT INTO marketing_consent (brand, channel, address, status, source, at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(brand, channel, address) DO UPDATE SET status = excluded.status, source = excluded.source, at = excluded.at, updated_by = excluded.updated_by",
    brand, channel, address, status, source.slice(0, 200), now(), by);
}

/* ================================================================ audiences */
function cleanFilters(brand: Brand, v: unknown): Filters {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, Record<string, unknown>>;
  const part = (k: string) => (o[k] && typeof o[k] === "object" ? o[k] : null);
  const f: Filters = { states: arr((o as Record<string, unknown>).states)?.map((x) => x.toUpperCase().slice(0, 2)) };
  if (brand === "mkb") {
    const l = part("leads"), c = part("clients");
    f.leads = { on: !!l?.on, statuses: arr(l?.statuses), stages: arr(l?.stages), tags: arr(l?.tags), services: arr(l?.services) };
    f.clients = { on: !!c?.on, statuses: arr(c?.statuses), services: arr(c?.services), tags: arr(c?.tags) };
  } else {
    const off = part("offices"), r = part("resellers");
    f.offices = { on: !!off?.on, stages: arr(off?.stages) };
    f.resellers = { on: !!r?.on };
  }
  return f;
}
const any = (wanted: string[] | undefined, have: string[]) => !wanted?.length || wanted.some((w) => have.includes(w));
const inStates = (f: Filters, st: string) => !f.states?.length || f.states.includes(st.toUpperCase());

async function contacts(env: AppEnv, brand: Brand, f: Filters): Promise<Contact[]> {
  const out: Contact[] = [];
  if (brand === "mkb") {
    if (f.leads?.on) {
      const rows = await all<{ id: string; type: string; name: string; contact_name: string | null; email: string; phone: string; address: string | null; tags: string; interests: string; stage_id: string; status: string }>(env.DB, "SELECT id, type, name, contact_name, email, phone, address, tags, interests, stage_id, status FROM leads");
      for (const r of rows) {
        const st = json<Record<string, string>>(r.address, {}).state ?? "";
        if (!any(f.leads.statuses, [r.status]) || !any(f.leads.stages, [r.stage_id]) || !any(f.leads.tags, json<string[]>(r.tags, [])) || !any(f.leads.services, json<string[]>(r.interests, [])) || !inStates(f, st)) continue;
        const person = r.type === "business" ? r.contact_name || r.name : r.name;
        out.push({ type: "lead", id: r.id, name: person, firstName: firstOf(person), businessName: r.type === "business" ? r.name : "", email: r.email, phone: r.phone, state: st });
      }
    }
    if (f.clients?.on) {
      const rows = await all<{ id: string; type: string; name: string; contact_name: string | null; email: string | null; phone: string | null; address: string | null; tags: string | null; status: string; services: string | null }>(env.DB, "SELECT c.id, c.type, c.name, c.contact_name, c.email, c.phone, c.address, c.tags, c.status, (SELECT group_concat(service) FROM client_services s WHERE s.client_id = c.id) AS services FROM clients c WHERE c.status NOT IN ('prospect', 'declined')");
      for (const r of rows) {
        const st = json<Record<string, string>>(r.address, {}).state ?? "";
        if (!any(f.clients.statuses, [r.status]) || !any(f.clients.services, (r.services ?? "").split(",")) || !any(f.clients.tags, json<string[]>(r.tags, [])) || !inStates(f, st)) continue;
        const person = r.type === "business" ? r.contact_name || r.name : r.name;
        out.push({ type: "client", id: r.id, name: person, firstName: firstOf(person), businessName: r.type === "business" ? r.name : "", email: r.email ?? "", phone: r.phone ?? "", state: st });
      }
    }
  } else {
    if (f.offices?.on) {
      const rows = await all<{ id: string; name: string; contact_name: string; email: string; phone: string; state: string; stage: string }>(env.DB, "SELECT id, name, contact_name, email, phone, state, stage FROM mon_offices");
      for (const r of rows) {
        if (!any(f.offices.stages, [r.stage]) || !inStates(f, r.state)) continue;
        const person = r.contact_name || r.name;
        out.push({ type: "office", id: r.id, name: person, firstName: firstOf(person), businessName: r.name, email: r.email, phone: r.phone, state: r.state });
      }
    }
    if (f.resellers?.on) {
      const rows = await all<{ id: string; name: string; contact: string; email: string; phone: string }>(env.DB, "SELECT id, name, contact, email, phone FROM mon_resellers WHERE active = 1");
      for (const r of rows) {
        if (f.states?.length) continue; // resellers have no state on file
        const person = r.contact || r.name;
        out.push({ type: "reseller", id: r.id, name: person, firstName: firstOf(person), businessName: r.name, email: r.email, phone: r.phone, state: "" });
      }
    }
  }
  return out;
}

/** Who will get it, and who's skipped (and why). */
async function resolve(env: AppEnv, brand: Brand, f: Filters) {
  const list = await contacts(env, brand, f);
  const unsub = new Set((await all<{ address: string }>(env.DB, "SELECT address FROM marketing_consent WHERE brand = ? AND channel = 'email' AND status = 'unsubscribed'", brand)).map((r) => r.address));
  const seen = new Set<string>();
  const send: (Contact & { email: string })[] = [];
  const skipped = { noEmail: 0, unsubscribed: 0, duplicate: 0 };
  // Clients first, so a person who is both keeps their client details.
  for (const c of [...list.filter((x) => x.type === "client"), ...list.filter((x) => x.type !== "client")]) {
    const e = c.email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { skipped.noEmail++; continue; }
    if (unsub.has(e)) { skipped.unsubscribed++; continue; }
    if (seen.has(e)) { skipped.duplicate++; continue; }
    seen.add(e);
    send.push({ ...c, email: e });
  }
  return { send, skipped };
}
export async function previewAudience(env: AppEnv, a: Actor, b: { brand?: unknown; filters?: unknown }) {
  requirePermission(a, "campaigns", "view");
  if (!isBrand(b.brand)) throw badRequest("Unknown brand.");
  const r = await resolve(env, b.brand, cleanFilters(b.brand, b.filters));
  return { count: r.send.length, skipped: r.skipped, sample: r.send.slice(0, 8).map((c) => ({ name: c.name || c.businessName, type: c.type })) };
}
/** Options for the audience builder: stages, tags, states in use. */
export async function audienceOptions(env: AppEnv, a: Actor) {
  requirePermission(a, "campaigns", "view");
  const stages = await all<{ id: string; name: string }>(env.DB, "SELECT id, name FROM lead_stages ORDER BY position");
  const tagRows = await all<{ tags: string }>(env.DB, "SELECT tags FROM leads UNION ALL SELECT tags FROM clients");
  const tags = [...new Set(tagRows.flatMap((r) => json<string[]>(r.tags, [])))].sort();
  return { stages, tags };
}

/* ---- saved audiences */
export async function listAudiences(env: AppEnv, a: Actor, brand: string) {
  requirePermission(a, "campaigns", "view");
  if (!isBrand(brand)) throw badRequest("Unknown brand.");
  const rows = await all<{ id: string; name: string; filters: string; updated_at: string }>(env.DB, "SELECT id, name, filters, updated_at FROM campaign_audiences WHERE brand = ? ORDER BY name", brand);
  return { audiences: rows.map((r) => ({ id: r.id, name: r.name, filters: json<Filters>(r.filters, {}), updatedAt: r.updated_at })) };
}
export async function saveAudience(env: AppEnv, a: Actor, b: { id?: unknown; brand?: unknown; name?: unknown; filters?: unknown }) {
  requirePermission(a, "campaigns", "edit");
  requireStaff(a);
  if (!isBrand(b.brand)) throw badRequest("Unknown brand.");
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  if (!name) throw badRequest("Name the audience.");
  const filters = JSON.stringify(cleanFilters(b.brand, b.filters));
  const t = now();
  const id = typeof b.id === "string" && b.id ? b.id : randomId("aud");
  await run(env.DB, "INSERT INTO campaign_audiences (id, brand, name, filters, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, filters = excluded.filters, updated_at = excluded.updated_at", id, b.brand, name, filters, t, a.member.id, t);
  return listAudiences(env, a, b.brand);
}
export async function deleteAudience(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "campaigns", "delete");
  const r = await one<{ brand: Brand }>(env.DB, "SELECT brand FROM campaign_audiences WHERE id = ?", id);
  if (!r) throw notFound("Audience not found.");
  await run(env.DB, "DELETE FROM campaign_audiences WHERE id = ?", id);
  return listAudiences(env, a, r.brand);
}

/* ---- templates */
function cleanContent(v: unknown): Content {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const s = (k: string, max: number) => (typeof o[k] === "string" ? (o[k] as string).slice(0, max) : "");
  const url = (k: string) => { const u = s(k, 1000).trim(); return /^https:\/\/[^\s]+$/i.test(u) || u === "" ? u : "INVALID"; };
  const c: Content = { subject: s("subject", 200), preheader: s("preheader", 200), heading: s("heading", 200), body: s("body", 20_000), buttonLabel: s("buttonLabel", 60), buttonUrl: url("buttonUrl"), image: url("image") };
  if (c.buttonUrl === "INVALID") throw badRequest("The button link must start with https://");
  if (c.image === "INVALID") throw badRequest("The image link must start with https:// (copy it from the Media library).");
  return c;
}
export async function listTemplates(env: AppEnv, a: Actor, brand: string) {
  requirePermission(a, "campaigns", "view");
  if (!isBrand(brand)) throw badRequest("Unknown brand.");
  const rows = await all<{ id: string; name: string; content: string; updated_at: string }>(env.DB, "SELECT id, name, content, updated_at FROM campaign_templates WHERE brand = ? ORDER BY name", brand);
  return { templates: rows.map((r) => ({ id: r.id, name: r.name, content: json<Content>(r.content, EMPTY_CONTENT), updatedAt: r.updated_at })) };
}
export async function saveTemplate(env: AppEnv, a: Actor, b: { id?: unknown; brand?: unknown; name?: unknown; content?: unknown }) {
  requirePermission(a, "campaigns", "edit");
  requireStaff(a);
  if (!isBrand(b.brand)) throw badRequest("Unknown brand.");
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  if (!name) throw badRequest("Name the template.");
  const t = now();
  const id = typeof b.id === "string" && b.id ? b.id : randomId("tpl");
  await run(env.DB, "INSERT INTO campaign_templates (id, brand, name, content, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, content = excluded.content, updated_at = excluded.updated_at", id, b.brand, name, JSON.stringify(cleanContent(b.content)), t, a.member.id, t);
  return listTemplates(env, a, b.brand);
}
export async function deleteTemplate(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "campaigns", "delete");
  const r = await one<{ brand: Brand }>(env.DB, "SELECT brand FROM campaign_templates WHERE id = ?", id);
  if (!r) throw notFound("Template not found.");
  await run(env.DB, "DELETE FROM campaign_templates WHERE id = ?", id);
  return listTemplates(env, a, r.brand);
}

/* ================================================================ campaigns */
type Row = { id: string; brand: Brand; channel: "email"; name: string; content: string; filters: string; status: Campaign["status"]; scheduled_at: string | null; started_at: string | null; finished_at: string | null; created_at: string; created_by: string | null; sent_by: string | null; updated_at: string; rev: number };
const toCampaign = (r: Row): Campaign => ({ id: r.id, brand: r.brand, channel: r.channel, name: r.name, content: json<Content>(r.content, EMPTY_CONTENT), filters: json<Filters>(r.filters, DEFAULT_FILTERS[r.brand]), status: r.status, scheduledAt: r.scheduled_at ?? undefined, startedAt: r.started_at ?? undefined, finishedAt: r.finished_at ?? undefined, createdAt: r.created_at, createdBy: r.created_by ?? undefined, sentBy: r.sent_by ?? undefined, updatedAt: r.updated_at, rev: r.rev });
async function stats(env: AppEnv, id: string) {
  const r = await one<Record<string, number>>(env.DB, "SELECT count(*) AS total, sum(status = 'queued') AS queued, sum(status = 'sent') AS sent, sum(status = 'failed') AS failed, sum(status = 'skipped') AS skipped, sum(opened_at IS NOT NULL) AS opened, sum(clicked_at IS NOT NULL) AS clicked, sum(unsubscribed_at IS NOT NULL) AS unsubscribed FROM campaign_recipients WHERE campaign_id = ?", id);
  const n = (k: string) => Number(r?.[k] ?? 0);
  return { total: n("total"), queued: n("queued"), sent: n("sent"), failed: n("failed"), skipped: n("skipped"), opened: n("opened"), clicked: n("clicked"), unsubscribed: n("unsubscribed") };
}
async function campaignRow(env: AppEnv, id: string) {
  const r = await one<Row>(env.DB, "SELECT * FROM campaigns WHERE id = ?", id);
  if (!r) throw notFound("Campaign not found.");
  return r;
}
export async function listCampaigns(env: AppEnv, a: Actor, brand: string) {
  requirePermission(a, "campaigns", "view");
  if (!isBrand(brand)) throw badRequest("Unknown brand.");
  const rows = await all<Row>(env.DB, "SELECT * FROM campaigns WHERE brand = ? ORDER BY created_at DESC LIMIT 200", brand);
  return { campaigns: await Promise.all(rows.map(async (r) => ({ ...toCampaign(r), stats: r.status === "draft" ? undefined : await stats(env, r.id) }))), usage: await usageToday(env) };
}
export async function getCampaign(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "campaigns", "view");
  const r = await campaignRow(env, id);
  const recipients = r.status === "draft" ? [] : await all<{ id: string; address: string; name: string; contact_type: string; contact_id: string; status: string; error: string | null; sent_at: string | null; opened_at: string | null; clicked_at: string | null; unsubscribed_at: string | null }>(env.DB, "SELECT id, address, name, contact_type, contact_id, status, error, sent_at, opened_at, clicked_at, unsubscribed_at FROM campaign_recipients WHERE campaign_id = ? ORDER BY name LIMIT 2000", id);
  return { campaign: { ...toCampaign(r), stats: await stats(env, id) }, recipients, settings: await settingsFor(env, r.brand), usage: await usageToday(env) };
}
export async function createCampaign(env: AppEnv, a: Actor, b: { brand?: unknown; name?: unknown; templateId?: unknown; copyOf?: unknown }) {
  requirePermission(a, "campaigns", "create");
  requireStaff(a);
  if (!isBrand(b.brand)) throw badRequest("Unknown brand.");
  let content: Content = EMPTY_CONTENT, filters: Filters = DEFAULT_FILTERS[b.brand];
  if (typeof b.templateId === "string" && b.templateId) {
    const t = await one<{ content: string }>(env.DB, "SELECT content FROM campaign_templates WHERE id = ? AND brand = ?", b.templateId, b.brand);
    if (t) content = json<Content>(t.content, EMPTY_CONTENT);
  }
  if (typeof b.copyOf === "string" && b.copyOf) {
    const c = await one<Row>(env.DB, "SELECT * FROM campaigns WHERE id = ? AND brand = ?", b.copyOf, b.brand);
    if (c) { content = json<Content>(c.content, EMPTY_CONTENT); filters = json<Filters>(c.filters, filters); }
  }
  const id = randomId("cmp");
  const t = now();
  const name = (typeof b.name === "string" && b.name.trim().slice(0, 100)) || "Untitled campaign";
  await run(env.DB, "INSERT INTO campaigns (id, brand, channel, name, content, filters, status, created_at, created_by, updated_at) VALUES (?, ?, 'email', ?, ?, ?, 'draft', ?, ?, ?)", id, b.brand, name, JSON.stringify(content), JSON.stringify(filters), t, a.member.id, t);
  return getCampaign(env, a, id);
}
export async function saveCampaign(env: AppEnv, a: Actor, id: string, b: { name?: unknown; content?: unknown; filters?: unknown; rev?: unknown }) {
  requirePermission(a, "campaigns", "edit");
  requireStaff(a);
  const r = await campaignRow(env, id);
  if (r.status !== "draft") throw badRequest("Only drafts can be changed. Cancel the schedule first.");
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "This campaign was changed somewhere else. Reloading the latest version.", "conflict");
  const name = (typeof b.name === "string" && b.name.trim().slice(0, 100)) || r.name;
  const res = await run(env.DB, "UPDATE campaigns SET name = ?, content = ?, filters = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", name, JSON.stringify(b.content !== undefined ? cleanContent(b.content) : json<Content>(r.content, EMPTY_CONTENT)), JSON.stringify(b.filters !== undefined ? cleanFilters(r.brand, b.filters) : json<Filters>(r.filters, {})), now(), id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "This campaign was changed somewhere else. Reloading the latest version.", "conflict");
  return getCampaign(env, a, id);
}
export async function deleteCampaign(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "campaigns", "delete");
  const r = await campaignRow(env, id);
  if (r.status === "sending" || r.status === "sent") throw badRequest("Sent campaigns are kept for your records.");
  await run(env.DB, "DELETE FROM campaigns WHERE id = ?", id);
  return { ok: true };
}

/* ---- rendering & sending */
function ready(c: Content, s: CampaignSettings) {
  if (!c.subject.trim()) return "Add a subject line.";
  if (!c.body.trim()) return "Write the message.";
  if (!s.mailingAddress.trim()) return "Add your mailing address in Campaigns → Settings — the law requires it in every marketing email.";
  return null;
}
async function renderFor(env: AppEnv, brand: Brand, content: Content, s: CampaignSettings, to: { email: string; name: string; firstName: string; businessName: string; rid?: string }) {
  const origin = linkOrigin(env);
  const token = await unsubscribeToken(env, brand, to.email, to.rid ?? "");
  const unsubscribeUrl = `${origin}/u/${token}`;
  const trackLink = to.rid ? async (u: string) => `${origin}/api/public/c/l/${to.rid}?u=${encodeURIComponent(u)}&s=${await sign(env, `${to.rid}|${u}`)}` : null;
  // Links are signed one by one (async), then dropped into the synchronous renderer.
  const links = new Map<string, string>();
  if (trackLink) for (const u of [content.buttonUrl ?? "", ...((content.body.match(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g) ?? []))]) if (u) links.set(u, await trackLink(u));
  const logoUrl = brand === "monarch" ? `${publicAssetOrigin(env)}/brand/monarch-email.png` : `${publicAssetOrigin(env)}/brand/mkb-seal-192.png`;
  const out = renderCampaign({ brand, content, settings: s, logoUrl, unsubscribeUrl, vars: { "first name": to.firstName || "there", name: to.name || "there", "business name": to.businessName || to.name || "" },
    openPixelUrl: to.rid ? `${origin}/api/public/c/o/${to.rid}` : undefined, trackLink: (u) => links.get(u) ?? u });
  return { ...out, unsubscribeUrl: `${origin}/api/public/unsubscribe/${token}` };
}

/** Sends one email through Resend (recorded in the outbox like every email). */
async function deliver(env: AppEnv, s: CampaignSettings, to: string, template: string, m: { subject: string; html: string; text: string; unsubscribeUrl: string }) {
  const id = randomId("em");
  await run(env.DB, "INSERT INTO email_outbox (id, to_email, template, subject, body_dev, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, to, template, m.subject, isDev(env) ? m.text : null, now());
  // Local development without an email key: recorded in the outbox and treated as sent, so the flow can be tried.
  if (!env.RESEND_API_KEY) return isDev(env) ? { ok: true, error: null, providerId: "dev" } : { ok: false, error: "Email sending isn't set up (no Resend key)", providerId: null };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: `${s.fromName} <${s.fromEmail}>`, to: [to], ...(s.replyTo ? { reply_to: s.replyTo } : {}), subject: m.subject, html: m.html, text: m.text, headers: { "List-Unsubscribe": `<${m.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
    });
    const out = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    const error = res.ok ? null : (out.message ?? `HTTP ${res.status}`).slice(0, 300);
    await run(env.DB, "UPDATE email_outbox SET sent_at = ?, provider_id = ?, error = ? WHERE id = ?", res.ok ? now() : null, out.id ?? null, error, id);
    return { ok: res.ok, error, providerId: out.id ?? null };
  } catch (e) {
    await run(env.DB, "UPDATE email_outbox SET error = ? WHERE id = ?", String(e).slice(0, 300), id);
    return { ok: false, error: String(e).slice(0, 300), providerId: null };
  }
}

/** Live preview (no tracking) — for the editor. */
export async function previewCampaign(env: AppEnv, a: Actor, b: { brand?: unknown; content?: unknown }) {
  requirePermission(a, "campaigns", "view");
  if (!isBrand(b.brand)) throw badRequest("Unknown brand.");
  const s = await settingsFor(env, b.brand);
  const r = await renderFor(env, b.brand, cleanContent(b.content), { ...s, mailingAddress: s.mailingAddress || "(your mailing address — add it in Settings)" }, { email: "preview@example.com", name: "Jordan Sample", firstName: "Jordan", businessName: "Sample Business LLC" });
  return { subject: r.subject, html: r.html };
}
/** A test copy to the signed-in staff member (or an address they give). */
export async function testCampaign(env: AppEnv, a: Actor, id: string, b: { to?: unknown }) {
  requirePermission(a, "campaigns", "edit");
  requireStaff(a);
  const r = await campaignRow(env, id);
  const s = await settingsFor(env, r.brand);
  const content = json<Content>(r.content, EMPTY_CONTENT);
  const problem = ready(content, s);
  if (problem) throw badRequest(problem);
  const to = (typeof b.to === "string" && b.to.trim() ? b.to : a.member.email).trim().toLowerCase();
  if (!EMAIL_RE.test(to)) throw badRequest("Enter the address for the test.");
  const m = await renderFor(env, r.brand, content, s, { email: to, name: a.member.name, firstName: firstOf(a.member.name), businessName: "Sample Business LLC" });
  const out = await deliver(env, s, to, `campaign-test:${id}`, { ...m, subject: `[Test] ${m.subject}` });
  if (!out.ok) throw new HttpError(502, `The test didn't send: ${out.error}`);
  return { sentTo: to };
}

/** Send now (or at `at`). Locks the content; the audience is taken when sending starts. */
export async function sendCampaign(env: AppEnv, a: Actor, id: string, b: { at?: unknown }) {
  requirePermission(a, "campaigns", "approve");
  requireStaff(a);
  const r = await campaignRow(env, id);
  if (r.status !== "draft") throw badRequest("This campaign was already sent or scheduled.");
  const s = await settingsFor(env, r.brand);
  const problem = ready(json<Content>(r.content, EMPTY_CONTENT), s);
  if (problem) throw badRequest(problem);
  const at = typeof b.at === "string" && b.at ? new Date(b.at) : null;
  if (at && (isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000)) throw badRequest("Choose a time in the future.");
  const t = now();
  if (at) {
    await run(env.DB, "UPDATE campaigns SET status = 'scheduled', scheduled_at = ?, sent_by = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", at.toISOString(), a.member.id, t, id);
    await audit(env.DB, a, { action: "Record update", resource: `Campaign ${r.name}`, meta: `Scheduled for ${at.toISOString()}` });
    return getCampaign(env, a, id);
  }
  await run(env.DB, "UPDATE campaigns SET status = 'scheduled', scheduled_at = ?, sent_by = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", t, a.member.id, t, id);
  await audit(env.DB, a, { action: "Record update", resource: `Campaign ${r.name}`, meta: "Sent now" });
  await processCampaigns(env, id);
  return getCampaign(env, a, id);
}
export async function cancelCampaign(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "campaigns", "approve");
  const r = await campaignRow(env, id);
  if (r.status === "scheduled") await run(env.DB, "UPDATE campaigns SET status = 'draft', scheduled_at = NULL, updated_at = ?, rev = rev + 1 WHERE id = ?", now(), id);
  else if (r.status === "sending") {
    await run(env.DB, "UPDATE campaign_recipients SET status = 'skipped', error = 'Cancelled before sending' WHERE campaign_id = ? AND status = 'queued'", id);
    await run(env.DB, "UPDATE campaigns SET status = 'cancelled', finished_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", now(), now(), id);
  } else throw badRequest("Only scheduled or sending campaigns can be stopped.");
  await audit(env.DB, a, { action: "Record update", resource: `Campaign ${r.name}`, meta: r.status === "scheduled" ? "Schedule cancelled (back to draft)" : "Stopped while sending" });
  return getCampaign(env, a, id);
}

/**
 * Starts due campaigns (takes their audience) and sends queued emails within
 * today's room under the daily cap. Called on "Send now" and every 15 minutes.
 */
export async function processCampaigns(env: AppEnv, onlyId?: string) {
  const t = now();
  const due = await all<Row>(env.DB, `SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= ?${onlyId ? " AND id = ?" : ""}`, ...(onlyId ? [t, onlyId] : [t]));
  for (const r of due) {
    const { send, skipped } = await resolve(env, r.brand, json<Filters>(r.filters, {}));
    const stmts = send.map((c) => env.DB.prepare("INSERT OR IGNORE INTO campaign_recipients (id, campaign_id, address, name, contact_type, contact_id, vars, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued')").bind(randomId("r").replace(/[^A-Za-z0-9_]/g, "x"), r.id, c.email, c.name || c.businessName, c.type, c.id, JSON.stringify({ firstName: c.firstName, businessName: c.businessName })));
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
    await run(env.DB, "UPDATE campaigns SET status = 'sending', started_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", t, t, r.id);
    console.log("campaign started", r.id, send.length, JSON.stringify(skipped));
  }
  const sending = await all<Row>(env.DB, `SELECT * FROM campaigns WHERE status = 'sending'${onlyId ? " AND id = ?" : ""} ORDER BY started_at`, ...(onlyId ? [onlyId] : []));
  let room = (await usageToday(env)).campaignRoom;
  for (const r of sending) {
    const s = await settingsFor(env, r.brand);
    const content = json<Content>(r.content, EMPTY_CONTENT);
    if (room > 0) {
      const batch = await all<{ id: string; address: string; name: string; contact_type: string; contact_id: string; vars: string }>(env.DB, "SELECT id, address, name, contact_type, contact_id, vars FROM campaign_recipients WHERE campaign_id = ? AND status = 'queued' LIMIT ?", r.id, Math.min(room, 200));
      const unsub = new Set((await all<{ address: string }>(env.DB, "SELECT address FROM marketing_consent WHERE brand = ? AND channel = 'email' AND status = 'unsubscribed'", r.brand)).map((x) => x.address));
      for (const p of batch) {
        if (unsub.has(p.address)) { await run(env.DB, "UPDATE campaign_recipients SET status = 'skipped', error = 'Unsubscribed' WHERE id = ?", p.id); continue; }
        const v = json<{ firstName?: string; businessName?: string }>(p.vars, {});
        const m = await renderFor(env, r.brand, content, s, { email: p.address, name: p.name, firstName: v.firstName ?? "", businessName: v.businessName ?? "", rid: p.id });
        const out = await deliver(env, s, p.address, `campaign:${r.id}`, m);
        room--;
        const at = now();
        await run(env.DB, "UPDATE campaign_recipients SET status = ?, error = ?, provider_id = ?, sent_at = ? WHERE id = ?", out.ok ? "sent" : "failed", out.error, out.providerId, out.ok ? at : null, p.id);
        if (out.ok) await timeline(env, p.contact_type, p.contact_id, `Marketing email sent: “${r.name}”`, at);
        if (room <= 0) break;
      }
    }
    const left = (await one<{ n: number }>(env.DB, "SELECT count(*) AS n FROM campaign_recipients WHERE campaign_id = ? AND status = 'queued'", r.id))?.n ?? 0;
    if (!left) await run(env.DB, "UPDATE campaigns SET status = 'sent', finished_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", now(), now(), r.id);
  }
}
async function timeline(env: AppEnv, type: string, id: string, text: string, at: string) {
  if (type === "lead") await run(env.DB, "INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', ?, 'system', ?)", randomId("x"), id, text, at);
  else if (type === "client") await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, at) VALUES (?, ?, 'message', ?, 'system', ?)", randomId("x"), id, text, at);
}

/* ================================================================ public: tracking & unsubscribe */
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
export async function trackOpen(env: AppEnv, rid: string) {
  if (/^[A-Za-z0-9_]{6,60}$/.test(rid)) await run(env.DB, "UPDATE campaign_recipients SET opened_at = coalesce(opened_at, ?) WHERE id = ?", now(), rid);
  return new Response(PIXEL, { headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0" } });
}
export async function trackClick(env: AppEnv, rid: string, url: string, sig: string) {
  if (!/^https?:\/\//i.test(url) || (await sign(env, `${rid}|${url}`)) !== sig) return new Response("This link isn't valid.", { status: 404 });
  const t = now();
  await run(env.DB, "UPDATE campaign_recipients SET clicked_at = coalesce(clicked_at, ?), opened_at = coalesce(opened_at, ?) WHERE id = ?", t, t, rid);
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
}
/** What the unsubscribe page shows (masked address). */
export async function unsubscribeInfo(env: AppEnv, token: string) {
  const { brand, address } = await readToken(env, token);
  const [u, d] = address.split("@");
  const c = await one<{ status: string }>(env.DB, "SELECT status FROM marketing_consent WHERE brand = ? AND channel = 'email' AND address = ?", brand, address);
  return { brand, brandName: BRANDS[brand].label, email: `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`, unsubscribed: c?.status === "unsubscribed" };
}
export async function unsubscribe(env: AppEnv, token: string) {
  const { brand, address, rid } = await readToken(env, token);
  await recordConsent(env, brand, "email", address, "unsubscribed", "Unsubscribe link", null);
  if (rid) await run(env.DB, "UPDATE campaign_recipients SET unsubscribed_at = coalesce(unsubscribed_at, ?) WHERE id = ?", now(), rid);
  return { ok: true, brandName: BRANDS[brand].label };
}
