/**
 * Monarch's online store (monarchtaxsuite.com/store): every package switched on under
 * Monarch → Packages → "Show in the store" gets a product page with a Buy button.
 * Buy opens Stripe Checkout; when Stripe confirms the payment, the buyer is added as a
 * Monarch office (or matched by email), the paid sale is recorded, the usual paid steps
 * run (welcome email for software packages), and the buyer gets a confirmation email
 * with the product's "after purchase" message. Server-only.
 */
import { all, HttpError, one, rateLimit, stripeKey, type AppEnv } from "./core";
import { sendMonarch } from "./monarch-email";
import { loadSettings, toPackage } from "./monarch";
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
  // Software packages get the usual welcome; everything else gets a purchase confirmation.
  const email = String(s.customer_details?.email ?? "").trim().toLowerCase();
  if (pkg.kind !== "package" && email) {
    const st = await loadSettings(env);
    await sendMonarch(env, st, {
      to: email, template: "monarch_store_purchase", subject: `Your purchase: ${pkg.name}`, heading: "Thank you for your purchase",
      paragraphs: [`You bought ${pkg.name} for ${usd(Math.max(0, Math.round(s.amount_total ?? pkg.priceCents)))}. Stripe is emailing your receipt separately.`, pkg.store.afterPurchase || "We'll email you the next steps shortly."],
      after: ["Questions? Just reply to this email."],
    }).catch((e) => console.error("store confirmation", e instanceof Error ? e.message : e));
  }
  return done;
}
