/**
 * Tax Preparation Center — configuration (statuses, forms, due dates, fee
 * schedule, organizer templates). Everything here is generic reference data;
 * no client information lives in this file.
 */
import type { ActivityItem, ClientType, Note } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Statuses + workflow                                                 */
/* ------------------------------------------------------------------ */

export const RETURN_STATUSES = [
  "Intake",
  "Awaiting Documents",
  "Ready for Review",
  "In Preparation",
  "Awaiting Client Approval",
  "Ready to E-file",
  "Submitted",
  "Accepted",
  "Rejected",
  "Completed",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Linear path used for the stepper ("Rejected" branches off "Submitted"). */
export const STATUS_PATH: ReturnStatus[] = ["Intake", "Awaiting Documents", "Ready for Review", "In Preparation", "Awaiting Client Approval", "Ready to E-file", "Submitted", "Accepted", "Completed"];

export type StatusTone = "neutral" | "info" | "warning" | "danger" | "success";
export const STATUS_META: Record<ReturnStatus, { tone: StatusTone; hint: string; waitingOn: "client" | "staff" | "irs" | "none" }> = {
  Intake: { tone: "neutral", hint: "Engagement set up; organizer and document requests not sent yet", waitingOn: "staff" },
  "Awaiting Documents": { tone: "warning", hint: "Organizer / documents requested from the client", waitingOn: "client" },
  "Ready for Review": { tone: "info", hint: "Documents in — preparer reviews them before starting", waitingOn: "staff" },
  "In Preparation": { tone: "info", hint: "Return being prepared; needs reviewer sign-off before client approval", waitingOn: "staff" },
  "Awaiting Client Approval": { tone: "warning", hint: "Client reviewing the return and signing the e-file authorization", waitingOn: "client" },
  "Ready to E-file": { tone: "info", hint: "Approved and signed — ready to transmit", waitingOn: "staff" },
  Submitted: { tone: "info", hint: "Transmitted — waiting for acknowledgement", waitingOn: "irs" },
  Accepted: { tone: "success", hint: "Accepted — close out billing and deliver copies", waitingOn: "staff" },
  Rejected: { tone: "danger", hint: "Rejected — correct the issue and resubmit", waitingOn: "staff" },
  Completed: { tone: "success", hint: "Filed, paid and delivered", waitingOn: "none" },
};

/* ------------------------------------------------------------------ */
/* Forms + due dates                                                   */
/* ------------------------------------------------------------------ */

export const INDIVIDUAL_FORMS = ["1040", "1040 + Sch C", "1040-X"] as const;
export const BUSINESS_FORMS = ["1065", "1120-S", "1120", "990"] as const;
export type TaxForm = (typeof INDIVIDUAL_FORMS)[number] | (typeof BUSINESS_FORMS)[number];

export const FORM_LABEL: Record<TaxForm, string> = {
  "1040": "1040 — Individual",
  "1040 + Sch C": "1040 + Schedule C — Self-employed",
  "1040-X": "1040-X — Amended individual",
  "1065": "1065 — Partnership / multi-member LLC",
  "1120-S": "1120-S — S corporation",
  "1120": "1120 — C corporation",
  "990": "990 — Exempt organization",
};

export const FILING_STATUSES = ["Single", "Married filing jointly", "Married filing separately", "Head of household", "Qualifying surviving spouse"] as const;
export type FilingStatus = (typeof FILING_STATUSES)[number];

export const formsFor = (kind: ClientType) => (kind === "business" ? BUSINESS_FORMS : INDIVIDUAL_FORMS) as readonly TaxForm[];

/** Suggested form from a business entity type. */
export function formForEntity(entity?: string): TaxForm {
  if (entity === "S-Corp") return "1120-S";
  if (entity === "C-Corp") return "1120";
  if (entity === "Nonprofit") return "990";
  return "1065";
}

/** Weekend deadlines roll to the next business day (federal holidays not modeled in the preview). */
function rollWeekend(d: Date) {
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
const at5pm = (y: number, m: number, day: number) => rollWeekend(new Date(y, m - 1, day, 17, 0, 0)).toISOString();

/** Original and extended due dates for a tax year + form. 1040-X has no fixed deadline. */
export function dueDates(form: TaxForm, taxYear: number): { due?: string; extended?: string } {
  const y = taxYear + 1;
  if (form === "1040-X") return {};
  if (form === "1065" || form === "1120-S") return { due: at5pm(y, 3, 15), extended: at5pm(y, 9, 15) };
  if (form === "990") return { due: at5pm(y, 5, 15), extended: at5pm(y, 11, 15) };
  return { due: at5pm(y, 4, 15), extended: at5pm(y, 10, 15) };
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

export type FeeItem = { code: string; label: string; kind: "individual" | "business" | "both"; price: number; unit?: string };

export const DEFAULT_FEE_SCHEDULE: FeeItem[] = [
  { code: "F1040", label: "Form 1040 — base return", kind: "individual", price: 325 },
  { code: "SCHC", label: "Schedule C — self-employment", kind: "individual", price: 150 },
  { code: "SCHE", label: "Schedule E — rental property", kind: "individual", price: 125, unit: "per property" },
  { code: "SCHD", label: "Schedule D — investments / crypto", kind: "individual", price: 75 },
  { code: "SCHA", label: "Schedule A — itemized deductions", kind: "individual", price: 75 },
  { code: "DEP", label: "Dependents & credits worksheet", kind: "individual", price: 25 },
  { code: "F1040X", label: "Form 1040-X — amended return", kind: "individual", price: 225 },
  { code: "EXT-I", label: "Extension (Form 4868)", kind: "individual", price: 50 },
  { code: "F1065", label: "Form 1065 — partnership return", kind: "business", price: 900 },
  { code: "F1120S", label: "Form 1120-S — S corporation return", kind: "business", price: 1000 },
  { code: "F1120", label: "Form 1120 — C corporation return", kind: "business", price: 1200 },
  { code: "F990", label: "Form 990 / 990-EZ — exempt organization", kind: "business", price: 600 },
  { code: "K1", label: "Schedule K-1", kind: "business", price: 50, unit: "per owner" },
  { code: "PAY", label: "Payroll / 1099 information returns", kind: "business", price: 100 },
  { code: "EXT-B", label: "Extension (Form 7004)", kind: "business", price: 75 },
  { code: "STATE", label: "State return", kind: "both", price: 75, unit: "per state" },
  { code: "STATE-B", label: "State business return", kind: "business", price: 150, unit: "per state" },
  { code: "PRIOR", label: "Prior-year / amended review", kind: "both", price: 125 },
  { code: "PLAN", label: "Tax planning & estimates", kind: "both", price: 100 },
];

/** Starting price lines when a return is created. */
export function defaultPricing(form: TaxForm): { code: string; qty: number }[] {
  switch (form) {
    case "1040":
      return [{ code: "F1040", qty: 1 }, { code: "STATE", qty: 1 }];
    case "1040 + Sch C":
      return [{ code: "F1040", qty: 1 }, { code: "SCHC", qty: 1 }, { code: "STATE", qty: 1 }];
    case "1040-X":
      return [{ code: "F1040X", qty: 1 }, { code: "STATE", qty: 1 }];
    case "1065":
      return [{ code: "F1065", qty: 1 }, { code: "K1", qty: 2 }, { code: "STATE-B", qty: 1 }];
    case "1120-S":
      return [{ code: "F1120S", qty: 1 }, { code: "K1", qty: 1 }, { code: "STATE-B", qty: 1 }];
    case "1120":
      return [{ code: "F1120", qty: 1 }, { code: "STATE-B", qty: 1 }];
    case "990":
      return [{ code: "F990", qty: 1 }];
  }
}

/* ------------------------------------------------------------------ */
/* Organizers                                                          */
/* ------------------------------------------------------------------ */

export type DocSpec = { name: string; category: string; sensitive: boolean };
export type OrganizerQuestion = {
  id: string;
  section: string;
  label: string;
  type: "yesno" | "number" | "select" | "text";
  options?: string[];
  /** Documents added to the checklist when answered "Yes" (or a number > 0). */
  docs?: DocSpec[];
};

export const ORGANIZERS: Record<ClientType, { title: string; questions: OrganizerQuestion[] }> = {
  individual: {
    title: "Individual tax organizer",
    questions: [
      { id: "fs_change", section: "Personal & filing", label: "Did your filing status change this year (marriage, divorce, etc.)?", type: "yesno" },
      { id: "dependents", section: "Personal & filing", label: "How many dependents will you claim?", type: "number", docs: [{ name: "Dependent SSN cards / birth certificates", category: "Identity", sensitive: true }] },
      { id: "moved", section: "Personal & filing", label: "Did you move during the year?", type: "yesno" },
      { id: "w2", section: "Income", label: "How many W-2 jobs did you have?", type: "number", docs: [{ name: "W-2 forms (all employers)", category: "Income", sensitive: false }] },
      { id: "se", section: "Income", label: "Self-employment, gig or 1099-NEC/1099-K income?", type: "yesno", docs: [{ name: "1099-NEC / 1099-K", category: "Income", sensitive: false }, { name: "Business income & expense summary", category: "Income", sensitive: false }] },
      { id: "unemp", section: "Income", label: "Unemployment benefits?", type: "yesno", docs: [{ name: "1099-G", category: "Income", sensitive: false }] },
      { id: "interest", section: "Income", label: "Interest or dividends?", type: "yesno", docs: [{ name: "1099-INT / 1099-DIV", category: "Income", sensitive: false }] },
      { id: "sales", section: "Income", label: "Sold stocks, crypto or other investments?", type: "yesno", docs: [{ name: "1099-B / crypto gain-loss report", category: "Income", sensitive: false }] },
      { id: "rental", section: "Income", label: "Own rental property?", type: "yesno", docs: [{ name: "Rental income & expense summary", category: "Income", sensitive: false }] },
      { id: "retire", section: "Income", label: "Retirement distributions or Social Security?", type: "yesno", docs: [{ name: "1099-R / SSA-1099", category: "Income", sensitive: false }] },
      { id: "mortgage", section: "Deductions & credits", label: "Paid mortgage interest or property tax?", type: "yesno", docs: [{ name: "1098 mortgage interest statement", category: "Deductions", sensitive: false }] },
      { id: "education", section: "Deductions & credits", label: "Paid tuition or student loan interest?", type: "yesno", docs: [{ name: "1098-T / 1098-E", category: "Deductions", sensitive: false }] },
      { id: "childcare", section: "Deductions & credits", label: "Paid for childcare?", type: "yesno", docs: [{ name: "Childcare provider statement (name, EIN, amount)", category: "Credits", sensitive: false }] },
      { id: "marketplace", section: "Deductions & credits", label: "Health insurance through the Marketplace?", type: "yesno", docs: [{ name: "1095-A", category: "Credits", sensitive: false }] },
      { id: "charity", section: "Deductions & credits", label: "Charitable donations?", type: "yesno", docs: [{ name: "Donation receipts", category: "Deductions", sensitive: false }] },
      { id: "estimates", section: "Payments & banking", label: "Made estimated tax payments?", type: "yesno", docs: [{ name: "Estimated payment confirmations", category: "Payments", sensitive: false }] },
      { id: "refund", section: "Payments & banking", label: "Refund preference", type: "select", options: ["Direct deposit", "Paper check", "Apply to next year"] },
      { id: "notices", section: "Payments & banking", label: "Received any IRS or state letters?", type: "yesno", docs: [{ name: "IRS / state notices", category: "Correspondence", sensitive: true }] },
    ],
  },
  business: {
    title: "Business tax organizer",
    questions: [
      { id: "owners", section: "Entity", label: "Number of owners / shareholders", type: "number" },
      { id: "own_change", section: "Entity", label: "Any change in ownership this year?", type: "yesno", docs: [{ name: "Ownership change documents", category: "Entity", sensitive: false }] },
      { id: "method", section: "Entity", label: "Accounting method", type: "select", options: ["Cash", "Accrual"] },
      { id: "mkb_books", section: "Income & expenses", label: "Does MKB keep your books?", type: "yesno" },
      { id: "merchant", section: "Income & expenses", label: "Card / marketplace sales (1099-K)?", type: "yesno", docs: [{ name: "1099-K statements", category: "Income", sensitive: false }] },
      { id: "inventory", section: "Income & expenses", label: "Carry inventory?", type: "yesno", docs: [{ name: "Year-end inventory count", category: "Financials", sensitive: false }] },
      { id: "payroll", section: "Payroll & contractors", label: "Run payroll?", type: "yesno", docs: [{ name: "Payroll reports (941 / 940 / W-3)", category: "Payroll", sensitive: false }] },
      { id: "contractors", section: "Payroll & contractors", label: "Paid contractors $600 or more?", type: "yesno", docs: [{ name: "Contractor list with W-9s", category: "Payroll", sensitive: true }] },
      { id: "assets", section: "Assets & loans", label: "Bought equipment or vehicles?", type: "yesno", docs: [{ name: "Asset purchase invoices", category: "Assets", sensitive: false }] },
      { id: "loans", section: "Assets & loans", label: "Business loans or lines of credit?", type: "yesno", docs: [{ name: "Year-end loan statements", category: "Financials", sensitive: false }] },
      { id: "biz_estimates", section: "Payments", label: "Made estimated or extension payments?", type: "yesno", docs: [{ name: "Estimated payment confirmations", category: "Payments", sensitive: false }] },
      { id: "biz_notices", section: "Payments", label: "Received any IRS or state letters?", type: "yesno", docs: [{ name: "IRS / state notices", category: "Correspondence", sensitive: true }] },
    ],
  },
};

/** Checklist every return starts with (organizer answers add more). */
export function baseChecklist(kind: ClientType, opts: { hasEin: boolean; form: TaxForm }): DocSpec[] {
  if (kind === "business")
    return [
      ...(opts.hasEin ? [] : [{ name: "EIN confirmation letter (CP 575 / 147C)", category: "Tax ID", sensitive: true }]),
      { name: "Year-end profit & loss and balance sheet", category: "Financials", sensitive: false },
      { name: "Prior-year business return", category: "Tax return", sensitive: true },
      { name: "Responsible party photo ID", category: "Identity", sensitive: true },
    ];
  return [
    { name: "Government photo ID", category: "Identity", sensitive: true },
    { name: opts.form === "1040-X" ? "Originally filed return" : "Prior-year tax return", category: "Tax return", sensitive: true },
    ...(opts.form === "1040-X" ? [{ name: "Documents supporting the amendment", category: "Supporting", sensitive: false }] : []),
  ];
}

/* ------------------------------------------------------------------ */
/* E-file                                                              */
/* ------------------------------------------------------------------ */

/** Sample acknowledgement codes for the preview (illustrative wording). */
export const REJECTION_REASONS = [
  { code: "IND-031-04", reason: "Prior-year AGI or self-select PIN does not match IRS records" },
  { code: "IND-181-01", reason: "Taxpayer prior-year AGI / PIN missing" },
  { code: "R0000-504-02", reason: "Dependent SSN already claimed on another return" },
  { code: "R0000-902-01", reason: "Business name control does not match the EIN" },
  { code: "F1040-164-01", reason: "Earned income credit claimed but not allowed (prior disallowance)" },
  { code: "STATE-GA-0101", reason: "State return: withholding does not match W-2 records" },
  { code: "OTHER", reason: "Other — see notes" },
];

/* ------------------------------------------------------------------ */
/* Return model                                                        */
/* ------------------------------------------------------------------ */

export type FollowUp = {
  id: string; question: string; ref?: string; status: "draft" | "sent" | "answered"; answer?: string; askedAt?: string; answeredAt?: string;
  /** Which intake answer ("section.question" or "section.row.question") or flag ("flag:…") this is about. */
  qKey?: string;
  /** Staff applied the reply to the intake or closed it. */
  resolvedAt?: string;
};

/** Which letter versions the client accepted, and how. The wording itself is kept on the server by version. */
export type EngagementAcceptance = {
  letterKey: "tax_individual" | "tax_business";
  version: number;
  termsVersion: number;
  /** Shown in lists and the intake PDF. */
  title: string;
  acceptedName: string;
  acceptedAt: string;
  method: "online" | "in_office" | "paper";
  recordedBy?: string;
};

export type OrganizerState = {
  status: "not_sent" | "sent" | "in_progress" | "submitted" | "reviewed";
  sentAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  /** Earlier quick screener answers (kept for returns created before the full interview). */
  answers: Record<string, string>;
  /** Full guided interview (see lib/tax/interview). Sensitive numbers are kept as last four only. */
  interview?: {
    answers: import("@/lib/tax/interview/engine").Answers;
    updatedAt?: string;
    enteredBy?: "client" | "staff";
    consentName?: string;
    /** Section the client stopped on, so they resume where they left off. */
    step?: number;
  };
  /** Preparer questions sent back to the client in one request. */
  followUps?: FollowUp[];
  /** Engagement letter the client accepted with this interview. */
  engagement?: EngagementAcceptance;
};

export type ChecklistItem = {
  id: string;
  name: string;
  category: string;
  required: boolean;
  sensitive: boolean;
  source: "standard" | "organizer" | "custom";
  /** Linked document on the central client profile (status comes from there). */
  docId?: string;
  waivedReason?: string;
  /** Prior-year returns: documents archived from that season. */
  archived?: boolean;
};

export type EfileAttempt = {
  id: string;
  jurisdiction: string; // "Federal" or a state code
  submittedAt: string;
  submissionId: string;
  result: "pending" | "accepted" | "rejected";
  resultAt?: string;
  code?: string;
  reason?: string;
};

export type PriceLine = { id: string; code?: string; description: string; qty: number; unit: number };

export type TaxReturn = {
  id: string;
  clientId: string;
  /** The client's Tax Preparation engagement this return belongs to. */
  enrollmentId?: string;
  taxYear: number;
  kind: ClientType;
  form: TaxForm;
  filingStatus?: FilingStatus;
  states: string[];
  status: ReturnStatus;
  preparerId: string;
  reviewerId: string;
  dueAt?: string;
  extension?: { filedAt: string; dueAt: string };
  reviewSignoff?: { by: string; at: string; note?: string };
  approvalSignatureId?: string;
  clientApprovedAt?: string;
  organizer: OrganizerState;
  checklist: ChecklistItem[];
  efile: EfileAttempt[];
  pricing: { lines: PriceLine[]; discount: number };
  statusHistory: { status: ReturnStatus; at: string; by: string; note?: string }[];
  notes: Note[];
  activity: ActivityItem[];
  createdAt: string;
  completedAt?: string;
};

export const priceTotal = (r: Pick<TaxReturn, "pricing">) => Math.max(0, r.pricing.lines.reduce((s, l) => s + l.qty * l.unit, 0) - r.pricing.discount);

/* ------------------------------------------------------------------ */
/* Permissions (enforced server-side in Phase 3)                       */
/* ------------------------------------------------------------------ */

/**
 * Permission keys the owner will combine into custom roles (Team & Permissions).
 * The Tax Center's "Preview access" switch simulates combinations of these.
 */
export const TAX_PERMISSIONS = {
  view: "tax.returns.view",
  edit: "tax.returns.edit",
  review: "tax.returns.review",
  efile: "tax.returns.efile",
  billing: "tax.billing.manage",
  sensitiveDocs: "documents.sensitive.view",
  revealIds: "pii.taxid.reveal",
} as const;
export type TaxPermission = (typeof TAX_PERMISSIONS)[keyof typeof TAX_PERMISSIONS];
