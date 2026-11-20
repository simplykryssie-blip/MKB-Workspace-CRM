/**
 * Black Friday / Cyber Monday 2026: the "Tax Prize" golden-ticket scratch-off at /black-friday.
 * Visitors start scratching; before the prize shows, a popup collects their details (an
 * ordinary Forms-builder form, so they land in Leads and get the right tax interview by
 * email). The server picks one instant prize per person ($25/$50/$75 off 2026 tax prep).
 * Opting in to texts adds the VIP bonus: the Credit Comeback Vault (PDF + Letter Builder,
 * behind a private signed link) and priority filing. Server-only.
 */
import { CREDIT_VAULT } from "@/lib/funnels/credit-vault";
import { BIZ_TYPES, FILER, IND_TYPES, TAX_PRIZE, usd0 } from "@/lib/funnels/tax-prize";
import type { FormField, LeadForm } from "@/lib/forms/config";
import { FIRM, renderEmail } from "@/lib/email/templates";
import { badRequest, HttpError, json, now, one, rateLimit, run, type AppEnv } from "./core";
import { audit, requirePermission, sendEmail, type Actor } from "./identity";
import { publicFormById, publicSubmit } from "./forms";
import { loadFunnels } from "./funnels";
import { linkOrigin } from "./books-intake";
import { publicAssetOrigin } from "./email";
import { randomId, sha256 } from "./crypto";
import { recordConsent } from "./campaigns";

const f = (x: Omit<FormField, "map"> & { map?: FormField["map"] }): FormField => ({ map: "none", ...x });
const ME = { fieldId: "tp-who", equals: FILER.me };
const BIZ = { fieldId: "tp-who", equals: FILER.biz };
/** The popup's questions. The return-type answers match the tax interview's return choices. */
export function creditVaultFields(): FormField[] {
  return [
    f({ id: "tp-who", type: "radio", label: "Who's filing?", required: true, options: [FILER.me, FILER.biz] }),
    f({ id: "tp-ind", type: "radio", label: "Which return?", required: true, options: [...IND_TYPES], showIf: ME }),
    f({ id: "tp-biz-name", type: "text", label: "Business name", required: true, map: "businessName", showIf: BIZ }),
    f({ id: "tp-biz", type: "radio", label: "Business type", required: true, options: [...BIZ_TYPES], showIf: BIZ }),
    f({ id: "tp-name", type: "text", label: "Full name", required: true, map: "fullName" }),
    f({ id: "tp-phone", type: "phone", label: "Mobile phone", required: true, map: "phone" }),
    f({ id: "tp-email", type: "email", label: "Email", required: true, map: "email" }),
    f({ id: "tp-state", type: "radio", label: "State", required: true, options: ["Louisiana", "Texas", "Another state"], map: "state" }),
    f({ id: "tp-consent", type: "consent", label: "I agree to the Official Rules and that MKB Financial Group may contact me about my prize and my tax return.", required: true }),
  ];
}
const routingFor = (ownerId: string, stageId: string): LeadForm["routing"] => ({
  ownerId, stageId, source: "Website", sourceDetail: "Black Friday 2026: Tax Prize scratch-off",
  tags: ["BFCM 2026", "Black Friday Tax Prize", TAX_PRIZE.campaign], followUpHours: 24,
  autoIntake: { kind: "tax", taxYear: 2026 },
});

/** Creates (or upgrades) the campaign form. Staff can edit the wording in Forms afterwards. */
export async function ensureCreditVaultForm(env: AppEnv, a: Actor | null): Promise<string> {
  const db = env.DB;
  const existing = await one<{ id: string; status: string; fields: string; routing: string }>(db, "SELECT id, status, fields, routing FROM forms WHERE id = ?", CREDIT_VAULT.formId);
  if (existing) {
    if (existing.status !== "published") await run(db, "UPDATE forms SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?", now(), now(), existing.id);
    // The first version (Credit Vault waitlist) is upgraded to the Tax Prize questions once.
    if (!existing.fields.includes('"tp-who"')) {
      const r = json<{ ownerId?: string; stageId?: string }>(existing.routing, {});
      const stage = r.stageId ?? (await one<{ id: string }>(db, "SELECT id FROM lead_stages ORDER BY position LIMIT 1"))?.id ?? "";
      await run(db, "UPDATE forms SET name = ?, title = ?, intro = ?, fields = ?, routing = ?, services = ?, thank_you = ?, updated_at = ? WHERE id = ?",
        "Black Friday Tax Prize (2026)", "Claim your Black Friday Tax Prize", "Every ticket wins.", JSON.stringify(creditVaultFields()), JSON.stringify(routingFor(r.ownerId ?? "", stage)), JSON.stringify(["tax"]), "Your prize is revealed. Check your email.", now(), existing.id);
    }
    return existing.id;
  }
  if (a) requirePermission(a, "leads", "edit");
  const owner = await one<{ id: string }>(db, "SELECT m.id FROM members m JOIN roles r ON r.id = m.role_id WHERE r.is_owner = 1 AND m.status = 'active' LIMIT 1");
  const stage = await one<{ id: string }>(db, "SELECT id FROM lead_stages ORDER BY position LIMIT 1");
  if (!owner || !stage) throw badRequest("Set up the lead pipeline first.");
  const slug = (await one(db, "SELECT 1 FROM forms WHERE slug = ?", CREDIT_VAULT.slug)) ? `${CREDIT_VAULT.slug}-vip` : CREDIT_VAULT.slug;
  const t = now();
  await run(db, "INSERT INTO forms (id, name, slug, title, intro, status, fields, services, routing, thank_you, layout, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, 'single', ?, ?, ?)",
    CREDIT_VAULT.formId, "Black Friday Tax Prize (2026)", slug, "Claim your Black Friday Tax Prize", "Every ticket wins.",
    JSON.stringify(creditVaultFields()), JSON.stringify(["tax"]), JSON.stringify(routingFor(owner.id, stage.id)), "Your prize is revealed. Check your email.", t, t, t);
  if (a) await audit(db, a, { action: "Record update", resource: "Form Black Friday Tax Prize", meta: "Created from the Black Friday funnel template" });
  return CREDIT_VAULT.formId;
}

/** What /black-friday needs; null when the page is off (visitors go to the home page). */
export async function creditVaultPage(env: AppEnv) {
  const s = await loadFunnels(env);
  if (!s.creditVault.on || !s.creditVault.formId) return null;
  await ensureCreditVaultForm(env, null);
  const form = await publicFormById(env, s.creditVault.formId);
  if (!form) return null;
  // Tracking: the campaign IDs from Settings → Campaign pages, else the website's own.
  const site = await one<{ published: string | null }>(env.DB, "SELECT published FROM website_settings WHERE id = 1").catch(() => null);
  const w = site?.published ? json<{ metaPixelId?: string; ga4Id?: string }>(site.published, {}) : {};
  const tracking = { metaPixelId: s.tracking.metaPixelId || w.metaPixelId || "", gaId: s.tracking.gaId || w.ga4Id || "" };
  const privacy = !!(await one(env.DB, "SELECT 1 FROM website_pages WHERE site = 'mkb' AND slug = 'privacy' AND deleted_at IS NULL AND published IS NOT NULL"));
  const claimed = (await one<{ n: number }>(env.DB, "SELECT count(*) AS n FROM funnel_prizes WHERE campaign = ?", TAX_PRIZE.campaign).catch(() => null))?.n ?? 0;
  return { form, tracking, privacy, claimed };
}

/* ---------------------------------------------------------------- the private Vault link (VIP bonus) */
// A signed link (no database row): the packet isn't personal, the link just keeps it for VIPs.
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function mac(env: AppEnv, payload: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(`credit-vault-kit:${env.ENCRYPTION_KEY ?? "dev"}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(payload)))).slice(0, 32);
}
export async function kitToken(env: AppEnv, email: string) {
  const payload = `${(await sha256(email.trim().toLowerCase())).slice(0, 12)}.${Date.now().toString(36)}`;
  return `${payload}.${await mac(env, payload)}`;
}
export async function kitValid(env: AppEnv, token: unknown) {
  if (typeof token !== "string" || token.length > 120) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const sig = await mac(env, `${parts[0]}.${parts[1]}`);
  if (sig.length !== parts[2].length) return false;
  let d = 0;
  for (let i = 0; i < sig.length; i++) d |= sig.charCodeAt(i) ^ parts[2].charCodeAt(i);
  if (d !== 0) return false;
  const issued = parseInt(parts[1], 36);
  return Number.isFinite(issued) && Date.now() - issued < 400 * 864e5; // about 13 months
}
export const kitUrl = (env: AppEnv, token: string) => `${linkOrigin(env)}${CREDIT_VAULT.path}/kit?k=${encodeURIComponent(token)}`;

/* ---------------------------------------------------------------- claiming a prize */
type PrizeRow = { id: string; prize_cents: number; code: string; vip_bonus: number; lead_id: string | null; client_id: string | null };
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => `MKB-BF-${Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("")}`;
function pickPrize() {
  const r = crypto.getRandomValues(new Uint32Array(1))[0] % 100;
  let acc = 0;
  for (const p of TAX_PRIZE.prizes) { acc += p.odds; if (r < acc) return p.cents; }
  return TAX_PRIZE.prizes[0].cents;
}
const digits = (s: string) => s.replace(/\D/g, "").slice(-10);

/**
 * { data, honeypot, clientKey, attribution, emailOptIn, smsOptIn } — the popup. Saves the entry
 * (→ lead + the right tax interview by email), picks (or returns) this person's prize, records
 * their marketing choices, and sends the prize by email (and text, if they opted in).
 */
export async function joinCreditVault(env: AppEnv, req: Request, b: { data?: Record<string, unknown>; honeypot?: string; clientKey?: unknown; attribution?: unknown; emailOptIn?: unknown; smsOptIn?: unknown }, ip: string) {
  const s = await loadFunnels(env);
  if (!s.creditVault.on || !s.creditVault.formId || Date.now() > Date.parse(TAX_PRIZE.closesAt)) throw new HttpError(404, "This Black Friday offer has ended.", "not_found");
  await ensureCreditVaultForm(env, null);
  const row = await one<{ slug: string }>(env.DB, "SELECT slug FROM forms WHERE id = ? AND status = 'published'", s.creditVault.formId);
  if (!row) throw new HttpError(404, "This offer has ended.", "not_found");
  const data = b.data ?? {};
  const email = typeof data["tp-email"] === "string" ? (data["tp-email"] as string).trim().toLowerCase() : "";
  const phone = digits(typeof data["tp-phone"] === "string" ? (data["tp-phone"] as string) : "");
  const name = typeof data["tp-name"] === "string" ? (data["tp-name"] as string).trim() : "";
  // The form check (required answers, consent) and the lead + tax interview happen here.
  await publicSubmit(env, req, row.slug, { data, honeypot: b.honeypot, clientKey: b.clientKey, attribution: b.attribution }, ip);
  if ((b.honeypot ?? "").trim()) return { ok: true, prizeCents: TAX_PRIZE.prizes[0].cents, code: "", vip: false };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || phone.length !== 10) throw badRequest("Please check your email and mobile number.");
  if (!(await rateLimit(env.DB, `prize-ip:${ip}`, 15, 60))) throw new HttpError(429, "Too many tries. Please wait a few minutes.", "rate_limited");

  const sms = b.smsOptIn === true;
  const t = now();
  const src = `Black Friday Tax Prize page (${TAX_PRIZE.path}), ${t.slice(0, 10)}`;
  if (b.emailOptIn !== false) await recordConsent(env, "mkb", "email", email, "subscribed", src, null);
  if (sms) await recordConsent(env, "mkb", "sms", phone, "subscribed", `${src}: checked the text opt-in box`, null);

  // One prize per person: the same email or phone gets the prize already picked.
  let p = await one<PrizeRow>(env.DB, "SELECT * FROM funnel_prizes WHERE campaign = ? AND (email = ? OR phone = ?) ORDER BY created_at LIMIT 1", TAX_PRIZE.campaign, email, phone);
  const first = !p;
  if (!p) {
    const lead = await one<{ id: string }>(env.DB, "SELECT id FROM leads WHERE lower(email) = ? ORDER BY created_at DESC LIMIT 1", email);
    const client = lead ? null : await one<{ id: string }>(env.DB, "SELECT id FROM clients WHERE lower(email) = ? LIMIT 1", email);
    p = { id: randomId("prz"), prize_cents: pickPrize(), code: newCode(), vip_bonus: sms ? 1 : 0, lead_id: lead?.id ?? null, client_id: client?.id ?? null };
    await run(env.DB, "INSERT INTO funnel_prizes (id, campaign, email, phone, prize_cents, code, vip_bonus, lead_id, client_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", p.id, TAX_PRIZE.campaign, email, phone, p.prize_cents, p.code, p.vip_bonus, p.lead_id, p.client_id, t);
    const label = `${usd0(p.prize_cents)} off 2026 tax prep`;
    const note = `Black Friday Tax Prize: ${label} (code ${p.code}, redeem by ${TAX_PRIZE.redeemBy}).${sms ? " VIP bonus: opted in to texts (Credit Comeback Vault + priority filing)." : ""}`;
    if (p.lead_id) {
      const l = await one<{ tags: string; owner_id: string }>(env.DB, "SELECT tags, owner_id FROM leads WHERE id = ?", p.lead_id);
      const tags = [...new Set([...json<string[]>(l?.tags ?? "[]", []), `Prize: ${label}`, ...(sms ? ["VIP bonus"] : [])])];
      await env.DB.batch([
        env.DB.prepare("UPDATE leads SET tags = ?, rev = rev + 1 WHERE id = ?").bind(JSON.stringify(tags), p.lead_id),
        env.DB.prepare("INSERT INTO lead_notes (id, lead_id, author_id, body, at) VALUES (?, ?, ?, ?, ?)").bind(randomId("n"), p.lead_id, l?.owner_id ?? null, note, t),
      ]);
    } else if (p.client_id) {
      await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, at) VALUES (?, ?, 'message', ?, 'client', ?)", randomId("x"), p.client_id, note, t);
    }
  } else if (sms && !p.vip_bonus) {
    await run(env.DB, "UPDATE funnel_prizes SET vip_bonus = 1 WHERE id = ?", p.id);
    p.vip_bonus = 1;
  }
  const vip = !!p.vip_bonus;
  const kit = vip ? kitUrl(env, await kitToken(env, email)) : null;
  if (first) {
    const firstName = name.split(" ")[0] || "there";
    await sendPrizeEmail(env, email, firstName, p, kit).catch((e) => console.error("prize email", e instanceof Error ? e.message : e));
    if (vip) {
      const { sendText } = await import("./sms");
      await sendText(env, { brand: "mkb", to: phone, body: `MKB Financial Group: You won ${usd0(p.prize_cents)} off your 2026 tax prep! Code ${p.code} (use by ${TAX_PRIZE.redeemBy}). Your VIP bonus, the Credit Comeback Vault: ${kit} Reply STOP to opt out.` }).catch((e) => console.error("prize text", e instanceof Error ? e.message : e));
    }
  }
  return { ok: true, prizeCents: p.prize_cents, code: p.code, vip, kit, again: !first };
}

async function sendPrizeEmail(env: AppEnv, to: string, first: string, p: PrizeRow, kit: string | null) {
  const amount = usd0(p.prize_cents);
  const e = renderEmail({
    wording: {
      subject: `You won ${amount} off your 2026 tax prep`,
      heading: `${amount} off is yours, ${first}`,
      intro: `Your Black Friday golden ticket revealed ${amount} off MKB Financial Group's fee to prepare your 2026 tax return. Your prize code is ${p.code}. Use it by ${TAX_PRIZE.redeemBy}.`,
      docsNote: "",
      steps: `Watch for a separate email with your private 2026 tax interview link. You can start it now, even before the IRS opens filing.\nWhen you file with MKB, mention code ${p.code} and we'll take ${amount} off your preparation fee.${kit ? "\nOpen your VIP bonus, the Credit Comeback Vault, with the button below." : ""}`,
      button: kit ? "Open my VIP bonus" : "Book a call",
      closing: "Questions? Reply to this email or call 888-379-9372. Official Rules apply; the discount applies to MKB preparation fees only and has no cash value.",
    },
    docsTitle: "", vars: {}, buttonUrl: kit ?? `${linkOrigin(env)}/book-consultation`, logoUrl: `${publicAssetOrigin(env)}/brand/mkb-seal-192.png`,
    secondary: kit ? { lead: "Prefer to talk first?", label: "Book a call", url: `${linkOrigin(env)}/book-consultation` } : undefined,
  });
  await sendEmail(env, { to, template: "bfcm_tax_prize", subject: e.subject, text: e.text, html: e.html });
}

/** The Credit Comeback Vault PDF, for a valid VIP link. */
export async function creditVaultPdf(env: AppEnv, token: unknown) {
  if (!(await kitValid(env, token))) throw new HttpError(403, "This link isn't valid. Use the link in your VIP email or text.", "forbidden");
  const { buildCreditVaultPdf } = await import("./intake-pdf");
  const pdf = await buildCreditVaultPdf();
  return new Response(pdf as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="The Credit Comeback Vault - ${FIRM.name}.pdf"`, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
}
