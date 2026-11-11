/**
 * Monthly bookkeeping invoices: one per workspace per month, for the plan's
 * monthly fee plus any additional charges not invoiced yet. Run by staff
 * ("Invoice this month now") or automatically each day by the scheduled job
 * on each workspace's billing day. Server-only.
 */
import { periodLabel, type ExtraCharge } from "@/lib/books/config";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { audit, requirePermission, type Actor } from "./identity";
import { cents, dollarsOf, nextNumber, type InvoiceRow } from "./billing";
import { deliverInvoice } from "./billing-docs";
import { cleanBilling } from "./books";

type WsRow = { id: string; client_id: string; business_name: string; service: string; extras: string; billing: string; started_at: string; activity: string; rev: number };

/** Today's date in Central time, as { period: "YYYY-MM", day }. */
export function centralToday(at = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { period: `${g("year")}-${g("month")}`, day: Number(g("day")), date: `${g("year")}-${g("month")}-${g("day")}` };
}
const addDays = (date: string, n: number) => { const d = new Date(`${date}T17:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString(); };

/** Already billed? (An invoice tied to this month, or an older one naming it.) */
async function billedNumber(env: AppEnv, ws: WsRow, period: string) {
  const r = await one<{ number: string }>(env.DB, "SELECT number FROM invoices WHERE workspace_id = ? AND status != 'void' AND (billing_period = ? OR (billing_period IS NULL AND description LIKE ?)) LIMIT 1", ws.id, period, `%${periodLabel(period)}%`);
  return r?.number ?? null;
}

/**
 * Creates (and optionally emails) the month's invoice. `by` is a team member id or "system".
 * Never bills a month twice.
 */
export async function billWorkspaceMonth(env: AppEnv, wsId: string, period: string, opts: { send: boolean; by: string }) {
  if (!/^\d{4}-\d{2}$/.test(period)) throw badRequest("Choose the month to bill.");
  const ws = await one<WsRow>(env.DB, "SELECT id, client_id, business_name, service, extras, billing, started_at, activity, rev FROM books_workspaces WHERE id = ?", wsId);
  if (!ws) throw notFound("Workspace not found.");
  const client = await one<{ status: string; email: string | null }>(env.DB, "SELECT status, email FROM clients WHERE id = ?", ws.client_id);
  if (!client || ["inactive", "prospect", "declined"].includes(client.status)) return { created: false, reason: "client_inactive" as const };
  const existing = await billedNumber(env, ws, period);
  if (existing) return { created: false, reason: "already_billed" as const, number: existing };
  const service = json<{ plan: string; monthlyFee: number }>(ws.service, { plan: "", monthlyFee: 0 });
  const extras = json<ExtraCharge[]>(ws.extras, []);
  const pending = extras.filter((x) => !x.invoiced);
  const label = periodLabel(period);
  const lines = [
    ...(service.monthlyFee > 0 ? [{ label: `Monthly bookkeeping — ${service.plan || "plan"} (${label})`, amount: dollarsOf(cents(service.monthlyFee)), kind: "service" as const }] : []),
    ...pending.map((x) => ({ label: `${x.label} (${periodLabel(x.period)})`, amount: dollarsOf(cents(x.amount)), kind: "service" as const })),
  ];
  const amount = lines.reduce((s, l) => s + cents(l.amount), 0);
  if (amount <= 0) return { created: false, reason: "nothing_to_bill" as const };
  const billing = cleanBilling(json(ws.billing, {}));
  const t = now();
  const issued = t.slice(0, 10);
  const id = randomId("inv");
  const number = await nextNumber(env);
  const history = JSON.stringify([{ at: t, by: opts.by, text: opts.by === "system" ? `Created automatically for ${label}` : `Created for ${label}` }]);
  try {
    await run(env.DB, "INSERT INTO invoices (id, number, client_id, service, workspace_id, billing_period, description, payment_mode, status, lines, amount_cents, paid_cents, issued_at, due_at, history, created_at, created_by, updated_at) VALUES (?, ?, ?, 'books', ?, ?, ?, 'upfront', 'open', ?, ?, 0, ?, ?, ?, ?, ?, ?)",
      id, number, ws.client_id, ws.id, period, `${ws.business_name} — bookkeeping, ${label}`, JSON.stringify(lines), amount, t, addDays(issued, billing.dueDays), history, t, opts.by === "system" ? null : opts.by, t);
  } catch (e) {
    if (String(e).includes("UNIQUE")) return { created: false, reason: "already_billed" as const };
    throw e;
  }
  // The additional charges are now on an invoice; the workspace remembers that (and logs it).
  const ids = new Set(pending.map((x) => x.id));
  const act = [{ id: randomId("x"), kind: "invoice", text: `Invoice ${number} ${opts.by === "system" ? "created automatically" : "created"} — ${label}, $${dollarsOf(amount).toFixed(2)}`, at: t, actor: opts.by === "system" ? "system" : "staff" }, ...json<unknown[]>(ws.activity, [])].slice(0, 500);
  await run(env.DB, "UPDATE books_workspaces SET extras = ?, activity = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(extras.map((x) => (ids.has(x.id) ? { ...x, invoiced: true } : x))), JSON.stringify(act), t, ws.id);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'invoice', ?, ?, ?, ?)", randomId("x"), ws.client_id, `Invoice ${number} created for ${ws.business_name} bookkeeping, ${label} — $${dollarsOf(amount).toFixed(2)}`, opts.by === "system" ? "system" : "staff", opts.by === "system" ? null : opts.by, t);
  let sent = false;
  if (opts.send && client.email) {
    const row = (await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ?", id))!;
    sent = (await deliverInvoice(env, row, opts.by).catch(() => ({ sent: false }))).sent;
  }
  return { created: true, number, amount: dollarsOf(amount), sent, emailedTo: opts.send ? client.email : null };
}

/** Staff: "Invoice <month> now". */
export async function billNow(env: AppEnv, a: Actor, wsId: string, b: { period?: unknown; send?: unknown }) {
  requirePermission(a, "books", "edit");
  requirePermission(a, "billing", "create");
  if (a.kind !== "staff") throw forbidden();
  const out = await billWorkspaceMonth(env, wsId, typeof b.period === "string" ? b.period : "", { send: b.send !== false, by: a.member.id });
  if (out.created) await audit(env.DB, a, { action: "Record update", resource: `Invoice ${out.number}`, department: "books", meta: `Monthly bookkeeping invoice created${out.sent ? " and emailed" : ""}` });
  if (!out.created && out.reason === "already_billed") throw new HttpError(409, `This month is already billed${"number" in out && out.number ? ` (invoice ${out.number})` : ""}.`, "already_billed");
  if (!out.created && out.reason === "nothing_to_bill") throw badRequest("There's nothing to bill — set the monthly fee first.");
  if (!out.created) throw badRequest("This client isn't active.");
  return out;
}

/** Daily job: every workspace with automatic billing whose billing day has come this month. */
export async function runMonthlyBilling(env: AppEnv, at = new Date()) {
  const today = centralToday(at);
  const rows = await all<WsRow>(env.DB, "SELECT id, client_id, business_name, service, extras, billing, started_at, activity, rev FROM books_workspaces WHERE billing LIKE '%\"auto\":true%'");
  const results: { ws: string; out: unknown }[] = [];
  for (const ws of rows) {
    const b = cleanBilling(json(ws.billing, {}));
    if (!b.auto || today.day < b.day) continue;
    if (ws.started_at.slice(0, 7) > today.period) continue; // starts later
    try { results.push({ ws: ws.id, out: await billWorkspaceMonth(env, ws.id, today.period, { send: b.email, by: "system" }) }); }
    catch (e) { results.push({ ws: ws.id, out: { error: String(e).slice(0, 200) } }); }
  }
  return { date: today.date, checked: rows.length, results };
}
