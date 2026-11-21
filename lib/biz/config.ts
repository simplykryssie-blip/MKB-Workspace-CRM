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

export const CATEGORIES = ["Business Formation", "Business Compliance", "Business Documentation", "Packages & Plans", "Business Consulting"] as const;
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
  /** MKB service fee (default quote line). State and government fees are separate and passed through at cost. */
  price: number;
  /** How the price is charged, shown after it: "per filing", "each", "per year". Blank = one-time fee. */
  unit?: string;
  /** Optional admin-entered estimate. Never pre-filled: state fees differ and change, so quotes use the fee confirmed for the specific state. */
  filingFeeEstimate?: number;
  /** Goes to a state or federal agency: unlocks the agency log and "Submitted to Agency" statuses. */
  agency: boolean;
  /** Uses the formation workspace (proposed names, organizer, owners, the client's registered agent, EIN). */
  formation: boolean;
  turnaroundDays: number;
  /** Information the client must provide — becomes the starting checklist of client requests. */
  needs: string[];
  /** Expected deliverables. */
  deliverables: string[];
  /** The working steps — every new request for this service starts with these as its task list, in order. */
  steps: string[];
  /** Only for these business types (e.g. the formation packages are for LLCs only). Blank = any. */
  entityTypes?: EntityType[];
  /** Bundles: the services included (by id). */
  includes?: string[];
  /** Renews every year: when the year's work is complete, next year's renewal is put on the compliance calendar. */
  recurring?: boolean;
  /** No set price yet: quoted in writing for each client (the website shows "Quoted in writing"; staff enter the fee on the request). */
  quoted?: boolean;
  /** Shown on the website price list (when active). */
  web?: boolean;
  active: boolean;
  custom?: boolean;
};

/** Discount on business-services fees for a client's second entity and beyond (MKB fee only, never state fees). */
export const MULTI_ENTITY_DISCOUNT_PCT = 20;
/** Bumped when the built-in catalog changes; older saved catalogs are brought up to date once. */
export const CATALOG_VERSION = 2;

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
  steps: [],
  web: true,
  active: true,
  ...o,
});

/* Working steps for each service (Krystal's process). Bundles combine them. */
const STEPS = {
  formation: ["Intake received", "Name availability check", "Collect owners/members and structure", "Formation documents drafted", "Client approves the documents", "Filed with the Secretary of State", "EIN application submitted", "Filed documents and EIN delivered", "Record book set up", "Annual-report deadline put on the calendar"],
  ein: ["Intake received", "Form SS-4 prepared", "EIN application submitted", "EIN confirmation letter delivered"],
  dba: ["Intake received", "State trade-name filing submitted", "Parish/county filing submitted (where the state requires it — Louisiana needs both)", "Certificates delivered"],
  foreign: ["Intake received", "Certificate of good standing ordered from the home state", "Filed in the new state", "Confirmation delivered"],
  amend: ["Intake received (what is changing)", "Amendment drafted", "Amendment filed", "Confirmation delivered"],
  dissolve: ["Intake received (debts and final filings confirmed)", "Dissolution filed", "Confirmation delivered", "Final tax-return reminder set"],
  annual: ["Deadline tracked", "Client reminded", "Updated information collected", "Report filed", "Confirmation delivered"],
  license: ["Intake received (business type, locations, current licenses)", "Required licenses researched", "Deadline calendar built", "Reminders set"],
  licenseReport: ["Intake received (business type, locations, current licenses)", "Required licenses researched", "License report delivered"],
  oa: ["Intake received (members, ownership %, management, contributions, distributions, voting and transfer rules)", "Prepared from the template", "Client review", "Signed", "Stored in the record book"],
  resolutions: ["Intake received (action approved, date, who approved)", "Resolution drafted", "Signed", "Stored in the record book"],
  records: ["Existing documents collected", "Record book organized", "Record book delivered"],
};
const part = (label: string, steps: string[]) => steps.filter((x) => !/^Intake received/.test(x)).map((x) => `${label}: ${x}`);
const GOOD_STANDING_STEPS = ["Plan year started — confirm entity details", ...part("Annual filing", STEPS.annual), ...part("Deadlines", STEPS.license), "Amendment (one included per plan year): file if the client needs one"];

const FORMATION_NEEDS = ["Business name and two alternates", "Business activity", "Principal and mailing addresses", "Owners/members with ownership percentages", "Management structure", "Your registered agent's name and street address (MKB is not a registered agent)"];

export const DEFAULT_CATALOG: CatalogService[] = [
  // Business Formation
  svc("llc", "Business Formation", "LLC formation", "administrative", 495, { description: "Name availability check, articles prepared and submitted to the state, and your EIN included.", agency: true, formation: true, turnaroundDays: 21, needs: FORMATION_NEEDS, deliverables: ["Filed articles of organization", "State filing confirmation", "EIN confirmation letter"], steps: STEPS.formation }),
  svc("corp", "Business Formation", "Corporation formation", "administrative", 495, { description: "Name availability check, articles of incorporation prepared and submitted, and your EIN included.", agency: true, formation: true, turnaroundDays: 21, needs: FORMATION_NEEDS, deliverables: ["Filed articles of incorporation", "State filing confirmation", "EIN confirmation letter"], steps: STEPS.formation }),
  svc("nonprofit", "Business Formation", "Nonprofit formation", "administrative", 0, { quoted: true, description: "State formation only: name availability check, nonprofit articles of incorporation prepared and submitted to the state, and your EIN. IRS tax-exemption applications are not included.", agency: true, formation: true, turnaroundDays: 28, needs: [...FORMATION_NEEDS.filter((x) => !/^Owners/.test(x)), "Initial directors and officers", "Nonprofit purpose"], deliverables: ["Filed nonprofit articles of incorporation", "State filing confirmation", "EIN confirmation letter"], steps: STEPS.formation.map((x) => (x === "Collect owners/members and structure" ? "Collect directors, officers and nonprofit purpose" : x)) }),
  svc("ein", "Business Formation", "EIN application (standalone)", "administrative", 125, { description: "IRS EIN application for an existing business.", agency: true, turnaroundDays: 5, needs: ["Legal business name and entity type", "Business address", "Responsible party details (Social Security number collected securely in the client portal only)"], deliverables: ["EIN confirmation letter"], steps: STEPS.ein }),
  svc("dba", "Business Formation", "Trade name / DBA", "administrative", 175, { unit: "per filing", description: "Trade name registration with the state, plus the parish or county filing where required.", agency: true, turnaroundDays: 14, needs: ["Trade name you want", "Parish(es) or county where you do business"], deliverables: ["State trade name certificate", "Parish/county filing confirmation"], steps: STEPS.dba }),
  svc("foreign", "Business Formation", "Foreign registration", "administrative", 395, { description: "Register your existing business to operate in another state.", agency: true, turnaroundDays: 21, needs: ["State where the business will operate", "Your registered agent in that state", "Formation documents"], deliverables: ["Certificate of good standing (home state)", "Foreign registration approval", "State filing confirmation"], steps: STEPS.foreign }),
  svc("amend", "Business Formation", "Amendment / name change", "administrative", 225, { description: "Prepare and file an amendment: name, members, address or purpose.", agency: true, needs: ["What is changing", "Current formation documents"], deliverables: ["Filed amendment", "State filing confirmation"], steps: STEPS.amend }),
  svc("dissolve", "Business Formation", "Dissolution", "administrative", 325, { description: "Prepare and file dissolution paperwork, with a final tax-return reminder.", agency: true, needs: ["Effective date", "Owner approval of the dissolution", "Debts and final filings confirmed"], deliverables: ["Filed dissolution", "State filing confirmation"], steps: STEPS.dissolve }),
  // Business Compliance
  svc("annual", "Business Compliance", "Annual report (Louisiana)", "administrative", 175, { unit: "per year", description: "Prepare and file the Louisiana annual report every year.", agency: true, turnaroundDays: 7, recurring: true, needs: ["Confirm officers/members and addresses"], deliverables: ["Filed annual report", "State filing confirmation"], steps: STEPS.annual }),
  svc("tx-pir", "Business Compliance", "Texas franchise tax / PIR preparation", "administrative", 225, { unit: "per year", description: "Prepare the Texas franchise tax report and Public Information Report every year.", agency: true, turnaroundDays: 10, recurring: true, needs: ["Confirm officers/members and addresses", "Annual revenue for the report year"], deliverables: ["Filed franchise tax report / PIR", "Filing confirmation"], steps: STEPS.annual }),
  svc("license", "Business Compliance", "Licenses & deadlines tracking", "administrative", 249, { unit: "per year", description: "We research the licenses your business needs, build your deadline calendar and remind you before each one is due.", turnaroundDays: 30, recurring: true, needs: ["Business type and activities", "Locations", "Current licenses and permits"], deliverables: ["License and deadline calendar"], steps: STEPS.license }),
  svc("license-report", "Business Compliance", "License report (one-time)", "administrative", 175, { description: "A one-time report of the licenses and permits your business needs.", turnaroundDays: 14, needs: ["Business type and activities", "Locations", "Current licenses and permits"], deliverables: ["License report"], steps: STEPS.licenseReport }),
  // Business Documentation
  svc("oa", "Business Documentation", "Operating agreement — single-member", "document_prep", 295, { description: "Operating agreement prepared from a standard template and your instructions.", turnaroundDays: 10, needs: ["Management structure", "Contributions and distributions", "Transfer rules"], deliverables: ["Operating agreement (for review and signature)"], steps: STEPS.oa }),
  svc("oa-multi", "Business Documentation", "Operating agreement — multi-member", "document_prep", 395, { description: "Operating agreement for two or more members, prepared from a standard template and your instructions.", turnaroundDays: 14, needs: ["Members and ownership percentages", "Management structure", "Contributions and distributions", "Voting and transfer rules"], deliverables: ["Operating agreement (for review and signature)"], steps: STEPS.oa }),
  svc("resolutions", "Business Documentation", "Resolution", "document_prep", 150, { unit: "each", description: "A written resolution for an action your members or board approved.", turnaroundDays: 5, needs: ["Action approved and date", "Who approved it"], deliverables: ["Resolution (for signature)"], steps: STEPS.resolutions }),
  svc("resolutions-pkg", "Business Documentation", "Annual resolutions package", "document_prep", 395, { unit: "per year", description: "The year's resolutions prepared, signed and stored in your record book.", turnaroundDays: 14, recurring: true, needs: ["Actions approved this year, with dates and who approved them"], deliverables: ["Resolutions (for signature)"], steps: STEPS.resolutions }),
  svc("records", "Business Documentation", "Business record book — digital", "administrative", 195, { description: "Your formation documents, agreements and filings organized into a digital record book.", turnaroundDays: 14, needs: ["Existing business documents"], deliverables: ["Digital record book"], steps: STEPS.records }),
  svc("records-physical", "Business Documentation", "Business record book — physical", "administrative", 295, { description: "Your record book organized and delivered as a printed binder (digital copy included).", turnaroundDays: 21, needs: ["Existing business documents"], deliverables: ["Physical record book", "Digital record book"], steps: STEPS.records }),
  // Packages & Plans
  svc("pkg-formation", "Packages & Plans", "LLC Formation Package", "administrative", 695, { entityTypes: ["LLC"], description: "For LLCs: formation, operating agreement, organizational resolutions and a digital record book.", agency: true, formation: true, turnaroundDays: 28, includes: ["llc", "oa", "resolutions", "records"], needs: [...FORMATION_NEEDS, "Operating agreement terms"], deliverables: ["Filed formation documents", "State filing confirmation", "EIN confirmation letter", "Operating agreement (for review and signature)", "Resolutions (for signature)", "Digital record book"],
    steps: [...STEPS.formation.slice(0, -2), ...part("Operating agreement", STEPS.oa), ...part("Resolutions", STEPS.resolutions), ...part("Record book", STEPS.records), "Annual-report deadline put on the calendar"] }),
  svc("pkg-complete", "Packages & Plans", "LLC Formation Complete", "administrative", 895, { entityTypes: ["LLC"], description: "For LLCs: the LLC Formation Package plus a physical record book, one trade name (DBA), a license report and year 1 of the Annual Good Standing Plan.", agency: true, formation: true, turnaroundDays: 35, includes: ["llc", "oa", "resolutions", "records-physical", "dba", "license-report", "good-standing"], needs: [...FORMATION_NEEDS, "Operating agreement terms", "Trade name you want", "Current licenses and permits"], deliverables: ["Filed formation documents", "State filing confirmation", "EIN confirmation letter", "Operating agreement (for review and signature)", "Resolutions (for signature)", "Physical record book", "Trade name certificates", "License report"],
    steps: [...STEPS.formation.slice(0, -2), ...part("Operating agreement", STEPS.oa), ...part("Resolutions", STEPS.resolutions), ...part("Trade name", STEPS.dba), ...part("License report", STEPS.licenseReport), ...part("Record book", STEPS.records), "Annual-report deadline put on the calendar", "Good Standing Plan year 1 started (annual filing, deadline tracking, one amendment)"] }),
  svc("good-standing", "Packages & Plans", "Annual Good Standing Plan", "administrative", 349, { unit: "per year", description: "Your annual filing, deadline and license tracking, and one amendment a year.", agency: true, turnaroundDays: 365, recurring: true, includes: ["annual", "license", "amend"], needs: ["Confirm officers/members and addresses", "Current licenses and permits"], deliverables: ["Filed annual report", "State filing confirmation", "License and deadline calendar"], steps: GOOD_STANDING_STEPS }),
  svc("good-standing-premium", "Packages & Plans", "Annual Good Standing Plan — Premium", "administrative", 449, { unit: "per year", description: "Everything in the Good Standing Plan plus the annual resolutions package.", agency: true, turnaroundDays: 365, recurring: true, includes: ["annual", "license", "amend", "resolutions-pkg"], needs: ["Confirm officers/members and addresses", "Current licenses and permits", "Actions approved this year"], deliverables: ["Filed annual report", "State filing confirmation", "License and deadline calendar", "Resolutions (for signature)"], steps: [...GOOD_STANDING_STEPS, ...part("Resolutions package", STEPS.resolutions)] }),
  // Not on Krystal's approved price list: kept (inactive) so older requests still show their service.
  svc("rename", "Business Formation", "Business name change", "administrative", 225, { agency: true, active: false, web: false, steps: STEPS.amend, deliverables: ["Filed name amendment", "State filing confirmation"] }),
  svc("registration", "Business Formation", "Business registration assistance", "administrative", 249, { agency: true, active: false, web: false }),
  svc("state-compliance", "Business Compliance", "State compliance tracking", "administrative", 300, { active: false, web: false }),
  svc("minutes", "Business Documentation", "Meeting minutes", "document_prep", 99, { active: false, web: false }),
  svc("letters", "Business Documentation", "Business letters", "document_prep", 79, { active: false, web: false }),
  svc("docprep", "Business Documentation", "Business document preparation", "document_prep", 149, { active: false, web: false }),
  svc("consult-new", "Business Consulting", "New business consultation", "consulting", 199, { active: false, web: false }),
  svc("consult-structure", "Business Consulting", "Business structure consultation", "consulting", 249, { active: false, web: false }),
  svc("startup", "Business Consulting", "Startup planning", "consulting", 499, { active: false, web: false }),
  svc("setup", "Business Consulting", "Business setup assistance", "consulting", 349, { active: false, web: false }),
  svc("admin", "Business Consulting", "General business administrative support", "consulting", 75, { active: false, web: false }),
];

/**
 * Brings a saved catalog up to date with the built-in one: built-in services take
 * the new prices, steps and wording; services the owner added stay; retired
 * built-ins (registered agent coordination) are removed.
 */
export function upgradeCatalog(saved: CatalogService[]): CatalogService[] {
  if (saved.some((x) => x.id === "good-standing")) {
    // Built-in services added since this catalog was saved (e.g. nonprofit formation) are added once.
    const have = new Set(saved.map((x) => x.id));
    return [...saved.map((x) => ({ ...x, steps: x.steps ?? [] })), ...structuredClone(DEFAULT_CATALOG.filter((x) => !have.has(x.id)))];
  }
  const builtIn = new Set(DEFAULT_CATALOG.map((x) => x.id));
  const custom = saved.filter((x) => !builtIn.has(x.id) && x.id !== "agent").map((x) => ({ ...x, steps: x.steps ?? [] }));
  return [...structuredClone(DEFAULT_CATALOG), ...custom];
}
/** "$175 per filing", "$349/yr". */
export const svcPrice = (x: Pick<CatalogService, "price" | "unit" | "quoted">) => x.quoted ? "Quoted in writing" : `$${x.price.toLocaleString("en-US")}${x.unit === "per year" ? "/yr" : x.unit ? ` ${x.unit}` : ""}`;

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

export type BizTask = { id: string; title: string; dueAt?: string; assigneeId: string; done: boolean; doneAt?: string; createdAt: string; /** Its task on the calendar (live CRM). */ calTaskId?: string };
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
/** The client's own registered agent. MKB is not a registered agent and doesn't arrange one; "mkb_coordinated" only exists on older records. */
export type RegisteredAgent = { type: "mkb_coordinated" | "third_party" | "self"; name: string; address: string };
export const AGENT_TYPE: Record<RegisteredAgent["type"], string> = { mkb_coordinated: "Provider chosen by the client (older record)", third_party: "Registered agent company (client's choice)", self: "Owner / member acts as agent" };
/** Choices staff can pick (the client designates and handles their own agent). */
export const AGENT_CHOICES: [RegisteredAgent["type"], string][] = [["self", AGENT_TYPE.self], ["third_party", AGENT_TYPE.third_party]];

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
  /** The due date's task on the calendar (live CRM). */
  dueTaskId?: string;
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
  /** The submitted Business Solutions intake this request was started from. */
  intakeId?: string;
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
  registered_agent: "Registered agent renewal (client's own agent)",
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
  /** The service a request for this deadline uses (recurring plans); otherwise picked from the kind. */
  serviceId?: string;
  /** Its task on the calendar (live CRM). */
  calTaskId?: string;
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
