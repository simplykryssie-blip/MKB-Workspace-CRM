/**
 * Service prices set by the Owner in Settings → Fees. Tax return prices live
 * in the Tax Center fee schedule; business services in their catalog.
 */

export type BooksPlan = {
  key: string; fee: number; transactions: number; accounts: number;
  /** Business locations included (more are an add-on). */
  locations: number;
  /** Price shown as "$999+" (starting at). */
  startingAt?: boolean;
  tagline?: string;
  description?: string;
  includes: string[];
  excludes: string[];
};
/** Optional bookkeeping services added to a plan. */
export type BooksAddOn = {
  key: string; name: string;
  /** monthly = added to the monthly fee; one_time = billed once; quote = priced per client. */
  billing: "monthly" | "one_time" | "quote";
  price: number;
  /** Shown as "Starting at". */
  startingAt: boolean;
  /** e.g. "per account", "per location". */
  unit: string;
  includes: string[];
};
export type ServiceFees = {
  books: {
    plans: BooksPlan[];
    addOns: BooksAddOn[];
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
  /** Tax filing partners. Software and service bureau are staff-only (never on anything a client sees); the bank appears on bank product invoices. */
  taxPartners: { software: string; serviceBureau: string; bankProduct: string };
  /** Invoice wording (editable). {{bank}} is the refund transfer bank from Tax filing partners. */
  invoiceText: { upfrontNote: string; bankDisclosure: string };
  /** Late payment terms (all services). */
  late: { graceDays: number; adminFee: number; monthlyRatePct: number; courtAfterDays: number; /** Added if MKB has to file a claim in court (plus court costs). */ courtAdminFee: number };
};

const EXCLUDES = ["Accounts payable (A/P)", "Accounts receivable (A/R)", "Payroll processing or payroll tax filings", "Sales-tax filings", "Receipt collection/organization (dedicated receipt management available as an add-on)", "Cleanup or catch-up bookkeeping", "Complex journal entries or specialized accounting", "Multiple business locations (additional locations available at custom pricing)", "Financial consulting or advisory services", "Quarterly or annual tax preparation"];

export const DEFAULT_SERVICE_FEES: ServiceFees = {
  books: {
    plans: [
      { key: "Foundation", fee: 399, startingAt: false, transactions: 150, accounts: 3, locations: 1, tagline: "Build your base. Stay in control.", description: "Designed for small businesses and entrepreneurs who need reliable, accurate bookkeeping to keep their business organized and growing. We handle the numbers so you can focus on what you do best \u2014 running your business.", includes: ["Transaction categorization", "Bank and credit card reconciliation (up to 3 financial accounts)", "Monthly financial statements (P&L, Balance Sheet, Cash Flow Statement)", "Month-end close", "Basic receipt review (documents provided by you)", "Monthly reporting", "Routine clarification and document requests", "Access to a dedicated support team"], excludes: EXCLUDES },
      { key: "Essential", fee: 549, startingAt: false, transactions: 400, accounts: 5, locations: 1, tagline: "Grow with confidence.", description: "Designed for established businesses that need more support and higher capacity. With increased transaction limits and additional financial accounts, this package gives you the structure and insight to manage day-to-day operations and support your next stage of growth.", includes: ["Transaction categorization", "Bank and credit card reconciliation (up to 5 financial accounts)", "Monthly financial statements (P&L, Balance Sheet, Cash Flow Statement)", "Month-end close", "Basic receipt review (documents provided by you)", "Monthly reporting", "Routine clarification and document requests", "Access to a dedicated support team"], excludes: EXCLUDES },
      { key: "Growth", fee: 749, startingAt: false, transactions: 750, accounts: 8, locations: 1, tagline: "Expand your potential. We handle the numbers.", description: "Designed for growing businesses that need more capacity, more support, and greater financial visibility. With higher transaction limits and additional financial accounts, this package gives you the structure and insight to scale with confidence.", includes: ["Transaction categorization", "Bank and credit card reconciliation (up to 8 financial accounts)", "Monthly financial statements (P&L, Balance Sheet, Cash Flow Statement)", "Month-end close", "Basic receipt review (documents provided by you)", "Monthly reporting", "Routine clarification and document requests", "Access to a dedicated support team", "Proactive communication as your business grows"], excludes: EXCLUDES },
      { key: "Advanced", fee: 999, startingAt: true, transactions: 1500, accounts: 12, locations: 1, tagline: "Built for more. Support for what's next.", description: "Designed for established businesses that need a higher level of support, greater capacity, and comprehensive financial oversight. With expanded transaction limits and additional accounts, we provide the structure, accuracy, and insights to help you operate efficiently and plan for what's next.", includes: ["Transaction categorization", "Bank and credit card reconciliation (up to 12 financial accounts)", "Monthly financial statements (P&L, Balance Sheet, Cash Flow Statement)", "Month-end close", "Basic receipt review (documents provided by you)", "Monthly reporting", "Routine clarification and document requests", "Access to a dedicated support team", "Proactive communication and support", "Built for higher-volume businesses"], excludes: EXCLUDES },
    ],
    addOns: [
      { key: "ap", name: "Accounts payable (A/P)", billing: "monthly", price: 100, startingAt: true, unit: "", includes: ["Enter and categorize vendor bills", "Maintain A/P balances", "Reconcile A/P", "Included in month-end close"] },
      { key: "ar", name: "Accounts receivable (A/R)", billing: "monthly", price: 100, startingAt: true, unit: "", includes: ["Record customer invoices", "Apply customer payments", "Maintain A/R balances", "Reconcile A/R", "Included in month-end close"] },
      { key: "receipts", name: "Receipt & document management", billing: "monthly", price: 100, startingAt: false, unit: "", includes: ["Receipt collection and organization", "Match receipts to transactions", "Ongoing missing receipt follow-up", "Secure document management"] },
      { key: "biweekly", name: "Biweekly bookkeeping", billing: "monthly", price: 150, startingAt: false, unit: "", includes: ["Books updated every two weeks", "Same great support and reporting"] },
      { key: "weekly", name: "Weekly bookkeeping", billing: "monthly", price: 300, startingAt: false, unit: "", includes: ["Books updated weekly", "Stay closer to your numbers"] },
      { key: "accounts", name: "Additional financial accounts", billing: "monthly", price: 50, startingAt: true, unit: "per account", includes: ["Additional bank, credit card, or standard financial accounts", "Reconciliation included", "Pricing may vary for complex accounts (e.g., Stripe, PayPal, loans, merchant processors)"] },
      { key: "locations", name: "Additional locations", billing: "monthly", price: 150, startingAt: true, unit: "per location", includes: ["Bookkeeping for additional business locations", "Includes location-specific reporting (where applicable)", "Final pricing based on transaction volume, number of accounts, and complexity"] },
      { key: "qbo", name: "QuickBooks setup & consultation", billing: "one_time", price: 350, startingAt: true, unit: "", includes: ["Complete setup and customization", "Chart of accounts", "Bank connections", "Initial configuration and training", "Pricing based on your business needs"] },
      { key: "catchup", name: "Catch-up bookkeeping", billing: "quote", price: 0, startingAt: false, unit: "", includes: ["For books that are behind", "Pricing based on months, volume and complexity", "Get current and move forward with confidence"] },
      { key: "cleanup", name: "Bookkeeping cleanup", billing: "one_time", price: 500, startingAt: true, unit: "", includes: ["Fix errors and discrepancies", "Reconcile accounts", "Clean up historical transactions", "Pricing based on scope, months and complexity"] },
      { key: "custom", name: "Custom solutions", billing: "quote", price: 0, startingAt: false, unit: "", includes: ["We create tailored solutions for your business", "Flexible pricing based on scope", "Get the exact support you need"] },
    ],
    overagePerTransaction: 0.5,
    overagePerAccount: 50,
    upgradeAfterMonths: 2,
  },
  expunge: { baseFee: 550, chargesIncluded: 2, extraChargeFee: 550 },
  taxPartners: { software: "TaxWise", serviceBureau: "MKB Financial Group (in-house)", bankProduct: "Santa Barbara Tax Products Group (TPG)" },
  invoiceText: {
    upfrontNote: "Pay securely online by card or bank transfer, or pay in person at our office. Your return is filed after payment and your e-signature.",
    bankDisclosure: "You chose to have these fees taken out of your federal refund. Your refund goes first to {{bank}}, which deducts the fees and sends you the rest.\n\nIf your refund is smaller than expected, delayed, or reduced — for example because the IRS adjusts it or applies it to a past-due debt (an \"offset\") — the fees may not be fully collected. Any amount not collected from your refund remains due, and we'll send you an updated invoice to pay directly.\n\nYou can always choose to pay upfront instead and receive your full refund. No payment is due now unless your refund can't cover these fees.",
  },
  late: { graceDays: 7, adminFee: 75, monthlyRatePct: 1, courtAfterDays: 39, courtAdminFee: 250 },
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
    courtAdmin: money(f.late.courtAdminFee),
  };
}

/** Basic sanity rules (the server applies the same). */
export function checkFees(f: ServiceFees): string | null {
  const n = (x: unknown) => typeof x === "number" && isFinite(x) && x >= 0;
  if (!Array.isArray(f.books?.plans) || !f.books.plans.length || f.books.plans.length > 12) return "Add between 1 and 12 bookkeeping plans.";
  if (f.books.plans.some((p) => !p.key?.trim() || !n(p.fee) || !n(p.transactions) || !n(p.accounts) || !n(p.locations))) return "Every bookkeeping plan needs a name, price and limits.";
  if ((f.books.addOns ?? []).some((x) => !x.name?.trim() || !n(x.price))) return "Every add-on needs a name and a price (0 for custom quotes).";
  if (new Set(f.books.plans.map((p) => p.key.trim().toLowerCase())).size !== f.books.plans.length) return "Bookkeeping plan names must be different.";
  if (![f.books.overagePerTransaction, f.books.overagePerAccount, f.expunge.baseFee, f.expunge.extraChargeFee, f.late.adminFee, f.late.monthlyRatePct, f.late.courtAdminFee].every(n)) return "Prices can't be negative.";
  if (!(f.books.upgradeAfterMonths >= 1 && f.books.upgradeAfterMonths <= 12)) return "Choose 1–12 months before moving to a bigger plan.";
  if (!(f.expunge.chargesIncluded >= 1 && f.expunge.chargesIncluded <= 20)) return "The expungement fee must cover 1–20 charges.";
  if (f.late.monthlyRatePct > 1) return "Louisiana generally caps agreed interest at 12% a year (1% per month).";
  if (!(f.late.graceDays >= 0 && f.late.courtAfterDays > f.late.graceDays)) return "Court action must come after the grace period.";
  return null;
}

/* ---------------------------------------------------------------- bookkeeping quote */
export type BooksQuoteLine = { label: string; amount: number; billing: "monthly" | "one_time" | "quote"; startingAt?: boolean };
export type BooksQuote = { plan: BooksPlan; monthly: BooksQuoteLine[]; oneTime: BooksQuoteLine[]; quoted: BooksQuoteLine[]; monthlyTotal: number; oneTimeTotal: number; extraAccounts: number; extraLocations: number; /** Why the quote looks the way it does (estimates, add-ons the answers call for). */ notes?: string[] };

/**
 * Cheapest plan that fits the monthly transactions, plus extra accounts and
 * locations beyond the plan's limits, plus chosen add-ons.
 */
export function booksQuote(b: ServiceFees["books"], need: { transactions: number; accounts: number; locations: number; addOnKeys: string[] }): BooksQuote {
  const addOn = (k: string) => b.addOns.find((x) => x.key === k);
  const acctPrice = addOn("accounts")?.price ?? b.overagePerAccount;
  const locPrice = addOn("locations")?.price ?? 0;
  const sorted = [...b.plans].sort((x, y) => x.fee - y.fee);
  const fits = sorted.filter((p) => p.transactions >= need.transactions);
  const pool = fits.length ? fits : [sorted[sorted.length - 1]];
  const cost = (p: BooksPlan) => p.fee + Math.max(0, need.accounts - p.accounts) * acctPrice + Math.max(0, need.locations - p.locations) * locPrice;
  const plan = pool.reduce((best, p) => (cost(p) < cost(best) ? p : best), pool[0]);
  const extraAccounts = Math.max(0, need.accounts - plan.accounts);
  const extraLocations = Math.max(0, need.locations - plan.locations);
  const monthly: BooksQuoteLine[] = [{ label: `${plan.key} plan`, amount: plan.fee, billing: "monthly", startingAt: plan.startingAt }];
  if (extraAccounts) monthly.push({ label: `Additional financial accounts × ${extraAccounts}`, amount: extraAccounts * acctPrice, billing: "monthly", startingAt: addOn("accounts")?.startingAt });
  if (extraLocations) monthly.push({ label: `Additional locations × ${extraLocations}`, amount: extraLocations * locPrice, billing: "monthly", startingAt: true });
  const oneTime: BooksQuoteLine[] = [];
  const quoted: BooksQuoteLine[] = [];
  for (const k of need.addOnKeys) {
    const x = addOn(k);
    if (!x || k === "accounts" || k === "locations") continue;
    const line = { label: x.name, amount: x.price, billing: x.billing, startingAt: x.startingAt };
    (x.billing === "monthly" ? monthly : x.billing === "one_time" ? oneTime : quoted).push(line);
  }
  return { plan, monthly, oneTime, quoted, monthlyTotal: monthly.reduce((s, l) => s + l.amount, 0), oneTimeTotal: oneTime.reduce((s, l) => s + l.amount, 0), extraAccounts, extraLocations };
}
export const priceLabel = (amount: number, startingAt?: boolean, suffix = "") => `${startingAt ? "Starting at " : ""}${money(amount)}${suffix}`;
