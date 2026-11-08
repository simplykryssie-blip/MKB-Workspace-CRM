/**
 * Billing — invoices and payments are server records. The browser asks for
 * changes; the server checks permission, computes totals from the lines,
 * numbers invoices, and keeps a history of every change. Amounts are stored
 * in cents. Server-only.
 */
import type { Invoice, InvoiceLine, ServiceKey } from "@/lib/types";
import { canDo } from "@/lib/team/policy";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, run, str, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { audit, requireStaff, type Actor } from "./identity";
import { loadFees } from "./settings";

type Staff = Extract<Actor, { kind: "staff" }>;
export type InvoiceRow = {
  id: string; number: string; client_id: string; service: ServiceKey; tax_return_id: string | null; workspace_id: string | null; biz_request_id: string | null; exp_matter_id: string | null;
  description: string; payment_mode: "upfront" | "bank_product"; status: Invoice["status"]; lines: string; amount_cents: number; paid_cents: number; issued_at: string; due_at: string;
  sent_at: string | null; paid_at: string | null; voided_at: string | null; void_reason: string | null; adjustments: string; history: string; bureau: string | null; pay_token_hash: string | null; late_fee_at: string | null; created_at: string; rev: number;
};
export type BureauFee = { code: string; label: string; amount: number; applies: "all" | "bank_product" };

const SERVICES: ServiceKey[] = ["tax", "books", "biz", "expunge"];
const KINDS: InvoiceLine["kind"][] = ["service", "additional", "filing", "third_party", "discount", "clerk", "government", "records", "backend", "late_fee"];
export const cents = (d: number) => Math.round(d * 100);
const dollars = (c: number) => Math.round(c) / 100;

export const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id, number: r.number, service: r.service, description: r.description, amount: dollars(r.amount_cents), paid: dollars(r.paid_cents),
  status: r.status !== "void" && r.status !== "draft" && r.status !== "paid" && r.paid_cents === 0 && r.due_at < now() ? "overdue" : r.status,
  issuedAt: r.issued_at, dueAt: r.due_at, taxReturnId: r.tax_return_id ?? undefined, workspaceId: r.workspace_id ?? undefined, bizRequestId: r.biz_request_id ?? undefined, expMatterId: r.exp_matter_id ?? undefined,
  lines: json<InvoiceLine[]>(r.lines, []), paidAt: r.paid_at ?? undefined, adjustments: json(r.adjustments, []), paymentMode: r.payment_mode, sentAt: r.sent_at ?? undefined,
  voidedAt: r.voided_at ?? undefined, voidReason: r.void_reason ?? undefined, history: json(r.history, []), bureau: r.bureau ?? undefined, lateFeeAt: r.late_fee_at ?? undefined, rev: r.rev,
});

/* ---------------------------------------------------------------- access */
/** Billing staff, or tax staff who can edit returns (for tax invoices). */
function canBill(a: Staff, service: ServiceKey | "any", action: "view" | "create" | "edit" | "approve" | "settings") {
  if (canDo(a.policy, a.member, "billing", action)) return true;
  return (service === "tax" || service === "any") && action !== "settings" && action !== "approve" && canDo(a.policy, a.member, "tax", "edit");
}
function need(a: Actor, service: ServiceKey | "any", action: Parameters<typeof canBill>[2]): asserts a is Staff {
  requireStaff(a);
  if (!canBill(a, service, action)) throw forbidden("Your role can't do that in billing.");
}
async function clientFor(env: AppEnv, a: Staff, clientId: string) {
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
  if (!c || !(await canOpen(env, a, c))) throw notFound("Client not found.");
  return c;
}
async function rowFor(env: AppEnv, a: Staff, id: string) {
  const r = await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id);
  if (!r) throw notFound("Invoice not found.");
  await clientFor(env, a, r.client_id);
  return r;
}

/** Invoices for clients the person can open (optionally one client). */
export async function listInvoices(env: AppEnv, a: Actor, clientId?: string) {
  need(a, "any", "view");
  const rows = clientId
    ? await all<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE client_id = ? ORDER BY issued_at DESC", clientId)
    : await all<InvoiceRow>(env.DB, "SELECT * FROM invoices ORDER BY issued_at DESC LIMIT 5000");
  const ids = [...new Set(rows.map((r) => r.client_id))];
  const clients = ids.length ? await all<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id IN (${ids.map(() => "?").join(",")})`, ...ids) : [];
  const ok = new Map<string, string>();
  for (const c of clients) if (await canOpen(env, a, c)) ok.set(c.id, c.name);
  const full = canDo(a.policy, a.member, "billing", "view");
  return { invoices: rows.filter((r) => ok.has(r.client_id) && (full || r.service === "tax")).map((r) => ({ ...toInvoice(r), clientId: r.client_id, clientName: ok.get(r.client_id)! })) };
}

/** Invoices for the client profile (used when loading full client records). */
export async function invoicesByClient(env: AppEnv, ids: string[]) {
  if (!ids.length) return new Map<string, Invoice[]>();
  const rows = await all<InvoiceRow>(env.DB, `SELECT * FROM invoices WHERE client_id IN (${ids.map(() => "?").join(",")}) ORDER BY issued_at DESC`, ...ids);
  const m = new Map<string, Invoice[]>();
  for (const r of rows) m.set(r.client_id, [...(m.get(r.client_id) ?? []), toInvoice(r)]);
  return m;
}

/* ---------------------------------------------------------------- back-end fees */
export async function listBureauFees(env: AppEnv, bureau: string): Promise<BureauFee[]> {
  return (await all<{ code: string; label: string; amount_cents: number; applies: BureauFee["applies"] }>(env.DB, "SELECT code, label, amount_cents, applies FROM bureau_fees WHERE bureau = ? ORDER BY position", bureau)).map((f) => ({ code: f.code, label: f.label, amount: dollars(f.amount_cents), applies: f.applies }));
}
export async function getBureauFees(env: AppEnv, a: Actor, bureau: string) {
  need(a, "any", "view");
  const bureaus = (await all<{ bureau: string }>(env.DB, "SELECT DISTINCT bureau FROM bureau_fees ORDER BY bureau")).map((b) => b.bureau);
  return { bureau, bureaus, fees: await listBureauFees(env, bureau) };
}
export async function saveBureauFees(env: AppEnv, a: Actor, bureau: string, b: { fees?: unknown }) {
  need(a, "any", "settings");
  const name = str(bureau, 80).trim();
  if (!name) throw badRequest("Name the service bureau.");
  const list = Array.isArray(b.fees) ? b.fees : [];
  if (list.length > 40) throw badRequest("Up to 40 back-end fees per bureau.");
  const fees = list.map((f, i) => {
    const x = f as Partial<BureauFee>;
    const label = str(x.label, 120).trim();
    const amount = Number(x.amount);
    if (!label || !isFinite(amount) || amount < 0 || amount > 10_000) throw badRequest(`Check fee ${i + 1}: it needs a name and an amount.`);
    return { code: str(x.code, 30).trim() || `F${i + 1}`, label, amount_cents: cents(amount), applies: x.applies === "all" ? "all" : "bank_product", position: i };
  });
  if (new Set(fees.map((f) => f.code)).size !== fees.length) throw badRequest("Fee codes must be different.");
  await env.DB.batch([env.DB.prepare("DELETE FROM bureau_fees WHERE bureau = ?").bind(name), ...fees.map((f) => env.DB.prepare("INSERT INTO bureau_fees (bureau, code, label, amount_cents, applies, position) VALUES (?, ?, ?, ?, ?, ?)").bind(name, f.code, f.label, f.amount_cents, f.applies, f.position))]);
  await audit(env.DB, a, { action: "Record update", resource: `Back-end fees — ${name}`, meta: `${fees.length} fees` });
  return getBureauFees(env, a, name);
}

/* ---------------------------------------------------------------- invoices */
type Draft = { clientId?: unknown; service?: unknown; description?: unknown; lines?: unknown; amount?: unknown; dueAt?: unknown; draft?: unknown; paymentMode?: unknown; bureau?: unknown; taxReturnId?: unknown; workspaceId?: unknown; bizRequestId?: unknown; expMatterId?: unknown };

function cleanLines(v: unknown): InvoiceLine[] {
  const list = Array.isArray(v) ? v : [];
  if (list.length > 60) throw badRequest("Too many invoice lines.");
  return list.map((l, i) => {
    const x = l as Partial<InvoiceLine>;
    const label = str(x.label, 200).trim();
    const amount = Number(x.amount);
    if (!label || !isFinite(amount) || Math.abs(amount) > 1_000_000) throw badRequest(`Check line ${i + 1}.`);
    return { label, amount: dollars(cents(amount)), kind: KINDS.includes(x.kind as InvoiceLine["kind"]) ? (x.kind as InvoiceLine["kind"]) : "service" };
  });
}
const total = (lines: InvoiceLine[]) => lines.reduce((s, l) => s + cents(l.amount), 0);
const hist = (h: string, by: string, text: string) => JSON.stringify([{ at: now(), by, text }, ...json<unknown[]>(h, [])].slice(0, 200));

async function nextNumber(env: AppEnv) {
  const y = new Date().getFullYear();
  await run(env.DB, "INSERT INTO invoice_counters (year, next) VALUES (?, 1) ON CONFLICT(year) DO NOTHING", y);
  const r = await one<{ next: number }>(env.DB, "UPDATE invoice_counters SET next = next + 1 WHERE year = ? RETURNING next - 1 AS next", y);
  return `INV-${y}-${String(r!.next).padStart(4, "0")}`;
}

/** Adds the bureau's back-end fees (bank product invoices get all; upfront invoices only the 'all' ones). */
async function withBackendFees(env: AppEnv, lines: InvoiceLine[], mode: "upfront" | "bank_product", bureau: string | null) {
  if (!bureau) return lines;
  const fees = (await listBureauFees(env, bureau)).filter((f) => f.applies === "all" || mode === "bank_product");
  const base = lines.filter((l) => l.kind !== "backend");
  return [...base, ...fees.map((f): InvoiceLine => ({ label: f.label, amount: f.amount, kind: "backend" }))];
}

export async function createInvoice(env: AppEnv, a: Actor, b: Draft) {
  const service = SERVICES.includes(b.service as ServiceKey) ? (b.service as ServiceKey) : null;
  if (!service) throw badRequest("Choose the service.");
  need(a, service, "create");
  const clientId = str(b.clientId, 80);
  await clientFor(env, a, clientId);
  const mode = b.paymentMode === "bank_product" ? "bank_product" : "upfront";
  if (mode === "bank_product" && service !== "tax") throw badRequest("Bank products are only for tax returns.");
  // Back-end fees come from the service bureau in Settings (staff only), unless one is named.
  const bureau = service === "tax" ? str(b.bureau, 80).trim() || (await loadFees(env)).taxPartners.serviceBureau || null : null;
  let lines = cleanLines(b.lines);
  if (!lines.length) { const amt = Number(b.amount); if (!isFinite(amt) || amt <= 0) throw badRequest("Add at least one line."); lines = [{ label: str(b.description, 200) || "Services", amount: dollars(cents(amt)), kind: "service" }]; }
  if (service === "tax") lines = await withBackendFees(env, lines, mode, bureau);
  const amount = total(lines);
  if (amount <= 0) throw badRequest("The invoice total must be more than $0.");
  const due = str(b.dueAt, 40);
  if (!/^\d{4}-\d{2}-\d{2}/.test(due)) throw badRequest("Choose a due date.");
  const taxReturnId = b.taxReturnId ? str(b.taxReturnId, 120) : null;
  if (taxReturnId && !(await one(env.DB, "SELECT 1 FROM tax_returns WHERE id = ? AND client_id = ?", taxReturnId, clientId))) throw badRequest("That return belongs to another client.");
  const id = randomId("inv");
  const number = await nextNumber(env);
  const t = now();
  const status = b.draft === true ? "draft" : "open";
  await run(env.DB, "INSERT INTO invoices (id, number, client_id, service, tax_return_id, workspace_id, biz_request_id, exp_matter_id, description, payment_mode, status, lines, amount_cents, paid_cents, issued_at, due_at, sent_at, history, bureau, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?, ?, ?, ?)",
    id, number, clientId, service, taxReturnId, b.workspaceId ? str(b.workspaceId, 120) : null, b.bizRequestId ? str(b.bizRequestId, 120) : null, b.expMatterId ? str(b.expMatterId, 120) : null,
    str(b.description, 300) || lines[0].label, mode, status, JSON.stringify(lines), amount, t, due, hist("[]", a.member.id, `Created${status === "draft" ? " as a draft" : ""}${mode === "bank_product" ? " — paid from refund (bank product)" : ""}`), bureau, t, a.member.id, t);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'invoice', ?, 'staff', ?, ?)", randomId("x"), clientId, `${status === "draft" ? "Drafted" : "Created"} invoice ${number} — $${dollars(amount).toFixed(2)}`, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `Invoice ${number}`, meta: `Created ($${dollars(amount).toFixed(2)})` });
  return { invoice: toInvoice((await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id))!) };
}

/** Edit an invoice that has no payments yet (lines, description, due date, payment method). */
export async function updateInvoice(env: AppEnv, a: Actor, id: string, b: Draft & { rev?: unknown }) {
  requireStaff(a);
  const r = await rowFor(env, a, id);
  need(a, r.service, "edit");
  if (r.status === "void") throw badRequest("This invoice is void.");
  if (r.paid_cents > 0) throw badRequest("This invoice has payments. Use a credit or correction instead of editing it.");
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Someone else changed this invoice. Reloading.", "conflict");
  const mode = b.paymentMode === "bank_product" || b.paymentMode === "upfront" ? b.paymentMode : r.payment_mode;
  if (mode === "bank_product" && r.service !== "tax") throw badRequest("Bank products are only for tax returns.");
  const bureau = r.service === "tax" ? (b.bureau !== undefined ? str(b.bureau, 80).trim() || null : r.bureau) : null;
  let lines = b.lines !== undefined ? cleanLines(b.lines) : json<InvoiceLine[]>(r.lines, []);
  if (r.service === "tax" && (mode !== r.payment_mode || bureau !== r.bureau || b.lines !== undefined)) lines = await withBackendFees(env, lines, mode, bureau);
  const amount = total(lines);
  if (amount <= 0) throw badRequest("The invoice total must be more than $0.");
  const due = b.dueAt !== undefined ? str(b.dueAt, 40) : r.due_at;
  if (!/^\d{4}-\d{2}-\d{2}/.test(due)) throw badRequest("Choose a due date.");
  const desc = b.description !== undefined ? str(b.description, 300) || lines[0].label : r.description;
  const what = [amount !== r.amount_cents && `total $${dollars(r.amount_cents).toFixed(2)} → $${dollars(amount).toFixed(2)}`, mode !== r.payment_mode && (mode === "bank_product" ? "now paid from refund" : "now pay upfront"), due !== r.due_at && "due date", desc !== r.description && "description"].filter(Boolean).join(", ") || "lines";
  const res = await run(env.DB, "UPDATE invoices SET description = ?, payment_mode = ?, bureau = ?, lines = ?, amount_cents = ?, due_at = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", desc, mode, bureau, JSON.stringify(lines), amount, due, hist(r.history, a.member.id, `Edited: ${what}`), now(), id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Someone else changed this invoice. Reloading.", "conflict");
  await audit(env.DB, a, { action: "Record update", resource: `Invoice ${r.number}`, meta: `Edited: ${what}` });
  return { invoice: toInvoice((await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id))!) };
}

/** Recalculates paid amount and status from the payments table (never trusts a running total). */
async function settle(env: AppEnv, id: string) {
  const r = (await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id))!;
  const p = (await one<{ s: number | null }>(env.DB, "SELECT sum(amount_cents) s FROM payments WHERE invoice_id = ?", id))?.s ?? 0;
  const status = r.status === "void" ? "void" : r.status === "draft" && p === 0 ? "draft" : p >= r.amount_cents ? "paid" : p > 0 ? "partial" : "open";
  await run(env.DB, "UPDATE invoices SET paid_cents = ?, status = ?, paid_at = CASE WHEN ? = 'paid' THEN coalesce(paid_at, ?) ELSE NULL END, updated_at = ?, rev = rev + 1 WHERE id = ?", p, status, status, now(), now(), id);
  return (await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id))!;
}

/** Records a payment. Used by staff, the Stripe webhook and approved bank imports. */
export async function applyPayment(env: AppEnv, r: InvoiceRow, p: { amountCents: number; method: string; source: "manual" | "stripe" | "bank_import"; reference?: string; receivedAt?: string; by?: string; note?: string }) {
  if (r.status === "void") throw badRequest("This invoice is void.");
  if (p.amountCents <= 0) throw badRequest("Enter an amount.");
  if (p.amountCents > r.amount_cents - r.paid_cents) throw badRequest(`That's more than the $${dollars(r.amount_cents - r.paid_cents).toFixed(2)} still owed.`);
  try {
    await run(env.DB, "INSERT INTO payments (id, invoice_id, client_id, amount_cents, method, source, reference, received_at, recorded_at, recorded_by, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", randomId("pay"), r.id, r.client_id, p.amountCents, p.method, p.source, p.reference ?? null, p.receivedAt ?? now(), now(), p.by ?? null, p.note ?? null);
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new HttpError(409, "This payment was already recorded.", "duplicate");
    throw e;
  }
  const after = await settle(env, r.id);
  await run(env.DB, "UPDATE invoices SET history = ? WHERE id = ?", hist(after.history, p.by ?? "system", `Payment $${dollars(p.amountCents).toFixed(2)} (${p.method})${after.status === "paid" ? " — paid in full" : ""}`), r.id);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'payment', ?, ?, ?, ?)", randomId("x"), r.client_id, `Payment of $${dollars(p.amountCents).toFixed(2)} on ${r.number} (${p.method})`, p.source === "stripe" ? "client" : "staff", p.by ?? null, now());
  return after;
}

export async function recordPayment(env: AppEnv, a: Actor, id: string, b: { amount?: unknown; method?: unknown; reference?: unknown; receivedAt?: unknown; note?: unknown }) {
  requireStaff(a);
  const r = await rowFor(env, a, id);
  need(a, r.service, "edit");
  const amt = cents(Number(b.amount));
  const method = str(b.method, 40) || "Other";
  const received = typeof b.receivedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(b.receivedAt) ? b.receivedAt : now();
  const after = await applyPayment(env, r, { amountCents: amt, method, source: "manual", reference: str(b.reference, 120) || undefined, receivedAt: received, by: a.member.id, note: str(b.note, 300) || undefined });
  await audit(env.DB, a, { action: "Record update", resource: `Invoice ${r.number}`, meta: `Payment recorded $${dollars(amt).toFixed(2)} (${method})` });
  return { invoice: toInvoice(after) };
}

/** Refund (money returned), credit (owed less) or correction (total changes). */
export async function adjustInvoice(env: AppEnv, a: Actor, id: string, b: { kind?: unknown; amount?: unknown; note?: unknown }) {
  requireStaff(a);
  const r = await rowFor(env, a, id);
  need(a, r.service, "edit");
  if (!canDo(a.policy, a.member, "billing", "edit") && b.kind === "refund") throw forbidden("Refunds need billing permission.");
  const kind = b.kind === "refund" || b.kind === "credit" || b.kind === "correction" ? b.kind : null;
  const amt = cents(Number(b.amount));
  const note = str(b.note, 300).trim();
  if (!kind || !isFinite(amt) || amt === 0 || !note) throw badRequest("Choose the type, amount and a reason.");
  if (r.status === "void") throw badRequest("This invoice is void.");
  let amount = r.amount_cents;
  if (kind === "correction") amount = r.amount_cents + amt;
  else amount = r.amount_cents - Math.abs(amt);
  if (amount < 0) throw badRequest("That would make the invoice negative.");
  const stmts = [];
  if (kind === "refund") {
    if (Math.abs(amt) > r.paid_cents) throw badRequest("You can't refund more than was paid.");
    stmts.push(env.DB.prepare("INSERT INTO payments (id, invoice_id, client_id, amount_cents, method, source, reference, received_at, recorded_at, recorded_by, note) VALUES (?, ?, ?, ?, 'Refund', 'manual', NULL, ?, ?, ?, ?)").bind(randomId("pay"), r.id, r.client_id, -Math.abs(amt), now(), now(), a.member.id, note));
  }
  if (amount < r.paid_cents - (kind === "refund" ? Math.abs(amt) : 0)) throw badRequest("The total can't go below what's already been paid. Record a refund first.");
  const adj = [{ id: randomId("adj"), kind, amount: dollars(Math.abs(amt)) * (kind === "correction" && amt < 0 ? -1 : 1), note, at: now(), byId: a.member.id }, ...json<unknown[]>(r.adjustments, [])];
  stmts.push(env.DB.prepare("UPDATE invoices SET amount_cents = ?, adjustments = ?, history = ?, updated_at = ? WHERE id = ?").bind(amount, JSON.stringify(adj), hist(r.history, a.member.id, `${kind[0].toUpperCase()}${kind.slice(1)} $${dollars(Math.abs(amt)).toFixed(2)} — ${note}`), now(), r.id));
  await env.DB.batch(stmts);
  const after = await settle(env, r.id);
  await audit(env.DB, a, { action: "Record update", resource: `Invoice ${r.number}`, meta: `${kind} $${dollars(Math.abs(amt)).toFixed(2)}: ${note}` });
  return { invoice: toInvoice(after) };
}

export async function voidInvoice(env: AppEnv, a: Actor, id: string, b: { reason?: unknown }) {
  requireStaff(a);
  const r = await rowFor(env, a, id);
  need(a, r.service, "edit");
  const reason = str(b.reason, 300).trim();
  if (!reason) throw badRequest("Give a reason for voiding.");
  if (r.paid_cents > 0) throw badRequest("Refund the payments before voiding this invoice.");
  if (r.status === "void") return { invoice: toInvoice(r) };
  await run(env.DB, "UPDATE invoices SET status = 'void', voided_at = ?, void_reason = ?, pay_token_hash = NULL, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", now(), reason, hist(r.history, a.member.id, `Voided — ${reason}`), now(), id);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'invoice', ?, 'staff', ?, ?)", randomId("x"), r.client_id, `Voided invoice ${r.number} — ${reason}`, a.member.id, now());
  await audit(env.DB, a, { action: "Record update", resource: `Invoice ${r.number}`, meta: `Voided: ${reason}` });
  return { invoice: toInvoice((await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id))!) };
}

export async function getInvoiceRow(env: AppEnv, a: Actor, id: string) {
  requireStaff(a);
  const r = await rowFor(env, a, id);
  need(a, r.service, "view");
  return r;
}
export async function invoicePayments(env: AppEnv, id: string) {
  return (await all<{ id: string; amount_cents: number; method: string; source: string; reference: string | null; received_at: string; note: string | null }>(env.DB, "SELECT id, amount_cents, method, source, reference, received_at, note FROM payments WHERE invoice_id = ? ORDER BY received_at DESC", id)).map((p) => ({ id: p.id, amount: dollars(p.amount_cents), method: p.method, source: p.source, reference: p.reference ?? undefined, receivedAt: p.received_at, note: p.note ?? undefined }));
}
export { dollars };
