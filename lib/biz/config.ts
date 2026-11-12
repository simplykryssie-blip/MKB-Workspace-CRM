/**
 * Business Services Center — configuration and domain types.
 *
 * MKB provides administrative business services (formation assistance,
 * compliance tracking, administrative document preparation and consulting).
 * MKB is not a law firm and does not give legal advice; the catalog, client
 * portal and deliverables say so. Nothing here submits a filing: staff file
 * with agencies outside the app and record what happened, and an approval is
 * only recorded with a confirmation the staff member has verified.
 */
import type { Client } from "@/lib/types";

export type EntityType = NonNullable<Client["business"]>["entityType"] | "Corporation";
export const ENTITY_TYPES: EntityType[] = ["LLC", "Corporation", "S-Corp", "C-Corp", "Sole Prop", "Partnership", "Nonprofit"];
/** All 50 states. (Territories and DC can be added later if MKB serves them.) */
export const STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];
export const US_STATES = STATES.map(([c]) => c);
export const stateName = (code: string) => STATES.find(([c]) => c === code)?.[1] ?? code;
/** Options for state dropdowns: "GA — Georgia". */
export const stateOptions = (): [string, string][] => STATES.map(([c, n]) => [c, `${c} — ${n}`]);

export const NOT_LEGAL_ADVICE =
  "MKB Financial Group provides administrative business services and document preparation from information you provide. MKB is not a law firm and does not provide legal advice. For legal questions, consult a licensed attorney.";

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const CATEGORIES = ["Business Formation", "Business Compliance", "Business Documentation", "Business Consulting"] as const;
export type Category = (typeof CATEGORIES)[number] | string;

/** What kind of work the service is — shown to clients so administrative help is never mistaken for legal services. */
export type ServiceNature = "administrative" | "document_prep" | "consulting";
export const NATURE: Record<ServiceNature, { label: string; note: string }> = {
  administrative: { label: "Administrative assistance", note: "MKB prepares and submits paperwork on your behalf using information you provide." },
  document_prep: { label: "Administrative document preparation", note: "Documents are prepared from your instructions and standard templates. This is not legal advice or legal drafting." },
  consulting: { label: "Business consulting", note: "General business and administrative guidance. Not legal, tax-law or investment advice." },
};

export type CatalogService = {
  id: string;
  category: Category;
  name: string;
  description: string;
  nature: ServiceNature;
  /** MKB service fee (default quote line). */
  price: number;
  /** Optional admin-entered estimate. Never pre-filled: state fees differ and change, so quotes use the fee confirmed for the specific state. */
  filingFeeEstimate?: number;
  /** Goes to a state or federal agency: unlocks the agency log and "Submitted to Agency" statuses. */
  agency: boolean;
  /** Uses the formation workspace (proposed names, organizer, owners, registered agent, EIN). */
  formation: boolean;
  turnaroundDays: number;
  /** Information the client must provide — becomes the starting checklist of client requests. */
  needs: string[];
  /** Expected deliverables. */
  deliverables: string[];
  active: boolean;
  custom?: boolean;
};

const svc = (id: string, category: Category, name: string, nature: ServiceNature, price: number, o: Partial<CatalogService> = {}): CatalogService => ({
  id,
  category,
  name,
  nature,
  price,
  description: o.description ?? "",
  agency: false,
  formation: false,
  turnaroundDays: 14,
  needs: [],
  deliverables: [],
  active: true,
  ...o,
});

export const DEFAULT_CATALOG: CatalogService[] = [
  // Business Formation
  svc("llc", "Business Formation", "LLC formation assistance", "administrative", 599, { description: "Name availability check, articles of organization preparation and submission, and EIN assistance.", agency: true, formation: true, turnaroundDays: 21, needs: ["Proposed name and two alternates", "Business purpose", "Principal business address", "Organizer details", "Member/ownership information", "Registered agent choice"], deliverables: ["Filed articles of organization", "State filing confirmation", "EIN confirmation letter"] }),
  svc("corp", "Business Formation", "Corporation formation assistance", "administrative", 749, { description: "Articles of incorporation preparation and submission, initial administrative setup, and EIN assistance.", agency: true, formation: true, turnaroundDays: 21, needs: ["Proposed name and two alternates", "Business purpose", "Principal office address", "Incorporator details", "Initial directors and shareholders", "Registered agent choice"], deliverables: ["Filed articles of incorporation", "State filing confirmation", "EIN confirmation letter"] }),
  svc("ein", "Business Formation", "EIN application assistance", "administrative", 149, { description: "Help completing and submitting an IRS EIN application for an existing entity.", agency: true, turnaroundDays: 5, needs: ["Legal business name and entity type", "Responsible party details (collected securely)", "Business address"], deliverables: ["EIN confirmation letter"] }),
  svc("foreign", "Business Formation", "Foreign qualification assistance", "administrative", 349, { description: "Register an existing business to operate in another state (foreign qualification / certificate of authority).", agency: true, turnaroundDays: 21, needs: ["State(s) where the business will operate", "Certificate of good standing from the formation state (if that state requires one)", "Registered agent in the new state"], deliverables: ["Foreign registration approval", "State filing confirmation"] }),
  svc("registration", "Business Formation", "Business registration assistance", "administrative", 249, { description: "Trade name, foreign qualification or local registration paperwork.", agency: true, needs: ["Business details", "Registration type and jurisdiction"], deliverables: ["Registration confirmation"] }),
  svc("amend", "Business Formation", "Business amendments", "administrative", 299, { description: "Prepare and submit amendments (members, address, purpose).", agency: true, needs: ["What is changing", "Current formation documents"], deliverables: ["Filed amendment", "State filing confirmation"] }),
  svc("rename", "Business Formation", "Business name change assistance", "administrative", 299, { description: "Name availability check and name-change filing.", agency: true, needs: ["New name and alternates", "Current formation documents"], deliverables: ["Filed name amendment", "State filing confirmation"] }),
  svc("dissolve", "Business Formation", "Business dissolution assistance", "administrative", 349, { description: "Prepare and submit dissolution paperwork and a wind-down checklist.", agency: true, needs: ["Effective date", "Owner approval of dissolution"], deliverables: ["Filed dissolution", "State filing confirmation", "Wind-down checklist"] }),
  // Business Compliance
  svc("annual", "Business Compliance", "Annual report assistance", "administrative", 175, { description: "Prepare and submit the state annual report or registration.", agency: true, turnaroundDays: 7, needs: ["Confirm officers/members and addresses"], deliverables: ["Filed annual report", "State filing confirmation"] }),
  svc("license", "Business Compliance", "Business license tracking", "administrative", 175, { description: "Track and renew local business licenses and permits.", agency: true, turnaroundDays: 14, needs: ["Current license or permit", "Renewal notice"], deliverables: ["Renewed license or permit"] }),
  svc("agent", "Business Compliance", "Registered agent coordination", "administrative", 125, { description: "Coordinate a registered agent appointment or change with the provider and state.", agency: true, turnaroundDays: 10, needs: ["Current registered agent", "Preferred provider"], deliverables: ["Registered agent confirmation"] }),
  svc("state-compliance", "Business Compliance", "State compliance tracking", "administrative", 300, { description: "Annual tracking of state deadlines with reminders.", turnaroundDays: 365, deliverables: ["Compliance calendar"] }),
  svc("records", "Business Compliance", "Business record maintenance", "administrative", 250, { description: "Organize and maintain the business record book.", turnaroundDays: 30, needs: ["Existing business records"], deliverables: ["Organized record book"] }),
  // Business Documentation
  svc("oa", "Business Documentation", "Operating agreement preparation", "document_prep", 399, { description: "Administrative preparation of an operating agreement from a standard template and your instructions.", turnaroundDays: 10, needs: ["Members and ownership percentages", "Management structure", "Key terms you want included"], deliverables: ["Operating agreement (for review and signature)"] }),
  svc("resolutions", "Business Documentation", "Corporate resolutions", "document_prep", 149, { description: "Prepare resolutions for actions your board or members approved.", turnaroundDays: 5, needs: ["Action approved and date", "Who approved it"], deliverables: ["Resolution (for signature)"] }),
  svc("minutes", "Business Documentation", "Meeting minutes", "document_prep", 99, { description: "Prepare minutes from your meeting notes.", turnaroundDays: 5, needs: ["Meeting date, attendees and notes"], deliverables: ["Meeting minutes"] }),
  svc("letters", "Business Documentation", "Business letters", "document_prep", 79, { description: "Business correspondence prepared on your letterhead.", turnaroundDays: 3, needs: ["Recipient and purpose"], deliverables: ["Business letter"] }),
  svc("docprep", "Business Documentation", "Business document preparation", "document_prep", 149, { description: "Other administrative business documents.", turnaroundDays: 7, needs: ["What you need prepared"], deliverables: ["Prepared document"] }),
  // Business Consulting
  svc("consult-new", "Business Consulting", "New business consultation", "consulting", 199, { description: "A working session on getting a new business started.", turnaroundDays: 7, deliverables: ["Consultation summary and next steps"] }),
  svc("consult-structure", "Business Consulting", "Business structure consultation", "consulting", 249, { description: "Compare common business structures at a general, administrative level.", turnaroundDays: 7, deliverables: ["Consultation summary"] }),
  svc("startup", "Business Consulting", "Startup planning", "consulting", 499, { description: "Launch checklist and administrative startup plan.", turnaroundDays: 21, deliverables: ["Startup plan"] }),
  svc("setup", "Business Consulting", "Business setup assistance", "consulting", 349, { description: "Bank account, licensing and administrative setup checklist and help.", turnaroundDays: 14, deliverables: ["Setup checklist"] }),
  svc("admin", "Business Consulting", "General business administrative support", "consulting", 75, { description: "Hourly administrative support.", turnaroundDays: 7, deliverables: ["Summary of work"] }),
];

/* ------------------------------------------------------------------ */
/* Request workflow                                                    */
/* ------------------------------------------------------------------ */

export const REQUEST_STATUSES = [
  "Intake",
  "Awaiting Client Information",
  "Ready for Processing",
  "In Progress",
  "Submitted to Agency",
  "Awaiting Agency Response",
  "Approved",
  "Documents Delivered",
  "Completed",
  "On Hold",
  "Cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
/** The forward path (On Hold and Cancelled sit outside it). */
export const FLOW: RequestStatus[] = REQUEST_STATUSES.filter((s) => s !== "On Hold" && s !== "Cancelled");
export const AGENCY_STEPS: RequestStatus[] = ["Submitted to Agency", "Awaiting Agency Response"];

export type Owner = "Client" | "MKB" | "Agency" | "Done";
export const STATUS_META: Record<RequestStatus, { tone: "neutral" | "info" | "success" | "warning" | "danger"; owner: Owner; client: string }> = {
  Intake: { tone: "info", owner: "MKB", client: "Request received" },
  "Awaiting Client Information": { tone: "warning", owner: "Client", client: "Waiting on you" },
  "Ready for Processing": { tone: "info", owner: "MKB", client: "Scheduled" },
  "In Progress": { tone: "info", owner: "MKB", client: "MKB is working on it" },
  "Submitted to Agency": { tone: "info", owner: "Agency", client: "Submitted to the agency" },
  "Awaiting Agency Response": { tone: "warning", owner: "Agency", client: "Waiting on the agency" },
  Approved: { tone: "success", owner: "MKB", client: "Approved — preparing your documents" },
  "Documents Delivered": { tone: "success", owner: "MKB", client: "Documents delivered" },
  Completed: { tone: "success", owner: "Done", client: "Complete" },
  "On Hold": { tone: "neutral", owner: "MKB", client: "On hold" },
  Cancelled: { tone: "neutral", owner: "Done", client: "Cancelled" },
};

export type QuoteLineKind = "service" | "additional" | "filing" | "third_party" | "discount" | "clerk" | "government" | "records" | "backend" | "late_fee";
export const LINE_KIND: Record<QuoteLineKind, { label: string; group: "mkb" | "passthrough" }> = {
  service: { label: "MKB service fee", group: "mkb" },
  additional: { label: "Additional MKB service fee", group: "mkb" },
  discount: { label: "Discount", group: "mkb" },
  filing: { label: "State / government filing fee", group: "passthrough" },
  third_party: { label: "Third-party fee", group: "passthrough" },
  clerk: { label: "Clerk fee", group: "passthrough" },
  government: { label: "Government fee", group: "passthrough" },
  records: { label: "Records request fee", group: "passthrough" },
  backend: { label: "Back-end fee", group: "passthrough" },
  late_fee: { label: "Late fee", group: "mkb" },
};
export type QuoteLine = { id: string; kind: QuoteLineKind; label: string; amount: number };
export type Quote = { status: "draft" | "sent" | "accepted" | "declined"; lines: QuoteLine[]; sentAt?: string; acceptedAt?: string; note?: string };
export const quoteTotal = (q: Quote) => q.lines.reduce((s, l) => s + (l.kind === "discount" ? -Math.abs(l.amount) : l.amount), 0);

/** Something MKB needs from the client. */
export type InfoRequest = {
  id: string;
  label: string;
  detail?: string;
  /** Needs a file (vs. an answer). */
  file: boolean;
  status: "open" | "responded" | "accepted";
  response?: string;
  docIds: string[];
  createdAt: string;
  respondedAt?: string;
};

export type BizTask = { id: string; title: string; dueAt?: string; assigneeId: string; done: boolean; doneAt?: string; createdAt: string };
export type InternalNote = { id: string; authorId: string; body: string; at: string };

export type AgencyEvent = {
  id: string;
  agency: string;
  kind: "submitted" | "follow_up" | "info_requested" | "approved" | "rejected";
  at: string;
  byId: string;
  reference?: string;
  note?: string;
  /** Approvals only: staff confirmed the result directly with the agency (portal lookup, letter, email). */
  verified?: boolean;
  confirmationDocId?: string;
};
export const AGENCY_KIND: Record<AgencyEvent["kind"], string> = {
  submitted: "Submitted by MKB",
  follow_up: "Follow-up with agency",
  info_requested: "Agency requested information",
  approved: "Approved — confirmation verified",
  rejected: "Rejected / returned",
};

export type Deliverable = {
  id: string;
  name: string;
  category: DocCategory;
  docId?: string;
  status: "pending" | "ready_for_review" | "approved" | "delivered";
  reviewedBy?: string;
  deliveredAt?: string;
};
export const DELIVERABLE_META: Record<Deliverable["status"], { label: string; tone: "neutral" | "info" | "success" | "warning" }> = {
  pending: { label: "Not started", tone: "neutral" },
  ready_for_review: { label: "Ready for review", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
};

export type Person = { name: string; title?: string; email?: string; phone?: string };
export type Owner_ = { id: string; name: string; role: string; pct: number };
export type RegisteredAgent = { type: "mkb_coordinated" | "third_party" | "self"; name: string; address: string };
export const AGENT_TYPE: Record<RegisteredAgent["type"], string> = { mkb_coordinated: "Provider coordinated by MKB", third_party: "Third-party provider (client's choice)", self: "Owner / member acts as agent" };

export type EinStatus = "not_needed" | "not_started" | "info_collected" | "submitted" | "received";
export const EIN_STATUS: Record<EinStatus, string> = { not_needed: "Not needed", not_started: "Not started", info_collected: "Information collected", submitted: "Application submitted", received: "EIN confirmation received" };
export type StateFiling = "not_submitted" | "submitted" | "awaiting" | "approved" | "rejected";
export const STATE_FILING: Record<StateFiling, string> = { not_submitted: "Not submitted", submitted: "Submitted", awaiting: "Awaiting agency response", approved: "Approved (confirmation verified)", rejected: "Returned by agency" };

export type FormationDetails = {
  proposedName: string;
  alternates: string[];
  state: string;
  structure: EntityType;
  purpose: string;
  businessAddress: string;
  principalLocation: string;
  /** Responsible party / organizer — contact details only. Tax IDs are collected
   *  through the secure vault in Phase 3, never in this form. */
  organizer: Person;
  owners: Owner_[];
  agent?: RegisteredAgent;
  einStatus: EinStatus;
  stateFiling: StateFiling;
  confirmationNumber?: string;
  confirmationVerified?: boolean;
  confirmationDocId?: string;
  docsDelivered: boolean;
  completedAt?: string;
};

export type StatusChange = { status: RequestStatus; at: string; byId: string; note?: string };

export type ServiceRequest = {
  id: string;
  number: string;
  /** Existing MKB client — or a prospect who is not a client yet. */
  clientId?: string;
  prospect?: { name: string; email: string; phone: string };
  /** The client's engagement this request mirrors (shown on the client profile). */
  enrollmentId?: string;
  entityId?: string;
  businessName: string;
  structure: EntityType;
  state: string;
  serviceId: string;
  serviceName: string;
  description: string;
  preferredDate?: string;
  dueAt?: string;
  assignedTo: string;
  reviewerId: string;
  status: RequestStatus;
  holdFrom?: RequestStatus;
  holdReason?: string;
  source: "staff" | "portal" | "phone" | "website";
  createdAt: string;
  consultation?: { status: "scheduled" | "completed"; at: string };
  quote: Quote;
  /** Proceed before payment (owner override), with reason. */
  paymentWaived?: string;
  info: InfoRequest[];
  tasks: BizTask[];
  notes: InternalNote[];
  agency: AgencyEvent[];
  deliverables: Deliverable[];
  formation?: FormationDetails;
  history: StatusChange[];
  completedAt?: string;
  approvedBy?: string;
  followUpAt?: string;
  cancelReason?: string;
  /** The client accepted the engagement letter (versions + who, when and how). Recorded once, by the server. */
  engagement?: { letterKey: "biz"; version: number; termsVersion: number; acceptedName: string; acceptedAt: string; method: "in_office" | "paper" | "online"; recordedBy?: string };
};

/* ------------------------------------------------------------------ */
/* Business entities + compliance                                      */
/* ------------------------------------------------------------------ */

export type BizEntity = {
  id: string;
  clientId: string;
  legalName: string;
  dba?: string;
  entityType: EntityType;
  /** State of formation (domestic state). */
  state: string;
  status: "forming" | "active" | "inactive" | "dissolved";
  formationDate?: string;
  /** State-issued identification number in the formation state. */
  stateIdNumber?: string;
  /** Additional states where the business is registered or authorized to operate. */
  registrations: StateRegistration[];
  standing: Standing;
  einStatus: EinStatus;
  principalAddress: string;
  agent?: RegisteredAgent;
  ownerId: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  createdAt: string;
};

export type ComplianceKind = "annual_report" | "franchise_tax" | "periodic_report" | "business_license" | "registered_agent" | "foreign_qualification" | "other";
export const COMPLIANCE_KIND: Record<ComplianceKind, string> = {
  annual_report: "Annual report / registration",
  franchise_tax: "Franchise tax",
  periodic_report: "Periodic report",
  business_license: "Business license / permit",
  registered_agent: "Registered agent renewal",
  foreign_qualification: "Foreign qualification renewal",
  other: "Other requirement",
};

export type Frequency = "annual" | "biennial" | "quarterly" | "one_time" | "other";
export const FREQUENCY: Record<Frequency, string> = { annual: "Every year", biennial: "Every two years", quarterly: "Every quarter", one_time: "One time", other: "Other (see notes)" };
/** Months to roll a deadline forward after it's filed. */
export const FREQ_MONTHS: Record<Frequency, number> = { annual: 12, biennial: 24, quarterly: 3, one_time: 0, other: 0 };

/**
 * A requirement an administrator maintains for a state and entity type.
 * Nothing is pre-loaded as fact: deadlines and fees stay blank until someone
 * researches the official source and records when it was last verified.
 */
export type ComplianceRule = {
  id: string;
  /** Two-letter state, or "LOCAL" for city/county or provider requirements that aren't state rules. */
  state: string;
  entityTypes: EntityType[] | "any";
  /** Domestic = the formation state; foreign = states where the business is qualified to operate. */
  appliesTo: "domestic" | "foreign" | "both";
  kind: ComplianceKind;
  label: string;
  description: string;
  agency: string;
  agencyUrl?: string;
  frequency: Frequency;
  /** Same date every period, the anniversary of formation/registration, or set per business. */
  due: { month: number; day: number } | "anniversary" | "manual";
  /** Filing fee as published by the agency — blank until verified. */
  filingFee?: number;
  source: string;
  lastVerifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
};
export const ruleVerified = (r: ComplianceRule) => !!r.lastVerifiedAt;
export const dueLabel = (d: ComplianceRule["due"]) => (d === "manual" ? "Set per business" : d === "anniversary" ? "Anniversary of formation/registration" : new Date(2000, d.month - 1, d.day).toLocaleDateString("en-US", { month: "long", day: "numeric" }));

/** State-specific document checklist an administrator maintains for a service. */
export type StateChecklist = { id: string; state: string; serviceId: string | "any"; items: string[]; source: string; lastVerifiedAt?: string };

/** Where a business is registered beyond its formation state. */
export type StateRegistration = {
  id: string;
  state: string;
  kind: "foreign_qualification" | "registration";
  stateIdNumber?: string;
  effectiveAt?: string;
  status: "active" | "pending" | "withdrawn";
  agency?: string;
  notes?: string;
};
export const REG_KIND: Record<StateRegistration["kind"], string> = { foreign_qualification: "Foreign qualification", registration: "Other state registration" };

/** Standing is only shown as verified when staff checked the state's own records. */
export type Standing = { status: "not_verified" | "verified_active" | "verified_issue"; checkedAt?: string; byId?: string; source?: string; note?: string; state?: string };

export type ComplianceItem = {
  id: string;
  entityId: string;
  state: string;
  kind: ComplianceKind;
  title: string;
  description?: string;
  agency?: string;
  agencyUrl?: string;
  dueAt: string;
  filingFee?: number;
  ruleId?: string;
  source: string;
  frequency: Frequency;
  lastVerifiedAt?: string;
  verifiedBy?: string;
  reminderDays: number[];
  remindersSent: number[];
  status: "upcoming" | "in_progress" | "filed" | "not_applicable";
  ownerId: string;
  notes?: string;
  requestId?: string;
  filedAt?: string;
};

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export const DOC_CATEGORIES = [
  "Formation documents",
  "EIN confirmation letter",
  "Operating agreement",
  "Corporate resolution",
  "Annual report",
  "Business license",
  "State filing confirmation",
  "Client-provided document",
  "Completed deliverable",
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const DEFAULT_REMINDERS = [60, 30, 14, 7];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const daysBetween = (fromIso: string, toIso: string) => Math.round((new Date(toIso).setHours(12, 0, 0, 0) - new Date(fromIso).setHours(12, 0, 0, 0)) / 86400000);

/** Next occurrence of a month/day on or after `from`. */
export function nextAnnual(month: number, day: number, from: Date): string {
  let y = from.getFullYear();
  let t = new Date(y, month - 1, day, 17);
  if (t.getTime() < from.getTime()) t = new Date(++y, month - 1, day, 17);
  return t.toISOString();
}
