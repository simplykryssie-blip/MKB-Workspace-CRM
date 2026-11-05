/**
 * SAMPLE BOOKKEEPING SEEDS — DESIGN PREVIEW ONLY.
 * Fictional businesses, QuickBooks company names, account masks, transaction
 * references and amounts. Nothing here is real client financial data.
 *
 * This file must not import lib/sample/clients.ts (that file imports this one
 * to place bookkeeping documents, invoices and messages on client records).
 */
import { SAMPLE_NOW } from "./time";
import type { ClientDocument, Invoice, Message } from "@/lib/types";
import type { BankAccount, MonthStage, QboAccess, QboStatus, ReportType, ReviewKind, ReviewStatus } from "@/lib/books/config";

const d = (days: number, h = 10, m = 0) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};
const on = (iso: string) => new Date(iso).toISOString();

export type BooksSeed = {
  clientId: string;
  /** Matches the client's bookkeeping engagement title. */
  title: string;
  businessName: string;
  entityType: string;
  bookkeeperId: string;
  reviewerId: string;
  plan: string;
  monthlyFee: number;
  includes: string[];
  reports: ReportType[];
  extras?: { label: string; amount: number; period: string; invoiced: boolean }[];
  qbo: { status: QboStatus; company: string; access: QboAccess; realm?: string; lastSync?: string; connectedAt?: string; authorizedBy?: string };
  accounts: Omit<BankAccount, "id">[];
  months: { period: string; stage: MonthStage; followupFrom?: MonthStage }[];
  items?: { period: string; kind: ReviewKind; txnRef: string; amount?: number; description: string; status: ReviewStatus; response?: string; resolution?: string }[];
  /** Outstanding MKB document requests (on the client profile). */
  requests?: { period: string; name: string; category: string }[];
  /** Invoice status per billed month. */
  billing: Record<string, Invoice["status"]>;
  messages?: { from: "client" | "staff"; body: string; daysAgo: number }[];
  startedAt: string;
};

export const BOOKS_SEEDS: BooksSeed[] = [
  {
    clientId: "c-1002",
    title: "Monthly bookkeeping",
    businessName: "Maple Example LLC",
    entityType: "LLC",
    bookkeeperId: "s-rt",
    reviewerId: "s-mk",
    plan: "Monthly review & close — Standard",
    monthlyFee: 650,
    includes: ["Monthly categorization review", "Up to 3 bank / card reconciliations", "Monthly P&L and Balance Sheet", "Quarterly check-in"],
    reports: ["Profit and Loss", "Balance Sheet"],
    extras: [{ label: "Additional account reconciliation (4th account)", amount: 75, period: "2026-10", invoiced: false }],
    qbo: { status: "connected", company: "Maple Example LLC (Sample)", access: "qboa", realm: "•••• 4410", lastSync: d(0, 6, 12), connectedAt: on("2025-05-20T15:00:00"), authorizedBy: "Pat Example" },
    accounts: [
      { name: "Operating checking", kind: "bank", mask: "4410", institution: "Sample Community Bank" },
      { name: "Business savings", kind: "bank", mask: "8820", institution: "Sample Community Bank" },
      { name: "Business card", kind: "credit_card", mask: "1007", institution: "Example Card Co." },
    ],
    months: [
      { period: "2026-08", stage: "Month Closed" },
      { period: "2026-09", stage: "Month Closed" },
      { period: "2026-10", stage: "Reconciliation in Progress" },
      { period: "2026-11", stage: "Client Entry in Progress" },
    ],
    items: [
      { period: "2026-10", kind: "uncategorized", txnRef: "Oct 14 · Business card ••1007 · SAMPLE HARDWARE SUPPLY", amount: 412.6, description: "Left in Uncategorized Expense — likely materials / supplies.", status: "resolved", resolution: "Client confirmed job materials; recategorized to Supplies." },
      { period: "2026-10", kind: "unusual", txnRef: "Oct 22 · Operating checking ••4410 · Transfer to savings", amount: 5000, description: "Larger than usual transfer — confirm it isn't owner draw.", status: "resolved", resolution: "Confirmed transfer to business savings." },
    ],
    billing: { "2026-08": "paid", "2026-09": "paid", "2026-10": "paid", "2026-11": "open" },
    messages: [
      { from: "staff", body: "October review is done — two quick items resolved. Starting reconciliations now.", daysAgo: 2 },
      { from: "client", body: "Great, thank you! Let me know if you need the savings statement.", daysAgo: 2 },
    ],
    startedAt: on("2025-05-20T15:00:00"),
  },
  {
    clientId: "c-1007",
    title: "Monthly bookkeeping",
    businessName: "Bluebird Sample Inc.",
    entityType: "S-Corp",
    bookkeeperId: "s-rt",
    reviewerId: "s-mk",
    plan: "Monthly review & close — Plus (payroll)",
    monthlyFee: 950,
    includes: ["Monthly categorization review", "Up to 5 reconciliations", "Payroll clearing review", "Full monthly report package"],
    reports: ["Profit and Loss", "Balance Sheet", "Cash Flow Statement", "General Ledger"],
    qbo: { status: "needs_reauth", company: "Bluebird Sample Inc (Sample)", access: "client_authorized", realm: "•••• 0191", lastSync: d(-9, 4, 40), connectedAt: on("2024-07-01T15:00:00"), authorizedBy: "Lee Bluebird" },
    accounts: [
      { name: "Operating checking", kind: "bank", mask: "2291", institution: "Example National Bank" },
      { name: "Payroll checking", kind: "bank", mask: "2307", institution: "Example National Bank" },
      { name: "Corporate card", kind: "credit_card", mask: "6650", institution: "Sample Card Services" },
    ],
    months: [
      { period: "2026-08", stage: "Month Closed" },
      { period: "2026-09", stage: "Client Follow-up Needed", followupFrom: "Reconciliation in Progress" },
      { period: "2026-10", stage: "Client Entry in Progress" },
      { period: "2026-11", stage: "Client Entry in Progress" },
    ],
    items: [
      { period: "2026-09", kind: "discrepancy", txnRef: "Corporate card ••6650 · Sep statement", amount: 236.18, description: "QuickBooks register is short of the September statement — likely a missing charge.", status: "sent_to_client" },
      { period: "2026-09", kind: "missing_receipt", txnRef: "Sep 18 · Corporate card ••6650 · SAMPLE TRAVEL CO", amount: 1184, description: "Receipt needed for travel booking (over $75 policy).", status: "sent_to_client" },
      { period: "2026-09", kind: "uncategorized", txnRef: "Sep 27 · Operating checking ••2291 · Deposit — no memo", amount: 2750, description: "Deposit not matched to an invoice. Is this a customer payment or owner contribution?", status: "client_responded", response: "That was a customer paying two invoices at once (sample)." },
    ],
    requests: [{ period: "2026-10", name: "Statement — Corporate card ••6650 — October 2026", category: "Credit card statement" }],
    billing: { "2026-08": "paid", "2026-09": "paid", "2026-10": "overdue", "2026-11": "open" },
    messages: [
      { from: "staff", body: "QuickBooks says our connection to Bluebird's company expired. When you have a minute, please reconnect from the link in your portal.", daysAgo: 8 },
      { from: "staff", body: "I sent two September questions to your task list — the card is $236.18 short of the statement.", daysAgo: 4 },
      { from: "client", body: "Answered the deposit one. Looking for the travel receipt now.", daysAgo: 1 },
    ],
    startedAt: on("2024-07-01T15:00:00"),
  },
  {
    clientId: "c-1008",
    title: "Monthly bookkeeping",
    businessName: "Harbor Demo Bakery LLC",
    entityType: "LLC",
    bookkeeperId: "s-rt",
    reviewerId: "s-mk",
    plan: "Monthly review & close — Standard",
    monthlyFee: 550,
    includes: ["Monthly categorization review", "Up to 3 reconciliations", "Monthly P&L and Balance Sheet"],
    reports: ["Profit and Loss", "Balance Sheet", "Cash Flow Statement"],
    extras: [{ label: "Catch-up cleanup (Jun–Jul 2026)", amount: 600, period: "2026-08", invoiced: true }],
    qbo: { status: "connected", company: "Harbor Demo Bakery (Sample)", access: "qboa", realm: "•••• 0155", lastSync: d(0, 5, 55), connectedAt: on("2026-07-28T15:00:00"), authorizedBy: "Morgan Harbor" },
    accounts: [
      { name: "Operating checking", kind: "bank", mask: "7740", institution: "Sample Credit Union" },
      { name: "Merchant deposits", kind: "bank", mask: "7766", institution: "Sample Credit Union" },
      { name: "Supplies card", kind: "credit_card", mask: "3301", institution: "Example Card Co." },
    ],
    months: [
      { period: "2026-08", stage: "Month Closed" },
      { period: "2026-09", stage: "Month Closed" },
      { period: "2026-10", stage: "MKB Final Review" },
      { period: "2026-11", stage: "Client Entry in Progress" },
    ],
    items: [{ period: "2026-10", kind: "miscategorized", txnRef: "Oct 9 · Supplies card ••3301 · SAMPLE OVEN REPAIR", amount: 890, description: "Booked to Supplies; repair of equipment should go to Repairs & Maintenance.", status: "resolved", resolution: "Client approved the correction; reclassified." }],
    billing: { "2026-08": "paid", "2026-09": "paid", "2026-10": "paid", "2026-11": "open" },
    startedAt: on("2026-07-28T15:00:00"),
  },
  {
    clientId: "c-1009",
    title: "Monthly bookkeeping — Mockwell Design Studio",
    businessName: "Mockwell Design Studio",
    entityType: "Sole Prop",
    bookkeeperId: "s-rt",
    reviewerId: "s-mk",
    plan: "Monthly review & close — Starter",
    monthlyFee: 300,
    includes: ["Monthly categorization review", "1 bank + 1 card reconciliation", "Monthly P&L"],
    reports: ["Profit and Loss"],
    qbo: { status: "connected", company: "Mockwell Design Studio (Sample)", access: "client_authorized", realm: "•••• 0124", lastSync: d(-1, 22, 10), connectedAt: on("2025-10-02T15:00:00"), authorizedBy: "Morgan Mockwell" },
    accounts: [
      { name: "Business checking", kind: "bank", mask: "5120", institution: "Example National Bank" },
      { name: "Rewards card", kind: "credit_card", mask: "9081", institution: "Sample Card Services" },
    ],
    months: [
      { period: "2026-09", stage: "Month Closed" },
      { period: "2026-10", stage: "Ready for MKB Review" },
      { period: "2026-11", stage: "Client Entry in Progress" },
    ],
    billing: { "2026-09": "paid", "2026-10": "paid", "2026-11": "open" },
    messages: [{ from: "client", body: "October is all entered — submitted for review!", daysAgo: 1 }],
    startedAt: on("2025-10-02T15:00:00"),
  },
  {
    clientId: "c-1009",
    title: "Monthly bookkeeping — Mockwell Rental Properties",
    businessName: "Mockwell Rental Properties",
    entityType: "LLC",
    bookkeeperId: "s-mk",
    reviewerId: "s-rt",
    plan: "Monthly review & close — Starter",
    monthlyFee: 300,
    includes: ["Monthly categorization review", "1 bank reconciliation", "Monthly P&L by property"],
    reports: ["Profit and Loss", "Balance Sheet"],
    qbo: { status: "connected", company: "Mockwell Rentals LLC (Sample)", access: "qboa", realm: "•••• 7781", lastSync: d(0, 7, 30), connectedAt: on("2026-01-12T15:00:00"), authorizedBy: "Morgan Mockwell" },
    accounts: [{ name: "Rental operating account", kind: "bank", mask: "6602", institution: "Sample Community Bank" }],
    months: [
      { period: "2026-09", stage: "Reports Ready" },
      { period: "2026-10", stage: "MKB Reviewing" },
      { period: "2026-11", stage: "Client Entry in Progress" },
    ],
    items: [
      { period: "2026-10", kind: "uncategorized", txnRef: "Oct 3 · Rental operating ••6602 · SAMPLE PLUMBING LLC", amount: 345, description: "Uncategorized — which property was this repair for?", status: "open" },
      { period: "2026-10", kind: "missing_info", txnRef: "Oct 1 · Rental operating ••6602 · Deposit", amount: 1600, description: "Rent deposit not tagged to a property / class.", status: "open" },
    ],
    billing: { "2026-09": "paid", "2026-10": "open", "2026-11": "open" },
    startedAt: on("2026-01-12T15:00:00"),
  },
];

/* ------------------------------------------------------------------ */
/* Records placed on the central client profile                        */
/* ------------------------------------------------------------------ */

export const workspaceIdFor = (enrollmentId: string) => `BK-${enrollmentId}`;
export const acctId = (wsId: string, i: number) => `${wsId}-a${i}`;
const ORDER: MonthStage[] = ["Client Entry in Progress", "Ready for MKB Review", "MKB Reviewing", "Reconciliation in Progress", "Client Follow-up Needed", "MKB Final Review", "Reports Ready", "Month Closed"];
export const stageIndex = (s: MonthStage) => ORDER.indexOf(s);
const monthName = (p: string) => new Date(`${p}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const endOf = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m, 0, 12);
};

/** Statements, receipts, requests, invoices and messages for one bookkeeping engagement. */
export function booksClientRecords(seed: BooksSeed, enrollmentId: string, contact: string, invoiceStart: number) {
  const ws = workspaceIdFor(enrollmentId);
  const documents: ClientDocument[] = [];
  const invoices: Invoice[] = [];
  const messages: Message[] = [];
  let n = invoiceStart;

  seed.months.forEach((mo) => {
    const end = endOf(mo.period);
    if (end > SAMPLE_NOW) return; // month not over yet — no statements
    const past = stageIndex(mo.stage) >= 1 || mo.stage === "Client Follow-up Needed";
    seed.accounts.forEach((a, i) => {
      const name = `Statement — ${a.name} ••${a.mask} — ${monthName(mo.period)}`;
      if (seed.requests?.some((r) => r.name === name)) return;
      const uploaded = new Date(end);
      uploaded.setDate(uploaded.getDate() + 3 + i);
      if (!past && uploaded > SAMPLE_NOW) return;
      documents.push({
        id: `${ws}-st-${mo.period}-${i}`,
        name,
        service: "books",
        category: a.kind === "bank" ? "Bank statement" : "Credit card statement",
        status: stageIndex(mo.stage) >= stageIndex("MKB Final Review") ? "reviewed" : "received",
        sensitive: false,
        requestedAt: end.toISOString(),
        uploadedAt: uploaded.toISOString(),
        sizeKb: 180 + i * 40,
        uploadedBy: "client",
        workspaceId: ws,
        period: mo.period,
      });
    });
    if (past) {
      const up = new Date(end);
      up.setDate(up.getDate() + 6);
      documents.push({ id: `${ws}-rc-${mo.period}`, name: `Receipts batch — ${monthName(mo.period)}`, service: "books", category: "Receipts", status: "received", sensitive: false, requestedAt: end.toISOString(), uploadedAt: up.toISOString(), sizeKb: 920, uploadedBy: "client", workspaceId: ws, period: mo.period });
    }
  });
  (seed.requests ?? []).forEach((r, i) =>
    documents.push({ id: `${ws}-rq-${i}`, name: r.name, service: "books", category: r.category, status: "requested", sensitive: false, requestedAt: d(-3), workspaceId: ws, period: r.period }),
  );

  Object.entries(seed.billing).forEach(([period, status]) => {
    const [y, m] = period.split("-").map(Number);
    const issued = new Date(y, m - 1, 1, 9).toISOString();
    const due = new Date(y, m - 1, 15, 17).toISOString();
    invoices.push({
      id: `${ws}-inv-${period}`,
      number: `INV-B${String(n++).padStart(4, "0")}`,
      service: "books",
      description: `${seed.businessName} — bookkeeping, ${monthName(period)}`,
      amount: seed.monthlyFee,
      paid: status === "paid" ? seed.monthlyFee : 0,
      status,
      issuedAt: issued,
      dueAt: due,
      workspaceId: ws,
    });
  });
  (seed.extras ?? []).filter((x) => x.invoiced).forEach((x, i) => {
    const [y, m] = x.period.split("-").map(Number);
    invoices.push({ id: `${ws}-ex-${i}`, number: `INV-B${String(n++).padStart(4, "0")}`, service: "books", description: `${seed.businessName} — ${x.label}`, amount: x.amount, paid: x.amount, status: "paid", issuedAt: new Date(y, m - 1, 5, 9).toISOString(), dueAt: new Date(y, m - 1, 20, 17).toISOString(), workspaceId: ws });
  });

  (seed.messages ?? []).forEach((mm, i) =>
    messages.push({ id: `${ws}-msg-${i}`, from: mm.from, author: mm.from === "client" ? contact : seed.bookkeeperId === "s-mk" ? "MKB Owner" : "Robin Tate", body: mm.body, at: d(-mm.daysAgo, 10 + i, 15), service: "books", read: true, workspaceId: ws }),
  );

  return { documents, invoices, messages, nextInvoice: n };
}
