/**
 * Monarch's online store (monarchtaxsuite.com/store): every package switched on under
 * Monarch → Packages → "Show in the store" gets a product page with a Buy button.
 * Buy opens Stripe Checkout; when Stripe confirms the payment, the buyer is added as a
 * Monarch office (or matched by email), the paid sale is recorded, the usual paid steps
 * run (welcome email for software packages), and the buyer gets a confirmation email
 * with the product's "after purchase" message. Server-only.
 */
import { all, badRequest, HttpError, notFound, now, one, rateLimit, run, stripeKey, type AppEnv } from "./core";
import { randomId, randomToken, sha256 } from "./crypto";
import { notify } from "./notifications";
import { addTaxYear, calcOrigin, createLicense, emailSetupLink } from "./calculator";
import { FULL_TAX_YEAR } from "@/lib/calculator/full";
import { sendMonarch } from "./monarch-email";
import { loadSettings, toPackage, loadAll, need, note } from "./monarch";
import type { Actor } from "./identity";
import { recordWebsiteSale, type CheckoutSession } from "./monarch-sales";
import { BILLING_LABEL, usd, type Package } from "@/lib/monarch/types";
import type { Section, StoreCard } from "@/lib/website/types";

type Row = Parameters<typeof toPackage>[0];
const media = (key: string) => `/site/media/${key}`;
export const priceLabel = (p: Package) => `${usd(p.priceCents)}${p.kind === "package" ? ` · ${BILLING_LABEL[p.billing]}` : " · one-time"}`;

export async function storeProducts(env: AppEnv): Promise<Package[]> {
  return (await all<Row>(env.DB, "SELECT * FROM mon_packages WHERE store = 1 AND active = 1 AND slug IS NOT NULL ORDER BY position, price_cents, name")).map(toPackage);
}
async function storeProduct(env: AppEnv, slug: string) {
  const r = await one<Row>(env.DB, "SELECT * FROM mon_packages WHERE slug = ? AND store = 1 AND active = 1", slug);
  return r ? toPackage(r) : null;
}
export const storeCards = (list: Package[]): StoreCard[] => list.map((p) => ({ slug: p.store.slug, name: p.name, price: priceLabel(p), summary: p.store.summary, image: p.store.images[0] ? media(p.store.images[0]) : undefined }));

/** Sections for /store, /store/<slug> and /store/thanks (null = no such product). */
export async function storeSections(env: AppEnv, parts: string[], query: URLSearchParams): Promise<{ title: string; description: string; sections: Section[] } | null> {
  if (parts.length === 1) {
    const list = await storeProducts(env);
    return {
      title: "Store",
      description: "Software, tools and services for tax professionals from Monarch Tax Suite.",
      sections: [
        { id: "st-h", type: "hero", eyebrow: "Monarch Tax Suite", title: "Store", body: "Software, tools and services for tax professionals. Pay securely by card through Stripe." },
        { id: "st-g", type: "store", tone: "warm", products: storeCards(list) },
      ],
    };
  }
  if (parts[1] === "thanks") {
    const p = query.get("p") ? await storeProduct(env, String(query.get("p")).slice(0, 80)) : null;
    return {
      title: "Thank you",
      description: "",
      sections: [
        { id: "st-t", type: "hero", eyebrow: "Payment received", title: "Thank you for your purchase!", body: [p ? `You bought ${p.name}.` : "", p?.store.afterPurchase || "We'll email you the next steps shortly.", "Stripe is emailing your receipt. Questions? Contact us any time."].filter(Boolean).join("\n\n"), buttons: [{ label: "Back to the store", href: "/store", style: "gold" }] },
      ],
    };
  }
  const p = await storeProduct(env, parts.slice(1).join("/"));
  if (!p) return null;
  const buy = `/api/public/monarch-store/buy/${encodeURIComponent(p.store.slug)}`;
  const canBuy = p.billing !== "monthly";
  const sections: Section[] = [
    { id: "st-p", type: "hero", eyebrow: priceLabel(p), title: p.name, body: p.store.summary, image: p.store.images[0] ? media(p.store.images[0]) : undefined, buttons: [canBuy ? { label: `Buy now — ${usd(p.priceCents)}`, href: buy, style: "gold" } : { label: "Contact us to sign up", href: "/contact", style: "gold" }, { label: "All products", href: "/store", style: "outline" }] },
  ];
  if (p.store.description) sections.push({ id: "st-d", type: "text", title: "About", body: p.store.description });
  if (p.features.length) sections.push({ id: "st-f", type: "cards", tone: "warm", title: "What's included", columns: p.features.length > 4 ? 3 : 2, items: p.features.map((f) => ({ title: f })) });
  const fine = [p.store.terms && { title: "Purchase terms", body: p.store.terms }, p.store.disclaimer && { title: "Disclaimer", body: p.store.disclaimer }].filter(Boolean) as { title: string; body: string }[];
  if (fine.length) sections.push({ id: "st-q", type: "faq", title: "Terms", items: fine });
  if (canBuy) sections.push({ id: "st-c", type: "cta", title: `Get ${p.name}`, body: `${priceLabel(p)}. Secure checkout through Stripe.`, buttons: [{ label: `Buy now — ${usd(p.priceCents)}`, href: buy }] });
  return { title: p.name, description: p.store.summary, sections };
}

/** Where the store lives for this visitor: Monarch's own domain, or /msite on the app. */
function storeOrigin(env: AppEnv, req: Request) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const own = (env.MONARCH_HOSTS ?? "").toLowerCase().split(",").map((h) => h.trim()).includes(host);
  return own ? `https://${host}` : `${env.APP_ORIGIN ?? new URL(req.url).origin}/msite`;
}

/** Buy button: starts a Stripe Checkout for the product and sends the visitor there. */
export async function storeCheckout(env: AppEnv, req: Request, slug: string, ip: string) {
  const origin = storeOrigin(env, req);
  const back = (q: string) => Response.redirect(`${origin}/store/${encodeURIComponent(slug)}${q}`, 303);
  if (!(await rateLimit(env.DB, `store-buy:${ip}`, 20, 10))) throw new HttpError(429, "Too many tries. Please wait a few minutes.", "rate_limited");
  const p = await storeProduct(env, slug);
  if (!p) return Response.redirect(`${origin}/store`, 303);
  if (!stripeKey(env, "monarch") || p.billing === "monthly" || p.priceCents < 50) return back("?unavailable=1");
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(p.priceCents),
    "line_items[0][price_data][product_data][name]": p.name,
    "metadata[monarch_package_id]": p.id,
    "payment_intent_data[metadata][monarch_package_id]": p.id,
    "payment_intent_data[description]": `Monarch store: ${p.name}`,
    "phone_number_collection[enabled]": "true",
    "custom_fields[0][key]": "business",
    "custom_fields[0][label][type]": "custom",
    "custom_fields[0][label][custom]": "Business name",
    "custom_fields[0][type]": "text",
    "custom_fields[0][optional]": "true",
    allow_promotion_codes: "true",
    success_url: `${origin}/store/thanks?p=${encodeURIComponent(slug)}`,
    cancel_url: `${origin}/store/${encodeURIComponent(slug)}`,
  });
  if (p.store.summary) form.set("line_items[0][price_data][product_data][description]", p.store.summary.slice(0, 300));
  if (p.store.images[0] && /^https:/.test(origin)) form.set("line_items[0][price_data][product_data][images][0]", `${origin.replace(/\/msite$/, "")}${media(p.store.images[0])}`);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${stripeKey(env, "monarch")}`, "content-type": "application/x-www-form-urlencoded" }, body: form });
  const s = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !s.url) { console.error("monarch store checkout", res.status, s.error?.message); return back("?unavailable=1"); }
  return Response.redirect(s.url, 303);
}

/** Stripe webhook: a store checkout was paid. Null when it isn't one. */
export async function monarchStorePurchase(env: AppEnv, s: CheckoutSession & { metadata?: Record<string, string> | null }) {
  const id = s.metadata?.monarch_package_id;
  if (!id) return null;
  const pk = await one<Row>(env.DB, "SELECT * FROM mon_packages WHERE id = ?", id);
  if (!pk) return null;
  const done = await recordWebsiteSale(env, s, pk, "store");
  if (!done || "duplicate" in done) return done;
  const pkg = toPackage(pk);
  const email = String(s.customer_details?.email ?? "").trim().toLowerCase();
  const officeId = done.office;
  const st = await loadSettings(env);
  const paid = usd(Math.max(0, Math.round(s.amount_total ?? pkg.priceCents)));
  const confirm = (paragraphs: string[], extra: Partial<Parameters<typeof sendMonarch>[2]> = {}) => email ? sendMonarch(env, st, { to: email, template: "monarch_store_purchase", subject: `Your purchase: ${pkg.name}`, heading: "Thank you for your purchase", paragraphs, after: ["Questions? Just reply to this email."], ...extra }).catch((e) => console.error("store confirmation", e instanceof Error ? e.message : e)) : Promise.resolve();
  try {
    const d = pkg.store.delivery;
    if (d === "calculator_license") {
      // A new license for this office, and the private setup link by email.
      const licenseId = await createLicense(env, officeId, { taxYear: pkg.store.taxYear ?? FULL_TAX_YEAR, packageId: pkg.id });
      await emailSetupLink(env, licenseId, { subject: `Your purchase: ${pkg.name} — set it up`, intro: `Thank you for buying ${pkg.name} (${paid}). Your license is active. Use your private setup page to add your website, copy your install code, and connect your GoHighLevel so new leads go straight to you.` });
      return done;
    }
    if (d === "calculator_update") {
      const year = pkg.store.taxYear ?? FULL_TAX_YEAR + 1;
      const n = await addTaxYear(env, officeId, year);
      if (n) {
        const lic = await one<{ id: string }>(env.DB, "SELECT id FROM calc_licenses WHERE office_id = ? AND status != 'revoked' ORDER BY created_at LIMIT 1", officeId);
        if (lic) await emailSetupLink(env, lic.id, { subject: `Your purchase: ${pkg.name}`, heading: "Your calculator update is ready", intro: `Thank you for buying ${pkg.name} (${paid}). Your calculator license now includes the ${year} tax year. Nothing changes on your website; your setup page is below if you need it.` });
        return done;
      }
      await notify(env, { module: "monarch" }, { kind: "text", title: `Calculator update bought, but no license found`, body: `${pkg.name} was bought by ${email || "a customer"}, who has no calculator license on file. Check the office and add the ${year} tax year by hand.`, href: `/monarch/offices/${officeId}` });
      await confirm([`You bought ${pkg.name} for ${paid}. Stripe is emailing your receipt separately.`, "We'll match it to your calculator license and email you shortly."]);
      return done;
    }
    if (d === "download") {
      const token = await issueDownloadLink(env, s.payment_intent ?? s.id, pkg.id, officeId);
      await confirm([`You bought ${pkg.name} for ${paid}. Stripe is emailing your receipt separately.`, pkg.store.afterPurchase || "Your files are ready to download. The link works for 30 days."], { button: { label: "Download my files", url: `${calcOrigin(env)}/i/m/d/${token}` } });
      return done;
    }
  } catch (e) {
    // The sale is recorded; delivery problems go to the owner instead of failing the payment.
    console.error("store delivery", e instanceof Error ? e.message : e);
    await notify(env, { module: "monarch" }, { kind: "text", title: `Store delivery needs a hand: ${pkg.name}`, body: `The payment went through, but the automatic delivery didn't (${e instanceof Error ? e.message.slice(0, 160) : "error"}). Open the office and finish it by hand.`, href: `/monarch/offices/${officeId}` }).catch(() => undefined);
    return done;
  }
  // Software packages get the usual welcome; everything else gets a purchase confirmation.
  if (pkg.kind !== "package") await confirm([`You bought ${pkg.name} for ${paid}. Stripe is emailing your receipt separately.`, pkg.store.afterPurchase || "We'll email you the next steps shortly."]);
  return done;
}


/* ---------------------------------------------------------------- downloads (/i/m/d/<token>) */
const DOWNLOAD_DAYS = 30;
export async function issueDownloadLink(env: AppEnv, saleRef: string, packageId: string, officeId: string) {
  const token = randomToken(32);
  await run(env.DB, "INSERT INTO mon_download_links (token_hash, sale_id, package_id, office_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)", await sha256(token), saleRef, packageId, officeId, now(), new Date(Date.now() + DOWNLOAD_DAYS * 864e5).toISOString());
  return token;
}
async function downloadLink(env: AppEnv, token: string, ip: string) {
  if (!(await rateLimit(env.DB, `dl:${ip}`, 60, 10))) throw new HttpError(429, "Too many requests. Please wait a few minutes.");
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw notFound("This link isn't valid.");
  const l = await one<{ token_hash: string; package_id: string; expires_at: string }>(env.DB, "SELECT token_hash, package_id, expires_at FROM mon_download_links WHERE token_hash = ?", await sha256(token));
  if (!l) throw notFound("This link isn't valid.");
  if (l.expires_at < now()) throw new HttpError(410, "This download link has expired. Reply to your purchase email and we'll send a new one.");
  return l;
}
export async function downloadView(env: AppEnv, token: string, ip: string) {
  const l = await downloadLink(env, token, ip);
  const pk = await one<{ name: string }>(env.DB, "SELECT name FROM mon_packages WHERE id = ?", l.package_id);
  const files = await all<{ id: string; name: string; size: number }>(env.DB, "SELECT id, name, size FROM mon_package_files WHERE package_id = ? AND deleted_at IS NULL ORDER BY created_at", l.package_id);
  return { product: pk?.name ?? "Your purchase", expiresAt: l.expires_at, files };
}
export async function downloadFile(env: AppEnv, token: string, fileId: string, ip: string) {
  const l = await downloadLink(env, token, ip);
  const f = await one<{ name: string; r2_key: string; content_type: string }>(env.DB, "SELECT name, r2_key, content_type FROM mon_package_files WHERE id = ? AND package_id = ? AND deleted_at IS NULL", fileId, l.package_id);
  if (!f) throw notFound("File not found.");
  const obj = await env.FILES.get(f.r2_key);
  if (!obj) throw notFound("File not found.");
  await run(env.DB, "UPDATE mon_download_links SET downloads = downloads + 1 WHERE token_hash = ?", l.token_hash);
  const safe = f.name.replace(/[^A-Za-z0-9._ -]+/g, "-");
  return new Response(obj.body, { headers: { "content-type": f.content_type, "content-disposition": `attachment; filename="${safe}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}

/* ---------------------------------------------------------------- staff: a download product's files */
const MAX_FILE = 25 * 1024 * 1024;
export async function uploadPackageFile(env: AppEnv, a: Actor, req: Request, packageId: string) {
  need(a, "settings");
  if (!(await one(env.DB, "SELECT 1 FROM mon_packages WHERE id = ?", packageId))) throw notFound("Package not found.");
  const name = (decodeURIComponent(req.headers.get("x-file-name") ?? "") || "file").replace(/[\r\n\\/]+/g, " ").trim().slice(0, 160);
  const type = (req.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim().slice(0, 100) || "application/octet-stream";
  if (/html|javascript|svg/i.test(type) || /\.(html?|js|svg)$/i.test(name)) throw badRequest("That file type can't be sold as a download. Use PDF, Word, Excel, ZIP or images.");
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) throw badRequest("The file is empty.");
  if (buf.byteLength > MAX_FILE) throw badRequest("Files can be up to 25 MB.");
  const id = randomId("pf");
  const key = `monarch/products/${packageId}/${id}`;
  await env.FILES.put(key, buf, { httpMetadata: { contentType: type } });
  await run(env.DB, "INSERT INTO mon_package_files (id, package_id, name, r2_key, size, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, packageId, name, key, buf.byteLength, type, now());
  await note(a, "Package", `Added download file ${name}`, env);
  return loadAll(env, a);
}
export async function deletePackageFile(env: AppEnv, a: Actor, packageId: string, fileId: string) {
  need(a, "settings");
  const f = await one<{ name: string }>(env.DB, "SELECT name FROM mon_package_files WHERE id = ? AND package_id = ? AND deleted_at IS NULL", fileId, packageId);
  if (!f) throw notFound("File not found.");
  await run(env.DB, "UPDATE mon_package_files SET deleted_at = ? WHERE id = ?", now(), fileId);
  await note(a, "Package", `Removed download file ${f.name}`, env);
  return loadAll(env, a);
}
