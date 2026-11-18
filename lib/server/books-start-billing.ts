/**
 * Bookkeeping: billing right after the client signs the proposal.
 *
 * Signing creates the first invoice and emails it with a Pay online link (the client
 * is also shown a Pay now button on the signing page):
 *  - the first month (or the first quarter, for quarterly clients), and
 *  - a 50% deposit on one-time project work (catch-up, cleanup, setup…).
 * The other 50% is billed by MKB when the project is done ("Bill the balance" on the intake).
 * Custom-quoted work isn't billed here: it's priced and approved in writing first.
 * When MKB starts the bookkeeping workspace, the first invoice is tied to its first
 * billing period, so automatic billing never charges that month or quarter twice.
 * Server-only.
 */
import { quarterOf } from "@/lib/books/config";
import { DEPOSIT_PCT, isQuarterly, startInvoiceLines, type Proposal } from "@/lib/books/proposal";
import { badRequest, json, now, one, run, HttpError, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { cents, dollarsOf, nextNumber, type InvoiceRow } from "./billing";
import { deliverInvoice } from "./billing-docs";
import { audit, requirePermission, type Actor } from "./identity";

type Line = { label: string; amount: number; kind: "service" };

async function insertInvoice(env: AppEnv, clientId: string, description: string, lines: Line[], by: string | null) {
  const amount = lines.reduce((s, l) => s + cents(l.amount), 0);
  if (amount <= 0) return null;
  const id = randomId("inv");
  const number = await nextNumber(env);
  const t = now();
  await run(env.DB, "INSERT INTO invoices (id, number, client_id, service, workspace_id, billing_period, description, payment_mode, status, lines, amount_cents, paid_cents, issued_at, due_at, history, created_at, created_by, updated_at) VALUES (?, ?, ?, 'books', NULL, NULL, ?, 'upfront', 'open', ?, ?, 0, ?, ?, ?, ?, ?, ?)",
    id, number, clientId, description, JSON.stringify(lines), amount, t, t, JSON.stringify([{ at: t, by: by ?? "system", text: "Created" }]), t, by, t);
  return (await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id))!;
}

/**
 * Called when the client signs. Creates the first invoice (due now) and emails it.
 * Returns the Pay online link for the signing page (or null when there's nothing to pay).
 */
export async function createStartInvoice(env: AppEnv, clientId: string, bizName: string, p: Proposal, to?: string) {
  const { lines, balance } = startInvoiceLines(p);
  const inv = await insertInvoice(env, clientId, `${bizName} — bookkeeping: first ${isQuarterly(p) ? "quarter" : "month"}${balance.length ? ` + ${DEPOSIT_PCT}% project deposit` : ""}`, lines, null);
  if (!inv) return { invoice: null, payUrl: null, balance };
  const out = await deliverInvoice(env, inv, "system", { to }).catch((e) => { console.error("start invoice email", e instanceof Error ? e.message : e); return null; });
  return { invoice: { id: inv.id, number: inv.number, amount: dollarsOf(inv.amount_cents) }, payUrl: out?.payUrl ?? null, balance };
}

/** Staff: when the workspace starts, the first invoice counts as its first billing period. */
export async function linkStartInvoice(env: AppEnv, invoiceId: string, wsId: string) {
  const ws = await one<{ service: string; months: string }>(env.DB, "SELECT service, months FROM books_workspaces WHERE id = ?", wsId);
  if (!ws) return;
  const first = json<{ period: string }[]>(ws.months, []).map((m) => m.period).sort()[0];
  if (!first) return;
  const period = json<{ cadence?: string }>(ws.service, {}).cadence === "quarterly" ? quarterOf(first).start : first;
  // Never steal a period that already has an invoice.
  if (await one(env.DB, "SELECT 1 FROM invoices WHERE workspace_id = ? AND billing_period = ? AND status != 'void'", wsId, period)) return;
  await run(env.DB, "UPDATE invoices SET workspace_id = ?, billing_period = ?, updated_at = ? WHERE id = ? AND workspace_id IS NULL", wsId, period, now(), invoiceId);
}

/** Staff: bills the remaining project balance (the other 50%) once the work is done. */
export async function billBalance(env: AppEnv, a: Actor, intake: { id: string; client_id: string; proposal: string | null }, bizName: string) {
  requirePermission(a, "books", "edit");
  requirePermission(a, "billing", "create");
  if (a.kind !== "staff") throw new HttpError(403, "Staff only.", "forbidden");
  const p = json<Proposal | null>(intake.proposal, null);
  if (!p || p.status !== "signed") throw badRequest("The proposal isn't signed yet.");
  if (p.balanceInvoice) throw new HttpError(409, `The balance was already billed (invoice ${p.balanceInvoice.number}).`, "already_billed");
  const bal = p.balance ?? [];
  if (!bal.length) throw badRequest("There's no project balance to bill.");
  const inv = await insertInvoice(env, intake.client_id, `${bizName} — bookkeeping project balance`, bal.map((b) => ({ label: `${b.label} — remaining ${100 - DEPOSIT_PCT}% (project complete)`, amount: b.amount, kind: "service" as const })), a.member.id);
  if (!inv) throw badRequest("There's no project balance to bill.");
  const next: Proposal = { ...p, balanceInvoice: { id: inv.id, number: inv.number, amount: dollarsOf(inv.amount_cents) } };
  await run(env.DB, "UPDATE books_intakes SET proposal = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(next), now(), intake.id);
  const out = await deliverInvoice(env, inv, a.member.id).catch(() => null);
  await audit(env.DB, a, { action: "Record update", resource: `Invoice ${inv.number}`, department: "books", meta: `Project balance billed${out?.sent ? " and emailed" : ""}` });
  return { number: inv.number, amount: dollarsOf(inv.amount_cents), emailed: !!out?.sent };
}
