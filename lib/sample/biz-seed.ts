/**
 * Business Services sample data — fictional businesses, requests and deadlines.
 *
 * Kept free of imports from ./clients so the client builder can call
 * `bizClientRecords()` to put each request's documents, invoices and messages
 * on the central client record (one source of truth, no duplicate clients).
 * Agency names, confirmation numbers and fees are placeholders, not real data.
 */
import { SAMPLE_NOW } from "./time";
import { DEFAULT_REMINDERS, FLOW, quoteTotal, type BizEntity, type ComplianceItem, type ComplianceRule, type StateChecklist, type Deliverable, type FormationDetails, type InfoRequest, type QuoteLine, type RequestStatus, type ServiceRequest, type StatusChange } from "@/lib/biz/config";
import type { ClientDocument, Invoice, Message } from "@/lib/types";

const d = (days: number, h = 10, m = 0) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};

const AGENT = { type: "mkb_coordinated" as const, name: "Sample Registered Agents Co. (fictional)", address: "100 Example Way, Suite 1, Lakeside, GA 30002" };

/* ------------------------------------------------------------------ */
/* Businesses                                                          */
/* ------------------------------------------------------------------ */

const NV: BizEntity["standing"] = { status: "not_verified" };
const reg = (id: string, state: string, status: "active" | "pending", effective?: string, note?: string) => ({ id, state, kind: "foreign_qualification" as const, stateIdNumber: status === "active" ? `SAMPLE-${state}-${id.slice(-3).toUpperCase()}` : undefined, effectiveAt: effective, status, notes: note });

export const BIZ_ENTITIES: BizEntity[] = [
  { id: "E-1002", clientId: "c-1002", legalName: "Maple Example LLC", entityType: "LLC", state: "GA", stateIdNumber: "SAMPLE-GA-190301", status: "active", formationDate: "2019-03-01", einStatus: "received", principalAddress: "220 Sample Blvd, Suite 300, Riverton, GA 30001", agent: AGENT, ownerId: "s-mk", lastReviewedAt: d(-40), nextReviewAt: d(50), createdAt: d(-400),
    registrations: [reg("r-sc1", "SC", "active", "2021-04-12"), reg("r-fl1", "FL", "active", "2023-02-20")],
    standing: { status: "verified_active", state: "GA", checkedAt: d(-40), byId: "s-mk", source: "Sample: state business search (fictional lookup)", note: "Sample record of a staff check." } },
  { id: "E-1003", clientId: "c-1003", legalName: "Northwind Demo Co. LLC", entityType: "LLC", state: "GA", status: "forming", einStatus: "info_collected", principalAddress: "9 Placeholder Pkwy, Lakeside, GA 30002", agent: AGENT, ownerId: "s-mk", createdAt: d(-12), registrations: [], standing: NV },
  { id: "E-1007", clientId: "c-1007", legalName: "Bluebird Sample Inc.", entityType: "S-Corp", state: "GA", stateIdNumber: "SAMPLE-GA-160715", status: "active", formationDate: "2016-07-15", einStatus: "received", principalAddress: "1 Demo Plaza, Floor 2, Riverton, GA 30001", agent: { type: "third_party", name: "Example Agent Services (fictional)", address: "55 Placeholder St, Riverton, GA 30001" }, ownerId: "s-jp", lastReviewedAt: d(-60), nextReviewAt: d(30), createdAt: d(-500),
    registrations: [reg("r-nc1", "NC", "active", "2019-09-03"), reg("r-tn1", "TN", "active", "2022-05-16")], standing: NV },
  { id: "E-1008", clientId: "c-1008", legalName: "Harbor Demo Bakery LLC", dba: "Harbor Demo Café", entityType: "LLC", state: "GA", stateIdNumber: "SAMPLE-GA-220201", status: "active", formationDate: "2022-02-01", einStatus: "received", principalAddress: "33 Example Wharf, Bayview, GA 30005", agent: { type: "self", name: "Morgan Harbor", address: "33 Example Wharf, Bayview, GA 30005" }, ownerId: "s-mk", lastReviewedAt: d(-20), nextReviewAt: d(70), createdAt: d(-300), registrations: [], standing: NV },
  { id: "E-1009A", clientId: "c-1009", legalName: "Mockwell Design Studio", entityType: "Sole Prop", state: "GA", status: "active", formationDate: "2023-01-09", einStatus: "not_needed", principalAddress: "6 Test Court, Lakeside, GA 30002", ownerId: "s-jp", lastReviewedAt: d(-90), nextReviewAt: d(5), createdAt: d(-200), registrations: [], standing: NV },
  { id: "E-1009B", clientId: "c-1009", legalName: "Mockwell Rental Properties LLC", entityType: "LLC", state: "DE", stateIdNumber: "SAMPLE-DE-210503", status: "active", formationDate: "2021-05-03", einStatus: "received", principalAddress: "6 Test Court, Lakeside, GA 30002", agent: AGENT, ownerId: "s-jp", lastReviewedAt: d(-2), nextReviewAt: d(88), createdAt: d(-200),
    registrations: [reg("r-ga1", "GA", "active", "2021-06-01"), reg("r-fl2", "FL", "pending", undefined, "Considering a property in Florida — foreign qualification not filed yet.")], standing: NV },
  { id: "E-1010", clientId: "c-1010", legalName: "Quinn Example Consulting LLC", entityType: "LLC", state: "CO", stateIdNumber: "SAMPLE-CO-200612", status: "active", formationDate: "2020-06-12", einStatus: "received", principalAddress: "90 Sample Hollow, Fairview, GA 30003", agent: AGENT, ownerId: "s-mk", lastReviewedAt: d(-20), nextReviewAt: d(160), createdAt: d(-60),
    registrations: [reg("r-ga2", "GA", "active", "2022-08-01")], standing: NV },
  { id: "E-1011", clientId: "c-1011", legalName: "Pine & Oak Demo Studio LLC", entityType: "LLC", state: "GA", stateIdNumber: "SAMPLE-GA-201010", status: "active", formationDate: "2020-10-10", einStatus: "received", principalAddress: "15 Placeholder Row, Oakdale, GA 30004", agent: AGENT, ownerId: "s-jp", lastReviewedAt: d(-35), nextReviewAt: d(-1), createdAt: d(-120),
    registrations: [reg("r-al1", "AL", "active", "2024-03-04")], standing: NV },
  { id: "E-1012", clientId: "c-1012", legalName: "Demo-Reyes Mobile Detailing LLC", entityType: "LLC", state: "GA", status: "forming", einStatus: "not_started", principalAddress: "3 Mockingbird Example Rd, Bayview, GA 30005", ownerId: "s-mk", createdAt: d(-6), registrations: [], standing: NV },
];

/* ------------------------------------------------------------------ */
/* State requirement rules — placeholders until researched             */
/* ------------------------------------------------------------------ */

/**
 * Sample rules only. Deadlines and fees are deliberately left unset and every
 * rule is unverified: administrators research each state's official source,
 * fill in the details and record when they verified them.
 */
const PLACEHOLDER = "Sample placeholder — research the official state source before use";
const LLC_CORP: ComplianceRule["entityTypes"] = ["LLC", "Corporation", "S-Corp", "C-Corp", "Nonprofit"];
export const COMPLIANCE_RULES: ComplianceRule[] = [
  { id: "rule-ga-annual", state: "GA", entityTypes: LLC_CORP, appliesTo: "both", kind: "annual_report", label: "Annual report / registration", description: "Periodic report the state requires to keep the business active. Details to be researched.", agency: "Georgia business filing agency (to be confirmed)", frequency: "annual", due: "manual", source: PLACEHOLDER },
  { id: "rule-de-tax", state: "DE", entityTypes: ["LLC"], appliesTo: "domestic", kind: "franchise_tax", label: "Annual tax / report (LLC)", description: "Placeholder for Delaware's LLC requirement. Details to be researched.", agency: "Delaware business filing agency (to be confirmed)", frequency: "annual", due: "manual", source: PLACEHOLDER },
  { id: "rule-co-periodic", state: "CO", entityTypes: LLC_CORP, appliesTo: "domestic", kind: "periodic_report", label: "Periodic report", description: "Placeholder for Colorado's periodic report. Details to be researched.", agency: "Colorado business filing agency (to be confirmed)", frequency: "annual", due: "anniversary", source: PLACEHOLDER },
  { id: "rule-local-license", state: "LOCAL", entityTypes: "any", appliesTo: "both", kind: "business_license", label: "Local business license renewal", description: "City or county license. Renewal dates differ by jurisdiction — use the date printed on the client's license.", agency: "City or county licensing office", frequency: "annual", due: "manual", source: "The client's license or renewal notice", lastVerifiedAt: d(-30), verifiedBy: "s-mk" },
  { id: "rule-agent", state: "LOCAL", entityTypes: LLC_CORP, appliesTo: "both", kind: "registered_agent", label: "Registered agent service renewal", description: "Renewal of the registered agent provider's service (a contract, not a state rule).", agency: "Registered agent provider", frequency: "annual", due: "manual", source: "Registered agent provider contract", lastVerifiedAt: d(-30), verifiedBy: "s-mk" },
];

export const STATE_CHECKLISTS: StateChecklist[] = [
  { id: "cl-ga-llc", state: "GA", serviceId: "llc", items: ["Sample item: confirm whether the state needs anything beyond the standard formation checklist"], source: PLACEHOLDER },
  { id: "cl-any-foreign", state: "FL", serviceId: "foreign", items: ["Sample item: certificate of good standing from the formation state (confirm whether required and how recent)"], source: PLACEHOLDER },
];

/* ------------------------------------------------------------------ */
/* Client deadlines (fictional dates; sources marked unverified)       */
/* ------------------------------------------------------------------ */

const SAMPLE_SRC = "Sample data — requirement not yet researched";
const item = (entityId: string, key: string, o: Omit<ComplianceItem, "id" | "entityId" | "remindersSent" | "reminderDays" | "frequency" | "source"> & Partial<Pick<ComplianceItem, "remindersSent" | "reminderDays" | "frequency" | "source">>): ComplianceItem => ({
  id: `ci-${entityId}-${key}`,
  entityId,
  frequency: "annual",
  source: SAMPLE_SRC,
  reminderDays: [...DEFAULT_REMINDERS],
  remindersSent: [],
  ...o,
});
const annual = (entityId: string, key: string, state: string, days: number, ownerId: string, o: Partial<ComplianceItem> = {}): ComplianceItem =>
  item(entityId, key, { state, kind: "annual_report", title: `${state} annual report / registration`, agency: `${state} business filing agency (sample)`, ruleId: state === "GA" ? "rule-ga-annual" : undefined, dueAt: d(days, 17), status: "upcoming", ownerId, remindersSent: [60, 30, 14, 7].filter((r) => days <= r), ...o });

export const COMPLIANCE_ITEMS: ComplianceItem[] = [
  annual("E-1002", "ga-ar", "GA", 148, "s-mk"),
  annual("E-1002", "sc-ar", "SC", 35, "s-mk", { title: "SC annual report (foreign)" }),
  annual("E-1002", "fl-ar", "FL", 9, "s-mk", { title: "FL annual report (foreign)", lastVerifiedAt: d(-10), verifiedBy: "s-mk", source: "Sample: staff confirmed on the state's website (fictional)" }),
  item("E-1002", "lic", { state: "GA", kind: "business_license", title: "City business license renewal", agency: "City licensing office (sample)", dueAt: d(26, 17), ruleId: "rule-local-license", source: "The client's license (sample)", status: "in_progress", ownerId: "s-mk", requestId: "BSR-1042", remindersSent: [60, 30], notes: "Renewal form received from the client; MKB is preparing it." }),
  item("E-1002", "ra", { state: "GA", kind: "registered_agent", title: "Registered agent service renewal", agency: "Registered agent provider", dueAt: d(110, 17), ruleId: "rule-agent", source: "Provider contract (sample)", status: "upcoming", ownerId: "s-mk" }),
  annual("E-1007", "ga-ar", "GA", 148, "s-jp", { notes: "Last filed through BSR-1034." }),
  annual("E-1007", "nc-ar", "NC", 52, "s-jp", { title: "NC annual report (foreign)" }),
  annual("E-1007", "tn-ar", "TN", -4, "s-jp", { title: "TN annual report (foreign)", notes: "Client said they filed it themselves — get the confirmation." }),
  item("E-1007", "lic", { state: "GA", kind: "business_license", title: "County business license renewal", agency: "County licensing office (sample)", dueAt: d(12, 17), ruleId: "rule-local-license", status: "upcoming", ownerId: "s-jp", remindersSent: [60, 30, 14] }),
  annual("E-1008", "ga-ar", "GA", 148, "s-mk"),
  item("E-1008", "hp", { state: "GA", kind: "business_license", title: "Health permit renewal", agency: "County environmental health (sample)", dueAt: d(25, 17), ruleId: "rule-local-license", status: "in_progress", ownerId: "s-mk", requestId: "BSR-1036", remindersSent: [60, 30] }),
  item("E-1009A", "lic", { state: "GA", kind: "business_license", title: "Business license renewal", agency: "City licensing office (sample)", dueAt: d(40, 17), ruleId: "rule-local-license", status: "upcoming", ownerId: "s-jp", remindersSent: [60] }),
  item("E-1009B", "de-tax", { state: "DE", kind: "franchise_tax", title: "DE annual tax / report (LLC)", agency: "Delaware business filing agency (sample)", dueAt: d(208, 17), ruleId: "rule-de-tax", status: "upcoming", ownerId: "s-jp" }),
  annual("E-1009B", "ga-ar", "GA", 148, "s-jp", { title: "GA annual registration (foreign)" }),
  item("E-1009B", "rental", { state: "GA", kind: "business_license", title: "Rental property registration (sample)", agency: "City housing office (sample)", dueAt: d(55, 17), status: "upcoming", ownerId: "s-jp", remindersSent: [60] }),
  item("E-1010", "co-pr", { state: "CO", kind: "periodic_report", title: "CO periodic report", agency: "Colorado business filing agency (sample)", dueAt: d(20, 17), ruleId: "rule-co-periodic", status: "upcoming", ownerId: "s-mk", remindersSent: [60, 30] }),
  annual("E-1010", "ga-ar", "GA", 148, "s-mk", { title: "GA annual registration (foreign)" }),
  annual("E-1011", "ga-ar", "GA", 148, "s-jp"),
  annual("E-1011", "al-ar", "AL", 72, "s-jp", { title: "AL annual report (foreign)" }),
  item("E-1011", "lic", { state: "GA", kind: "business_license", title: "City business license renewal", agency: "City licensing office (sample)", dueAt: d(-3, 17), ruleId: "rule-local-license", status: "upcoming", ownerId: "s-jp", remindersSent: [60, 30, 14, 7], notes: "Client said they would renew online themselves — confirm." }),
];

/* ------------------------------------------------------------------ */
/* Service requests                                                    */
/* ------------------------------------------------------------------ */

type DocSeed = Omit<ClientDocument, "service" | "sensitive" | "requestedAt"> & { requestedAt?: string; sensitive?: boolean };
type InvSeed = { id: string; number: string; lines: QuoteLine[]; issuedAt: string; dueAt: string; paid: "all" | "none" | number; paidAt?: string; overdue?: boolean; refund?: { amount: number; note: string; at: string } };
type ReqSeed = Omit<ServiceRequest, "history" | "enrollmentId" | "notes" | "tasks" | "agency" | "info" | "deliverables"> &
  Partial<Pick<ServiceRequest, "notes" | "tasks" | "agency" | "info" | "deliverables">> & {
    /** Statuses walked through, oldest first, with dates. */
    path: [RequestStatus, string, string?][];
    docs?: DocSeed[];
    invoices?: InvSeed[];
    messages?: Omit<Message, "id" | "service" | "read" | "bizRequestId">[];
  };

const L = (id: string, kind: QuoteLine["kind"], label: string, amount: number): QuoteLine => ({ id, kind, label, amount });
const info = (id: string, label: string, o: Partial<InfoRequest> = {}): InfoRequest => ({ id, label, file: false, status: "accepted", docIds: [], createdAt: d(-10), ...o });
const deliv = (id: string, name: string, category: Deliverable["category"], status: Deliverable["status"], o: Partial<Deliverable> = {}): Deliverable => ({ id, name, category, status, ...o });

const NORTHWIND_FORMATION: FormationDetails = {
  proposedName: "Northwind Demo Co. LLC",
  alternates: ["Northwind Demo Consulting LLC", "NWD Sample Advisors LLC"],
  state: "GA",
  structure: "LLC",
  purpose: "Management consulting services for small businesses.",
  businessAddress: "9 Placeholder Pkwy, Lakeside, GA 30002",
  principalLocation: "9 Placeholder Pkwy, Lakeside, GA 30002",
  organizer: { name: "Sam Northwind", title: "Organizer / member", email: "sam@northwind.example", phone: "(555) 010-0103" },
  owners: [
    { id: "o1", name: "Sam Northwind", role: "Managing member", pct: 60 },
    { id: "o2", name: "Alex Sample-Northwind", role: "Member", pct: 40 },
  ],
  agent: AGENT,
  einStatus: "info_collected",
  stateFiling: "awaiting",
  docsDelivered: false,
};

const REQ_SEEDS: ReqSeed[] = [
  {
    id: "BSR-1031", number: "BSR-1031", clientId: "c-1003", entityId: "E-1003", businessName: "Northwind Demo Co. LLC", structure: "LLC", state: "GA",
    serviceId: "llc", serviceName: "LLC formation assistance", description: "Form a new single-state LLC for the consulting practice and get an EIN so the client can open a business bank account.",
    preferredDate: d(10), dueAt: d(14), assignedTo: "s-mk", reviewerId: "s-jp", status: "Awaiting Agency Response", source: "staff", createdAt: d(-12),
    consultation: { status: "completed", at: d(-12, 11) },
    quote: { status: "accepted", sentAt: d(-12, 15), acceptedAt: d(-11, 9), lines: [L("q1", "service", "LLC formation assistance", 599), L("q2", "additional", "EIN application assistance", 149), L("q3", "filing", "State filing fee (fictional sample amount)", 100)] },
    path: [["Intake", d(-12, 9)], ["Awaiting Client Information", d(-11, 10), "formation questionnaire sent"], ["Ready for Processing", d(-10, 15), "information complete; invoice paid"], ["In Progress", d(-10, 16)], ["Submitted to Agency", d(-9, 11), "articles submitted on the state portal by MKB"], ["Awaiting Agency Response", d(-2, 10), "follow-up: still in review"]],
    info: [
      info("i1", "Proposed name and two alternates", { status: "accepted", response: "Northwind Demo Co. LLC; Northwind Demo Consulting LLC; NWD Sample Advisors LLC", respondedAt: d(-11, 14) }),
      info("i2", "Member/ownership information", { status: "accepted", response: "Sam 60% managing member, Alex 40% member.", respondedAt: d(-11, 14) }),
      info("i3", "Completed formation questionnaire", { file: true, status: "accepted", docIds: ["bsr1031-d1"], respondedAt: d(-10, 12) }),
    ],
    tasks: [
      { id: "t1", title: "Check the state portal for an approval", dueAt: d(1, 17), assigneeId: "s-mk", done: false, createdAt: d(-2) },
      { id: "t2", title: "Prepare the EIN application once articles are approved", dueAt: d(5, 17), assigneeId: "s-mk", done: false, createdAt: d(-9) },
      { id: "t3", title: "Name availability search", assigneeId: "s-mk", done: true, doneAt: d(-10, 11), createdAt: d(-12) },
    ],
    notes: [{ id: "n1", authorId: "s-mk", body: "Client asked whether they can open a bank account before approval. Told them banks usually want the filed articles and the EIN — no promises on timing.", at: d(-1, 16, 40) }],
    agency: [
      { id: "a1", agency: "GA business filing agency (sample)", kind: "submitted", at: d(-9, 11), byId: "s-mk", reference: "SAMPLE-SUB-0042", note: "Submitted online by MKB. Submission receipt saved." },
      { id: "a2", agency: "GA business filing agency (sample)", kind: "follow_up", at: d(-2, 10), byId: "s-mk", note: "Portal still shows 'In review'. Check again in 2 business days." },
    ],
    deliverables: [deliv("v1", "Filed articles of organization", "Formation documents", "pending"), deliv("v2", "State filing confirmation", "State filing confirmation", "pending"), deliv("v3", "EIN confirmation letter", "EIN confirmation letter", "pending")],
    formation: NORTHWIND_FORMATION,
    docs: [
      { id: "bsr1031-d1", name: "Formation questionnaire (completed)", category: "Client-provided document", status: "reviewed", uploadedAt: d(-10, 12), uploadedBy: "client", sizeKb: 220 },
      { id: "bsr1031-d2", name: "State submission receipt SAMPLE-SUB-0042", category: "State filing confirmation", status: "received", uploadedAt: d(-9, 11, 20), uploadedBy: "staff", sizeKb: 84 },
    ],
    invoices: [{ id: "bsr1031-i1", number: "INV-S101", lines: [L("q1", "service", "LLC formation assistance", 599), L("q2", "additional", "EIN application assistance", 149), L("q3", "filing", "State filing fee (fictional sample amount)", 100)], issuedAt: d(-11, 9), dueAt: d(-4), paid: "all", paidAt: d(-10, 14) }],
    messages: [{ from: "staff", author: "MKB Owner", body: "Your articles were submitted to the state today. We'll let you know as soon as we have the approval confirmation.", at: d(-9, 12) }],
  },
  {
    id: "BSR-1032", number: "BSR-1032", clientId: "c-1003", entityId: "E-1003", businessName: "Northwind Demo Co. LLC", structure: "LLC", state: "GA",
    serviceId: "oa", serviceName: "Operating agreement preparation", description: "Operating agreement for two members with a 60/40 split. Client wants a buy-out clause discussed — referred to an attorney for the legal terms.",
    preferredDate: d(20), dueAt: d(24), assignedTo: "s-jp", reviewerId: "s-mk", status: "Intake", source: "portal", createdAt: d(-2, 9),
    quote: { status: "accepted", sentAt: d(-2, 14), acceptedAt: d(-1, 10), lines: [L("q1", "service", "Operating agreement preparation", 399)] },
    path: [["Intake", d(-2, 9), "submitted from the client portal"]],
    info: [info("i1", "Members, ownership percentages and management structure", { status: "open", createdAt: d(-1, 11), detail: "Confirm whether the LLC is member-managed or manager-managed." })],
    notes: [{ id: "n1", authorId: "s-jp", body: "Buy-out terms are legal decisions — told the client MKB prepares the agreement from their instructions and they should have an attorney review it.", at: d(-1, 11) }],
    deliverables: [deliv("v1", "Operating agreement (for review and signature)", "Operating agreement", "pending")],
    invoices: [{ id: "bsr1032-i1", number: "INV-S102", lines: [L("q1", "service", "Operating agreement preparation", 399)], issuedAt: d(-1, 10), dueAt: d(13), paid: "none" }],
  },
  {
    id: "BSR-1033", number: "BSR-1033", clientId: "c-1005", businessName: "Riley Test Kitchen (proposed)", structure: "LLC", state: "GA",
    serviceId: "consult-new", serviceName: "New business consultation", description: "Starting a small catering business. Wants to understand the setup steps, licensing, and whether to form an LLC now or later.",
    preferredDate: d(7), dueAt: d(9), assignedTo: "s-mk", reviewerId: "s-jp", status: "Intake", source: "portal", createdAt: d(-2, 18),
    consultation: { status: "scheduled", at: d(2, 14) },
    quote: { status: "draft", lines: [L("q1", "service", "New business consultation", 199)] },
    path: [["Intake", d(-2, 18), "submitted from the client portal"]],
    docs: [{ id: "bsr1033-d1", name: "Business idea notes", category: "Client-provided document", status: "received", uploadedAt: d(-2, 18, 5), uploadedBy: "client", sizeKb: 46 }],
    messages: [{ from: "client", author: "Riley Testcase", body: "I attached my notes. Thursday afternoon works for the consultation.", at: d(-2, 18, 6) }],
  },
  {
    id: "BSR-1034", number: "BSR-1034", clientId: "c-1007", entityId: "E-1007", businessName: "Bluebird Sample Inc.", structure: "S-Corp", state: "GA",
    serviceId: "annual", serviceName: "Annual report assistance", description: "2026 annual registration.",
    dueAt: d(-140), assignedTo: "s-jp", reviewerId: "s-mk", status: "Completed", source: "staff", createdAt: d(-230),
    quote: { status: "accepted", sentAt: d(-230), acceptedAt: d(-229), lines: [L("q1", "service", "Annual report assistance", 175), L("q2", "filing", "GA annual registration fee (fictional sample amount)", 50)] },
    path: [["Intake", d(-230)], ["Ready for Processing", d(-228)], ["In Progress", d(-227)], ["Submitted to Agency", d(-226)], ["Awaiting Agency Response", d(-226)], ["Approved", d(-222), "confirmation verified on the state portal"], ["Documents Delivered", d(-222, 15)], ["Completed", d(-221), "approved by MKB Owner"]],
    agency: [
      { id: "a1", agency: "GA business filing agency (sample)", kind: "submitted", at: d(-226), byId: "s-jp", reference: "SAMPLE-AR-2026-0191" },
      { id: "a2", agency: "GA business filing agency (sample)", kind: "approved", at: d(-222), byId: "s-jp", reference: "SAMPLE-AR-2026-0191", verified: true, confirmationDocId: "bsr1034-d1", note: "Confirmed on the state portal; filed copy downloaded." },
    ],
    deliverables: [deliv("v1", "Filed 2026 annual registration", "Annual report", "delivered", { docId: "bsr1034-d1", reviewedBy: "s-mk", deliveredAt: d(-222, 15) })],
    docs: [{ id: "bsr1034-d1", name: "2026 annual registration — filed copy", category: "Annual report", status: "reviewed", uploadedAt: d(-222, 11), uploadedBy: "staff", sizeKb: 132, deliveredAt: d(-222, 15) }],
    invoices: [{ id: "bsr1034-i1", number: "INV-S103", lines: [L("q1", "service", "Annual report assistance", 175), L("q2", "filing", "GA annual registration fee (fictional sample amount)", 50)], issuedAt: d(-229), dueAt: d(-215), paid: "all", paidAt: d(-228) }],
    approvedBy: "s-mk", completedAt: d(-221), followUpAt: d(-160),
  },
  {
    id: "BSR-1035", number: "BSR-1035", clientId: "c-1007", entityId: "E-1007", businessName: "Bluebird Sample Inc.", structure: "S-Corp", state: "GA",
    serviceId: "resolutions", serviceName: "Corporate resolutions", description: "Board resolution approving a new business line of credit and naming authorized signers.",
    preferredDate: d(3), dueAt: d(3), assignedTo: "s-jp", reviewerId: "s-mk", status: "In Progress", source: "phone", createdAt: d(-8),
    quote: { status: "accepted", sentAt: d(-8, 14), acceptedAt: d(-8, 16), lines: [L("q1", "service", "Corporate resolutions", 149)] },
    path: [["Intake", d(-8)], ["Awaiting Client Information", d(-8, 15)], ["Ready for Processing", d(-6, 10)], ["In Progress", d(-5, 9)]],
    info: [info("i1", "Action approved, date and who approved it", { status: "accepted", response: "Board approved a line of credit on Oct 28; Lee Bluebird and Pat Sample are authorized signers.", respondedAt: d(-6, 9) })],
    tasks: [{ id: "t1", title: "Draft resolution from the board's notes", assigneeId: "s-jp", done: true, doneAt: d(-1, 15), createdAt: d(-5) }, { id: "t2", title: "Owner review of the resolution", dueAt: d(1, 17), assigneeId: "s-mk", done: false, createdAt: d(-1) }],
    deliverables: [deliv("v1", "Board resolution — line of credit (for signature)", "Corporate resolution", "ready_for_review", { docId: "bsr1035-d1" })],
    docs: [{ id: "bsr1035-d1", name: "Board resolution — line of credit (draft)", category: "Corporate resolution", status: "received", uploadedAt: d(-1, 15), uploadedBy: "staff", sizeKb: 64 }],
    invoices: [{ id: "bsr1035-i1", number: "INV-S104", lines: [L("q1", "service", "Corporate resolutions", 149)], issuedAt: d(-8, 16), dueAt: d(6), paid: "all", paidAt: d(-6, 9) }],
  },
  {
    id: "BSR-1036", number: "BSR-1036", clientId: "c-1008", entityId: "E-1008", businessName: "Harbor Demo Bakery LLC", structure: "LLC", state: "GA",
    serviceId: "license", serviceName: "Business license tracking", description: "Health permit renewal for the bakery's retail location.",
    dueAt: d(25), assignedTo: "s-mk", reviewerId: "s-jp", status: "Submitted to Agency", source: "staff", createdAt: d(-14),
    quote: { status: "accepted", sentAt: d(-14), acceptedAt: d(-13), lines: [L("q1", "service", "Business license tracking — health permit renewal", 175), L("q2", "third_party", "County permit fee (sample amount, paid to the county)", 150)] },
    path: [["Intake", d(-14)], ["Awaiting Client Information", d(-13)], ["Ready for Processing", d(-6)], ["In Progress", d(-5)], ["Submitted to Agency", d(-3, 11), "renewal application dropped off by MKB"]],
    info: [info("i1", "Current permit and renewal notice", { file: true, status: "accepted", docIds: ["bsr1036-d1"], respondedAt: d(-7) })],
    agency: [{ id: "a1", agency: "County environmental health (sample)", kind: "submitted", at: d(-3, 11), byId: "s-mk", reference: "SAMPLE-HP-7731", note: "Application accepted at the counter; inspection to be scheduled by the county." }],
    tasks: [{ id: "t1", title: "Call the county if no inspection date by Nov 12", dueAt: d(7, 17), assigneeId: "s-mk", done: false, createdAt: d(-3) }],
    deliverables: [deliv("v1", "Renewed health permit", "Business license", "pending")],
    docs: [{ id: "bsr1036-d1", name: "Current health permit + renewal notice", category: "Business license", status: "reviewed", uploadedAt: d(-7), uploadedBy: "client", sizeKb: 310, expiresAt: d(25, 17) }],
    invoices: [{ id: "bsr1036-i1", number: "INV-S105", lines: [L("q1", "service", "Business license tracking — health permit renewal", 175), L("q2", "third_party", "County permit fee (sample amount, paid to the county)", 150)], issuedAt: d(-13), dueAt: d(1), paid: 175 }],
  },
  {
    id: "BSR-1037", number: "BSR-1037", clientId: "c-1008", entityId: "E-1008", businessName: "Harbor Demo Bakery LLC", structure: "LLC", state: "GA",
    serviceId: "registration", serviceName: "Business registration assistance", description: "Register the trade name “Harbor Demo Café” for the new café counter.",
    dueAt: d(4), assignedTo: "s-mk", reviewerId: "s-jp", status: "Approved", source: "staff", createdAt: d(-25),
    quote: { status: "accepted", sentAt: d(-25), acceptedAt: d(-24), lines: [L("q1", "service", "Business registration assistance — trade name", 249), L("q2", "filing", "County trade name filing fee (sample amount)", 40), L("q3", "discount", "Returning client discount", 25)] },
    path: [["Intake", d(-25)], ["Ready for Processing", d(-23)], ["In Progress", d(-22)], ["Submitted to Agency", d(-20)], ["Awaiting Agency Response", d(-12)], ["Approved", d(-1, 14), "confirmation verified with the county clerk"]],
    agency: [
      { id: "a1", agency: "County clerk (sample)", kind: "submitted", at: d(-20), byId: "s-mk", reference: "SAMPLE-TN-5520" },
      { id: "a2", agency: "County clerk (sample)", kind: "follow_up", at: d(-12), byId: "s-mk", note: "Clerk said publication is required before approval." },
      { id: "a3", agency: "County clerk (sample)", kind: "approved", at: d(-1, 14), byId: "s-mk", reference: "SAMPLE-TN-5520", verified: true, confirmationDocId: "bsr1037-d1", note: "Stamped registration picked up in person." },
    ],
    deliverables: [deliv("v1", "Trade name registration — stamped copy", "State filing confirmation", "approved", { docId: "bsr1037-d1", reviewedBy: "s-jp" })],
    docs: [{ id: "bsr1037-d1", name: "Trade name registration — stamped copy", category: "State filing confirmation", status: "reviewed", uploadedAt: d(-1, 15), uploadedBy: "staff", sizeKb: 410 }],
    invoices: [{ id: "bsr1037-i1", number: "INV-S106", lines: [L("q1", "service", "Business registration assistance — trade name", 249), L("q2", "filing", "County trade name filing fee (sample amount)", 40), L("q3", "discount", "Returning client discount", 25)], issuedAt: d(-24), dueAt: d(-10), paid: "all", paidAt: d(-22) }],
  },
  {
    id: "BSR-1038", number: "BSR-1038", clientId: "c-1012", entityId: "E-1012", businessName: "Demo-Reyes Mobile Detailing LLC", structure: "LLC", state: "GA",
    serviceId: "llc", serviceName: "LLC formation assistance", description: "Convert the detailing sole proprietorship into a new LLC. Keep the same business address.",
    preferredDate: d(14), dueAt: d(21), assignedTo: "s-mk", reviewerId: "s-jp", status: "Awaiting Client Information", source: "staff", createdAt: d(-6),
    consultation: { status: "completed", at: d(-6, 11) },
    quote: { status: "accepted", sentAt: d(-6, 14), acceptedAt: d(-5, 9), lines: [L("q1", "service", "LLC formation assistance", 599), L("q2", "filing", "State filing fee (fictional sample amount)", 100)] },
    path: [["Intake", d(-6)], ["Awaiting Client Information", d(-5, 10), "formation checklist sent"]],
    info: [
      info("i1", "Business purpose", { status: "responded", response: "Mobile car detailing and interior cleaning.", respondedAt: d(-3, 19), createdAt: d(-5, 10) }),
      info("i2", "Proposed name and two alternates", { status: "open", createdAt: d(-5, 10), detail: "We have your first choice. Please send two backups in case it isn't available." }),
      info("i3", "Signed formation questionnaire", { file: true, status: "open", createdAt: d(-5, 10) }),
    ],
    deliverables: [deliv("v1", "Filed articles of organization", "Formation documents", "pending"), deliv("v2", "State filing confirmation", "State filing confirmation", "pending"), deliv("v3", "EIN confirmation letter", "EIN confirmation letter", "pending")],
    formation: { proposedName: "Demo-Reyes Mobile Detailing LLC", alternates: [], state: "GA", structure: "LLC", purpose: "Mobile car detailing and interior cleaning.", businessAddress: "3 Mockingbird Example Rd, Bayview, GA 30005", principalLocation: "Mobile — client locations in the county", organizer: { name: "Taylor Demo-Reyes", title: "Organizer", email: "taylor@demo-reyes.example", phone: "(555) 010-0112" }, owners: [{ id: "o1", name: "Taylor Demo-Reyes", role: "Sole member", pct: 100 }], einStatus: "not_started", stateFiling: "not_submitted", docsDelivered: false },
    invoices: [{ id: "bsr1038-i1", number: "INV-S107", lines: [L("q1", "service", "LLC formation assistance", 599), L("q2", "filing", "State filing fee (fictional sample amount)", 100)], issuedAt: d(-5, 9), dueAt: d(-1), paid: 300, overdue: true }],
    messages: [{ from: "staff", author: "MKB Owner", body: "Thanks for the business purpose! We still need two backup names and your signed questionnaire before we can file.", at: d(-2, 10) }],
  },
  {
    id: "BSR-1039", number: "BSR-1039", clientId: "c-1011", entityId: "E-1011", businessName: "Pine & Oak Demo Studio LLC", structure: "LLC", state: "GA",
    serviceId: "agent", serviceName: "Registered agent coordination", description: "Move registered agent service in Georgia to the MKB-coordinated provider.",
    dueAt: d(-40), assignedTo: "s-jp", reviewerId: "s-mk", status: "Completed", source: "staff", createdAt: d(-60),
    quote: { status: "accepted", sentAt: d(-60), acceptedAt: d(-60), lines: [L("q1", "service", "Registered agent coordination", 125), L("q2", "third_party", "Registered agent provider — first year (sample amount)", 99), L("q3", "filing", "State change-of-agent filing fee (sample amount)", 5)] },
    path: [["Intake", d(-60)], ["Ready for Processing", d(-58)], ["In Progress", d(-57)], ["Submitted to Agency", d(-55)], ["Awaiting Agency Response", d(-55)], ["Approved", d(-45), "confirmation verified"], ["Documents Delivered", d(-44)], ["Completed", d(-43)]],
    agency: [{ id: "a1", agency: "GA business filing agency (sample)", kind: "submitted", at: d(-55), byId: "s-jp", reference: "SAMPLE-RA-3381" }, { id: "a2", agency: "GA business filing agency (sample)", kind: "approved", at: d(-45), byId: "s-jp", reference: "SAMPLE-RA-3381", verified: true, confirmationDocId: "bsr1039-d1" }],
    deliverables: [deliv("v1", "Change of registered agent — confirmation", "State filing confirmation", "delivered", { docId: "bsr1039-d1", reviewedBy: "s-mk", deliveredAt: d(-44) })],
    docs: [{ id: "bsr1039-d1", name: "Change of registered agent — confirmation", category: "State filing confirmation", status: "reviewed", uploadedAt: d(-45, 14), uploadedBy: "staff", sizeKb: 98, deliveredAt: d(-44) }],
    invoices: [{ id: "bsr1039-i1", number: "INV-S108", lines: [L("q1", "service", "Registered agent coordination", 125), L("q2", "third_party", "Registered agent provider — first year (sample amount)", 99), L("q3", "filing", "State change-of-agent filing fee (sample amount)", 5)], issuedAt: d(-60), dueAt: d(-46), paid: "all", paidAt: d(-59) }],
    approvedBy: "s-mk", completedAt: d(-43), followUpAt: d(-13),
  },
  {
    id: "BSR-1040", number: "BSR-1040", clientId: "c-1011", entityId: "E-1011", businessName: "Pine & Oak Demo Studio LLC", structure: "LLC", state: "GA",
    serviceId: "amend", serviceName: "Business amendments", description: "Add a new member and update the principal office address.",
    dueAt: d(10), assignedTo: "s-jp", reviewerId: "s-mk", status: "On Hold", holdFrom: "In Progress", holdReason: "Client is waiting on the new member's signature on their membership paperwork.", source: "portal", createdAt: d(-20),
    quote: { status: "accepted", sentAt: d(-20), acceptedAt: d(-19), lines: [L("q1", "service", "Business amendments", 299), L("q2", "filing", "State amendment filing fee (sample amount)", 25)] },
    path: [["Intake", d(-20)], ["Ready for Processing", d(-17)], ["In Progress", d(-15)], ["On Hold", d(-9), "waiting on the new member's signature"]],
    deliverables: [deliv("v1", "Filed amendment", "Formation documents", "pending")],
    invoices: [{ id: "bsr1040-i1", number: "INV-S109", lines: [L("q1", "service", "Business amendments", 299), L("q2", "filing", "State amendment filing fee (sample amount)", 25)], issuedAt: d(-19), dueAt: d(-5), paid: "all", paidAt: d(-18) }],
  },
  {
    id: "BSR-1041", number: "BSR-1041", clientId: "c-1009", entityId: "E-1009B", businessName: "Mockwell Rental Properties LLC", structure: "LLC", state: "DE",
    serviceId: "consult-structure", serviceName: "Business structure consultation", description: "Client is considering holding each rental property in a separate business. Wants a general overview of the administrative options and costs.",
    dueAt: d(-1), assignedTo: "s-jp", reviewerId: "s-mk", status: "Documents Delivered", source: "staff", createdAt: d(-15),
    consultation: { status: "completed", at: d(-4, 13) },
    quote: { status: "accepted", sentAt: d(-15), acceptedAt: d(-14), lines: [L("q1", "service", "Business structure consultation", 249)] },
    path: [["Intake", d(-15)], ["Ready for Processing", d(-14)], ["In Progress", d(-4, 13)], ["Approved", d(-3, 10), "summary reviewed by MKB Owner"], ["Documents Delivered", d(-2, 9)]],
    notes: [{ id: "n1", authorId: "s-jp", body: "Recommended the client speak with an attorney and their tax preparer before deciding — MKB can handle the filings afterwards.", at: d(-4, 15) }],
    deliverables: [deliv("v1", "Consultation summary and next steps", "Completed deliverable", "delivered", { docId: "bsr1041-d1", reviewedBy: "s-mk", deliveredAt: d(-2, 9) })],
    docs: [{ id: "bsr1041-d1", name: "Business structure consultation — summary", category: "Completed deliverable", status: "reviewed", uploadedAt: d(-3, 9), uploadedBy: "staff", sizeKb: 152, deliveredAt: d(-2, 9) }],
    invoices: [{ id: "bsr1041-i1", number: "INV-S110", lines: [L("q1", "service", "Business structure consultation", 249)], issuedAt: d(-14), dueAt: d(0), paid: "all", paidAt: d(-13) }],
    followUpAt: d(25),
  },
  {
    id: "BSR-1042", number: "BSR-1042", clientId: "c-1002", entityId: "E-1002", businessName: "Maple Example LLC", structure: "LLC", state: "GA",
    serviceId: "license", serviceName: "Business license tracking", description: "City business license renewal for 2027.",
    dueAt: d(20), assignedTo: "s-mk", reviewerId: "s-jp", status: "Ready for Processing", source: "staff", createdAt: d(-9),
    quote: { status: "accepted", sentAt: d(-9), acceptedAt: d(-8), lines: [L("q1", "service", "Business license tracking — city renewal", 175), L("q2", "filing", "City license renewal fee (sample amount)", 85)] },
    path: [["Intake", d(-9)], ["Awaiting Client Information", d(-8)], ["Ready for Processing", d(-1, 16), "renewal form received"]],
    info: [info("i1", "City renewal form and prior-year gross receipts", { file: true, status: "accepted", docIds: ["bsr1042-d1"], respondedAt: d(-1, 15) })],
    deliverables: [deliv("v1", "Renewed city business license", "Business license", "pending")],
    docs: [{ id: "bsr1042-d1", name: "City renewal form (signed)", category: "Client-provided document", status: "reviewed", uploadedAt: d(-1, 15), uploadedBy: "client", sizeKb: 188 }],
    invoices: [{ id: "bsr1042-i1", number: "INV-S111", lines: [L("q1", "service", "Business license tracking — city renewal", 175), L("q2", "filing", "City license renewal fee (sample amount)", 85)], issuedAt: d(-8), dueAt: d(6), paid: "all", paidAt: d(-7) }],
  },
  {
    id: "BSR-1043", number: "BSR-1043", prospect: { name: "Jamie Prospect-Sample", email: "jamie@prospect.example", phone: "(555) 010-0199" }, businessName: "Prospect Sample Robotics Inc.", structure: "Corporation", state: "TX",
    serviceId: "corp", serviceName: "Corporation formation assistance", description: "Website request: wants to incorporate a hardware startup with two co-founders and issue initial shares.",
    preferredDate: d(30), assignedTo: "s-mk", reviewerId: "s-jp", status: "Intake", source: "website", createdAt: d(0, 8, 40),
    quote: { status: "draft", lines: [] },
    path: [["Intake", d(0, 8, 40), "website request form"]],
  },
  {
    id: "BSR-1044", number: "BSR-1044", clientId: "c-1010", entityId: "E-1010", businessName: "Quinn Example Consulting LLC", structure: "LLC", state: "CO",
    serviceId: "dissolve", serviceName: "Business dissolution assistance", description: "Dissolve the consulting LLC at year end.",
    assignedTo: "s-mk", reviewerId: "s-jp", status: "Cancelled", cancelReason: "Client decided to keep the business open. Deposit refunded in full.", source: "phone", createdAt: d(-30),
    quote: { status: "accepted", sentAt: d(-30), acceptedAt: d(-29), lines: [L("q1", "service", "Business dissolution assistance", 349)] },
    path: [["Intake", d(-30)], ["Ready for Processing", d(-28)], ["Cancelled", d(-20), "client decided to keep the business open"]],
    invoices: [{ id: "bsr1044-i1", number: "INV-S112", lines: [L("q1", "service", "Business dissolution assistance", 349)], issuedAt: d(-29), dueAt: d(-15), paid: "all", paidAt: d(-28), refund: { amount: 349, note: "Request cancelled before work started", at: d(-20, 15) } }],
  },
];

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

export const bizEnrollmentId = (r: { clientId?: string; number: string }) => `${r.clientId}-bz${r.number.slice(4)}`;
export const progressFor = (s: RequestStatus) => (s === "Cancelled" ? 0 : s === "On Hold" ? 50 : Math.max(5, Math.round((FLOW.indexOf(s) / (FLOW.length - 1)) * 100)));

export const BIZ_REQUESTS: ServiceRequest[] = REQ_SEEDS.map(({ path, docs: _d, invoices: _i, messages: _m, ...r }) => ({
  ...r,
  enrollmentId: r.clientId ? bizEnrollmentId(r) : undefined,
  info: r.info ?? [],
  tasks: r.tasks ?? [],
  notes: r.notes ?? [],
  agency: r.agency ?? [],
  deliverables: r.deliverables ?? [],
  history: path.map(([status, at, note]): StatusChange => ({ status, at, byId: status === "Intake" && (r.source === "portal" || r.source === "website") ? "client" : r.assignedTo, note })),
}));

/** The documents, invoices and messages each request puts on the client's central record. */
export function bizClientRecords(clientId: string): { documents: ClientDocument[]; invoices: Invoice[]; messages: Message[] } {
  const documents: ClientDocument[] = [];
  const invoices: Invoice[] = [];
  const messages: Message[] = [];
  REQ_SEEDS.filter((r) => r.clientId === clientId).forEach((r) => {
    (r.docs ?? []).forEach((x) => documents.push({ service: "biz", sensitive: false, requestedAt: x.uploadedAt ?? r.createdAt, entityId: r.entityId, bizRequestId: r.id, ...x }));
    // Open "file" requests also appear as requested documents on the client record.
    (r.info ?? []).filter((i) => i.file && i.status === "open").forEach((i) => documents.push({ id: `${r.id}-${i.id}-req`, name: i.label, service: "biz", category: "Client-provided document", status: "requested", sensitive: false, requestedAt: i.createdAt, entityId: r.entityId, bizRequestId: r.id }));
    (r.invoices ?? []).forEach((iv) => {
      const lines = iv.lines.map((l) => ({ label: l.label, kind: l.kind, amount: l.kind === "discount" ? -Math.abs(l.amount) : l.amount }));
      const total = quoteTotal({ status: "accepted", lines: iv.lines });
      const paid = iv.paid === "all" ? total : iv.paid === "none" ? 0 : iv.paid;
      const inv: Invoice = { id: iv.id, number: iv.number, service: "biz", description: `${r.businessName} — ${r.serviceName}`, amount: total, paid, status: paid >= total ? "paid" : iv.overdue ? (paid > 0 ? "partial" : "overdue") : paid > 0 ? "partial" : "open", issuedAt: iv.issuedAt, dueAt: iv.dueAt, bizRequestId: r.id, lines, paidAt: iv.paidAt };
      if (iv.refund) {
        inv.adjustments = [{ id: `${iv.id}-adj`, kind: "refund", amount: iv.refund.amount, note: iv.refund.note, at: iv.refund.at, byId: "s-mk" }];
        inv.amount = total - iv.refund.amount;
        inv.paid = paid - iv.refund.amount;
        inv.status = "paid";
      }
      if (iv.overdue && paid < total) inv.status = paid > 0 ? "partial" : "overdue";
      invoices.push(inv);
    });
    (r.messages ?? []).forEach((m, i) => messages.push({ ...m, id: `${r.id}-m${i}`, service: "biz", read: true, bizRequestId: r.id }));
  });
  return { documents, invoices, messages };
}

/** Requests that belong on a client's record (each mirrors a business-services engagement). */
export const bizRequestsFor = (clientId: string) => BIZ_REQUESTS.filter((r) => r.clientId === clientId);

/** How a request shows up as the client's business-services engagement. */
export function bizEnrollmentState(status: RequestStatus, holdFrom?: RequestStatus): { stage: string; status: "active" | "waiting_on_client" | "in_review" | "complete" | "on_hold" | "cancelled"; progress: number } {
  const stage = status === "On Hold" ? holdFrom ?? "In Progress" : status;
  const st =
    status === "Completed" ? "complete" : status === "Cancelled" ? "cancelled" : status === "On Hold" ? "on_hold" : status === "Awaiting Client Information" ? "waiting_on_client" : status === "Documents Delivered" || status === "Approved" ? "in_review" : "active";
  return { stage, status: st, progress: progressFor(status === "On Hold" ? stage as RequestStatus : status) };
}
