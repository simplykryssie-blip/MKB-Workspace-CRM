/**
 * Bookkeeping Workspace — configuration.
 *
 * Shared-responsibility model: clients keep their own QuickBooks Online
 * company and enter/categorize day-to-day transactions. MKB reviews that work,
 * reconciles bank and card accounts, resolves questions with the client,
 * prepares reports and closes the month. QuickBooks stays the accounting
 * system of record — nothing here records transactions or balances of record.
 */
import type { ActivityItem, Note } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Monthly close workflow                                              */
/* ------------------------------------------------------------------ */

export const MONTH_STAGES = [
  "Waiting on Client Items",
  "Ready for MKB Review",
  "MKB Reviewing",
  "Reconciliation in Progress",
  "Client Follow-up Needed",
  "MKB Final Review",
  "Reports Ready",
  "Month Closed",
] as const;
export type MonthStage = (typeof MONTH_STAGES)[number];

export type Responsible = "Client" | "MKB" | "Done";
export const STAGE_META: Record<MonthStage, { owner: Responsible; tone: "neutral" | "info" | "warning" | "success"; hint: string }> = {
  "Waiting on Client Items": { owner: "Client", tone: "neutral", hint: "Waiting on the client's items: bank feeds connected, receipts, notes on cash or unusual activity" },
  "Ready for MKB Review": { owner: "MKB", tone: "info", hint: "Client submitted the month — waiting for MKB to start review" },
  "MKB Reviewing": { owner: "MKB", tone: "info", hint: "Reviewing categorization, uncategorized and unusual activity, missing information" },
  "Reconciliation in Progress": { owner: "MKB", tone: "info", hint: "Reconciling bank and credit card accounts to statements" },
  "Client Follow-up Needed": { owner: "Client", tone: "warning", hint: "Waiting on client answers, corrections or supporting documents" },
  "MKB Final Review": { owner: "MKB", tone: "info", hint: "Confirming reconciliations and reviewing financial results" },
  "Reports Ready": { owner: "MKB", tone: "success", hint: "Agreed reports prepared — deliver and close the month" },
  "Month Closed": { owner: "Done", tone: "success", hint: "Month closed and completion date recorded" },
};

/** Calendar month label: "2026-10" → "October 2026". */
export const periodLabel = (p: string, short = false) =>
  new Date(`${p}-15T12:00:00`).toLocaleDateString("en-US", { month: short ? "short" : "long", year: "numeric" });
export const periodEnd = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m, 0, 12).toISOString();
};
export const nextPeriod = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
/** MKB's target: close each month by the 15th of the following month. */
export const closeTarget = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m, 15, 17).toISOString();
};

/* ------------------------------------------------------------------ */
/* QuickBooks Online                                                   */
/* ------------------------------------------------------------------ */

export type QboStatus = "connected" | "needs_reauth" | "invite_pending" | "not_connected";
export type QboAccess = "qboa" | "client_authorized";

export const QBO_STATUS: Record<QboStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral"; hint: string }> = {
  connected: { label: "Access confirmed", tone: "success", hint: "MKB can sign in to this client's QuickBooks company." },
  needs_reauth: { label: "Access lost", tone: "danger", hint: "MKB's access stopped working (removed, or the company changed). Ask the client to invite MKB again." },
  invite_pending: { label: "Waiting for invite", tone: "warning", hint: "The client has been asked to invite MKB as their accountant in QuickBooks." },
  not_connected: { label: "No access yet", tone: "neutral", hint: "MKB doesn't have access to this client's QuickBooks yet." },
};
export const QBO_ACCESS: Record<QboAccess, { label: string; detail: string }> = {
  qboa: { label: "QuickBooks Online Accountant", detail: "Client invited MKB as their accountant; MKB signs in through QuickBooks Online Accountant." },
  client_authorized: { label: "Client's own login (shared screen)", detail: "The client signs in themselves while working with MKB — MKB has no login of its own." },
};

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export const REPORT_TYPES = ["Profit and Loss", "Balance Sheet", "Cash Flow Statement", "General Ledger", "A/R Aging", "A/P Aging", "Budget vs. Actual"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportReview = "not_started" | "preparing" | "in_review" | "approved";
export type ReportDelivery = "not_delivered" | "available" | "delivered";

export type BooksReport = {
  id: string;
  type: ReportType;
  period: string;
  review: ReportReview;
  delivery: ReportDelivery;
  preparedAt?: string;
  approvedBy?: string;
  deliveredAt?: string;
  /** The report file on the client record (hidden from the client until made available or delivered). */
  docId?: string;
};

/* ------------------------------------------------------------------ */
/* Workspace model                                                     */
/* ------------------------------------------------------------------ */

export type BankAccount = { id: string; name: string; kind: "bank" | "credit_card"; mask: string; institution: string };

export type ReconStatus = "not_started" | "in_progress" | "discrepancy" | "reconciled";
export type Reconciliation = {
  accountId: string;
  status: ReconStatus;
  statementDate?: string;
  /** Entered by MKB from the bank/card statement (`sample` marks fictional demo values). */
  endingBalance?: number;
  discrepancy?: { amount: number; note: string };
  completedAt?: string;
  by?: string;
  sample?: boolean;
};

export type ReviewKind = "uncategorized" | "miscategorized" | "unusual" | "missing_receipt" | "missing_info" | "discrepancy";
export const REVIEW_KIND: Record<ReviewKind, string> = {
  uncategorized: "Uncategorized",
  miscategorized: "Possible miscategorization",
  unusual: "Unusual / questionable",
  missing_receipt: "Missing receipt",
  missing_info: "Missing information",
  discrepancy: "Reconciliation discrepancy",
};
export type ReviewStatus = "open" | "sent_to_client" | "client_responded" | "resolved";
export type ReviewItem = {
  id: string;
  kind: ReviewKind;
  /** Reference to the QuickBooks transaction (date · account · payee). */
  txnRef: string;
  amount?: number;
  description: string;
  status: ReviewStatus;
  assignedTo: string;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
  taskId?: string;
  clientResponse?: string;
};

export type ClientTaskType = "entry" | "categorize" | "receipts" | "statement" | "question" | "confirm" | "submit";
export const TASK_TYPE: Record<ClientTaskType, string> = {
  entry: "Complete transaction entry",
  categorize: "Categorize transactions",
  receipts: "Upload receipts",
  statement: "Provide statement",
  question: "Answer MKB question",
  confirm: "Confirm correction",
  submit: "Submit month for review",
};
export type ClientTask = {
  id: string;
  period: string;
  type: ClientTaskType;
  title: string;
  detail?: string;
  status: "open" | "done";
  /** One of the four tasks every month starts with (closed together when the month is submitted). */
  standard?: boolean;
  createdAt: string;
  completedAt?: string;
  completedBy?: "client" | "staff";
  response?: string;
  docIds: string[];
  reviewItemId?: string;
  requestDocId?: string;
};

export type BooksMonth = {
  id: string;
  period: string;
  stage: MonthStage;
  /** Where to return after client follow-up. */
  followupFrom?: MonthStage;
  assignedTo: string;
  submittedAt?: string;
  reviewStartedAt?: string;
  finalApproval?: { by: string; at: string; note?: string };
  closedAt?: string;
  reopenCount: number;
  recons: Reconciliation[];
  reviewItems: ReviewItem[];
  reports: BooksReport[];
  reviewNotes: Note[];
  history: { stage: MonthStage; at: string; by: string; note?: string }[];
};

export type ExtraCharge = { id: string; label: string; amount: number; period: string; invoiced: boolean };

export type WorkspaceBilling = { auto: boolean; day: number; dueDays: number; email: boolean };
export const DEFAULT_BILLING: WorkspaceBilling = { auto: false, day: 1, dueDays: 15, email: true };

export type BooksWorkspace = {
  id: string;
  clientId: string;
  enrollmentId?: string;
  businessName: string;
  entityType: string;
  bookkeeperId: string;
  reviewerId: string;
  service: { plan: string; monthlyFee: number; reports: ReportType[]; includes: string[] };
  extras: ExtraCharge[];
  /** Automatic monthly invoice: on `day` of each month, bill that month's fee (plus uninvoiced charges). */
  billing?: WorkspaceBilling;
  qbo: {
    status: QboStatus;
    companyName: string;
    access: QboAccess;
    /** Intuit company ID (realmId), shown masked. Tokens never reach the browser. */
    realmMasked?: string;
    connectedAt?: string;
    lastSyncAt?: string;
    authorizedBy?: string;
  };
  accounts: BankAccount[];
  months: BooksMonth[];
  tasks: ClientTask[];
  notes: Note[];
  activity: ActivityItem[];
  startedAt: string;
};

/** Permission keys (the server enforces access through the roles system). */
export const BOOKS_PERMISSIONS = {
  view: "books.workspaces.view",
  review: "books.review.manage",
  reconcile: "books.reconciliations.manage",
  approve: "books.close.approve",
  billing: "books.billing.manage",
  qbo: "books.quickbooks.manage",
} as const;
