/**
 * Company settings (service fees). Server-only.
 */
import { DEFAULT_SERVICE_FEES, checkFees, type ServiceFees } from "@/lib/fees/config";
import { badRequest, json, now, one, run, type AppEnv } from "./core";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";

export async function loadFees(env: AppEnv): Promise<ServiceFees & { updatedAt?: string }> {
  const r = await one<{ data: string; updated_at: string }>(env.DB, "SELECT data, updated_at FROM service_settings WHERE key = 'fees'").catch(() => null);
  if (!r) return DEFAULT_SERVICE_FEES;
  const s = json<Partial<ServiceFees>>(r.data, {});
  return { books: { ...DEFAULT_SERVICE_FEES.books, ...s.books }, expunge: { ...DEFAULT_SERVICE_FEES.expunge, ...s.expunge }, taxPartners: { ...DEFAULT_SERVICE_FEES.taxPartners, ...s.taxPartners }, late: { ...DEFAULT_SERVICE_FEES.late, ...s.late }, updatedAt: r.updated_at };
}

export async function getFees(env: AppEnv, a: Actor) {
  requireStaff(a);
  return { fees: await loadFees(env) };
}

export async function saveFees(env: AppEnv, a: Actor, b: { fees?: ServiceFees }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const f = b.fees;
  if (!f || typeof f !== "object") throw badRequest("Missing fees.");
  const clean: ServiceFees = {
    books: {
      plans: (f.books?.plans ?? []).map((p) => ({ key: String(p.key ?? "").trim().slice(0, 40), fee: Number(p.fee), transactions: Math.round(Number(p.transactions)), accounts: Math.round(Number(p.accounts)) })),
      overagePerTransaction: Number(f.books?.overagePerTransaction),
      overagePerAccount: Number(f.books?.overagePerAccount),
      upgradeAfterMonths: Math.round(Number(f.books?.upgradeAfterMonths)),
    },
    expunge: { baseFee: Number(f.expunge?.baseFee), chargesIncluded: Math.round(Number(f.expunge?.chargesIncluded)), extraChargeFee: Number(f.expunge?.extraChargeFee) },
    taxPartners: { software: String(f.taxPartners?.software ?? "").trim().slice(0, 80), serviceBureau: String(f.taxPartners?.serviceBureau ?? "").trim().slice(0, 80), bankProduct: String(f.taxPartners?.bankProduct ?? "").trim().slice(0, 80) },
    late: { graceDays: Math.round(Number(f.late?.graceDays)), adminFee: Number(f.late?.adminFee), monthlyRatePct: Number(f.late?.monthlyRatePct), courtAfterDays: Math.round(Number(f.late?.courtAfterDays)), courtAdminFee: Number(f.late?.courtAdminFee) },
  };
  const err = checkFees(clean);
  if (err) throw badRequest(err);
  await run(env.DB, "INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('fees', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", JSON.stringify(clean), now(), a.member.id);
  await audit(env.DB, a, { action: "Record update", resource: "Service fees", meta: "Fees updated" });
  return { fees: await loadFees(env) };
}

/* ---------------------------------------------------------------- tax workflow rules */
export type TaxRules = { requireOwnerApproval: boolean; requireEngagement: boolean };
export const DEFAULT_TAX_RULES: TaxRules = { requireOwnerApproval: true, requireEngagement: true };

export async function loadTaxRules(env: AppEnv): Promise<TaxRules> {
  const r = await one<{ data: string }>(env.DB, "SELECT data FROM service_settings WHERE key = 'taxRules'").catch(() => null);
  return { ...DEFAULT_TAX_RULES, ...(r ? json<Partial<TaxRules>>(r.data, {}) : {}) };
}
export async function getTaxRules(env: AppEnv, a: Actor) {
  requireStaff(a);
  return { rules: await loadTaxRules(env) };
}
export async function saveTaxRules(env: AppEnv, a: Actor, b: { rules?: Partial<TaxRules> }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const r: TaxRules = { requireOwnerApproval: b.rules?.requireOwnerApproval !== false, requireEngagement: b.rules?.requireEngagement !== false };
  await run(env.DB, "INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('taxRules', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", JSON.stringify(r), now(), a.member.id);
  await audit(env.DB, a, { action: "Permission change", resource: "Tax workflow rules", meta: `Owner final approval ${r.requireOwnerApproval ? "required" : "off"}; engagement letter ${r.requireEngagement ? "required" : "optional"}` });
  return { rules: r };
}
