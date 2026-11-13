/**
 * Monarch sales: what an office bought, how it was paid (Stripe pay link or
 * recorded by hand), refunds, and reseller commissions. A commission is
 * created when a sale is paid, cancelled if the sale is refunded, and marked
 * paid out by staff. Server-only.
 */
import { badRequest, HttpError, notFound, now, one, rateLimit, run, str, type AppEnv } from "./core";
import { randomId, randomToken, sha256 } from "./crypto";
import { publicAssetOrigin } from "./email";
import { notify } from "./notifications";
import { sendMonarch } from "./monarch-email";
import { sendWelcomePackage } from "./monarch-link";
import { advance, loadAll, loadSettings, need, note, officeRow, staffId, toPackage, type SaleRowLite } from "./monarch";
import { usd } from "@/lib/monarch/types";
import type { Actor } from "./identity";

const payOrigin = (env: AppEnv) => (env.WEBSITE_HOSTS ? publicAssetOrigin(env) : env.APP_ORIGIN ?? "https://app.mkbfinancialgroup.com");
const METHODS = ["Cash", "Check", "Zelle", "Cash App", "Card (in person)", "Bank transfer", "Other"];

async function saleRow(env: AppEnv, id: string) {
  const r = await one<SaleRowLite>(env.DB, "SELECT * FROM mon_sales WHERE id = ?", id);
  if (!r) throw notFound("Sale not found.");
  return r;
}

/** Applies a paid sale's effects: package/add-on on the office, commission, stage. */
async function afterPaid(env: AppEnv, r: SaleRowLite) {
  const pk = r.package_id ? await one<Parameters<typeof toPackage>[0]>(env.DB, "SELECT * FROM mon_packages WHERE id = ?", r.package_id) : null;
  const pkg = pk ? toPackage(pk) : null;
  if (pkg?.kind === "seat") await run(env.DB, "UPDATE mon_offices SET extra_seats = extra_seats + ?, updated_at = ?, rev = rev + 1 WHERE id = ?", r.qty, now(), r.office_id);
  if (pkg?.kind === "location") await run(env.DB, "UPDATE mon_offices SET extra_locations = extra_locations + ?, updated_at = ?, rev = rev + 1 WHERE id = ?", r.qty, now(), r.office_id);
  if (pkg?.kind === "package") {
    // The office's package becomes the one bought; a seasonal package renews a year from payment.
    const renews = pkg.billing === "season" ? new Date(new Date(r.paid_at ?? now()).getTime() + 365 * 864e5).toISOString().slice(0, 10) : null;
    await run(env.DB, "UPDATE mon_offices SET package_id = ?, renews_on = coalesce(?, renews_on), updated_at = ?, rev = rev + 1 WHERE id = ?", pkg.id, renews, now(), r.office_id);
  }
  if (r.reseller_id) {
    const rs = await one<{ rate_bp: number }>(env.DB, "SELECT rate_bp FROM mon_resellers WHERE id = ?", r.reseller_id);
    if (rs && rs.rate_bp > 0) {
      const amt = Math.round((r.amount_cents * rs.rate_bp) / 10_000);
      await run(env.DB, "INSERT INTO mon_commissions (id, reseller_id, sale_id, rate_bp, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, 'owed', ?) ON CONFLICT(sale_id) DO UPDATE SET status = 'owed', amount_cents = excluded.amount_cents, rate_bp = excluded.rate_bp WHERE mon_commissions.status = 'cancelled'", randomId("mc"), r.reseller_id, r.id, rs.rate_bp, amt, now());
    }
  }
  await advance(env, r.office_id, { paid: true });
  // A new package: the welcome (setup link + software and bank applications) goes out right away.
  if (pkg?.kind === "package") {
    const o = await one<{ welcome_sent_at: string | null; stage: string }>(env.DB, "SELECT welcome_sent_at, stage FROM mon_offices WHERE id = ?", r.office_id);
    const s = await loadSettings(env);
    if (s.autoWelcome && o && !o.welcome_sent_at && (o.stage === "interested" || o.stage === "paid")) await sendWelcomePackage(env, r.office_id).catch((e) => console.error("monarch welcome", e instanceof Error ? e.message : e));
  }
}

export async function createSale(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  need(a, "create");
  const office = await officeRow(env, str(b.officeId, 60));
  const qty = Math.round(Number(b.qty) || 1);
  if (qty < 1 || qty > 500) throw badRequest("Quantity must be between 1 and 500.");
  const pk = b.packageId ? await one<Parameters<typeof toPackage>[0]>(env.DB, "SELECT * FROM mon_packages WHERE id = ?", String(b.packageId)) : null;
  if (b.packageId && !pk) throw badRequest("That package no longer exists. Reload and try again.");
  const unit = Math.round(Number(String(b.price ?? "").replace(/[$,\s]/g, "")) * 100);
  if (!isFinite(unit) || unit <= 0 || unit > 10_000_000) throw badRequest("Enter the price.");
  const description = str(b.description, 200) || (pk ? `${pk.name}${qty > 1 ? ` × ${qty}` : ""}` : "");
  if (!description) throw badRequest("Describe what was sold.");
  const paid = b.payment === "paid";
  if (b.payment === "link") {
    if (!env.STRIPE_SECRET_KEY) throw badRequest("Online payment isn't set up yet (Stripe). Record the payment by hand instead.");
    if (!office.email) throw badRequest("Add the office's email address first.");
  }
  const method = paid ? (METHODS.includes(String(b.method)) ? String(b.method) : "Other") : null;
  const t = now();
  const id = randomId("ms");
  await run(env.DB, "INSERT INTO mon_sales (id, office_id, package_id, description, qty, unit_cents, amount_cents, status, method, paid_at, reseller_id, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, office.id, pk?.id ?? null, description, qty, unit, unit * qty, paid ? "paid" : "unpaid", method, paid ? t : null, office.reseller_id, t, staffId(a), t);
  const r = await saleRow(env, id);
  if (paid) await afterPaid(env, r);
  let emailed: boolean | undefined;
  if (!paid && b.payment === "link") emailed = (await payLink(env, a, id)).emailed;
  await note(a, `Sale to ${office.name}`, `${description} — ${usd(unit * qty)}${paid ? ` paid (${method})` : ""}`, env);
  return { id, emailed, data: await loadAll(env, a) };
}

/** Emails a new Stripe pay link for an unpaid sale (older links stop working). */
export async function payLink(env: AppEnv, a: Actor, id: string) {
  need(a, "edit");
  const r = await saleRow(env, id);
  if (r.status !== "unpaid") throw badRequest("Only unpaid sales can get a pay link.");
  if (!env.STRIPE_SECRET_KEY) throw badRequest("Online payment isn't set up yet (Stripe). Record the payment by hand instead.");
  const o = await officeRow(env, r.office_id);
  if (!o.email) throw badRequest("Add the office's email address first.");
  const token = randomToken(24);
  await run(env.DB, "UPDATE mon_sales SET pay_token_hash = ?, link_sent_at = ?, updated_at = ? WHERE id = ?", await sha256(token), now(), now(), id);
  const s = await loadSettings(env);
  const res = await sendMonarch(env, s, {
    to: o.email, template: "monarch_pay_link",
    subject: `${o.name}: your Monarch Tax Suite order (${usd(r.amount_cents)})`,
    heading: `Your order: ${r.description}`,
    paragraphs: [`Total due: ${usd(r.amount_cents)}.`, "Pay securely online by card or bank account with the button below."],
    button: { label: "Pay online", url: `${payOrigin(env)}/api/public/monarch-pay/${token}` },
    after: ["Already paid? You can ignore this email."],
  });
  await note(a, `Sale to ${o.name}`, `Pay link emailed (${usd(r.amount_cents)})`, env);
  return { emailed: res.sent };
}

export async function updateSale(env: AppEnv, a: Actor, id: string, b: { action?: unknown; method?: unknown }) {
  const r = await saleRow(env, id);
  const t = now();
  if (b.action === "paid") {
    need(a, "edit");
    if (r.status !== "unpaid") throw badRequest("This sale isn't unpaid.");
    const method = METHODS.includes(String(b.method)) ? String(b.method) : "Other";
    await run(env.DB, "UPDATE mon_sales SET status = 'paid', method = ?, paid_at = ?, pay_token_hash = NULL, updated_at = ? WHERE id = ?", method, t, t, id);
    await afterPaid(env, await saleRow(env, id));
  } else if (b.action === "refund") {
    need(a, "approve");
    if (r.status !== "paid") throw badRequest("Only paid sales can be refunded.");
    await env.DB.batch([
      env.DB.prepare("UPDATE mon_sales SET status = 'refunded', refunded_at = ?, updated_at = ? WHERE id = ?").bind(t, t, id),
      env.DB.prepare("UPDATE mon_commissions SET status = 'cancelled' WHERE sale_id = ? AND status = 'owed'").bind(id),
    ]);
  } else if (b.action === "void") {
    need(a, "edit");
    if (r.status !== "unpaid") throw badRequest("Only unpaid sales can be cancelled.");
    await run(env.DB, "UPDATE mon_sales SET status = 'void', pay_token_hash = NULL, updated_at = ? WHERE id = ?", t, id);
  } else if (b.action === "link") {
    await payLink(env, a, id);
  } else throw badRequest("Unknown action.");
  await note(a, `Sale ${id}`, String(b.action), env);
  return loadAll(env, a);
}

/** Marks every owed commission for a reseller (or the listed ones) as paid out. */
export async function payCommissions(env: AppEnv, a: Actor, b: { resellerId?: unknown; ids?: unknown }) {
  need(a, "approve");
  const rid = str(b.resellerId, 60);
  if (!rid) throw badRequest("Choose a reseller.");
  const ids = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 500) : null;
  const t = now();
  const res = ids?.length
    ? await run(env.DB, `UPDATE mon_commissions SET status = 'paid', paid_at = ?, paid_by = ? WHERE reseller_id = ? AND status = 'owed' AND id IN (${ids.map(() => "?").join(",")})`, t, staffId(a), rid, ...ids)
    : await run(env.DB, "UPDATE mon_commissions SET status = 'paid', paid_at = ?, paid_by = ? WHERE reseller_id = ? AND status = 'owed'", t, staffId(a), rid);
  await note(a, `Reseller ${rid}`, `${res.meta.changes ?? 0} commission(s) marked paid`, env);
  return loadAll(env, a);
}

/* ---------------------------------------------------------------- public pay link → Stripe */
const page = (title: string, body: string, status = 200) => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#f7f6f2;font:16px/1.6 Arial,sans-serif;color:#111}.b{background:#0b0b0b;padding:14px 22px}.bar{height:4px;background:#b87912}.c{max-width:520px;margin:32px auto;padding:0 18px}h1{font:500 26px Georgia,serif}</style></head><body><div class="b"><img src="/brand/monarch-email.png" alt="Monarch Tax Suite" width="220" style="display:block;max-width:100%;height:auto"></div><div class="bar"></div><div class="c"><h1>${title}</h1>${body}</div></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });

export async function publicMonarchPay(env: AppEnv, token: string, ip: string, done: boolean) {
  if (done) return page("Thank you", "<p>Your payment was received. It can take a minute to show on your account.</p>");
  if (!(await rateLimit(env.DB, `monpay-ip:${ip}`, 30, 10))) return page("Please try again shortly", "<p>Too many attempts. Wait a few minutes and try again.</p>", 429);
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return page("Link not valid", "<p>This payment link isn't valid. Please use the newest email from Monarch Tax Suite.</p>", 404);
  const r = await one<SaleRowLite>(env.DB, "SELECT * FROM mon_sales WHERE pay_token_hash = ?", await sha256(token));
  if (!r) return page("Link not valid", "<p>This payment link has expired or been replaced. Please use the newest email from Monarch Tax Suite.</p>", 404);
  if (r.status === "paid") return page("Already paid", "<p>This order is paid in full. Thank you!</p>");
  if (r.status !== "unpaid") return page("Link not valid", "<p>This order is no longer open. Please contact Monarch Tax Suite.</p>", 404);
  if (!env.STRIPE_SECRET_KEY) return page("Online payment isn't available", "<p>Please contact Monarch Tax Suite to pay.</p>", 503);
  const base = `${payOrigin(env)}/api/public/monarch-pay/${token}`;
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(r.amount_cents),
    "line_items[0][price_data][product_data][name]": `${r.description} — Monarch Tax Suite`,
    "metadata[monarch_sale_id]": r.id,
    "payment_intent_data[metadata][monarch_sale_id]": r.id,
    "payment_intent_data[description]": `Monarch Tax Suite — ${r.description}`,
    client_reference_id: r.id,
    // Discount codes made in Stripe (e.g. a 100%-off code for testing) can be entered at checkout.
    allow_promotion_codes: "true",
    success_url: `${base}?done=1`,
    cancel_url: payOrigin(env) + "/",
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" }, body: form });
  const s = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !s.url) { console.error("monarch stripe checkout", res.status, s.error?.message); return page("Payment page unavailable", "<p>We couldn't open the payment page right now. Please try again later.</p>", 502); }
  return Response.redirect(s.url, 303);
}

/** Called by the verified Stripe webhook for a Monarch sale. Applies once. */
export async function monarchStripePaid(env: AppEnv, saleId: string, amountTotal: number, ref: string, discount = 0) {
  const r = await one<SaleRowLite>(env.DB, "SELECT * FROM mon_sales WHERE id = ?", saleId);
  if (!r) throw notFound("Sale not found.");
  if (r.status !== "unpaid" || (r.reference && r.reference === ref)) return { received: true, duplicate: true };
  // A discount code entered at checkout counts toward the total (a 100%-off code pays it in full).
  if (amountTotal + Math.max(0, discount) < r.amount_cents) throw new HttpError(400, "Amount paid is less than the sale.");
  const t = now();
  const method = discount > 0 ? (amountTotal > 0 ? `Card / bank (Stripe) — discount code ${usd(discount)}` : "Discount code (100% off — nothing charged)") : "Card / bank (Stripe)";
  const res = await run(env.DB, "UPDATE mon_sales SET status = 'paid', method = ?, reference = ?, paid_at = ?, pay_token_hash = NULL, updated_at = ? WHERE id = ? AND status = 'unpaid'", method, ref, t, t, saleId);
  if (!res.meta.changes) return { received: true, duplicate: true };
  await afterPaid(env, await saleRow(env, saleId));
  const o = await one<{ name: string }>(env.DB, "SELECT name FROM mon_offices WHERE id = ?", r.office_id);
  await notify(env, { module: "monarch" }, { kind: "payment", title: `Monarch payment: ${o?.name ?? "office"} (${usd(amountTotal)})`, body: `${r.description} — ${discount > 0 ? `paid through Stripe with a ${usd(discount)} discount code` : "paid online through Stripe"}.`, href: `/monarch/offices/${r.office_id}` });
  return { received: true };
}

export { METHODS };

/* ---------------------------------------------------------------- purchases from the website */
type CheckoutSession = { id: string; payment_link?: string | null; payment_status?: string; amount_total?: number; total_details?: { amount_discount?: number } | null; payment_intent?: string | null; customer_details?: { name?: string | null; email?: string | null; phone?: string | null; address?: { city?: string | null; state?: string | null } | null } | null; custom_fields?: { key?: string; label?: { custom?: string | null }; text?: { value?: string | null } | null; dropdown?: { value?: string | null } | null }[] };

/**
 * A package bought through a Stripe payment link on the website (one set on
 * the package in Monarch → Packages). Adds the office (or uses the one with
 * that email), records the paid sale, and — through the usual paid steps —
 * sends the welcome. Returns null when the payment isn't for a Monarch package.
 */
export async function monarchWebsitePurchase(env: AppEnv, s: CheckoutSession) {
  if (!s.payment_link || !env.STRIPE_SECRET_KEY) return null;
  const res = await fetch(`https://api.stripe.com/v1/payment_links/${encodeURIComponent(s.payment_link)}`, { headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  const link = (await res.json().catch(() => ({}))) as { url?: string };
  if (!res.ok || !link.url) return null;
  const pk = await one<Parameters<typeof toPackage>[0]>(env.DB, "SELECT * FROM mon_packages WHERE stripe_link = ?", link.url);
  if (!pk) return null;
  const ref = s.payment_intent ?? s.id;
  if (await one(env.DB, "SELECT 1 FROM mon_sales WHERE reference = ?", ref)) return { received: true, duplicate: true };
  const c = s.customer_details ?? {};
  const email = String(c.email ?? "").trim().toLowerCase().slice(0, 200);
  const field = (re: RegExp) => (s.custom_fields ?? []).find((f) => re.test(`${f.key ?? ""} ${f.label?.custom ?? ""}`))?.text?.value?.trim() || (s.custom_fields ?? []).find((f) => re.test(`${f.key ?? ""} ${f.label?.custom ?? ""}`))?.dropdown?.value?.trim() || "";
  const business = field(/business|company|office|firm/i);
  const contact = String(c.name ?? "").trim().slice(0, 120);
  const t = now();
  // The same office buying again (same email) gets the sale on its existing record.
  let office = email ? await one<{ id: string; name: string }>(env.DB, "SELECT id, name FROM mon_offices WHERE lower(email) = ? ORDER BY created_at LIMIT 1", email) : null;
  if (!office) {
    const id = randomId("of");
    const name = (business || contact || email || "New office").slice(0, 160);
    await run(env.DB, "INSERT INTO mon_offices (id, name, contact_name, email, phone, city, state, stage, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'interested', ?, NULL, ?)",
      id, name, contact, email, String(c.phone ?? "").slice(0, 40), String(c.address?.city ?? "").slice(0, 80), String(c.address?.state ?? "").slice(0, 2).toUpperCase(), t, t);
    office = { id, name };
  }
  // What they actually paid (a discount code lowers it; a 100%-off code makes it $0, so no reseller commission).
  const amount = Math.max(0, Math.round(s.amount_total ?? pk.price_cents));
  const discount = Math.max(0, Math.round(s.total_details?.amount_discount ?? 0));
  const method = discount > 0 ? (amount > 0 ? `Card / bank (Stripe — website) — discount code ${usd(discount)}` : "Discount code (100% off — nothing charged) — website") : "Card / bank (Stripe — website)";
  const saleId = randomId("ms");
  await run(env.DB, "INSERT INTO mon_sales (id, office_id, package_id, description, qty, unit_cents, amount_cents, status, method, reference, paid_at, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, 'paid', ?, ?, ?, ?, NULL, ?)",
    saleId, office.id, pk.id, pk.name, amount, amount, method, ref, t, t, t);
  await afterPaid(env, await saleRow(env, saleId));
  await notify(env, { module: "monarch" }, { kind: "payment", title: `New Monarch purchase: ${office.name} (${usd(amount)})`, body: `${pk.name} — bought on the website. The welcome email went out automatically.`, href: `/monarch/offices/${office.id}` });
  return { received: true, office: office.id };
}
