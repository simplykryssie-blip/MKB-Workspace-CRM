/**
 * Black Friday / Cyber Monday 2026: "The Credit Comeback Vault" scratch-off funnel at
 * /credit-comeback. Visitors scratch a golden ticket, join the VIP waitlist (an ordinary
 * Forms-builder form, so they land in Leads), and get a private link to the free packet:
 * the PDF and an in-browser letter builder. Server-only.
 */
import { CREDIT_VAULT } from "@/lib/funnels/credit-vault";
import { MARKETING_OPT_IN, type FormField, type LeadForm } from "@/lib/forms/config";
import { FIRM, renderEmail } from "@/lib/email/templates";
import { badRequest, HttpError, now, one, run, type AppEnv } from "./core";
import { audit, requirePermission, sendEmail, type Actor } from "./identity";
import { publicFormById, publicSubmit } from "./forms";
import { loadFunnels } from "./funnels";
import { linkOrigin } from "./books-intake";
import { publicAssetOrigin } from "./email";
import { sha256 } from "./crypto";

const f = (x: Omit<FormField, "map"> & { map?: FormField["map"] }): FormField => ({ map: "none", ...x });
export function creditVaultFields(): FormField[] {
  return [
    f({ id: "cv-name", type: "text", label: "Full name", required: true, map: "fullName" }),
    f({ id: "cv-email", type: "email", label: "Email", help: "Your private Vault link goes here.", required: true, map: "email" }),
    f({ id: "cv-phone", type: "phone", label: "Mobile phone", required: true, map: "phone" }),
    f({ id: "cv-state", type: "radio", label: "Where do you live?", required: true, options: ["Louisiana", "Texas", "Another state"], map: "state" }),
    f({ id: "cv-goal", type: "select", label: "What's your credit goal?", required: true, options: ["Remove errors and collections", "Buy a home", "Get approved for a car", "Rebuild after a hard time", "Get ready for a business loan", "Just learning"] }),
    f({ id: "cv-consent", type: "consent", label: "I agree that MKB Financial Group may email, text or call me about my request and the VIP waitlist, and will use my information only for that. Message and data rates may apply. Reply STOP to opt out of texts.", required: true }),
    f({ id: "cv-marketing", type: "marketing", label: MARKETING_OPT_IN }),
  ];
}

/** Creates the Credit Comeback Vault form (published) if it doesn't exist yet. Staff can edit it in Forms afterwards. */
export async function ensureCreditVaultForm(env: AppEnv, a: Actor): Promise<string> {
  const db = env.DB;
  const existing = await one<{ id: string; status: string }>(db, "SELECT id, status FROM forms WHERE id = ?", CREDIT_VAULT.formId);
  if (existing) {
    if (existing.status !== "published") await run(db, "UPDATE forms SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?", now(), now(), existing.id);
    return existing.id;
  }
  requirePermission(a, "leads", "edit");
  const owner = await one<{ id: string }>(db, "SELECT m.id FROM members m JOIN roles r ON r.id = m.role_id WHERE r.is_owner = 1 AND m.status = 'active' LIMIT 1");
  const stage = await one<{ id: string }>(db, "SELECT id FROM lead_stages ORDER BY position LIMIT 1");
  if (!owner || !stage) throw badRequest("Set up the lead pipeline first.");
  const routing: LeadForm["routing"] = { ownerId: owner.id, stageId: stage.id, source: "Website", sourceDetail: "Black Friday 2026: Credit Comeback Vault", tags: [...CREDIT_VAULT.tags, CREDIT_VAULT.campaignId], followUpHours: 48 };
  const slug = (await one(db, "SELECT 1 FROM forms WHERE slug = ?", CREDIT_VAULT.slug)) ? `${CREDIT_VAULT.slug}-vip` : CREDIT_VAULT.slug;
  const t = now();
  await run(db, "INSERT INTO forms (id, name, slug, title, intro, status, fields, services, routing, thank_you, layout, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, 'single', ?, ?, ?)",
    CREDIT_VAULT.formId, "Credit Comeback Vault (Black Friday 2026)", slug, "Claim your Credit Comeback Vault", "Join the VIP waitlist and get the free packet.",
    JSON.stringify(creditVaultFields()), JSON.stringify([]), JSON.stringify(routing), "Your Vault is unlocked. Check your email for your private link.", t, t, t);
  await audit(db, a, { action: "Record update", resource: "Form Credit Comeback Vault", meta: "Created from the Black Friday funnel template" });
  return CREDIT_VAULT.formId;
}

/** What /credit-comeback needs; null when the page is off (visitors go to the home page). */
export async function creditVaultPage(env: AppEnv) {
  const s = await loadFunnels(env);
  if (!s.creditVault.on || !s.creditVault.formId) return null;
  const form = await publicFormById(env, s.creditVault.formId);
  if (!form) return null;
  // Tracking: the campaign IDs from Settings → Campaign pages, else the website's own.
  const site = await one<{ published: string | null }>(env.DB, "SELECT published FROM website_settings WHERE id = 1").catch(() => null);
  const w = site?.published ? (JSON.parse(site.published) as { metaPixelId?: string; ga4Id?: string }) : {};
  const tracking = { metaPixelId: s.tracking.metaPixelId || w.metaPixelId || "", gaId: s.tracking.gaId || w.ga4Id || "" };
  const privacy = !!(await one(env.DB, "SELECT 1 FROM website_pages WHERE site = 'mkb' AND slug = 'privacy' AND deleted_at IS NULL AND published IS NOT NULL"));
  return { form, tracking, privacy };
}

/* ---------------------------------------------------------------- the private kit link */
// A signed link (no database row): the packet isn't personal, the link just keeps it for people who joined.
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
  const payload = `${parts[0]}.${parts[1]}`;
  const sig = await mac(env, payload);
  if (sig.length !== parts[2].length) return false;
  let d = 0;
  for (let i = 0; i < sig.length; i++) d |= sig.charCodeAt(i) ^ parts[2].charCodeAt(i);
  if (d !== 0) return false;
  const issued = parseInt(parts[1], 36);
  return Number.isFinite(issued) && Date.now() - issued < 400 * 864e5; // good for about 13 months
}
export const kitUrl = (env: AppEnv, token: string) => `${linkOrigin(env)}${CREDIT_VAULT.path}/kit?k=${encodeURIComponent(token)}`;

/** { data, honeypot, clientKey, attribution } — join the waitlist (→ a lead), then the private kit link (on screen and by email). */
export async function joinCreditVault(env: AppEnv, req: Request, b: { data?: Record<string, unknown>; honeypot?: string; clientKey?: unknown; attribution?: unknown }, ip: string) {
  const s = await loadFunnels(env);
  if (!s.creditVault.on || !s.creditVault.formId) throw new HttpError(404, "This offer has ended.", "not_found");
  const row = await one<{ slug: string }>(env.DB, "SELECT slug FROM forms WHERE id = ? AND status = 'published'", s.creditVault.formId);
  if (!row) throw new HttpError(404, "This offer has ended.", "not_found");
  // The same browser sending again (double tap, retry): still show the link, but don't email twice.
  const dup = typeof b.clientKey === "string" && !!(await one(env.DB, "SELECT 1 FROM form_submissions WHERE form_id = ? AND client_key = ?", s.creditVault.formId, b.clientKey));
  await publicSubmit(env, req, row.slug, b, ip);
  const email = typeof b.data?.["cv-email"] === "string" ? (b.data["cv-email"] as string).trim().toLowerCase() : "";
  const name = typeof b.data?.["cv-name"] === "string" ? (b.data["cv-name"] as string).trim() : "";
  if ((b.honeypot ?? "").trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: true };
  const token = await kitToken(env, email);
  const url = kitUrl(env, token);
  if (!dup) {
    await sendKitEmail(env, email, name.split(" ")[0] || "there", url).catch((e) => console.error("credit vault email", e instanceof Error ? e.message : e));
  }
  return { ok: true, kit: url };
}

async function sendKitEmail(env: AppEnv, to: string, first: string, url: string) {
  const e = renderEmail({
    wording: {
      subject: "Your Credit Comeback Vault is unlocked",
      heading: "Your Vault is unlocked",
      intro: `Hi ${first}, thanks for joining the MKB VIP waitlist. Your free Credit Comeback Vault is ready: the full 3-round dispute system as a PDF, plus the online Letter Builder that fills in your letters for you.`,
      docsNote: "",
      steps: "Open your Vault and download the PDF.\nPull your 3 free reports at annualcreditreport.com and use the audit checklist.\nBuild your Round 1 letters in the Letter Builder, print, sign and mail them certified.\nWatch for VIP-only Black Friday and Cyber Monday offers from MKB.",
      button: "Open my Vault",
      closing: "Keep this email: the link is your key to the Vault. Tax season is around the corner — when you're ready, we'll help your refund power your comeback.",
    },
    docsTitle: "", vars: {}, buttonUrl: url, logoUrl: `${publicAssetOrigin(env)}/brand/mkb-seal-192.png`,
    secondary: { lead: "Want help with your taxes this season?", label: "Book a call", url: `${linkOrigin(env)}/book-consultation` },
  });
  await sendEmail(env, { to, template: "credit_vault_kit", subject: e.subject, text: e.text, html: e.html });
}

/** The PDF, for a valid kit link. */
export async function creditVaultPdf(env: AppEnv, token: unknown) {
  if (!(await kitValid(env, token))) throw new HttpError(403, "This link isn't valid. Use the link in your Vault email.", "forbidden");
  const { buildCreditVaultPdf } = await import("./intake-pdf");
  const pdf = await buildCreditVaultPdf();
  return new Response(pdf as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="The Credit Comeback Vault - ${FIRM.name}.pdf"`, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
}
