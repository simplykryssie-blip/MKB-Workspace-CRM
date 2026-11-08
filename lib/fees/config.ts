/**
 * Service prices set by the Owner in Settings → Fees. Tax return prices live
 * in the Tax Center fee schedule; business services in their catalog.
 */

export type BooksPlan = { key: string; fee: number; transactions: number; accounts: number };
export type ServiceFees = {
  books: {
    plans: BooksPlan[];
    /** Billed for each transaction over the plan's limit in a month. */
    overagePerTransaction: number;
    /** Billed for each account over the plan's limit in a month. */
    overagePerAccount: number;
    /** Months in a row over the limit before moving to the plan that fits. */
    upgradeAfterMonths: number;
  };
  expunge: {
    /** MKB fee for a basic expungement… */
    baseFee: number;
    /** …covering up to this many charges. */
    chargesIncluded: number;
    /** Each charge beyond that. */
    extraChargeFee: number;
  };
  /** Late payment terms (all services). */
  late: { graceDays: number; adminFee: number; monthlyRatePct: number; courtAfterDays: number };
};

export const DEFAULT_SERVICE_FEES: ServiceFees = {
  books: {
    plans: [
      { key: "Foundation", fee: 399, transactions: 150, accounts: 3 },
      { key: "Essential", fee: 549, transactions: 400, accounts: 5 },
      { key: "Growth", fee: 749, transactions: 750, accounts: 8 },
      { key: "Advanced", fee: 999, transactions: 1500, accounts: 12 },
    ],
    overagePerTransaction: 0,
    overagePerAccount: 0,
    upgradeAfterMonths: 2,
  },
  expunge: { baseFee: 550, chargesIncluded: 2, extraChargeFee: 550 },
  late: { graceDays: 7, adminFee: 50, monthlyRatePct: 1, courtAfterDays: 39 },
};

export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** MKB expungement fee for a number of charges (third-party fees not included). */
export const expungeFee = (f: ServiceFees["expunge"], charges: number) => f.baseFee + Math.max(0, charges - f.chargesIncluded) * f.extraChargeFee;

/** Plain-English fee wording used to fill letters ({{expungeFee}}, {{lateRate}}, …). */
export function feeWords(f: ServiceFees): Record<string, string> {
  const e = f.expunge;
  return {
    expungeFee: `${money(e.baseFee)}, which covers up to ${e.chargesIncluded} charge${e.chargesIncluded === 1 ? "" : "s"}. Each additional charge is ${money(e.extraChargeFee)}`,
    booksOverage: [f.books.overagePerTransaction ? `${money(f.books.overagePerTransaction)} per extra transaction` : "", f.books.overagePerAccount ? `${money(f.books.overagePerAccount)} per extra account` : ""].filter(Boolean).join(" and ") || "the overage rates in our fee schedule",
    upgradeMonths: String(f.books.upgradeAfterMonths),
    lateGrace: String(f.late.graceDays),
    lateAdmin: money(f.late.adminFee),
    lateRate: `${f.late.monthlyRatePct}% per month (${+(f.late.monthlyRatePct * 12).toFixed(2)}% per year)`,
    courtDays: String(f.late.courtAfterDays),
  };
}

/** Basic sanity rules (the server applies the same). */
export function checkFees(f: ServiceFees): string | null {
  const n = (x: unknown) => typeof x === "number" && isFinite(x) && x >= 0;
  if (!Array.isArray(f.books?.plans) || !f.books.plans.length || f.books.plans.length > 12) return "Add between 1 and 12 bookkeeping plans.";
  if (f.books.plans.some((p) => !p.key?.trim() || !n(p.fee) || !n(p.transactions) || !n(p.accounts))) return "Every bookkeeping plan needs a name, price and limits.";
  if (new Set(f.books.plans.map((p) => p.key.trim().toLowerCase())).size !== f.books.plans.length) return "Bookkeeping plan names must be different.";
  if (![f.books.overagePerTransaction, f.books.overagePerAccount, f.expunge.baseFee, f.expunge.extraChargeFee, f.late.adminFee, f.late.monthlyRatePct].every(n)) return "Prices can't be negative.";
  if (!(f.books.upgradeAfterMonths >= 1 && f.books.upgradeAfterMonths <= 12)) return "Choose 1–12 months before moving to a bigger plan.";
  if (!(f.expunge.chargesIncluded >= 1 && f.expunge.chargesIncluded <= 20)) return "The expungement fee must cover 1–20 charges.";
  if (f.late.monthlyRatePct > 1) return "Louisiana generally caps agreed interest at 12% a year (1% per month).";
  if (!(f.late.graceDays >= 0 && f.late.courtAfterDays > f.late.graceDays)) return "Court action must come after the grace period.";
  return null;
}
