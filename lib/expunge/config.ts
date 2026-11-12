/**
 * Expungement Center — configuration and domain types.
 *
 * MKB provides administrative assistance and document preparation for record
 * expungement. MKB is not a law firm, does not give legal advice, and never
 * determines eligibility or promises an outcome. Screening here is preliminary
 * and administrative: outcomes are chosen by people, against jurisdiction rules
 * an administrator has verified, and anything uncertain goes to qualified legal review.
 *
 * Jurisdiction rules, waiting periods and fees are configuration, not code, and
 * Louisiana and Texas are configured separately — one never applies to the other.
 */

export const NOT_LEGAL_ADVICE_EXP =
  "MKB Financial Group provides administrative assistance and document preparation. MKB is not a law firm and does not provide legal advice or representation. Completing intake does not establish eligibility, and courts and agencies make their own determinations. For legal advice, consult a licensed attorney.";

export const ACKNOWLEDGMENTS = [
  { key: "accurate", text: "The information I provide is accurate and complete to the best of my knowledge." },
  { key: "notLegal", text: "MKB provides administrative assistance and document preparation, not legal representation or legal advice." },
  { key: "noEligibility", text: "Completing this intake does not mean I am eligible for expungement." },
  { key: "jurisdiction", text: "Eligibility and filing requirements depend on the jurisdiction and my full case history." },
  { key: "agencies", text: "Courts and government agencies make their own decisions; MKB cannot guarantee any outcome." },
] as const;
export type AckKey = (typeof ACKNOWLEDGMENTS)[number]["key"];

/* ------------------------------------------------------------------ */
/* Statuses                                                            */
/* ------------------------------------------------------------------ */

/** Filing & court status of a case. */
export const CASE_STATUSES = [
  "Not Started",
  "Preparing",
  "Awaiting Client Approval",
  "Ready for Filing",
  "Submitted",
  "Awaiting Agency / Court Response",
  "Hearing Scheduled",
  "Additional Information Requested",
  "Granted",
  "Denied",
  "Withdrawn",
  "Completed",
  "On Hold",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const CASE_FLOW: CaseStatus[] = ["Not Started", "Preparing", "Awaiting Client Approval", "Ready for Filing", "Submitted", "Awaiting Agency / Court Response", "Hearing Scheduled", "Granted", "Completed"];
export const STATUS_TONE: Record<CaseStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  "Not Started": "neutral",
  Preparing: "info",
  "Awaiting Client Approval": "warning",
  "Ready for Filing": "info",
  Submitted: "info",
  "Awaiting Agency / Court Response": "info",
  "Hearing Scheduled": "warning",
  "Additional Information Requested": "warning",
  Granted: "success",
  Denied: "danger",
  Withdrawn: "neutral",
  Completed: "success",
  "On Hold": "neutral",
};

/** Preliminary administrative screening — never a legal determination. */
export const SCREENING_OUTCOMES = [
  "Information Incomplete",
  "Awaiting Records",
  "Ready for Review",
  "Potentially Eligible — Pending Verification",
  "Potentially Ineligible — Further Review Required",
  "Attorney / Qualified Legal Review Needed",
  "Administrative Processing Approved",
] as const;
export type ScreeningOutcome = (typeof SCREENING_OUTCOMES)[number];
export const OUTCOME_TONE: Record<ScreeningOutcome, "neutral" | "info" | "success" | "warning" | "danger"> = {
  "Information Incomplete": "neutral",
  "Awaiting Records": "neutral",
  "Ready for Review": "info",
  "Potentially Eligible — Pending Verification": "info",
  "Potentially Ineligible — Further Review Required": "warning",
  "Attorney / Qualified Legal Review Needed": "danger",
  "Administrative Processing Approved": "success",
};

/** Dashboard phase, derived from intake, records, screening and filing status. */
export const PHASES = [
  "New inquiry",
  "Intake awaiting completion",
  "Awaiting criminal records",
  "Awaiting court minutes",
  "Awaiting eligibility review",
  "Flagged for legal review",
  "Documents being prepared",
  "Awaiting client approval",
  "Ready for filing",
  "Filed / awaiting court action",
  "Hearing scheduled",
  "Order received — finishing",
  "Completed",
  "Closed — not granted",
  "On hold",
] as const;
export type Phase = (typeof PHASES)[number];

/* ------------------------------------------------------------------ */
/* Jurisdictions (administrator-maintained)                            */
/* ------------------------------------------------------------------ */

/** States active in this release. The architecture supports more; none are activated or advertised. */
export const RELEASE_STATES = ["LA", "TX"] as const;

/**
 * A distinct legal process ("workflow") within a jurisdiction. Each has its own
 * rules, screening criteria, records checklist, forms and fees, and a case
 * belongs to exactly one. Texas expunction and Texas orders of nondisclosure
 * are separate workflows and are never combined.
 */
export type Remedy = { id: string; name: string; short: string; description: string; active: boolean };
export type Criterion = { id: string; remedyId: string; question: string; notes?: string } & Verified;

export type Verified = { lastVerifiedAt?: string; verifiedBy?: string };
export type Court = { id: string; name: string; clerk: string; clerkContact: string; daOffice?: string; daContact?: string; notes?: string };
export type Locality = { id: string; name: string; courts: Court[] };
export type JRule = { id: string; remedyId: string; title: string; citation: string; description: string; appliesTo: string; waitingPeriod: string; sourceUrl?: string; notes?: string } & Verified;
export type DocRequirement = { id: string; remedyId: string; caseType: string; docs: string[] } & Verified;
export type FilingForm = { id: string; remedyId: string; name: string; source: string; url?: string } & Verified;
export type GovFee = { id: string; remedyId: string; label: string; kind: "court_filing" | "clerk" | "government" | "records"; amount?: number; payableTo: string; notes?: string } & Verified;
export type Contact = { id: string; name: string; role: string; phone?: string; email?: string; url?: string };
export type Custodian = { id: string; name: string; type: "Clerk of court" | "Court" | "Law enforcement" | "State repository" | "Other"; locality?: string; contact: string; methods: string[]; notes?: string };

export type Jurisdiction = {
  id: string;
  state: string;
  stateName: string;
  localityLabel: "Parish" | "County";
  active: boolean;
  localities: Locality[];
  remedies: Remedy[];
  criteria: Criterion[];
  classifications: string[];
  rules: JRule[];
  requiredDocs: DocRequirement[];
  forms: FilingForm[];
  procedures: string;
  fees: GovFee[];
  contacts: Contact[];
  custodians: Custodian[];
  sources: { label: string; url?: string }[];
  verificationNotes: string;
} & Verified;

/* ------------------------------------------------------------------ */
/* Matters, cases, dockets, charges                                    */
/* ------------------------------------------------------------------ */

export const DISPOSITIONS = ["Dismissed", "Acquitted / not guilty", "Refused / not prosecuted", "Diverted / pretrial intervention", "Deferred adjudication", "Set aside", "Convicted", "Pending", "Unknown"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export type Charge = {
  id: string;
  description: string;
  statute?: string;
  classification?: string;
  disposition: Disposition;
  dispositionDate?: string;
  convictionDate?: string;
  sentence?: string;
  notes?: string;
};
export type Docket = { id: string; court: string; docketNumber: string; charges: Charge[] };

export type RecordVerification = "not_requested" | "requested" | "received" | "verified" | "incomplete";
export const RECORD_META: Record<RecordVerification, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  not_requested: { label: "Not requested", tone: "neutral" },
  requested: { label: "Requested", tone: "info" },
  received: { label: "Received — verify", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  incomplete: { label: "Incomplete", tone: "danger" },
};
export const RECORD_METHODS = ["Online portal", "Mail", "In person", "Email", "Fax", "Client provided"] as const;
export type RecordItem = {
  id: string;
  docType: string;
  required: boolean;
  /** Which record this is: minutes, criminal history, etc. (drives dashboard phases). */
  kind: "criminal_history" | "arrest" | "court_minutes" | "disposition" | "other";
  custodianId?: string;
  custodianName?: string;
  requestedAt?: string;
  method?: (typeof RECORD_METHODS)[number];
  fee?: number;
  feePaid?: boolean;
  receivedAt?: string;
  docId?: string;
  status: RecordVerification;
  missingInfo?: string;
};

export type ScreeningReview = { id: string; at: string; byId: string; reviewerName?: string; outcome: ScreeningOutcome; sources: string[]; explanation: string; legal?: boolean };
export type Tri = "yes" | "no" | "unknown";
export type Screening = {
  ruleIds: string[];
  offenseCategory: string;
  dispositionSummary: string;
  sentenceCompleted: Tri;
  waitingPeriod: string;
  waitingPeriodMet: Tri;
  obligationsOutstanding: Tri;
  pendingCharges: Tri;
  onSupervision: Tri;
  priorExpungements: Tri;
  supportingDocsComplete: Tri;
  missingInfo: string;
  disqualifyingIssues: string;
  legalReviewRequired: boolean;
  /** Answers to the workflow's own screening criteria (by criterion id). */
  answers: Record<string, Tri>;
  outcome: ScreeningOutcome;
  reviews: ScreeningReview[];
};

export type PrepStatus = "not_started" | "in_progress" | "ready_for_review" | "changes_requested" | "internally_approved";
export const PREP_META: Record<PrepStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  ready_for_review: { label: "Ready for internal review", tone: "warning" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  internally_approved: { label: "Internally approved", tone: "success" },
};
export type PrepForm = { id: string; name: string; source: string; status: "needed" | "drafted" | "final"; docId?: string };
export type Prep = {
  preparerId: string;
  reviewerId: string;
  status: PrepStatus;
  forms: PrepForm[];
  missing: string[];
  clientApproval: "not_sent" | "sent" | "approved" | "changes_requested";
  clientComment?: string;
  delivery: "not_delivered" | "delivered";
  deliveredAt?: string;
};

export type Filing = {
  court: string;
  clerkContact: string;
  daContact?: string;
  filedAt?: string;
  method?: string;
  confirmationNumber?: string;
  confirmationDocId?: string;
  confirmationVerified?: boolean;
  filingFee?: number;
  feeStatus: "not_due" | "unpaid" | "paid";
  hearingAt?: string;
  requirements?: string;
  courtResponse?: string;
  finalOrderDocId?: string;
  finalOrderVerified?: boolean;
  completedAt?: string;
};

export type StatusEvent = { at: string; byId: string; status: CaseStatus | "note"; note?: string };

export type ExpCase = {
  id: string;
  number: string;
  matterId: string;
  clientId: string;
  jurisdictionId: string;
  state: string;
  /** The single workflow this case follows (e.g. Texas expunction OR Texas nondisclosure — never both). */
  remedyId?: string;
  localityId?: string;
  locality: string;
  arrestingAgency: string;
  arrestDate?: string;
  arrestNumber?: string;
  arrestingJurisdiction?: string;
  dockets: Docket[];
  supervision?: string;
  sentenceCompleted: Tri;
  obligations: "paid" | "outstanding" | "none" | "unknown";
  resolution?: string;
  notes?: string;
  serviceType: string;
  complexity: Complexity;
  assignedTo: string;
  status: CaseStatus;
  holdFrom?: CaseStatus;
  holdReason?: string;
  records: RecordItem[];
  screening: Screening;
  prep: Prep;
  filing: Filing;
  history: StatusEvent[];
  internalNotes: { id: string; authorId: string; body: string; at: string }[];
  createdAt: string;
  /** Created by the client in the portal and not yet reviewed by staff. */
  draft?: boolean;
};

export type IntakeStatus = "inquiry" | "sent" | "in_progress" | "submitted" | "reviewed";
export const INTAKE_META: Record<IntakeStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" }> = {
  inquiry: { label: "New inquiry", tone: "info" },
  sent: { label: "Intake sent", tone: "warning" },
  in_progress: { label: "Client completing intake", tone: "warning" },
  submitted: { label: "Intake submitted — review", tone: "info" },
  reviewed: { label: "Intake reviewed", tone: "success" },
};
export type Intake = {
  status: IntakeStatus;
  step: number;
  first: string;
  middle: string;
  last: string;
  aliases: string[];
  currentAddress: string;
  previousAddresses: string[];
  preferredContact: string;
  idDoc: "not_requested" | "requested" | "received";
  idDocId?: string;
  additional: { pendingCharges: Tri; pendingDetail?: string; onSupervision: Tri; supervisionDetail?: string; priorExpungements: Tri; previousApplications: Tri; deniedApplications: Tri; otherCases?: string; hasRecords: Tri };
  acks: Partial<Record<AckKey, string>>;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

export const ASSIGNMENT_ROLES = ["Intake review", "Records collection", "Client follow-up", "Document preparation", "Quality review", "Filing coordination", "Case completion"] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export type InfoRequest = { id: string; caseId?: string; label: string; detail?: string; file: boolean; status: "open" | "responded" | "accepted"; response?: string; docIds: string[]; createdAt: string; respondedAt?: string };

export type AccessEvent = { id: string; at: string; who: string; role: string; action: string; caseId?: string };

export type ExpMatter = {
  id: string;
  number: string;
  clientId: string;
  enrollmentId?: string;
  source: "website" | "phone" | "referral" | "portal" | "staff";
  createdAt: string;
  intake: Intake;
  assignments: Record<AssignmentRole, string>;
  info: InfoRequest[];
  notes: { id: string; authorId: string; body: string; at: string }[];
  access: AccessEvent[];
  /** The submitted Record Relief intake this matter was opened from. */
  intakeId?: string;
  /** The client accepted the engagement letter (versions + who, when and how). Recorded once, by the server. */
  engagement?: { letterKey: "exp"; version: number; termsVersion: number; acceptedName: string; acceptedAt: string; method: "in_office" | "paper" | "online"; recordedBy?: string };
};

/* ------------------------------------------------------------------ */
/* Pricing (administrator-configured)                                  */
/* ------------------------------------------------------------------ */

export type Complexity = "standard" | "moderate" | "complex";
export const COMPLEXITY: Record<Complexity, string> = { standard: "Standard", moderate: "Moderate (multiple charges or dockets)", complex: "Complex (multiple courts or unusual history)" };
export type ServiceType = { id: string; name: string; description: string; active: boolean };
/** Price per case by service type × workflow (which implies the jurisdiction) × complexity. "Any" = fallback. */
export type PriceRule = { id: string; serviceTypeId: string; remedyId: string; complexity: Complexity; fee: number };

export type FeeKind = "service" | "additional" | "discount" | "filing" | "clerk" | "government" | "records" | "third_party";
export const FEE_KIND: Record<FeeKind, { label: string; group: "mkb" | "passthrough" }> = {
  service: { label: "MKB service fee", group: "mkb" },
  additional: { label: "Additional MKB fee", group: "mkb" },
  discount: { label: "Discount", group: "mkb" },
  filing: { label: "Court filing fee", group: "passthrough" },
  clerk: { label: "Clerk fee", group: "passthrough" },
  government: { label: "Government fee", group: "passthrough" },
  records: { label: "Records request fee", group: "passthrough" },
  third_party: { label: "Other third-party cost", group: "passthrough" },
};

/* ------------------------------------------------------------------ */
/* Access preview (enforced server-side in Phase 3)                    */
/* ------------------------------------------------------------------ */

export const EXP_ROLES = {
  owner: { label: "Owner", criminalHistory: true, edit: true, screening: true, billing: true, admin: true, revealSsn: true },
  coordinator: { label: "Case coordinator", criminalHistory: true, edit: true, screening: true, billing: false, admin: false, revealSsn: true },
  intake: { label: "Intake staff (no criminal-history access)", criminalHistory: false, edit: true, screening: false, billing: false, admin: false, revealSsn: false },
  billing: { label: "Billing staff", criminalHistory: false, edit: false, screening: false, billing: true, admin: false, revealSsn: false },
} as const;
export type ExpRole = keyof typeof EXP_ROLES;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const SSN_POLICY = "Collected because official forms may require it. Production requirements: field-level encryption at rest in a separate vault, never stored in browser storage or logs, shown masked by default, revealed only by permitted roles, and every view recorded in the audit log.";
export const mask = (v?: string) => (!v ? "—" : v.length <= 4 ? "••••" : `••••${v.slice(-4)}`);
export const chargeCount = (c: ExpCase) => c.dockets.reduce((s, d) => s + d.charges.length, 0);
export const verifiedLabel = (v: Verified) => (v.lastVerifiedAt ? `Verified ${new Date(v.lastVerifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Not verified");
