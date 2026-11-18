/**
 * The firm's own record (legal name, office address, EIN/EFIN last 4, EFIN status and
 * renewal, ERO) and the office's closed days. Closed days block online booking for
 * everyone. Only the last 4 digits of the EIN and EFIN are kept here; the full numbers
 * belong in "Your service bureau" when needed for forms. Server-only.
 */
import { all, badRequest, json, notFound, now, one, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";

export type Firm = { legalName: string; structure: string; address: string; city: string; state: string; zip: string; phone: string; email: string; einLast4: string; efinLast4: string; efinStatus: string; efinVerifiedFrom: string; efinRenewBy: string; ero: string };
export type Closure = { id: string; name: string; start: string; end: string; source: string };
export const EMPTY_FIRM: Firm = { legalName: "", structure: "", address: "", city: "", state: "", zip: "", phone: "", email: "", einLast4: "", efinLast4: "", efinStatus: "", efinVerifiedFrom: "", efinRenewBy: "", ero: "" };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function getFirm(env: AppEnv, a: Actor) {
  requireStaff(a);
  const r = await one<{ data: string }>(env.DB, "SELECT data FROM service_settings WHERE key = 'firm'");
  const closures = await all<{ id: string; name: string; start_date: string; end_date: string; source: string }>(env.DB, "SELECT id, name, start_date, end_date, source FROM business_closures ORDER BY start_date");
  return { firm: { ...EMPTY_FIRM, ...(r ? json<Partial<Firm>>(r.data, {}) : {}) }, closures: closures.map((c): Closure => ({ id: c.id, name: c.name, start: c.start_date, end: c.end_date, source: c.source })) };
}

export async function saveFirm(env: AppEnv, a: Actor, b: { firm?: Partial<Firm> }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const x = b.firm ?? {};
  const t = (k: keyof Firm, max: number) => String(x[k] ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
  const last4 = (k: keyof Firm, label: string) => { const v = t(k, 12).replace(/\D/g, ""); if (v && v.length !== 4) throw badRequest(`${label}: enter only the last 4 digits.`); return v; };
  const renew = t("efinRenewBy", 10);
  if (renew && !DAY.test(renew)) throw badRequest("Enter the EFIN date as YYYY-MM-DD.");
  const firm: Firm = { legalName: t("legalName", 120), structure: t("structure", 60), address: t("address", 160), city: t("city", 80), state: t("state", 2).toUpperCase(), zip: t("zip", 10), phone: t("phone", 20), email: t("email", 120), einLast4: last4("einLast4", "EIN"), efinLast4: last4("efinLast4", "EFIN"), efinStatus: t("efinStatus", 60), efinVerifiedFrom: t("efinVerifiedFrom", 120), efinRenewBy: renew, ero: t("ero", 120) };
  await run(env.DB, "INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('firm', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", JSON.stringify(firm), now(), a.member.id);
  await audit(env.DB, a, { action: "Record update", resource: "Firm details", meta: "Firm details updated" });
  return getFirm(env, a);
}

export async function addClosure(env: AppEnv, a: Actor, b: { name?: unknown; start?: unknown; end?: unknown }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const name = String(b.name ?? "").trim().slice(0, 80);
  const start = String(b.start ?? ""), end = String(b.end ?? "") || start;
  if (!name) throw badRequest("Name the closed day (e.g. Christmas).");
  if (!DAY.test(start) || !DAY.test(end) || end < start) throw badRequest("Choose the first and last closed day.");
  await run(env.DB, "INSERT INTO business_closures (id, name, start_date, end_date, source, created_at, created_by) VALUES (?, ?, ?, ?, 'manual', ?, ?)", randomId("cl"), name, start, end, now(), a.member.id);
  await audit(env.DB, a, { action: "Record update", resource: "Office closed days", meta: `Added ${name} (${start}${end !== start ? ` to ${end}` : ""})` });
  return getFirm(env, a);
}

export async function deleteClosure(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const c = await one<{ name: string; start_date: string }>(env.DB, "SELECT name, start_date FROM business_closures WHERE id = ?", id);
  if (!c) throw notFound("That closed day is already gone.");
  await run(env.DB, "DELETE FROM business_closures WHERE id = ?", id);
  await audit(env.DB, a, { action: "Record update", resource: "Office closed days", meta: `Removed ${c.name} (${c.start_date})` });
  return getFirm(env, a);
}

/** Every closed day (YYYY-MM-DD) between two dates, for online booking. */
export async function closedDays(env: AppEnv, from: string, to: string) {
  const rows = await all<{ start_date: string; end_date: string }>(env.DB, "SELECT start_date, end_date FROM business_closures WHERE end_date >= ? AND start_date <= ?", from, to);
  const out = new Set<string>();
  for (const r of rows) for (let d = r.start_date; d <= r.end_date; d = new Date(Date.parse(`${d}T12:00:00Z`) + 864e5).toISOString().slice(0, 10)) out.add(d);
  return out;
}
