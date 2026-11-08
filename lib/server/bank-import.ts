/**
 * Bank CSV import: upload a bank (or refund-transfer report) CSV, see each
 * deposit matched to an unpaid invoice, then approve — only approved rows mark
 * invoices paid. A deposit can only ever be applied once. Server-only.
 */
import { all, badRequest, forbidden, json, notFound, now, one, run, type AppEnv } from "./core";
import { randomId, sha256 } from "./crypto";
import { canDo } from "@/lib/team/policy";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { applyPayment, cents, dollars, type InvoiceRow } from "./billing";
import { audit, requireStaff, type Actor } from "./identity";

export type ImportRow = { n: number; date: string; amount: number; description: string; ref: string; invoiceId?: string; match?: "name_amount" | "amount" | "manual"; applied?: boolean; error?: string };

function needApprove(a: Actor): asserts a is Extract<Actor, { kind: "staff" }> {
  requireStaff(a);
  if (!canDo(a.policy, a.member, "billing", "approve")) throw forbidden("Bank imports need the billing approve permission.");
}

/** Splits one CSV line (handles quoted commas and "" escapes). */
function cells(line: string) {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}
const money = (s: string) => { const neg = /^\(.*\)$/.test(s.trim()) || s.trim().startsWith("-"); const v = Number(s.replace(/[^0-9.]/g, "")); return isFinite(v) ? (neg ? -v : v) : NaN; };
const isoDate = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); };
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);

/** Reads deposits from common bank CSV layouts (Date, Description, Amount — or Credit/Debit columns). */
export function parseBankCsv(text: string): Omit<ImportRow, "ref">[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw badRequest("The file has no rows.");
  if (lines.length > 5000) throw badRequest("Up to 5,000 rows per file.");
  const head = cells(lines[0]).map((h) => h.toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = col("date", "posted");
  const iDesc = col("description", "memo", "payee", "details", "name", "taxpayer");
  const iAmt = col("amount");
  const iCredit = col("credit", "deposit");
  if (iDate < 0 || (iAmt < 0 && iCredit < 0)) throw badRequest("Couldn't find Date and Amount (or Credit) columns. Export the file as CSV from your bank.");
  const rows: Omit<ImportRow, "ref">[] = [];
  lines.slice(1).forEach((l, k) => {
    const c = cells(l);
    const amount = iCredit >= 0 && c[iCredit] ? money(c[iCredit]) : money(c[iAmt] ?? "");
    const date = isoDate(c[iDate] ?? "");
    if (!date || !(amount > 0)) return; // deposits only
    rows.push({ n: k + 2, date, amount: dollars(cents(amount)), description: (iDesc >= 0 ? c[iDesc] : c.filter((_, j) => j !== iDate && j !== iAmt && j !== iCredit).join(" ")).slice(0, 300) });
  });
  if (!rows.length) throw badRequest("No deposits found in this file.");
  return rows;
}

async function openInvoices(env: AppEnv, a: Extract<Actor, { kind: "staff" }>) {
  const inv = await all<InvoiceRow & { c_name: string }>(env.DB, "SELECT i.*, c.name AS c_name FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.status IN ('open', 'partial', 'draft') AND i.amount_cents > i.paid_cents");
  const ids = [...new Set(inv.map((i) => i.client_id))];
  const clients = ids.length ? await all<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id IN (${ids.map(() => "?").join(",")})`, ...ids) : [];
  const ok = new Set<string>();
  for (const c of clients) if (await canOpen(env, a, c)) ok.add(c.id);
  return inv.filter((i) => ok.has(i.client_id));
}

/** Suggests an invoice for each deposit: same balance + client name in the description, else a unique balance match. */
function suggest(rows: ImportRow[], inv: (InvoiceRow & { c_name: string })[]) {
  const used = new Set<string>();
  for (const r of rows) {
    const same = inv.filter((i) => !used.has(i.id) && i.amount_cents - i.paid_cents === cents(r.amount));
    const d = new Set(words(r.description));
    const byName = same.filter((i) => words(i.c_name).some((w) => d.has(w)));
    const pick = byName.length === 1 ? byName[0] : !byName.length && same.length === 1 ? same[0] : undefined;
    if (pick) { r.invoiceId = pick.id; r.match = byName.length ? "name_amount" : "amount"; used.add(pick.id); }
  }
  return rows;
}

const view = (inv: (InvoiceRow & { c_name: string })[]) => inv.map((i) => ({ id: i.id, number: i.number, clientName: i.c_name, balance: dollars(i.amount_cents - i.paid_cents), paymentMode: i.payment_mode }));

export async function uploadBankCsv(env: AppEnv, a: Actor, b: { fileName?: unknown; text?: unknown }) {
  needApprove(a);
  const text = typeof b.text === "string" ? b.text : "";
  if (!text || text.length > 2_000_000) throw badRequest("Choose a CSV file under 2 MB.");
  const parsed = parseBankCsv(text);
  const fileName = (typeof b.fileName === "string" ? b.fileName : "bank.csv").slice(0, 120);
  // A stable reference per deposit so the same row in a later file can't be applied twice.
  const rows: ImportRow[] = await Promise.all(parsed.map(async (r) => ({ ...r, ref: (await sha256(`${r.date}|${r.amount}|${r.description}`)).slice(0, 32) })));
  const inv = await openInvoices(env, a);
  suggest(rows, inv);
  const id = randomId("imp");
  await run(env.DB, "INSERT INTO bank_imports (id, file_name, rows, status, uploaded_at, uploaded_by) VALUES (?, ?, ?, 'pending', ?, ?)", id, fileName, JSON.stringify(rows), now(), a.member.id);
  await audit(env.DB, a, { action: "Record update", resource: "Bank import", meta: `Uploaded ${fileName} (${rows.length} deposits, ${rows.filter((r) => r.invoiceId).length} matched)` });
  return { id, fileName, rows, invoices: view(inv) };
}

/** Applies the approved matches. Each row: { n, invoiceId } (or no invoiceId to skip). */
export async function approveImport(env: AppEnv, a: Actor, id: string, b: { matches?: unknown }) {
  needApprove(a);
  const imp = await one<{ rows: string; status: string; file_name: string }>(env.DB, "SELECT rows, status, file_name FROM bank_imports WHERE id = ?", id);
  if (!imp) throw notFound("Import not found.");
  if (imp.status !== "pending") throw badRequest("This import was already decided.");
  const rows = json<ImportRow[]>(imp.rows, []);
  const picks = new Map((Array.isArray(b.matches) ? b.matches : []).map((m) => [Number((m as { n: unknown }).n), String((m as { invoiceId?: unknown }).invoiceId ?? "")]));
  let applied = 0;
  for (const r of rows) {
    const invId = picks.get(r.n);
    if (!invId) continue;
    if (invId !== r.invoiceId) r.match = "manual";
    r.invoiceId = invId;
    const inv = await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", invId);
    const c = inv ? await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, inv.client_id) : null;
    if (!inv || !c || !(await canOpen(env, a, c))) { r.error = "Invoice not found"; continue; }
    try {
      await applyPayment(env, inv, { amountCents: Math.min(cents(r.amount), inv.amount_cents - inv.paid_cents), method: inv.payment_mode === "bank_product" ? "Refund transfer deposit" : "Bank deposit", source: "bank_import", reference: r.ref, receivedAt: r.date, by: a.member.id, note: `${imp.file_name}, row ${r.n}: ${r.description}`.slice(0, 300) });
      r.applied = true; applied++;
    } catch (e) { r.error = e instanceof Error ? e.message : "Couldn't apply"; }
  }
  await run(env.DB, "UPDATE bank_imports SET rows = ?, status = 'approved', decided_at = ?, decided_by = ? WHERE id = ?", JSON.stringify(rows), now(), a.member.id, id);
  await audit(env.DB, a, { action: "Approval", resource: "Bank import", meta: `${imp.file_name}: ${applied} payment${applied === 1 ? "" : "s"} applied` });
  return { applied, rows };
}

export async function discardImport(env: AppEnv, a: Actor, id: string) {
  needApprove(a);
  await run(env.DB, "UPDATE bank_imports SET status = 'discarded', decided_at = ?, decided_by = ? WHERE id = ? AND status = 'pending'", now(), a.member.id, id);
  return { ok: true };
}
