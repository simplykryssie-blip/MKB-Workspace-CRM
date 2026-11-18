/**
 * Campaign funnels — the 2027 Money Vault tax campaign at /unlock.
 *
 * One switch in Settings turns the page on or off (off: /unlock sends visitors to the
 * Tax Preparation page). The inquiry form is an ordinary form in the Forms builder,
 * created from a template the first time the funnel is turned on, so every inquiry
 * lands in Leads like any other form: same pipeline, same matching, same follow-up.
 * Tracking IDs (Meta Pixel, Google Analytics) are public by nature, but only staff
 * with Settings access can change them. Server-only.
 */
import { MARKETING_OPT_IN, type FormField, type LeadForm } from "@/lib/forms/config";
import { all, badRequest, json, now, one, rateLimit, run, type AppEnv } from "./core";
import { audit, requirePermission, type Actor } from "./identity";
import { publicFormById } from "./forms";

export const MONEY_VAULT = { key: "money-vault", campaignId: "mkb_2027_money_vault", taxYear: 2026, path: "/unlock", offPath: "/tax-preparation", formId: "form-money-vault-2027", slug: "money-vault-2027" } as const;

export type FunnelSettings = {
  /** turnedOnAt: when it was first turned on (the campaign's start). */
  moneyVault: { on: boolean; formId?: string; turnedOnAt?: string };
  tracking: { metaPixelId: string; gaId: string };
};
const DEFAULTS: FunnelSettings = { moneyVault: { on: false }, tracking: { metaPixelId: "", gaId: "" } };

export async function loadFunnels(env: AppEnv): Promise<FunnelSettings> {
  const r = await one<{ data: string }>(env.DB, "SELECT data FROM service_settings WHERE key = 'funnels'");
  const d = json<Partial<FunnelSettings>>(r?.data ?? null, {});
  return { moneyVault: { ...DEFAULTS.moneyVault, ...d.moneyVault }, tracking: { ...DEFAULTS.tracking, ...d.tracking } };
}

/* ---------------------------------------------------------------- the form template */
const W = "Me or my household";
const B = "My business";
const f = (x: Omit<FormField, "map"> & { map?: FormField["map"] }): FormField => ({ map: "none", ...x });
export function moneyVaultFields(): FormField[] {
  const ind = { fieldId: "mv-who", equals: W };
  const biz = { fieldId: "mv-who", equals: B };
  return [
    f({ id: "mv-h-who", type: "heading", label: "Who is this for?" }),
    f({ id: "mv-who", type: "radio", label: "Are you filing for yourself or for a business?", required: true, options: [W, B] }),
    f({ id: "mv-h-ind", type: "heading", label: "Your 2026 tax return", showIf: ind }),
    f({ id: "mv-ret-ind", type: "radio", label: "Which return do you need?", required: true, options: ["Personal return", "Self-employed or single-member LLC (Schedule C)", "Not sure"], showIf: ind }),
    f({ id: "mv-life", type: "checkboxes", label: "Did any of these happen in 2026?", help: "Optional — it helps us prepare. Pick any that apply.", options: ["Started a new job or had more than one job", "Side business or gig income", "Bought or sold a home", "New baby or dependent", "Married or divorced", "Received a letter from the IRS", "None of these"], showIf: ind }),
    f({ id: "mv-h-biz", type: "heading", label: "Your business", showIf: biz }),
    f({ id: "mv-biz-name", type: "text", label: "Business name", required: true, map: "businessName", showIf: biz }),
    f({ id: "mv-ret-biz", type: "radio", label: "How is the business set up?", required: true, options: ["Self-employed or single-member LLC (Schedule C)", "S corporation", "Partnership or multi-member LLC", "C corporation", "Not sure"], showIf: biz }),
    f({ id: "mv-books", type: "radio", label: "Are the business's 2026 books up to date?", help: "Optional.", options: ["Yes", "Mostly", "No — I'd like help with bookkeeping"], showIf: biz }),
    f({ id: "mv-h-contact", type: "heading", label: "Your contact details" }),
    f({ id: "mv-name", type: "text", label: "Full name", required: true, map: "fullName" }),
    f({ id: "mv-email", type: "email", label: "Email", help: "We'll send your private interview link here.", required: true, map: "email" }),
    f({ id: "mv-phone", type: "phone", label: "Mobile phone", required: true, map: "phone" }),
    f({ id: "mv-state", type: "radio", label: "Where do you live?", required: true, options: ["Louisiana", "Texas", "Another state"], map: "state" }),
    f({ id: "mv-pref", type: "radio", label: "Best way to reach you", options: ["Phone call", "Text message", "Email"], map: "preferredContact" }),
    f({ id: "mv-h-src", type: "heading", label: "How did you find us?" }),
    f({ id: "mv-src", type: "select", label: "How did you hear about MKB?", required: true, options: ["Facebook or Instagram", "Google search", "TikTok", "A friend or family member", "I'm a past client", "Flyer or event", "Other"] }),
    f({ id: "mv-ref", type: "text", label: "Who referred you?", help: "Optional — so we can thank them.", showIf: { fieldId: "mv-src", equals: "A friend or family member" } }),
    f({ id: "mv-h-review", type: "heading", label: "Review and send" }),
    f({ id: "mv-p-review", type: "paragraph", label: "Check your answers above. When you send this, we'll email you a private link to start your 2026 tax interview, plus an option to book a call if you'd rather talk first." }),
    f({ id: "mv-consent", type: "consent", label: "I agree that MKB Financial Group may contact me by phone, text or email about my request, and will use my information only to respond to it. Message and data rates may apply. I can opt out at any time.", required: true }),
    f({ id: "mv-marketing", type: "marketing", label: MARKETING_OPT_IN }),
  ];
}
const THANK_YOU = "We just emailed you a private link to start your 2026 tax interview. The same email has a button to book a call if you'd rather talk first. Don't see it in a few minutes? Check your spam or promotions folder, or call us at 888-379-9372.";

/** Creates the Money Vault form (published) if it doesn't exist yet. Staff can edit it in Forms afterwards. */
async function ensureForm(env: AppEnv, a: Actor): Promise<string> {
  const db = env.DB;
  const existing = await one<{ id: string; status: string }>(db, "SELECT id, status FROM forms WHERE id = ?", MONEY_VAULT.formId);
  if (existing) {
    if (existing.status !== "published") await run(db, "UPDATE forms SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?", now(), now(), existing.id);
    return existing.id;
  }
  requirePermission(a, "leads", "edit");
  const owner = await one<{ id: string }>(db, "SELECT m.id FROM members m JOIN roles r ON r.id = m.role_id WHERE r.is_owner = 1 AND m.status = 'active' LIMIT 1");
  const stage = await one<{ id: string }>(db, "SELECT id FROM lead_stages ORDER BY position LIMIT 1");
  if (!owner || !stage) throw badRequest("Set up the lead pipeline first.");
  const routing: LeadForm["routing"] = {
    ownerId: owner.id, stageId: stage.id, source: "Website", sourceDetail: `2027 Money Vault (tax year ${MONEY_VAULT.taxYear})`,
    tags: ["Money Vault 2027", `Tax year ${MONEY_VAULT.taxYear}`, MONEY_VAULT.campaignId], followUpHours: 24,
    autoIntake: { kind: "tax", taxYear: MONEY_VAULT.taxYear },
  };
  const slug = (await one(db, "SELECT 1 FROM forms WHERE slug = ?", MONEY_VAULT.slug)) ? `${MONEY_VAULT.slug}-unlock` : MONEY_VAULT.slug;
  const t = now();
  await run(db, "INSERT INTO forms (id, name, slug, title, intro, status, fields, services, routing, thank_you, layout, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, 'steps', ?, ?, ?)",
    MONEY_VAULT.formId, "2027 Money Vault inquiry", slug, "Unlock your 2026 tax return", "A few quick questions, about two minutes. No Social Security numbers, bank details or documents here.",
    JSON.stringify(moneyVaultFields()), JSON.stringify(["tax"]), JSON.stringify(routing), THANK_YOU, t, t, t);
  await audit(db, a, { action: "Record update", resource: "Form 2027 Money Vault inquiry", meta: "Created from the Money Vault funnel template" });
  return MONEY_VAULT.formId;
}

/* ---------------------------------------------------------------- staff */
export async function getFunnels(env: AppEnv, a: Actor) {
  requirePermission(a, "settings", "view");
  const s = await loadFunnels(env);
  const form = s.moneyVault.formId ? await one<{ id: string; slug: string; status: string }>(env.DB, "SELECT id, slug, status FROM forms WHERE id = ?", s.moneyVault.formId) : null;
  return { settings: s, form, campaignId: MONEY_VAULT.campaignId, taxYear: MONEY_VAULT.taxYear, path: MONEY_VAULT.path };
}

const PIXEL = /^\d{8,20}$/;
const GA = /^G-[A-Z0-9]{4,16}$/;
export async function saveFunnels(env: AppEnv, a: Actor, b: { moneyVaultOn?: unknown; metaPixelId?: unknown; gaId?: unknown }) {
  requirePermission(a, "settings", "settings");
  if (a.kind !== "staff") throw badRequest("Staff only.");
  const cur = await loadFunnels(env);
  const next: FunnelSettings = { moneyVault: { ...cur.moneyVault }, tracking: { ...cur.tracking } };
  if (typeof b.metaPixelId === "string") {
    const v = b.metaPixelId.trim();
    if (v && !PIXEL.test(v)) throw badRequest("The Meta Pixel ID is a number (usually 15–16 digits). Find it in Meta Events Manager.");
    next.tracking.metaPixelId = v;
  }
  if (typeof b.gaId === "string") {
    const v = b.gaId.trim().toUpperCase();
    if (v && !GA.test(v)) throw badRequest("The Google Analytics ID starts with G- (for example G-AB12CD34EF). Find it under Admin → Data streams.");
    next.tracking.gaId = v;
  }
  const changes: string[] = [];
  if (typeof b.moneyVaultOn === "boolean" && b.moneyVaultOn !== cur.moneyVault.on) {
    if (b.moneyVaultOn) {
      next.moneyVault.formId = await ensureForm(env, a);
      next.moneyVault.turnedOnAt = cur.moneyVault.turnedOnAt ?? now();
    }
    next.moneyVault.on = b.moneyVaultOn;
    changes.push(`Money Vault page turned ${b.moneyVaultOn ? "on" : "off"}`);
  }
  if (next.tracking.metaPixelId !== cur.tracking.metaPixelId) changes.push(next.tracking.metaPixelId ? "Meta Pixel ID set" : "Meta Pixel ID removed");
  if (next.tracking.gaId !== cur.tracking.gaId) changes.push(next.tracking.gaId ? "Google Analytics ID set" : "Google Analytics ID removed");
  await run(env.DB, "INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('funnels', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", JSON.stringify(next), now(), a.member.id);
  if (changes.length) await audit(env.DB, a, { action: "Record update", resource: "Settings: campaign funnels", meta: changes.join("; ") });
  return getFunnels(env, a);
}

/* ---------------------------------------------------------------- public */
/** What the /unlock page needs. Off (or its form unpublished): null — the page sends visitors to Tax Preparation. */
export async function moneyVaultPage(env: AppEnv) {
  const s = await loadFunnels(env);
  if (!s.moneyVault.on || !s.moneyVault.formId) return null;
  const form = await publicFormById(env, s.moneyVault.formId);
  if (!form) return null;
  const privacy = !!(await one(env.DB, "SELECT 1 FROM website_pages WHERE site = 'mkb' AND slug = 'privacy' AND deleted_at IS NULL AND published IS NOT NULL"));
  return { form, tracking: s.tracking, campaignId: MONEY_VAULT.campaignId, taxYear: MONEY_VAULT.taxYear, privacy };
}

/** Counts a page visit (a daily number only: no IP, cookie or visitor ID is kept). */
export async function countVisit(env: AppEnv, funnel: unknown, ip: string) {
  if (funnel !== MONEY_VAULT.key) return { ok: true };
  if (!(await loadFunnels(env)).moneyVault.on) return { ok: true };
  if (!(await rateLimit(env.DB, `funnel-visit:${ip}`, 20, 60))) return { ok: true };
  await run(env.DB, "INSERT INTO funnel_visits (funnel, day, visits) VALUES (?, ?, 1) ON CONFLICT(funnel, day) DO UPDATE SET visits = visits + 1", MONEY_VAULT.key, now().slice(0, 10));
  return { ok: true };
}

/* ---------------------------------------------------------------- report */
/**
 * Visits → inquiries → qualified → clients → paid, plus interviews, returns and revenue.
 * Counts only (no names), from the Money Vault form's submissions and the leads they made.
 */
export async function moneyVaultReport(env: AppEnv, a: Actor) {
  requirePermission(a, "leads", "view");
  const db = env.DB;
  const s = await loadFunnels(env);
  const formId = s.moneyVault.formId ?? MONEY_VAULT.formId;
  const year = MONEY_VAULT.taxYear;
  const visits = (await one<{ n: number }>(db, "SELECT COALESCE(SUM(visits), 0) AS n FROM funnel_visits WHERE funnel = ?", MONEY_VAULT.key))?.n ?? 0;
  const subs = await all<{ outcome: string; lead_id: string | null; client_id: string | null; attribution: string | null }>(db, "SELECT outcome, lead_id, client_id, attribution FROM form_submissions WHERE form_id = ? AND channel != 'Staff test' AND outcome != 'spam'", formId);
  const leadIds = [...new Set(subs.map((x) => x.lead_id).filter((x): x is string => !!x))];
  const inList = (n: number) => Array(n).fill("?").join(",") || "''";
  const leads = leadIds.length ? await all<{ id: string; status: string; stage_position: number; converted_client_id: string | null }>(db, `SELECT l.id, l.status, COALESCE(s.position, 0) AS stage_position, l.converted_client_id FROM leads l LEFT JOIN lead_stages s ON s.id = l.stage_id WHERE l.id IN (${inList(leadIds.length)})`, ...leadIds) : [];
  const qualifiedPos = (await one<{ position: number }>(db, "SELECT position FROM lead_stages WHERE lower(name) = 'qualified'"))?.position ?? 2;
  const stages = await all<{ id: string; name: string; position: number }>(db, "SELECT id, name, position FROM lead_stages ORDER BY position");
  // Clients: converted leads, plus existing clients who came back through the page.
  const people = leadIds.length ? await all<{ id: string; status: string }>(db, `SELECT id, status FROM clients WHERE lead_id IN (${inList(leadIds.length)})`, ...leadIds) : [];
  const clientIds = [...new Set([...leads.map((l) => l.converted_client_id), ...people.filter((p) => !["prospect", "declined"].includes(p.status)).map((p) => p.id), ...subs.map((x) => x.client_id)].filter((x): x is string => !!x))];
  const anyIds = [...new Set([...clientIds, ...people.map((p) => p.id)])];
  const returns = anyIds.length ? await all<{ status: string; organizer: string }>(db, `SELECT status, organizer FROM tax_returns WHERE tax_year = ? AND client_id IN (${inList(anyIds.length)})`, year, ...anyIds) : [];
  const inv = clientIds.length ? await all<{ status: string; paid_cents: number }>(db, `SELECT status, paid_cents FROM invoices WHERE service = 'tax' AND status != 'void' AND client_id IN (${inList(clientIds.length)}) AND issued_at >= ?`, ...clientIds, (s.moneyVault.turnedOnAt ?? `${year}-10-01`).slice(0, 10)) : [];
  const sources = new Map<string, number>();
  for (const x of subs) {
    const at = x.attribution ? json<{ first?: { utm_source?: string; fbclid?: string; gclid?: string; referrer?: string } }>(x.attribution, {}).first : undefined;
    const k = at?.utm_source || (at?.fbclid ? "facebook (ad click)" : at?.gclid ? "google (ad click)" : at?.referrer ? "referral link" : "direct");
    sources.set(k, (sources.get(k) ?? 0) + 1);
  }
  const submitted = returns.filter((r) => ["submitted", "reviewed"].includes(json<{ status?: string }>(r.organizer, {}).status ?? "")).length;
  const filed = returns.filter((r) => ["Submitted", "Accepted", "Completed"].includes(r.status)).length;
  return {
    on: s.moneyVault.on, turnedOnAt: s.moneyVault.turnedOnAt ?? null, taxYear: year, campaignId: MONEY_VAULT.campaignId,
    visits,
    inquiries: subs.length,
    newLeads: subs.filter((x) => x.outcome === "new_lead").length,
    qualified: leads.filter((l) => l.status === "converted" || (l.status === "open" && l.stage_position >= qualifiedPos)).length,
    lost: leads.filter((l) => l.status === "lost").length,
    byStage: stages.map((st) => ({ name: st.name, count: leads.filter((l) => l.status === "open" && l.stage_position === st.position).length })),
    clients: clientIds.length,
    interviewsSubmitted: submitted,
    returnsFiled: filed,
    paidInvoices: inv.filter((x) => x.status === "paid").length,
    revenueCents: inv.reduce((t, x) => t + (x.paid_cents ?? 0), 0),
    sources: [...sources.entries()].sort((x, y) => y[1] - x[1]).map(([name, count]) => ({ name, count })),
  };
}
