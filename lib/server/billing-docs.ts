/**
 * Invoice documents and payments from outside: branded PDF, sending by email,
 * the client's private pay link (Stripe Checkout) and the Stripe webhook that
 * records card/bank payments. Card details never touch MKB's systems.
 * Server-only.
 */
import { FIRM } from "@/lib/email/templates";
import type { InvoiceLine } from "@/lib/types";
import { badRequest, HttpError, json, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { randomId, randomToken, safeEqual, sha256 } from "./crypto";
import { applyPayment, dollars, getInvoiceRow, toInvoice, type InvoiceRow } from "./billing";
import { publicAssetOrigin, sendTemplate } from "./email";
import { audit, type Actor } from "./identity";
import { buildInvoicePdf } from "./intake-pdf";
import { notify } from "./notifications";
import { loadFees } from "./settings";

const usd = (c: number) => `$${dollars(c).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });
/** Where clients open their pay link: the public website host in production (the app itself is behind sign-in). */
const payOrigin = (env: AppEnv) => (env.WEBSITE_HOSTS ? publicAssetOrigin(env) : env.APP_ORIGIN ?? "https://app.mkbfinancialgroup.com");
export const stripeReady = (env: AppEnv) => !!env.STRIPE_SECRET_KEY;

async function pdfFor(env: AppEnv, r: InvoiceRow, payUrl?: string) {
  const c = await one<{ name: string; contact_name: string | null; address: string | null }>(env.DB, "SELECT name, contact_name, address FROM clients WHERE id = ?", r.client_id);
  const addr = json<{ line1?: string; city?: string; state?: string; zip?: string }>(c?.address, {});
  const fees = await loadFees(env);
  const inv = toInvoice(r);
  return buildInvoicePdf({
    number: r.number, issuedAt: r.issued_at, dueAt: r.due_at, status: r.status, paymentMode: r.payment_mode,
    billTo: [c?.name ?? "Client", c?.contact_name ? `Attn: ${c.contact_name}` : "", addr.line1 ?? "", [addr.city, [addr.state, addr.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")],
    lines: inv.lines ?? [], total: inv.amount, paid: inv.paid, adjustments: (inv.adjustments ?? []).map((a) => ({ kind: a.kind, amount: a.amount, note: a.note })),
    payUrl, payNote: fees.invoiceText.upfrontNote, disclosure: fees.invoiceText.bankDisclosure.replace(/\{\{bank\}\}/g, fees.taxPartners.bankProduct || "the bank"),
  });
}
const fileName = (r: InvoiceRow) => `MKB-Invoice-${r.number}.pdf`;

export async function downloadInvoice(env: AppEnv, a: Actor, id: string, inline: boolean) {
  const r = await getInvoiceRow(env, a, id);
  const bytes = await pdfFor(env, r);
  await audit(env.DB, a, { action: "Record update", resource: `Invoice ${r.number}`, meta: inline ? "Viewed PDF" : "Downloaded PDF" });
  return new Response(bytes as unknown as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `${inline ? "inline" : "attachment"}; filename="${fileName(r)}"`, "cache-control": "private, no-store" } });
}

/** Sends (or resends) the invoice: marks it open, makes a fresh private pay link, emails the PDF. */
export async function sendInvoice(env: AppEnv, a: Actor, id: string) {
  const r = await getInvoiceRow(env, a, id);
  if (a.kind !== "staff") throw badRequest("Staff only.");
  if (r.status === "void") throw badRequest("This invoice is void.");
  const c = await one<{ name: string; contact_name: string | null; email: string | null }>(env.DB, "SELECT name, contact_name, email FROM clients WHERE id = ?", r.client_id);
  if (!c?.email) throw badRequest("This client has no email address on file.");
  if (!(await rateLimit(env.DB, `invmail:${id}`, 6, 60))) throw new HttpError(429, "Too many emails for this invoice in the last hour.", "rate_limited");
  const owed = r.amount_cents - r.paid_cents;
  // A new link each time; older links stop working.
  const token = owed > 0 && r.payment_mode === "upfront" ? randomToken(24) : null;
  const payUrl = token ? `${payOrigin(env)}/api/public/pay/${token}` : undefined;
  const t = now();
  await run(env.DB, "UPDATE invoices SET status = CASE WHEN status = 'draft' THEN 'open' ELSE status END, sent_at = ?, pay_token_hash = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", t, token ? await sha256(token) : null,
    JSON.stringify([{ at: t, by: a.member.id, text: r.sent_at ? "Resent to the client" : "Sent to the client" }, ...json<unknown[]>(r.history, [])].slice(0, 200)), t, id);
  const fresh = (await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id))!;
  const pdf = await pdfFor(env, fresh, payUrl);
  const first = (c.contact_name || c.name).trim().split(/\s+/)[0];
  const payNote = r.payment_mode === "bank_product" ? "These fees will be taken out of your refund — no payment is due now unless your refund can't cover them." : owed > 0 ? `It's due ${longDate(r.due_at)}. You can pay securely online with the button below.` : "It's paid in full — thank you.";
  const out = await sendTemplate(env, "invoice_sent", { to: c.email, vars: { firstName: first, number: r.number, amount: usd(r.amount_cents), dueDate: longDate(r.due_at), payNote }, attachments: [{ filename: fileName(r), content: pdf }], buttonUrl: payUrl });
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'invoice', ?, 'staff', ?, ?)", randomId("x"), r.client_id, `${r.sent_at ? "Resent" : "Sent"} invoice ${r.number} to ${c.email}${out.sent ? "" : " (queued)"}`, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `Invoice ${r.number}`, meta: `${r.sent_at ? "Resent" : "Sent"} by email${out.sent ? "" : " (queued)"}` });
  return { invoice: toInvoice(fresh), sent: out.sent, payLink: !!payUrl, stripe: stripeReady(env) };
}

/* ---------------------------------------------------------------- client pay link */
const page = (title: string, body: string, status = 200) => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#f7f6f2;font:16px/1.6 Arial,sans-serif;color:#111}.b{background:#0b0b0b;color:#fff;padding:18px 22px;font:600 18px Georgia,serif}.bar{height:4px;background:#b87912}.c{max-width:520px;margin:32px auto;padding:0 18px}h1{font:500 26px Georgia,serif}</style></head><body><div class="b">${FIRM.name}</div><div class="bar"></div><div class="c"><h1>${title}</h1>${body}<p style="color:#555;font-size:14px">Questions? Call ${FIRM.phone}.</p></div></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

/** Opens Stripe Checkout for what's still owed. No sign-in: the long random link is the key, and it changes on every resend. */
export async function publicPay(env: AppEnv, token: string, ip: string, done: boolean) {
  if (done) return page("Thank you", "<p>Your payment was received. It can take a minute to show on your account. You'll get a receipt by email.</p>");
  if (!(await rateLimit(env.DB, `pay-ip:${ip}`, 30, 10))) return page("Please try again shortly", "<p>Too many attempts. Wait a few minutes and try again.</p>", 429);
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return page("Link not valid", "<p>This payment link isn't valid. Please use the newest invoice email.</p>", 404);
  const r = await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE pay_token_hash = ?", await sha256(token));
  if (!r || r.status === "void") return page("Link not valid", "<p>This payment link has expired or been replaced. Please use the newest invoice email, or call us.</p>", 404);
  const owed = r.amount_cents - r.paid_cents;
  if (owed <= 0) return page("Already paid", `<p>Invoice ${r.number} is paid in full. Thank you!</p>`);
  if (!stripeReady(env)) return page("Online payment isn't available yet", `<p>Please pay invoice ${r.number} (${usd(owed)}) at our office, or call us.</p>`, 503);
  const base = `${payOrigin(env)}/api/public/pay/${token}`;
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(owed),
    "line_items[0][price_data][product_data][name]": `Invoice ${r.number} — ${FIRM.name}`,
    "metadata[invoice_id]": r.id,
    "payment_intent_data[metadata][invoice_id]": r.id,
    "payment_intent_data[description]": `Invoice ${r.number}`,
    client_reference_id: r.id,
    success_url: `${base}?done=1`,
    cancel_url: base.replace(/\/api\/public\/pay\/.*/, "/"),
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" }, body: form });
  const s = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !s.url) { console.error("stripe checkout", res.status, s.error?.message); return page("Payment page unavailable", "<p>We couldn't open the payment page right now. Please try again later or call us.</p>", 502); }
  return Response.redirect(s.url, 303);
}

/* ---------------------------------------------------------------- Stripe webhook */
async function hmacHex(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verifies Stripe's signature, then records completed checkout payments (once each). */
export async function stripeWebhook(env: AppEnv, req: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new HttpError(503, "Webhook not configured.");
  const raw = await req.text();
  if (raw.length > 512_000) throw badRequest("Too large.");
  const sig = req.headers.get("stripe-signature") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const all = sig.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) throw new HttpError(400, "Stale or missing signature.");
  const expected = await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${t}.${raw}`);
  if (!all.some((v) => safeEqual(v, expected))) throw new HttpError(400, "Bad signature.");
  const evt = JSON.parse(raw) as { type: string; data: { object: { id: string; payment_status?: string; amount_total?: number; payment_intent?: string; metadata?: Record<string, string> } } };
  if (evt.type !== "checkout.session.completed" && evt.type !== "checkout.session.async_payment_succeeded") return { received: true };
  const s = evt.data.object;
  if (s.payment_status !== "paid") return { received: true };
  const id = s.metadata?.invoice_id;
  const r = id ? await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id) : null;
  if (!r) throw notFound("Invoice not found.");
  const ref = s.payment_intent ?? s.id;
  // Stripe may send the same event more than once: record it (and ring the bell) only the first time.
  if (await one(env.DB, "SELECT 1 FROM payments WHERE source = 'stripe' AND reference = ?", ref)) return { received: true, duplicate: true };
  try {
    const owed = r.amount_cents - r.paid_cents;
    const amt = Math.min(s.amount_total ?? 0, owed);
    if (amt > 0) await applyPayment(env, r, { amountCents: amt, method: "Card / bank (Stripe)", source: "stripe", reference: ref, receivedAt: now() });
    else return { received: true, nothingOwed: true };
  } catch (e) {
    if (e instanceof HttpError && e.code === "duplicate") return { received: true, duplicate: true };
    throw e;
  }
  await notify(env, { module: "billing" }, { kind: "payment", title: `Payment received: ${r.number} (${usd(s.amount_total ?? 0)})`, body: "Paid online through Stripe.", href: `/billing?invoice=${r.id}` });
  return { received: true };
}
