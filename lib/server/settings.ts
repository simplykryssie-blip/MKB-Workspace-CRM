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
  // Older saved fees: fill new plan fields (locations, lists) and add-ons from the defaults.
  const books = { ...DEFAULT_SERVICE_FEES.books, ...s.books };
  books.plans = books.plans.map((p) => {
    const q = p as Partial<typeof p>;
    const d = DEFAULT_SERVICE_FEES.books.plans.find((x) => x.key === p.key);
    return { ...p, locations: q.locations ?? 1, includes: q.includes ?? d?.includes ?? [], excludes: q.excludes ?? d?.excludes ?? [], tagline: q.tagline ?? d?.tagline, description: q.description ?? d?.description, startingAt: q.startingAt ?? d?.startingAt };
  });
  if (!Array.isArray(books.addOns) || !books.addOns.length) books.addOns = DEFAULT_SERVICE_FEES.books.addOns;
  return { books, expunge: { ...DEFAULT_SERVICE_FEES.expunge, ...s.expunge }, taxPartners: { ...DEFAULT_SERVICE_FEES.taxPartners, ...s.taxPartners }, invoiceText: { ...DEFAULT_SERVICE_FEES.invoiceText, ...s.invoiceText }, late: { ...DEFAULT_SERVICE_FEES.late, ...s.late }, updatedAt: r.updated_at };
}

export async function getFees(env: AppEnv, a: Actor) {
  requireStaff(a);
  return { fees: await loadFees(env) };
}

const lines = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 30);

export async function saveFees(env: AppEnv, a: Actor, b: { fees?: ServiceFees }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const f = b.fees;
  if (!f || typeof f !== "object") throw badRequest("Missing fees.");
  const clean: ServiceFees = {
    books: {
      plans: (f.books?.plans ?? []).map((p) => ({ key: String(p.key ?? "").trim().slice(0, 40), fee: Number(p.fee), startingAt: !!p.startingAt, transactions: Math.round(Number(p.transactions)), accounts: Math.round(Number(p.accounts)), locations: Math.round(Number(p.locations ?? 1)), tagline: String(p.tagline ?? "").slice(0, 200), description: String(p.description ?? "").slice(0, 1500), includes: lines(p.includes), excludes: lines(p.excludes) })),
      addOns: (f.books?.addOns ?? []).slice(0, 40).map((x, i) => ({ key: String(x.key ?? "").trim().slice(0, 30) || `addon${i + 1}`, name: String(x.name ?? "").trim().slice(0, 120), billing: (["monthly", "one_time", "quote"] as const).includes(x.billing) ? x.billing : "monthly", price: Number(x.price) || 0, startingAt: !!x.startingAt, unit: String(x.unit ?? "").slice(0, 40), includes: lines(x.includes) })),
      overagePerTransaction: Number(f.books?.overagePerTransaction),
      overagePerAccount: Number(f.books?.overagePerAccount),
      upgradeAfterMonths: Math.round(Number(f.books?.upgradeAfterMonths)),
    },
    expunge: { baseFee: Number(f.expunge?.baseFee), chargesIncluded: Math.round(Number(f.expunge?.chargesIncluded)), extraChargeFee: Number(f.expunge?.extraChargeFee) },
    taxPartners: { software: String(f.taxPartners?.software ?? "").trim().slice(0, 80), serviceBureau: String(f.taxPartners?.serviceBureau ?? "").trim().slice(0, 80), bankProduct: String(f.taxPartners?.bankProduct ?? "").trim().slice(0, 80) },
    invoiceText: { upfrontNote: String(f.invoiceText?.upfrontNote ?? "").trim().slice(0, 1000) || DEFAULT_SERVICE_FEES.invoiceText.upfrontNote, bankDisclosure: String(f.invoiceText?.bankDisclosure ?? "").replace(/\r/g, "").trim().slice(0, 4000) || DEFAULT_SERVICE_FEES.invoiceText.bankDisclosure },
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
  // Two sign-offs before the IRS (reviewer + Owner's final approval) are always required — not a setting.
  return { ...DEFAULT_TAX_RULES, ...(r ? json<Partial<TaxRules>>(r.data, {}) : {}), requireOwnerApproval: true };
}
export async function getTaxRules(env: AppEnv, a: Actor) {
  requireStaff(a);
  return { rules: await loadTaxRules(env) };
}
export async function saveTaxRules(env: AppEnv, a: Actor, b: { rules?: Partial<TaxRules> }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const r: TaxRules = { requireOwnerApproval: true, requireEngagement: b.rules?.requireEngagement !== false };
  await run(env.DB, "INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('taxRules', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", JSON.stringify(r), now(), a.member.id);
  await audit(env.DB, a, { action: "Permission change", resource: "Tax workflow rules", meta: `Owner final approval ${r.requireOwnerApproval ? "required" : "off"}; engagement letter ${r.requireEngagement ? "required" : "optional"}` });
  return { rules: r };
}
