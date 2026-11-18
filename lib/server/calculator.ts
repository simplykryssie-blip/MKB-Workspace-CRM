/**
 * Monarch tax calculator licenses (moved from the Monarch/Verexa app).
 *
 * - Staff (Monarch permission) manage a license on a Monarch office: status, authorized websites, and where its
 *   leads go (the customer's own GoHighLevel inbound webhook, stored encrypted; only its host is ever shown).
 * - The licensed calculator page hands its lead form a short-lived signed token (license + website); the public lead
 *   endpoint accepts nothing else as the destination, recomputes the estimate on the server, and forwards the lead
 *   in the same JSON shape and headers the old app used, during the visitor's request. Nothing about the visitor is
 *   stored: only a delivery outcome (no personal data), pruned after 30 days.
 * Server-only.
 */
import { all, badRequest, HttpError, isDev, notFound, now, one, rateLimit, run, str, type AppEnv } from "./core";
import { b64, decryptField, encryptField, randomId, randomToken, safeEqual, sha256 } from "./crypto";
import { loadSettings, need, note } from "./monarch";
import { sendMonarch } from "./monarch-email";
import type { Actor } from "./identity";
import { allowedHosts, EMBED_ID_PATTERN } from "./calc-embed";
import { computeFull, fullEstimateForLead, fullEstimateText, FULL_TAX_YEAR, NEEDS_INCOME_MESSAGE, sanitizeFullInputs, type FullLeadEstimate } from "@/lib/calculator/full";

const enc = new TextEncoder();
const b64url = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const vault = (env: AppEnv) => { if (!env.ENCRYPTION_KEY) throw new HttpError(503, "Encryption isn't set up on the server."); return env.ENCRYPTION_KEY; };
const aad = (licenseId: string) => `calc_webhook:${licenseId}`;
/** Where the calculator is served for customers' install code (CALCULATOR_ORIGIN, e.g. https://verexahq.com). */
export const calcOrigin = (env: AppEnv) => (env.CALCULATOR_ORIGIN || env.APP_ORIGIN || "https://app.mkbfinancialgroup.com").replace(/\/$/, "");
export const embedUrl = (env: AppEnv, embedId: string) => `${calcOrigin(env)}/embed/calculator?id=${encodeURIComponent(embedId)}`;
export const embedSnippet = (env: AppEnv, embedId: string) => `<iframe src="${embedUrl(env, embedId)}" title="Monarch Basic Tax Calculator" loading="lazy"\n  style="width:100%;max-width:1200px;height:1400px;border:0;display:block;margin:0 auto"></iframe>`;

/* ---------------------------------------------------------------- signed embed token */
const TOKEN_TTL_S = 4 * 60 * 60;
type TokenPayload = { l: string; h: string | null; e: number };
async function hmac(env: AppEnv, msg: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(`calc-embed-token:${vault(env)}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(b64(await crypto.subtle.sign("HMAC", k, enc.encode(msg))));
}
export async function issueEmbedToken(env: AppEnv, licenseId: string, host: string | null) {
  const body = b64url(btoa(JSON.stringify({ l: licenseId, h: host, e: Math.floor(Date.now() / 1000) + TOKEN_TTL_S } satisfies TokenPayload)));
  return `${body}.${await hmac(env, body)}`;
}
async function verifyToken(env: AppEnv, token: unknown): Promise<TokenPayload | null> {
  if (typeof token !== "string" || token.length > 600) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, await hmac(env, body))) return null;
  try {
    const p = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/"))) as TokenPayload;
    return typeof p.l === "string" && p.e > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

/* ---------------------------------------------------------------- rows */
type LicRow = { id: string; office_id: string; embed_id: string; key_prefix: string; tax_years: string; status: "active" | "suspended" | "revoked"; source: string; notes: string; last_seen_at: string | null; last_seen_host: string | null; created_at: string };
type SetRow = { license_id: string; enabled: number; business_name: string; lead_source: string; include_summary: number; tags: string; webhook_enc: string | null; webhook_host: string; last_success_at: string | null; last_error: string | null; last_error_at: string | null };
const jsonArr = <T,>(s: string | null | undefined): T[] => { try { const v = JSON.parse(s ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

/** Lead form settings, when the form should show: on, named, and with a saved destination. */
export async function leadCapture(env: AppEnv, licenseId: string) {
  const s = await one<SetRow>(env.DB, "SELECT * FROM calc_lead_settings WHERE license_id = ?", licenseId);
  if (!s || !s.enabled || !s.business_name || !s.webhook_enc) return null;
  return s;
}

/* ---------------------------------------------------------------- staff */
export async function getCalc(env: AppEnv, a: Actor, officeId: string) {
  need(a, "view");
  const lics = await all<LicRow>(env.DB, "SELECT * FROM calc_licenses WHERE office_id = ? ORDER BY created_at", officeId);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const licenses = [];
  for (const l of lics) {
    const [domains, s, counts] = await Promise.all([
      all<{ domain: string }>(env.DB, "SELECT domain FROM calc_domains WHERE license_id = ? ORDER BY domain", l.id),
      one<SetRow>(env.DB, "SELECT * FROM calc_lead_settings WHERE license_id = ?", l.id),
      all<{ outcome: string; n: number }>(env.DB, "SELECT outcome, count(*) n FROM calc_deliveries WHERE license_id = ? AND created_at >= ? GROUP BY outcome", l.id, since),
    ]);
    licenses.push({
      id: l.id, embedId: l.embed_id, keyPrefix: l.key_prefix, maxDomains: (l as LicRow & { max_domains?: number }).max_domains ?? 3, taxYears: jsonArr<number>(l.tax_years), status: l.status, source: l.source, notes: l.notes,
      lastSeenAt: l.last_seen_at, lastSeenHost: l.last_seen_host, createdAt: l.created_at,
      domains: domains.map((d) => d.domain), installUrl: embedUrl(env, l.embed_id), snippet: embedSnippet(env, l.embed_id),
      leads: { enabled: !!s?.enabled, businessName: s?.business_name ?? "", leadSource: s?.lead_source ?? "", includeSummary: s ? !!s.include_summary : true, tags: jsonArr<string>(s?.tags), webhookHost: s?.webhook_host ?? "", webhookSaved: !!s?.webhook_enc, lastSuccessAt: s?.last_success_at ?? null, lastError: s?.last_error ?? null, lastErrorAt: s?.last_error_at ?? null },
      last30: Object.fromEntries(counts.map((c) => [c.outcome, c.n])) as Record<string, number>,
    });
  }
  return { licenses };
}

function cleanDomain(raw: unknown) {
  let v = String(raw ?? "").trim().toLowerCase();
  v = v.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v)) throw badRequest("Enter a website address like securefiletaxes.net.");
  return v;
}
function cleanWebhook(raw: unknown, dev = false) {
  let u: URL;
  try { u = new URL(String(raw ?? "").trim()); } catch { throw badRequest("Enter the full webhook URL, starting with https://"); }
  if (dev && u.protocol === "http:" && /^(127\.0\.0\.1|localhost)$/.test(u.hostname)) return u; // local development only
  if (u.protocol !== "https:") throw badRequest("The webhook URL must use https://");
  if (u.username || u.password || (u.port && u.port !== "443")) throw badRequest("The webhook URL can't contain a username, password or port.");
  if (/^[\d.]+$|^\[|localhost|\.local$|\.internal$/i.test(u.hostname) || !u.hostname.includes(".")) throw badRequest("Use a public webhook address (not an IP address or internal name).");
  if (u.toString().length > 2000) throw badRequest("The webhook URL is too long.");
  u.hash = "";
  return u;
}
const newEmbedId = () => {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let id = "";
  while (id.length < 22) for (const b of crypto.getRandomValues(new Uint8Array(32))) if (b < 232 && id.length < 22) id += A[b % A.length];
  return `emb_${id}`;
};

export async function calcAction(env: AppEnv, a: Actor, officeId: string, b: Record<string, unknown>) {
  need(a, "edit");
  const office = await one<{ id: string; name: string }>(env.DB, "SELECT id, name FROM mon_offices WHERE id = ?", officeId);
  if (!office) throw notFound("Office not found.");
  const t = now();
  const lic = async () => {
    const l = await one<LicRow>(env.DB, "SELECT * FROM calc_licenses WHERE id = ? AND office_id = ?", str(b.licenseId, 60), officeId);
    if (!l) throw notFound("License not found.");
    return l;
  };
  const action = String(b.action ?? "");
  if (action === "create") {
    await createLicense(env, officeId, { taxYear: FULL_TAX_YEAR });
    await note(a, "Calculator license", `Created a calculator license for ${office.name}`, env);
  } else if (action === "status") {
    const l = await lic();
    const st = String(b.status);
    if (!["active", "suspended", "revoked"].includes(st)) throw badRequest("Unknown status.");
    await run(env.DB, "UPDATE calc_licenses SET status = ?, updated_at = ? WHERE id = ?", st, t, l.id);
    await note(a, "Calculator license", `${office.name}: license ${st === "active" ? "turned back on" : st}`, env);
  } else if (action === "addDomain") {
    const l = await lic();
    const d = await addDomain(env, l.id, b.domain, null);
    await note(a, "Calculator license", `${office.name}: authorized ${d}`, env);
  } else if (action === "removeDomain") {
    const l = await lic();
    await removeDomain(env, l.id, String(b.domain ?? ""));
    await note(a, "Calculator license", `${office.name}: removed ${String(b.domain ?? "")}`, env);
  } else if (action === "maxDomains") {
    const l = await lic();
    const n = Math.max(1, Math.min(50, Math.round(Number(b.maxDomains) || 1)));
    await run(env.DB, "UPDATE calc_licenses SET max_domains = ?, updated_at = ? WHERE id = ?", n, t, l.id);
    await note(a, "Calculator license", `${office.name}: customer may add up to ${n} website(s)`, env);
  } else if (action === "leads") {
    const l = await lic();
    const host = await saveLeads(env, l.id, b);
    await note(a, "Calculator license", `${office.name}: lead delivery ${b.enabled === true ? "on" : "off"}${host ? ` (webhook ${host})` : ""}`, env);
  } else if (action === "testLead") {
    const l = await lic();
    await testLead(env, l.id);
  } else if (action === "emailSetup") {
    const l = await lic();
    const to = await emailSetupLink(env, l.id);
    await note(a, "Calculator license", `${office.name}: setup link emailed to ${to}`, env);
  } else throw badRequest("Unknown action.");
  return getCalc(env, a, officeId);
}

/* ---------------------------------------------------------------- shared license actions (staff and customer) */
type LicLite = { id: string; office_id: string; status: string; max_domains: number; tax_years: string };

export async function createLicense(env: AppEnv, officeId: string, o: { taxYear: number; packageId?: string | null }) {
  const t = now();
  const id = randomId("cal");
  await run(env.DB, "INSERT INTO calc_licenses (id, office_id, embed_id, tax_years, status, package_id, source, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, 'mkb', ?, ?)", id, officeId, newEmbedId(), JSON.stringify([o.taxYear]), o.packageId ?? null, t, t);
  const office = await one<{ name: string }>(env.DB, "SELECT name FROM mon_offices WHERE id = ?", officeId);
  await run(env.DB, "INSERT INTO calc_lead_settings (license_id, enabled, business_name, lead_source, include_summary, tags, updated_at) VALUES (?, 0, ?, ?, 1, '[]', ?) ON CONFLICT(license_id) DO NOTHING", id, office?.name ?? "", office?.name ?? "", t);
  return id;
}

/** Adds a tax year to an office's licenses (the annual update). Returns how many licenses got it. */
export async function addTaxYear(env: AppEnv, officeId: string, year: number) {
  const lics = await all<LicLite>(env.DB, "SELECT id, office_id, status, max_domains, tax_years FROM calc_licenses WHERE office_id = ? AND status != 'revoked'", officeId);
  for (const l of lics) {
    const years = [...new Set([...jsonArr<number>(l.tax_years), year])].sort();
    await run(env.DB, "UPDATE calc_licenses SET tax_years = ?, updated_at = ? WHERE id = ?", JSON.stringify(years), now(), l.id);
  }
  return lics.length;
}

/** `limit`: the customer's own limit (max_domains); null = staff (no limit). */
async function addDomain(env: AppEnv, licenseId: string, raw: unknown, limit: number | null) {
  const d = cleanDomain(raw);
  const have = (await all<{ domain: string }>(env.DB, "SELECT domain FROM calc_domains WHERE license_id = ?", licenseId)).map((x) => x.domain);
  if (have.includes(d)) return d;
  if (limit !== null && have.length >= limit) throw badRequest(`Your license covers ${limit} website${limit === 1 ? "" : "s"}. Remove one first, or contact Monarch Tax Suite to add more.`);
  await run(env.DB, "INSERT INTO calc_domains (license_id, domain, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", licenseId, d, now());
  return d;
}
async function removeDomain(env: AppEnv, licenseId: string, domain: string) {
  await run(env.DB, "DELETE FROM calc_domains WHERE license_id = ? AND domain = ?", licenseId, domain);
}

/** Saves lead delivery; returns the new webhook's host when one was pasted. */
async function saveLeads(env: AppEnv, licenseId: string, b: Record<string, unknown>) {
  const cur = await one<SetRow>(env.DB, "SELECT * FROM calc_lead_settings WHERE license_id = ?", licenseId);
  const tags = Array.isArray(b.tags) ? b.tags.map((x) => str(x, 40)).filter(Boolean).slice(0, 10) : jsonArr<string>(cur?.tags);
  let webhookEnc = cur?.webhook_enc ?? null, host = cur?.webhook_host ?? "", pasted = "";
  if (typeof b.webhookUrl === "string" && b.webhookUrl.trim()) {
    const u = cleanWebhook(b.webhookUrl, isDev(env));
    const secret = b64url(b64(crypto.getRandomValues(new Uint8Array(24))));
    webhookEnc = JSON.stringify(await encryptField(vault(env), JSON.stringify({ url: u.toString(), secret }), aad(licenseId)));
    host = pasted = u.hostname;
  }
  const enabled = b.enabled === true;
  const businessName = str(b.businessName, 80);
  if (enabled && !businessName) throw badRequest("Enter the business name shown on the calculator.");
  if (enabled && !webhookEnc) throw badRequest("Paste the GoHighLevel webhook URL first.");
  await run(env.DB, `INSERT INTO calc_lead_settings (license_id, enabled, business_name, lead_source, include_summary, tags, webhook_enc, webhook_host, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(license_id) DO UPDATE SET enabled = excluded.enabled, business_name = excluded.business_name, lead_source = excluded.lead_source, include_summary = excluded.include_summary, tags = excluded.tags, webhook_enc = excluded.webhook_enc, webhook_host = excluded.webhook_host, updated_at = excluded.updated_at`,
    licenseId, enabled ? 1 : 0, businessName, str(b.leadSource, 80) || cur?.lead_source || businessName, b.includeSummary === false ? 0 : 1, JSON.stringify(tags), webhookEnc, host, now());
  return pasted;
}

async function testLead(env: AppEnv, licenseId: string) {
  const s = await one<SetRow>(env.DB, "SELECT * FROM calc_lead_settings WHERE license_id = ?", licenseId);
  if (!s?.webhook_enc) throw badRequest("Save the GoHighLevel webhook URL first.");
  const id = crypto.randomUUID();
  const p: Lead = { submissionId: id, firstName: "Test", lastName: "Lead", email: "test.lead@example.com", phone: "+15555550100", estimate: sampleEstimate(), submittedAt: now() };
  const r = await sendWebhook(env, licenseId, s, { ...webhookBody(p, s, "test"), test: true }, id);
  await logDelivery(env, licenseId, r.ok ? "test" : "failed", r.ok ? "test" : r.reason, r.status);
  if (!r.ok) throw badRequest(`The test lead didn't go through: ${r.reason}${r.status ? ` (HTTP ${r.status})` : ""}. Check the webhook URL in your GoHighLevel workflow.`);
  await run(env.DB, "UPDATE calc_lead_settings SET last_success_at = ?, last_error = NULL WHERE license_id = ?", now(), licenseId);
}

/* ---------------------------------------------------------------- customer setup link (/i/m/c/<token>) */
const SETUP_DAYS = 365;
export const setupUrl = (env: AppEnv, token: string) => `${calcOrigin(env)}/i/m/c/${token}`;

/** A new private setup link for a license (the previous one stops working). */
export async function issueSetupLink(env: AppEnv, licenseId: string) {
  const token = randomToken(32);
  const t = now();
  await run(env.DB, "UPDATE calc_setup_links SET revoked_at = ? WHERE license_id = ? AND revoked_at IS NULL", t, licenseId);
  await run(env.DB, "INSERT INTO calc_setup_links (token_hash, license_id, created_at, expires_at) VALUES (?, ?, ?, ?)", await sha256(token), licenseId, t, new Date(Date.now() + SETUP_DAYS * 864e5).toISOString());
  return token;
}

/** Emails the license holder their setup link. Returns the address used. */
export async function emailSetupLink(env: AppEnv, licenseId: string, opts: { intro?: string; heading?: string; subject?: string } = {}) {
  const l = await one<{ office_id: string; tax_years: string }>(env.DB, "SELECT office_id, tax_years FROM calc_licenses WHERE id = ?", licenseId);
  if (!l) throw notFound("License not found.");
  const o = await one<{ name: string; contact_name: string; email: string }>(env.DB, "SELECT name, contact_name, email FROM mon_offices WHERE id = ?", l.office_id);
  if (!o?.email) throw badRequest("This office has no email address. Add one to the office first.");
  const token = await issueSetupLink(env, licenseId);
  const st = await loadSettings(env);
  await sendMonarch(env, st, {
    to: o.email, template: "monarch_calculator_setup", subject: opts.subject ?? "Set up your Monarch Basic Tax Calculator",
    heading: opts.heading ?? "Your tax calculator is ready",
    paragraphs: [`Hi ${o.contact_name || o.name},`, opts.intro ?? "Your Monarch Basic Tax Calculator license is active. Use your private setup page to add your website, copy your install code, and connect your GoHighLevel so new leads go straight to you.", "Keep this email: the link is your key to your setup page for the next year."],
    button: { label: "Set up my calculator", url: setupUrl(env, token) },
    list: { title: "Your license", items: [`Tax year${jsonArr<number>(l.tax_years).length === 1 ? "" : "s"}: ${jsonArr<number>(l.tax_years).join(", ")}`, "Works on the websites you add on your setup page"] },
    after: ["Questions? Just reply to this email."],
  });
  return o.email;
}

async function setupLicense(env: AppEnv, token: string, ip: string) {
  if (!(await rateLimit(env.DB, `calc-setup:${ip}`, 120, 10))) throw new HttpError(429, "Too many requests. Please wait a few minutes.");
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw notFound("This link isn't valid.");
  const link = await one<{ license_id: string; expires_at: string; revoked_at: string | null }>(env.DB, "SELECT license_id, expires_at, revoked_at FROM calc_setup_links WHERE token_hash = ?", await sha256(token));
  if (!link) throw notFound("This link isn't valid. Ask Monarch Tax Suite for a new one.");
  if (link.revoked_at) throw new HttpError(410, "This link was replaced by a newer one. Use the most recent email from Monarch Tax Suite.");
  if (link.expires_at < now()) throw new HttpError(410, "This link has expired. Ask Monarch Tax Suite for a new one.");
  const l = await one<LicRow & { max_domains: number }>(env.DB, "SELECT * FROM calc_licenses WHERE id = ?", link.license_id);
  if (!l) throw notFound("This link isn't valid.");
  await run(env.DB, "UPDATE calc_setup_links SET last_used_at = ? WHERE token_hash = ?", now(), await sha256(token)).catch(() => undefined);
  return l;
}

/** What the customer sees on their setup page (no secrets: the webhook shows only its host). */
export async function setupView(env: AppEnv, token: string, ip: string) {
  const l = await setupLicense(env, token, ip);
  const [o, domains, s] = await Promise.all([
    one<{ name: string; contact_name: string }>(env.DB, "SELECT name, contact_name FROM mon_offices WHERE id = ?", l.office_id),
    all<{ domain: string }>(env.DB, "SELECT domain FROM calc_domains WHERE license_id = ? ORDER BY domain", l.id),
    one<SetRow>(env.DB, "SELECT * FROM calc_lead_settings WHERE license_id = ?", l.id),
  ]);
  const st = await loadSettings(env);
  return {
    office: { name: o?.name ?? "", contactName: o?.contact_name ?? "" },
    license: { status: l.status, taxYears: jsonArr<number>(l.tax_years), maxDomains: l.max_domains, lastSeenAt: l.last_seen_at, lastSeenHost: l.last_seen_host },
    domains: domains.map((d) => d.domain), installUrl: embedUrl(env, l.embed_id), snippet: embedSnippet(env, l.embed_id),
    leads: { enabled: !!s?.enabled, businessName: s?.business_name ?? "", webhookHost: s?.webhook_host ?? "", webhookSaved: !!s?.webhook_enc, lastSuccessAt: s?.last_success_at ?? null, lastError: s?.last_error ?? null },
    contact: { phone: st.phone, email: st.email },
  };
}

export async function setupAction(env: AppEnv, token: string, ip: string, b: Record<string, unknown>) {
  const l = await setupLicense(env, token, ip);
  if (l.status !== "active") throw badRequest("This license isn't active. Please contact Monarch Tax Suite.");
  if (!(await rateLimit(env.DB, `calc-setup-write:${l.id}`, 40, 60))) throw new HttpError(429, "Too many changes. Please wait a few minutes.");
  const action = String(b.action ?? "");
  if (action === "addDomain") await addDomain(env, l.id, b.domain, l.max_domains);
  else if (action === "removeDomain") await removeDomain(env, l.id, String(b.domain ?? ""));
  else if (action === "leads") await saveLeads(env, l.id, { enabled: b.enabled, businessName: b.businessName, webhookUrl: b.webhookUrl });
  else if (action === "testLead") {
    if (!(await rateLimit(env.DB, `calc-setup-test:${l.id}`, 5, 60))) throw new HttpError(429, "Too many test leads. Please wait an hour.");
    await testLead(env, l.id);
  } else throw badRequest("Unknown action.");
  await run(env.DB, "INSERT INTO audit_events (id, at, actor_user_id, actor_member_id, actor_client_id, action, resource, department, meta, success, ip) VALUES (?, ?, NULL, NULL, NULL, 'Record update', 'Monarch — Calculator license', NULL, ?, 1, ?)", randomId("au"), now(), `Customer setup page: ${action} on license ${l.id}`, ip).catch(() => undefined);
  return setupView(env, token, ip);
}

/* ---------------------------------------------------------------- public lead endpoint */
type Lead = { submissionId: string; firstName: string; lastName: string | null; email: string | null; phone: string | null; estimate: FullLeadEstimate | null; submittedAt: string };
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseLead(input: Record<string, unknown>, includeSummary: boolean, years: number[]): Lead {
  if (typeof input.submissionId !== "string" || !UUID.test(input.submissionId)) throw badRequest("Invalid submission.");
  const firstName = clean(input.firstName, 60);
  if (!firstName) throw badRequest("Enter your first name.");
  const email = clean(input.email, 254).toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw badRequest("Enter a valid email address.");
  const rawPhone = clean(input.phone, 40);
  const phone = rawPhone ? rawPhone.replace(/[\s().-]/g, "") : null;
  if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) throw badRequest("Enter a valid phone number.");
  if (!email && !phone) throw badRequest("Enter an email address or phone number.");
  if (input.consent !== true) throw badRequest("Please agree to be contacted.");
  let estimate: FullLeadEstimate | null = null;
  if (includeSummary && input.inputs && years.includes(FULL_TAX_YEAR)) {
    const inputs = sanitizeFullInputs(input.inputs);
    if (!inputs) throw badRequest("Check the calculator entries and try again.");
    const result = computeFull(inputs);
    if (!result) throw badRequest(NEEDS_INCOME_MESSAGE);
    estimate = fullEstimateForLead(result, inputs.status);
  }
  return { submissionId: input.submissionId.toLowerCase(), firstName, lastName: clean(input.lastName, 60) || null, email, phone, estimate, submittedAt: now() };
}

/** The JSON body sent to the customer's webhook (same contract as the old app). */
function webhookBody(p: Lead, s: SetRow, host: string | null) {
  return {
    event: "calculator.lead", id: p.submissionId, submitted_at: p.submittedAt, source: s.lead_source || s.business_name, website: host, tags: jsonArr<string>(s.tags),
    contact: { first_name: p.firstName, last_name: p.lastName, email: p.email, phone: p.phone },
    estimate: p.estimate ? { ...p.estimate, text: fullEstimateText(p.estimate) } : null,
    consent: { contact: true, text_shown: `Agreed to be contacted by ${s.business_name} about this estimate.` },
  };
}
function sampleEstimate() {
  const inputs = sanitizeFullInputs({ status: "single", wages: 42000, withholding: 3600, kids: 1 })!;
  return fullEstimateForLead(computeFull(inputs)!, inputs.status);
}

type SendResult = { ok: true; status: number } | { ok: false; status: number | null; reason: string };
async function sendWebhook(env: AppEnv, licenseId: string, s: SetRow, body: object, idempotencyKey: string): Promise<SendResult> {
  const target = JSON.parse(await decryptField(vault(env), JSON.parse(s.webhook_enc!), aad(licenseId))) as { url: string; secret: string };
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", enc.encode(target.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`)))].map((x) => x.toString(16).padStart(2, "0")).join("");
  try {
    const res = await fetch(target.url, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json", "User-Agent": "MonarchTaxSuite-Webhook/1", "Idempotency-Key": idempotencyKey, "X-Monarch-Timestamp": String(ts), "X-Monarch-Signature": `v1=${sig}` }, body: raw });
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
    return { ok: false, status: res.status, reason: res.status >= 300 && res.status < 400 ? "redirected" : "rejected" };
  } catch (e) {
    return { ok: false, status: null, reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}
async function logDelivery(env: AppEnv, licenseId: string, outcome: string, reason: string | null, status: number | null) {
  await run(env.DB, "INSERT INTO calc_deliveries (id, license_id, outcome, reason, http_status, created_at) VALUES (?, ?, ?, ?, ?, ?)", randomId("cd"), licenseId, outcome, reason, status, now()).catch(() => undefined);
}

export async function forwardLead(env: AppEnv, req: Request, ip: string) {
  // Only the calculator page itself (same address) may post here.
  const origin = (() => { try { return new URL(req.headers.get("origin") ?? "").host; } catch { return ""; } })();
  if (!origin || origin !== new URL(req.url).host) throw new HttpError(403, "Not allowed.");
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw new HttpError(415, "Unsupported request.");
  const raw = await req.text();
  if (raw.length > 8000) throw new HttpError(413, "Request too large.");
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { throw badRequest("Unsupported request."); }
  const tok = await verifyToken(env, input.token);
  if (!tok) throw badRequest("This form has expired. Reload the page and try again.");
  const lic = await one<LicRow>(env.DB, "SELECT * FROM calc_licenses WHERE id = ?", tok.l);
  const unavailable = () => new HttpError(503, "This form is not accepting submissions right now.");
  if (!lic || lic.status !== "active") throw unavailable();
  if (tok.h) {
    const domains = (await all<{ domain: string }>(env.DB, "SELECT domain FROM calc_domains WHERE license_id = ?", lic.id)).map((d) => d.domain);
    if (!allowedHosts(domains).includes(tok.h)) throw unavailable();
  }
  const s = await leadCapture(env, lic.id);
  if (!s) throw unavailable();
  const p = parseLead(input, !!s.include_summary, jsonArr<number>(lic.tax_years));
  if (typeof input.website === "string" && input.website.trim()) return { ok: true }; // honeypot: pretend success, send nothing
  if (!(await rateLimit(env.DB, `calc-ip:${(await sha256(`calc:${ip}`)).slice(0, 32)}`, 5, 10))) { await logDelivery(env, lic.id, "rejected", "rate_limited_ip", null); throw new HttpError(429, "Too many submissions. Please try again later."); }
  if (!(await rateLimit(env.DB, `calc-lic:${lic.id}`, 300, 60))) { await logDelivery(env, lic.id, "rejected", "rate_limited_license", null); throw new HttpError(429, "Too many submissions. Please try again later."); }
  const body = webhookBody(p, s, tok.h);
  let r = await sendWebhook(env, lic.id, s, body, p.submissionId);
  if (!r.ok && (r.status === null || r.status >= 500 || r.status === 429 || r.status === 408)) {
    await new Promise((res) => setTimeout(res, 700));
    r = await sendWebhook(env, lic.id, s, body, p.submissionId); // same idempotency key, so no duplicate contact
  }
  const t = now();
  // Retention: delivery outcomes only, kept 30 days.
  await run(env.DB, "DELETE FROM calc_deliveries WHERE created_at < ?", new Date(Date.now() - 30 * 864e5).toISOString()).catch(() => undefined);
  if (!r.ok) {
    await logDelivery(env, lic.id, "failed", r.reason, r.status);
    await run(env.DB, "UPDATE calc_lead_settings SET last_error = ?, last_error_at = ? WHERE license_id = ?", `Delivery failed: ${r.reason}${r.status ? ` (HTTP ${r.status})` : ""}`, t, lic.id);
    throw new HttpError(502, "Your details could not be delivered right now. Nothing was saved. Please try again in a moment.");
  }
  await logDelivery(env, lic.id, "sent", null, r.status);
  await run(env.DB, "UPDATE calc_lead_settings SET last_success_at = ?, last_error = NULL WHERE license_id = ?", t, lic.id);
  return { ok: true };
}

/** First load on an authorized website marks the license as live (never slows the page). */
export async function noteSeen(env: AppEnv, licenseId: string, host: string | null) {
  if (!host) return;
  await run(env.DB, "UPDATE calc_licenses SET last_seen_at = ?, last_seen_host = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)", now(), host, licenseId, new Date(Date.now() - 3600e3).toISOString()).catch(() => undefined);
}
export { EMBED_ID_PATTERN };

/* ---------------------------------------------------------------- one-time hand-off from the old Monarch app */
/**
 * The old app holds a customer's webhook encrypted with a key nobody can read back. A one-time hand-off lets
 * that app send it here server-to-server: an owner arms it with the SHA-256 of a random one-time password
 * (service_settings 'calc_handoff': {hash, embedId, expires}); the first request carrying that password for
 * that embed id stores the webhook (encrypted with MKB's key), turns lead delivery on and disarms the hand-off.
 * The webhook is never returned or logged.
 */
export async function receiveHandoff(env: AppEnv, req: Request, ip: string) {
  if (!(await rateLimit(env.DB, `calc-handoff:${ip}`, 5, 60))) throw new HttpError(429, "Too many tries.");
  const armed = await one<{ data: string }>(env.DB, "SELECT data FROM service_settings WHERE key = 'calc_handoff'");
  const h = armed ? (JSON.parse(armed.data) as { hash: string; embedId: string; expires: string }) : null;
  if (!h || h.expires < now()) throw notFound();
  const raw = await req.text();
  if (raw.length > 4000) throw new HttpError(413, "Too large.");
  let b: { token?: unknown; embedId?: unknown; url?: unknown };
  try { b = JSON.parse(raw); } catch { throw badRequest("Bad request."); }
  if (typeof b.token !== "string" || !safeEqual(await sha256(b.token), h.hash) || b.embedId !== h.embedId) throw new HttpError(403, "Not allowed.");
  const lic = await one<LicRow>(env.DB, "SELECT * FROM calc_licenses WHERE embed_id = ?", h.embedId);
  if (!lic) throw notFound();
  const u = cleanWebhook(b.url);
  const secret = b64url(b64(crypto.getRandomValues(new Uint8Array(24))));
  const webhookEnc = JSON.stringify(await encryptField(vault(env), JSON.stringify({ url: u.toString(), secret }), aad(lic.id)));
  await run(env.DB, "UPDATE calc_lead_settings SET webhook_enc = ?, webhook_host = ?, enabled = 1, updated_at = ? WHERE license_id = ?", webhookEnc, u.hostname, now(), lic.id);
  await run(env.DB, "DELETE FROM service_settings WHERE key = 'calc_handoff'");
  await run(env.DB, "INSERT INTO audit_events (id, at, actor_user_id, actor_member_id, actor_client_id, action, resource, department, meta, success, ip) VALUES (?, ?, NULL, NULL, NULL, 'Record update', 'Monarch — Calculator license', NULL, ?, 1, ?)", randomId("au"), now(), `Lead webhook handed over from the old Monarch app (${u.hostname}) for license ${lic.id}`, ip);
  return { ok: true, host: u.hostname };
}
