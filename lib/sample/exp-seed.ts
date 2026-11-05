/**
 * Expungement Center sample data — fictional people, cases and contacts only.
 *
 * Jurisdictions are configured with structure but no legal rules, waiting
 * periods or fees: those stay blank and "Not verified" until an administrator
 * researches the official sources. Court and agency phone numbers and emails
 * are fictional (555 numbers, example.com). Docket and arrest numbers are made up.
 * Kept free of imports from ./clients so the client builder can call expClientRecords().
 */
import { SAMPLE_NOW } from "./time";
import {
  ASSIGNMENT_ROLES,
  type AssignmentRole,
  type Charge,
  type Docket,
  type ExpCase,
  type ExpMatter,
  type Intake,
  type Jurisdiction,
  type PriceRule,
  type RecordItem,
  type Screening,
  type ServiceType,
  type StatusEvent,
} from "@/lib/expunge/config";
import type { ClientDocument, Invoice, InvoiceLine, Message } from "@/lib/types";

const d = (days: number, h = 10, m = 0) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};
const day = (days: number) => d(days).slice(0, 10);

/* ------------------------------------------------------------------ */
/* Jurisdictions                                                        */
/* ------------------------------------------------------------------ */

const TODO = "To be researched — not verified";
const placeholderRules = (st: string) => [
  { id: `${st}-r1`, title: "Expungement eligibility — statute or rule", citation: "", description: `Placeholder. Record the ${st} statute(s) or court rule(s) that govern expungement after researching the official source.`, appliesTo: "To be determined", waitingPeriod: "", notes: TODO },
  { id: `${st}-r2`, title: "Waiting periods", citation: "", description: "Placeholder. Waiting periods differ by offense and disposition — enter them only from the official source.", appliesTo: "To be determined", waitingPeriod: "", notes: TODO },
];

export const EXP_JURISDICTIONS: Jurisdiction[] = [
  {
    id: "J-LA", state: "LA", stateName: "Louisiana", localityLabel: "Parish", active: true,
    localities: [
      { id: "LA-orleans", name: "Orleans Parish", courts: [{ id: "LA-orl-c1", name: "Orleans Parish criminal court (sample entry)", clerk: "Clerk of court — criminal records (sample)", clerkContact: "(555) 010-2201 · records@orleans-clerk.example.com", daOffice: "District attorney's office (sample)", daContact: "(555) 010-2202" }] },
      { id: "LA-jefferson", name: "Jefferson Parish", courts: [{ id: "LA-jef-c1", name: "Jefferson Parish district court (sample entry)", clerk: "Clerk of court (sample)", clerkContact: "(555) 010-2211 · clerk@jefferson-sample.example.com", daOffice: "District attorney's office (sample)", daContact: "(555) 010-2212" }] },
      { id: "LA-ebr", name: "East Baton Rouge Parish", courts: [{ id: "LA-ebr-c1", name: "East Baton Rouge district court (sample entry)", clerk: "Clerk of court (sample)", clerkContact: "(555) 010-2221 · clerk@ebr-sample.example.com" }] },
      { id: "LA-caddo", name: "Caddo Parish", courts: [{ id: "LA-cad-c1", name: "Caddo Parish district court (sample entry)", clerk: "Clerk of court (sample)", clerkContact: "(555) 010-2231" }] },
    ],
    classifications: ["Misdemeanor", "Felony", "To be confirmed"],
    rules: placeholderRules("LA"),
    requiredDocs: [
      { id: "LA-d-any", caseType: "Any case", docs: ["Criminal history report", "Arrest report", "Court minutes", "Final disposition"] },
      { id: "LA-d-conv", caseType: "Conviction", docs: ["Judgment of conviction", "Sentence information", "Probation or parole completion documentation"] },
      { id: "LA-d-dism", caseType: "Dismissal / acquittal / refusal", docs: ["Dismissal or acquittal documentation"] },
    ],
    forms: [{ id: "LA-f1", name: "Expungement motion and supporting forms (identify from the official source)", source: TODO }],
    procedures: "Placeholder. Describe the filing procedure (where to file, service requirements, hearing practice) after verifying it with the official sources and the clerk.",
    fees: [
      { id: "LA-fee1", label: "Court filing / processing fees", kind: "court_filing", payableTo: "Clerk of court", notes: "Amount not entered — confirm with the clerk." },
      { id: "LA-fee2", label: "Records / agency fees", kind: "government", payableTo: "State and local agencies", notes: "Amount not entered — confirm with each agency." },
    ],
    contacts: [{ id: "LA-k1", name: "Sample state records bureau", role: "Criminal history requests", phone: "(555) 010-2290", email: "records@la-bureau-sample.example.com" }],
    custodians: [
      { id: "LA-cu1", name: "Orleans Parish clerk — criminal records (sample)", type: "Clerk of court", locality: "Orleans Parish", contact: "(555) 010-2201", methods: ["In person", "Mail", "Email"] },
      { id: "LA-cu2", name: "Jefferson Parish clerk (sample)", type: "Clerk of court", locality: "Jefferson Parish", contact: "(555) 010-2211", methods: ["In person", "Mail"] },
      { id: "LA-cu3", name: "New Orleans police records (sample)", type: "Law enforcement", locality: "Orleans Parish", contact: "(555) 010-2240", methods: ["Online portal", "In person"] },
      { id: "LA-cu4", name: "Jefferson Parish sheriff records (sample)", type: "Law enforcement", locality: "Jefferson Parish", contact: "(555) 010-2241", methods: ["Mail", "In person"] },
      { id: "LA-cu5", name: "State criminal history repository (sample)", type: "State repository", contact: "(555) 010-2290", methods: ["Mail", "Online portal"] },
      { id: "LA-cu6", name: "East Baton Rouge clerk (sample)", type: "Clerk of court", locality: "East Baton Rouge Parish", contact: "(555) 010-2221", methods: ["Mail", "In person"] },
      { id: "LA-cu7", name: "Caddo Parish clerk (sample)", type: "Clerk of court", locality: "Caddo Parish", contact: "(555) 010-2231", methods: ["Mail"] },
    ],
    sources: [{ label: "Official state statutes and court rules (add link after research)" }, { label: "Clerk of court instructions per parish (add links)" }],
    verificationNotes: "Structure only. No rules, waiting periods, forms or fees have been verified for Louisiana.",
  },
  {
    id: "J-TX", state: "TX", stateName: "Texas", localityLabel: "County", active: true,
    localities: [
      { id: "TX-harris", name: "Harris County", courts: [{ id: "TX-har-c1", name: "Harris County criminal court (sample entry)", clerk: "District clerk — criminal (sample)", clerkContact: "(555) 010-3301 · records@harris-clerk.example.com", daOffice: "District attorney's office (sample)", daContact: "(555) 010-3302" }] },
      { id: "TX-travis", name: "Travis County", courts: [{ id: "TX-tra-c1", name: "Travis County court (sample entry)", clerk: "County clerk (sample)", clerkContact: "(555) 010-3311 · clerk@travis-sample.example.com" }] },
      { id: "TX-dallas", name: "Dallas County", courts: [{ id: "TX-dal-c1", name: "Dallas County criminal court (sample entry)", clerk: "District clerk (sample)", clerkContact: "(555) 010-3321", daOffice: "District attorney's office (sample)", daContact: "(555) 010-3322" }] },
      { id: "TX-bexar", name: "Bexar County", courts: [{ id: "TX-bex-c1", name: "Bexar County court (sample entry)", clerk: "District clerk (sample)", clerkContact: "(555) 010-3331" }] },
    ],
    classifications: ["Class C misdemeanor", "Class B misdemeanor", "Class A misdemeanor", "State jail felony", "Felony (degree to confirm)", "To be confirmed"],
    rules: placeholderRules("TX"),
    requiredDocs: [
      { id: "TX-d-any", caseType: "Any case", docs: ["Criminal history report", "Arrest report", "Court minutes", "Final disposition"] },
      { id: "TX-d-dism", caseType: "Dismissal / acquittal", docs: ["Dismissal or acquittal documentation", "Bill of information or charging document"] },
      { id: "TX-d-def", caseType: "Deferred adjudication / diversion", docs: ["Judgment of conviction", "Probation or parole completion documentation"] },
    ],
    forms: [{ id: "TX-f1", name: "Petition and supporting forms (identify from the official source)", source: TODO }],
    procedures: "Placeholder. Texas procedures are configured separately from Louisiana — record them only after verifying with the official sources and the clerk.",
    fees: [
      { id: "TX-fee1", label: "Court filing fees", kind: "court_filing", payableTo: "District or county clerk", notes: "Amount not entered — confirm with the clerk." },
      { id: "TX-fee2", label: "Agency fees", kind: "government", payableTo: "State and local agencies", notes: "Amount not entered — confirm with each agency." },
    ],
    contacts: [{ id: "TX-k1", name: "Sample state records repository", role: "Criminal history requests", phone: "(555) 010-3390", email: "records@tx-repo-sample.example.com" }],
    custodians: [
      { id: "TX-cu1", name: "Harris County district clerk (sample)", type: "Clerk of court", locality: "Harris County", contact: "(555) 010-3301", methods: ["Online portal", "In person"] },
      { id: "TX-cu2", name: "Travis County clerk (sample)", type: "Clerk of court", locality: "Travis County", contact: "(555) 010-3311", methods: ["Mail", "Email"] },
      { id: "TX-cu3", name: "Dallas County district clerk (sample)", type: "Clerk of court", locality: "Dallas County", contact: "(555) 010-3321", methods: ["Online portal", "Mail"] },
      { id: "TX-cu4", name: "Bexar County district clerk (sample)", type: "Clerk of court", locality: "Bexar County", contact: "(555) 010-3331", methods: ["Mail"] },
      { id: "TX-cu5", name: "City police records (sample)", type: "Law enforcement", contact: "(555) 010-3340", methods: ["Online portal", "Mail"] },
      { id: "TX-cu6", name: "State criminal history repository (sample)", type: "State repository", contact: "(555) 010-3390", methods: ["Online portal"] },
    ],
    sources: [{ label: "Official state statutes and court rules (add link after research)" }, { label: "Clerk instructions per county (add links)" }],
    verificationNotes: "Structure only. No rules, waiting periods, forms or fees have been verified for Texas.",
  },
];

/* ------------------------------------------------------------------ */
/* Services + pricing (sample prices, admin-editable)                  */
/* ------------------------------------------------------------------ */

export const EXP_SERVICES: ServiceType[] = [
  { id: "records", name: "Records collection only", description: "Request and organize arrest, court and criminal history records.", active: true },
  { id: "prep", name: "Screening & document preparation", description: "Administrative screening and preparation of documents for the client to review and file.", active: true },
  { id: "full", name: "Document preparation & filing coordination", description: "Preparation plus coordination of filing and court follow-up.", active: true },
];
const price = (serviceTypeId: string, state: string, complexity: PriceRule["complexity"], fee: number): PriceRule => ({ id: `p-${serviceTypeId}-${state}-${complexity}`, serviceTypeId, state, complexity, fee });
export const EXP_PRICES: PriceRule[] = [
  price("records", "Any", "standard", 150), price("records", "Any", "moderate", 225), price("records", "Any", "complex", 325),
  price("prep", "LA", "standard", 450), price("prep", "LA", "moderate", 600), price("prep", "LA", "complex", 800),
  price("prep", "TX", "standard", 425), price("prep", "TX", "moderate", 575), price("prep", "TX", "complex", 775),
  price("full", "LA", "standard", 750), price("full", "LA", "moderate", 950), price("full", "LA", "complex", 1250),
  price("full", "TX", "standard", 700), price("full", "TX", "moderate", 900), price("full", "TX", "complex", 1200),
];

/* ------------------------------------------------------------------ */
/* Builders                                                             */
/* ------------------------------------------------------------------ */

const ch = (id: string, description: string, disposition: Charge["disposition"], o: Partial<Charge> = {}): Charge => ({ id, description, disposition, ...o });
const dk = (id: string, court: string, docketNumber: string, charges: Charge[]): Docket => ({ id, court, docketNumber, charges });
type RecSeed = [docType: string, kind: RecordItem["kind"], status: RecordItem["status"], extra?: Partial<RecordItem>];
const recs = (caseId: string, list: RecSeed[]): RecordItem[] => list.map(([docType, kind, status, extra], i) => ({ id: `${caseId}-rec${i + 1}`, docType, kind, status, required: true, ...extra }));
const screening = (o: Partial<Screening> = {}): Screening => ({ ruleIds: [], offenseCategory: "", dispositionSummary: "", sentenceCompleted: "unknown", waitingPeriod: "", waitingPeriodMet: "unknown", obligationsOutstanding: "unknown", pendingCharges: "unknown", onSupervision: "unknown", priorExpungements: "unknown", supportingDocsComplete: "unknown", missingInfo: "", disqualifyingIssues: "", legalReviewRequired: false, outcome: "Information Incomplete", reviews: [], ...o });
const hist = (byId: string, ...events: [string, StatusEvent["status"], string?][]): StatusEvent[] => events.map(([at, status, note]) => ({ at, status, byId, note }));
const assign = (main: string, o: Partial<Record<AssignmentRole, string>> = {}) => Object.fromEntries(ASSIGNMENT_ROLES.map((r) => [r, o[r] ?? main])) as Record<AssignmentRole, string>;
const intake = (o: Partial<Intake>): Intake => ({
  status: "reviewed", step: 4, first: "", middle: "", last: "", aliases: [], currentAddress: "", previousAddresses: [], preferredContact: "Phone", idDoc: "received",
  additional: { pendingCharges: "no", onSupervision: "no", priorExpungements: "no", previousApplications: "no", deniedApplications: "no", hasRecords: "no" },
  acks: { accurate: d(-20), notLegal: d(-20), noEligibility: d(-20), jurisdiction: d(-20), agencies: d(-20) },
  ...o,
});

type CaseSeed = Omit<ExpCase, "screening" | "prep" | "filing" | "history" | "internalNotes" | "records" | "sentenceCompleted" | "obligations" | "complexity" | "serviceType"> &
  Partial<Pick<ExpCase, "sentenceCompleted" | "obligations" | "complexity" | "serviceType" | "internalNotes">> & { records?: RecSeed[]; screening?: Partial<Screening>; prep?: Partial<ExpCase["prep"]>; filing?: Partial<ExpCase["filing"]>; history?: StatusEvent[] };
const mkCase = (s: CaseSeed): ExpCase => ({
  sentenceCompleted: "unknown",
  obligations: "unknown",
  complexity: "standard",
  serviceType: "full",
  internalNotes: [],
  ...s,
  records: recs(s.id, s.records ?? []),
  screening: screening(s.screening),
  prep: { preparerId: s.assignedTo, reviewerId: s.assignedTo === "s-mk" ? "s-jp" : "s-mk", status: "not_started", forms: [], missing: [], clientApproval: "not_sent", delivery: "not_delivered", ...s.prep },
  filing: { court: s.dockets[0]?.court ?? "", clerkContact: "", feeStatus: "not_due", ...s.filing },
  history: s.history ?? hist(s.assignedTo, [s.createdAt, "Not Started", "case created"]),
});

const VERIFIED_REVIEW = (at: string, byId: string, explanation: string) => ({ id: `rv-${at.slice(0, 10)}-${byId}`, at, byId, outcome: "Administrative Processing Approved" as const, sources: ["Jurisdiction configuration (sample — not a verified legal source)", "Certified court minutes on file"], explanation });

/* ------------------------------------------------------------------ */
/* Matters and cases                                                    */
/* ------------------------------------------------------------------ */

export const EXP_MATTERS: ExpMatter[] = [
  { id: "EXP-2041", number: "EXP-2041", clientId: "c-1001", source: "referral", createdAt: d(-18), intake: intake({ first: "Jordan", middle: "Q.", last: "Sample", currentAddress: "100 Example Ave, Apt 4, Springfield, GA 30000", previousAddresses: ["22 Sample St, New Orleans, LA 70000 (2015–2019)"], preferredContact: "Email", submittedAt: d(-16), reviewedBy: "s-jp", reviewedAt: d(-15) }), assignments: assign("s-jp"), info: [], notes: [{ id: "n1", authorId: "s-jp", body: "Client moved from Louisiana in 2019. Wants records cleared before a licensing application.", at: d(-15) }], access: [] },
  { id: "EXP-2042", number: "EXP-2042", clientId: "c-1004", source: "referral", createdAt: d(-30), intake: intake({ first: "Casey", middle: "", last: "Placeholder", aliases: ["Casey P. Sample"], currentAddress: "48 Demo Street, Fairview, GA 30003", previousAddresses: ["9 Mock Ave, Houston, TX 77000 (2016–2018)", "15 Demo Ct, Metairie, LA 70000 (2019–2021)"], preferredContact: "Text", submittedAt: d(-28), reviewedBy: "s-jp", reviewedAt: d(-27), additional: { pendingCharges: "no", onSupervision: "no", priorExpungements: "no", previousApplications: "no", deniedApplications: "no", hasRecords: "yes" } }), assignments: assign("s-jp", { "Quality review": "s-mk" }), info: [{ id: "i1", caseId: "EXP-2042-C2", label: "Review and approve your prepared documents", detail: "Please review the prepared documents for your Louisiana case and approve them or tell us what to change.", file: false, status: "open", docIds: [], createdAt: d(-1) }], notes: [{ id: "n1", authorId: "s-jp", body: "Interview in ~6 weeks — keep the client updated weekly.", at: d(-29) }], access: [] },
  { id: "EXP-2043", number: "EXP-2043", clientId: "c-1010", source: "phone", createdAt: d(-9), intake: intake({ first: "Quinn", middle: "R.", last: "Example", currentAddress: "90 Sample Hollow, Fairview, GA 30003", previousAddresses: ["4 Example Ln, Austin, TX 78700 (2012–2016)", "70 Mock Blvd, Baton Rouge, LA 70800 (2017–2020)"], submittedAt: d(-8), reviewedBy: "s-jp", reviewedAt: d(-7), additional: { pendingCharges: "unknown", pendingDetail: "Client is unsure whether a 2023 citation was resolved.", onSupervision: "no", priorExpungements: "no", previousApplications: "yes", deniedApplications: "no", otherCases: "Says a 2019 traffic matter may exist in Dallas County.", hasRecords: "no" } }), assignments: assign("s-jp", { "Records collection": "s-al" }), info: [{ id: "i1", caseId: "EXP-2043-C1", label: "Signed records release authorization", detail: "We need your signed release before the county will send records.", file: true, status: "open", docIds: [], createdAt: d(-6) }, { id: "i2", label: "Was the 2023 citation resolved?", detail: "Tell us anything you know — court name, date, or any paperwork.", file: false, status: "open", docIds: [], createdAt: d(-6) }], notes: [], access: [] },
  { id: "EXP-2044", number: "EXP-2044", clientId: "c-1012", source: "referral", createdAt: d(-75), intake: intake({ first: "Taylor", middle: "", last: "Demo-Reyes", currentAddress: "3 Mockingbird Example Rd, Bayview, GA 30005", previousAddresses: ["11 Sample Pl, New Orleans, LA 70000 (2014–2018)"], submittedAt: d(-73), reviewedBy: "s-jp", reviewedAt: d(-72) }), assignments: assign("s-jp", { "Filing coordination": "s-mk" }), info: [], notes: [], access: [] },
  { id: "EXP-2045", number: "EXP-2045", clientId: "c-1005", source: "website", createdAt: d(0, 9, 15), intake: intake({ status: "inquiry", step: 0, first: "Riley", last: "Testcase", idDoc: "not_requested", acks: {} }), assignments: assign("s-jp"), info: [], notes: [{ id: "n1", authorId: "s-jp", body: "Website inquiry: asking about an old arrest in Texas. Send intake.", at: d(0, 9, 30) }], access: [] },
  { id: "EXP-2046", number: "EXP-2046", clientId: "c-1006", source: "portal", createdAt: d(-4), intake: intake({ status: "in_progress", step: 1, first: "Avery", last: "Fictional", currentAddress: "512 Sample Ridge, Oakdale, GA 30004", idDoc: "requested", acks: {}, additional: { pendingCharges: "unknown", onSupervision: "unknown", priorExpungements: "unknown", previousApplications: "unknown", deniedApplications: "unknown", hasRecords: "unknown" } }), assignments: assign("s-al"), info: [], notes: [], access: [] },
  { id: "EXP-2047", number: "EXP-2047", clientId: "c-1009", source: "referral", createdAt: d(-160), intake: intake({ first: "Morgan", last: "Mockwell", currentAddress: "6 Test Court, Lakeside, GA 30002", previousAddresses: ["8 Example Way, San Antonio, TX 78200 (2010–2014)", "30 Mock St, Shreveport, LA 71100 (2015–2017)"], submittedAt: d(-158), reviewedBy: "s-jp", reviewedAt: d(-157) }), assignments: assign("s-jp", { "Case completion": "s-mk" }), info: [], notes: [], access: [] },
];

export const EXP_CASES: ExpCase[] = [
  // Jordan — LA, dismissed, records verified, awaiting review.
  mkCase({
    id: "EXP-2041-C1", number: "EXP-2041-C1", matterId: "EXP-2041", clientId: "c-1001", jurisdictionId: "J-LA", state: "LA", localityId: "LA-orleans", locality: "Orleans Parish", arrestingAgency: "City police (sample)", arrestDate: "2016-08-14", arrestNumber: "SAMPLE-A-160814-77", arrestingJurisdiction: "Orleans Parish",
    dockets: [dk("dk1", "Orleans Parish criminal court (sample entry)", "SAMPLE-D-551204", [ch("c1", "Simple possession (sample)", "Dismissed", { classification: "Misdemeanor", dispositionDate: "2017-01-20" })])],
    sentenceCompleted: "yes", obligations: "none", resolution: "Dismissed", assignedTo: "s-jp", status: "Not Started", createdAt: d(-15),
    records: [["Criminal history report", "criminal_history", "verified", { custodianId: "LA-cu5", custodianName: "State criminal history repository (sample)", requestedAt: day(-14), method: "Mail", fee: 26, feePaid: true, receivedAt: day(-6), docId: "exp2041-d1" }], ["Arrest report", "arrest", "verified", { custodianId: "LA-cu3", custodianName: "New Orleans police records (sample)", requestedAt: day(-14), method: "Online portal", fee: 15, feePaid: true, receivedAt: day(-9), docId: "exp2041-d2" }], ["Court minutes", "court_minutes", "verified", { custodianId: "LA-cu1", custodianName: "Orleans Parish clerk — criminal records (sample)", requestedAt: day(-14), method: "In person", fee: 10, feePaid: true, receivedAt: day(-5), docId: "exp2041-d3" }], ["Dismissal or acquittal documentation", "disposition", "received", { custodianId: "LA-cu1", custodianName: "Orleans Parish clerk — criminal records (sample)", requestedAt: day(-14), method: "In person", receivedAt: day(-5), docId: "exp2041-d4" }]],
    screening: { offenseCategory: "Misdemeanor", dispositionSummary: "Single charge dismissed", sentenceCompleted: "yes", obligationsOutstanding: "no", pendingCharges: "no", onSupervision: "no", priorExpungements: "no", supportingDocsComplete: "unknown", missingInfo: "Verify the dismissal document matches the docket.", outcome: "Ready for Review" },
  }),
  // Casey — TX case: 1 docket, 2 charges; documents being prepared.
  mkCase({
    id: "EXP-2042-C1", number: "EXP-2042-C1", matterId: "EXP-2042", clientId: "c-1004", jurisdictionId: "J-TX", state: "TX", localityId: "TX-harris", locality: "Harris County", arrestingAgency: "City police (sample)", arrestDate: "2017-03-02", arrestNumber: "SAMPLE-TXA-170302", arrestingJurisdiction: "Harris County",
    dockets: [dk("dk1", "Harris County criminal court (sample entry)", "SAMPLE-TX-2017-00418", [ch("c1", "Theft (sample description)", "Dismissed", { classification: "Class B misdemeanor", dispositionDate: "2017-09-11" }), ch("c2", "Criminal trespass (sample description)", "Deferred adjudication", { classification: "Class B misdemeanor", dispositionDate: "2017-09-11", sentence: "Community supervision — 6 months (sample)" })])],
    supervision: "Community supervision completed 2018 (sample)", sentenceCompleted: "yes", obligations: "paid", complexity: "moderate", assignedTo: "s-jp", status: "Preparing", createdAt: d(-27),
    records: [["Criminal history report", "criminal_history", "verified", { custodianId: "TX-cu6", custodianName: "State criminal history repository (sample)", requestedAt: day(-26), method: "Online portal", fee: 10, feePaid: true, receivedAt: day(-25), docId: "exp2042-d1" }], ["Court minutes", "court_minutes", "verified", { custodianId: "TX-cu1", custodianName: "Harris County district clerk (sample)", requestedAt: day(-26), method: "Online portal", fee: 12, feePaid: true, receivedAt: day(-20), docId: "exp2042-d2" }], ["Final disposition", "disposition", "verified", { custodianId: "TX-cu1", custodianName: "Harris County district clerk (sample)", requestedAt: day(-26), method: "Online portal", receivedAt: day(-20), docId: "exp2042-d3" }], ["Probation or parole completion documentation", "other", "verified", { method: "Client provided", receivedAt: day(-18), docId: "exp2042-d4" }]],
    screening: { offenseCategory: "Class B misdemeanor (2 charges)", dispositionSummary: "One dismissed; one deferred adjudication, supervision completed", sentenceCompleted: "yes", waitingPeriod: "Not entered — jurisdiction rules not verified", waitingPeriodMet: "unknown", obligationsOutstanding: "no", pendingCharges: "no", onSupervision: "no", priorExpungements: "no", supportingDocsComplete: "yes", legalReviewRequired: true, outcome: "Administrative Processing Approved", reviews: [{ id: "rv1", at: d(-15), byId: "s-jp", outcome: "Attorney / Qualified Legal Review Needed", sources: ["Court minutes", "Final disposition"], explanation: "Two charges with different dispositions — sent for qualified legal review before preparing documents." }, { id: "rv2", at: d(-12), byId: "s-mk", reviewerName: "Sample Partner Attorney (fictional)", legal: true, outcome: "Administrative Processing Approved", sources: ["Partner attorney review memo (sample)"], explanation: "Qualified reviewer confirmed MKB may prepare documents for the client's review. Outcome is decided by the court." }] },
    prep: { status: "in_progress", forms: [{ id: "f1", name: "Petition (per verified jurisdiction forms)", source: "To be identified from official source", status: "drafted", docId: "exp2042-d5" }, { id: "f2", name: "Proposed order (per verified jurisdiction forms)", source: "To be identified from official source", status: "needed" }], missing: ["Confirm current mailing address for service"] },
    history: hist("s-jp", [d(-27), "Not Started", "case created"], [d(-11), "Preparing", "screening approved after qualified legal review"]),
  }),
  // Casey — LA case: 1 arrest, 2 dockets; awaiting client approval.
  mkCase({
    id: "EXP-2042-C2", number: "EXP-2042-C2", matterId: "EXP-2042", clientId: "c-1004", jurisdictionId: "J-LA", state: "LA", localityId: "LA-jefferson", locality: "Jefferson Parish", arrestingAgency: "Parish sheriff (sample)", arrestDate: "2020-05-19", arrestNumber: "SAMPLE-JP-200519", arrestingJurisdiction: "Jefferson Parish",
    dockets: [dk("dk1", "Jefferson Parish district court (sample entry)", "SAMPLE-JP-20-1187", [ch("c1", "Disturbing the peace (sample description)", "Refused / not prosecuted", { classification: "Misdemeanor", dispositionDate: "2020-07-01" })]), dk("dk2", "Jefferson Parish district court (sample entry)", "SAMPLE-JP-20-1188", [ch("c2", "Criminal mischief (sample description)", "Convicted", { classification: "Misdemeanor", convictionDate: "2020-10-14", sentence: "Fine and 6 months probation (sample)" })])],
    supervision: "Probation completed 2021 (sample)", sentenceCompleted: "yes", obligations: "paid", complexity: "moderate", assignedTo: "s-jp", status: "Awaiting Client Approval", createdAt: d(-27),
    records: [["Criminal history report", "criminal_history", "verified", { custodianId: "LA-cu5", custodianName: "State criminal history repository (sample)", requestedAt: day(-26), method: "Mail", fee: 26, feePaid: true, receivedAt: day(-17), docId: "exp2042-d6" }], ["Court minutes", "court_minutes", "verified", { custodianId: "LA-cu2", custodianName: "Jefferson Parish clerk (sample)", requestedAt: day(-26), method: "In person", fee: 20, feePaid: true, receivedAt: day(-19), docId: "exp2042-d7" }], ["Judgment of conviction", "disposition", "verified", { custodianId: "LA-cu2", custodianName: "Jefferson Parish clerk (sample)", requestedAt: day(-26), method: "In person", receivedAt: day(-19), docId: "exp2042-d8" }], ["Probation or parole completion documentation", "other", "verified", { method: "Client provided", receivedAt: day(-16), docId: "exp2042-d9" }]],
    screening: { offenseCategory: "Misdemeanor (2 dockets)", dispositionSummary: "One refused; one conviction with probation completed", sentenceCompleted: "yes", obligationsOutstanding: "no", pendingCharges: "no", onSupervision: "no", priorExpungements: "no", supportingDocsComplete: "yes", outcome: "Administrative Processing Approved", reviews: [VERIFIED_REVIEW(d(-10), "s-mk", "All required records verified. Administrative preparation approved; eligibility is decided by the court.")] },
    prep: { status: "internally_approved", forms: [{ id: "f1", name: "Motion package — docket ending 1187", source: "To be identified from official source", status: "final", docId: "exp2042-d10" }, { id: "f2", name: "Motion package — docket ending 1188", source: "To be identified from official source", status: "final", docId: "exp2042-d11" }], clientApproval: "sent" },
    history: hist("s-jp", [d(-27), "Not Started"], [d(-9), "Preparing"], [d(-1), "Awaiting Client Approval", "sent to client for review"]),
  }),
  // Quinn — TX Travis: awaiting criminal records.
  mkCase({
    id: "EXP-2043-C1", number: "EXP-2043-C1", matterId: "EXP-2043", clientId: "c-1010", jurisdictionId: "J-TX", state: "TX", localityId: "TX-travis", locality: "Travis County", arrestingAgency: "County sheriff (sample)", arrestDate: "2014-11-03", arrestNumber: "SAMPLE-TR-141103", arrestingJurisdiction: "Travis County",
    dockets: [dk("dk1", "Travis County court (sample entry)", "SAMPLE-TR-14-0902", [ch("c1", "Charge description pending records", "Unknown")])],
    assignedTo: "s-al", status: "Not Started", createdAt: d(-7),
    records: [["Criminal history report", "criminal_history", "requested", { custodianId: "TX-cu6", custodianName: "State criminal history repository (sample)", requestedAt: day(-6), method: "Online portal", fee: 10, feePaid: true }], ["Arrest report", "arrest", "not_requested", { missingInfo: "Need signed release from client first" }], ["Court minutes", "court_minutes", "not_requested"]],
    screening: { outcome: "Awaiting Records", missingInfo: "Charges and disposition unknown until records arrive." },
  }),
  // Quinn — TX Dallas: awaiting court minutes.
  mkCase({
    id: "EXP-2043-C2", number: "EXP-2043-C2", matterId: "EXP-2043", clientId: "c-1010", jurisdictionId: "J-TX", state: "TX", localityId: "TX-dallas", locality: "Dallas County", arrestingAgency: "City police (sample)", arrestDate: "2015-06-21", arrestNumber: "SAMPLE-DL-150621",
    dockets: [dk("dk1", "Dallas County criminal court (sample entry)", "SAMPLE-DL-15-3310", [ch("c1", "Possession of a controlled substance (sample)", "Acquitted / not guilty", { classification: "To be confirmed", dispositionDate: "2016-02-09" })])],
    assignedTo: "s-al", status: "Not Started", createdAt: d(-7),
    records: [["Criminal history report", "criminal_history", "verified", { custodianId: "TX-cu6", custodianName: "State criminal history repository (sample)", requestedAt: day(-6), method: "Online portal", fee: 10, feePaid: true, receivedAt: day(-5), docId: "exp2043-d1" }], ["Court minutes", "court_minutes", "requested", { custodianId: "TX-cu3", custodianName: "Dallas County district clerk (sample)", requestedAt: day(-5), method: "Mail", fee: 15, feePaid: false }], ["Dismissal or acquittal documentation", "disposition", "incomplete", { custodianId: "TX-cu3", custodianName: "Dallas County district clerk (sample)", requestedAt: day(-5), method: "Mail", receivedAt: day(-1), docId: "exp2043-d2", missingInfo: "Copy is missing the judge's signature page." }]],
    screening: { outcome: "Awaiting Records", dispositionSummary: "Client reports acquittal — confirm with minutes" },
  }),
  // Quinn — LA EBR: flagged for legal review (possible pending charge).
  mkCase({
    id: "EXP-2043-C3", number: "EXP-2043-C3", matterId: "EXP-2043", clientId: "c-1010", jurisdictionId: "J-LA", state: "LA", localityId: "LA-ebr", locality: "East Baton Rouge Parish", arrestingAgency: "City police (sample)", arrestDate: "2018-09-30", arrestNumber: "SAMPLE-BR-180930",
    dockets: [dk("dk1", "East Baton Rouge district court (sample entry)", "SAMPLE-BR-18-7781", [ch("c1", "Simple battery (sample description)", "Convicted", { classification: "Misdemeanor", convictionDate: "2019-03-12", sentence: "Fine (sample)" })])],
    sentenceCompleted: "yes", obligations: "unknown", assignedTo: "s-jp", status: "Not Started", createdAt: d(-7),
    records: [["Criminal history report", "criminal_history", "verified", { custodianId: "LA-cu5", custodianName: "State criminal history repository (sample)", requestedAt: day(-6), method: "Mail", fee: 26, feePaid: true, receivedAt: day(-2), docId: "exp2043-d3" }], ["Court minutes", "court_minutes", "verified", { custodianId: "LA-cu6", custodianName: "East Baton Rouge clerk (sample)", requestedAt: day(-6), method: "Mail", fee: 10, feePaid: true, receivedAt: day(-2), docId: "exp2043-d4" }], ["Judgment of conviction", "disposition", "verified", { custodianId: "LA-cu6", custodianName: "East Baton Rouge clerk (sample)", requestedAt: day(-6), method: "Mail", receivedAt: day(-2), docId: "exp2043-d5" }]],
    screening: { offenseCategory: "Misdemeanor", dispositionSummary: "Conviction — fine", sentenceCompleted: "yes", obligationsOutstanding: "unknown", pendingCharges: "unknown", onSupervision: "no", priorExpungements: "no", disqualifyingIssues: "Client reports a possible unresolved 2023 citation; court costs status unknown.", legalReviewRequired: true, outcome: "Attorney / Qualified Legal Review Needed", reviews: [{ id: "rv1", at: d(-1), byId: "s-jp", outcome: "Attorney / Qualified Legal Review Needed", sources: ["Criminal history report", "Client intake"], explanation: "Possible pending matter and unknown court costs — needs qualified legal review before any preparation." }] },
    internalNotes: [{ id: "n1", authorId: "s-jp", body: "Do not discuss eligibility with the client until the legal review comes back.", at: d(-1) }],
  }),
  // Taylor — LA Orleans: hearing scheduled.
  mkCase({
    id: "EXP-2044-C1", number: "EXP-2044-C1", matterId: "EXP-2044", clientId: "c-1012", jurisdictionId: "J-LA", state: "LA", localityId: "LA-orleans", locality: "Orleans Parish", arrestingAgency: "City police (sample)", arrestDate: "2015-02-11", arrestNumber: "SAMPLE-OR-150211",
    dockets: [dk("dk1", "Orleans Parish criminal court (sample entry)", "SAMPLE-OR-15-2290", [ch("c1", "Theft (sample description)", "Diverted / pretrial intervention", { classification: "Misdemeanor", dispositionDate: "2015-12-01" })])],
    sentenceCompleted: "yes", obligations: "paid", assignedTo: "s-jp", status: "Hearing Scheduled", createdAt: d(-72),
    records: [["Criminal history report", "criminal_history", "verified", { requestedAt: day(-70), method: "Mail", fee: 26, feePaid: true, receivedAt: day(-60), docId: "exp2044-d1", custodianName: "State criminal history repository (sample)" }], ["Court minutes", "court_minutes", "verified", { requestedAt: day(-70), method: "In person", fee: 10, feePaid: true, receivedAt: day(-62), docId: "exp2044-d2", custodianName: "Orleans Parish clerk — criminal records (sample)" }], ["Final disposition", "disposition", "verified", { requestedAt: day(-70), method: "In person", receivedAt: day(-62), docId: "exp2044-d3", custodianName: "Orleans Parish clerk — criminal records (sample)" }]],
    screening: { offenseCategory: "Misdemeanor", dispositionSummary: "Diversion completed", sentenceCompleted: "yes", obligationsOutstanding: "no", pendingCharges: "no", onSupervision: "no", priorExpungements: "no", supportingDocsComplete: "yes", outcome: "Administrative Processing Approved", reviews: [VERIFIED_REVIEW(d(-55), "s-mk", "Records verified; documents prepared for the client to file with MKB coordinating.")] },
    prep: { status: "internally_approved", forms: [{ id: "f1", name: "Motion package", source: "To be identified from official source", status: "final", docId: "exp2044-d4" }], clientApproval: "approved", delivery: "delivered", deliveredAt: d(-40) },
    filing: { court: "Orleans Parish criminal court (sample entry)", clerkContact: "(555) 010-2201", daContact: "(555) 010-2202", filedAt: day(-30), method: "In person by the client, coordinated by MKB", confirmationNumber: "SAMPLE-FILE-0912", confirmationDocId: "exp2044-d5", confirmationVerified: true, filingFee: 0, feeStatus: "paid", hearingAt: d(12, 9), requirements: "Client must attend the hearing in person (sample note)." },
    history: hist("s-jp", [d(-72), "Not Started"], [d(-50), "Preparing"], [d(-42), "Awaiting Client Approval"], [d(-40), "Ready for Filing"], [d(-30), "Submitted", "filing confirmation verified"], [d(-28), "Awaiting Agency / Court Response"], [d(-5), "Hearing Scheduled", "hearing date received from the clerk"]),
  }),
  // Avery — client portal draft case (intake in progress).
  mkCase({
    id: "EXP-2046-C1", number: "EXP-2046-C1", matterId: "EXP-2046", clientId: "c-1006", jurisdictionId: "J-TX", state: "TX", locality: "Bexar County", localityId: "TX-bexar", arrestingAgency: "Not sure", arrestDate: "2019-07-04", dockets: [dk("dk1", "", "", [ch("c1", "Not sure — client will look for paperwork", "Unknown")])], assignedTo: "s-al", status: "Not Started", createdAt: d(-3), draft: true,
  }),
  // Morgan — TX Bexar: completed with verified final order.
  mkCase({
    id: "EXP-2047-C1", number: "EXP-2047-C1", matterId: "EXP-2047", clientId: "c-1009", jurisdictionId: "J-TX", state: "TX", localityId: "TX-bexar", locality: "Bexar County", arrestingAgency: "City police (sample)", arrestDate: "2012-04-22", arrestNumber: "SAMPLE-BX-120422",
    dockets: [dk("dk1", "Bexar County court (sample entry)", "SAMPLE-BX-12-6604", [ch("c1", "Criminal mischief (sample description)", "Dismissed", { classification: "Class C misdemeanor", dispositionDate: "2012-08-30" })])],
    sentenceCompleted: "yes", obligations: "none", assignedTo: "s-jp", status: "Completed", createdAt: d(-157),
    records: [["Criminal history report", "criminal_history", "verified", { requestedAt: day(-155), method: "Online portal", fee: 10, feePaid: true, receivedAt: day(-150), docId: "exp2047-d1", custodianName: "State criminal history repository (sample)" }], ["Court minutes", "court_minutes", "verified", { requestedAt: day(-155), method: "Online portal", fee: 12, feePaid: true, receivedAt: day(-148), docId: "exp2047-d2", custodianName: "Bexar County district clerk (sample)" }], ["Dismissal or acquittal documentation", "disposition", "verified", { requestedAt: day(-155), method: "Online portal", receivedAt: day(-148), docId: "exp2047-d3", custodianName: "Bexar County district clerk (sample)" }]],
    screening: { offenseCategory: "Class C misdemeanor", dispositionSummary: "Dismissed", sentenceCompleted: "yes", obligationsOutstanding: "no", pendingCharges: "no", onSupervision: "no", priorExpungements: "no", supportingDocsComplete: "yes", outcome: "Administrative Processing Approved", reviews: [VERIFIED_REVIEW(d(-140), "s-mk", "Records verified; administrative preparation approved.")] },
    prep: { status: "internally_approved", forms: [{ id: "f1", name: "Petition package", source: "To be identified from official source", status: "final", docId: "exp2047-d4" }], clientApproval: "approved", delivery: "delivered", deliveredAt: d(-120) },
    filing: { court: "Bexar County court (sample entry)", clerkContact: "(555) 010-3331", filedAt: day(-115), method: "E-filing coordinated by MKB (sample)", confirmationNumber: "SAMPLE-EF-44120", confirmationDocId: "exp2047-d5", confirmationVerified: true, filingFee: 0, feeStatus: "paid", courtResponse: "Order signed (sample)", finalOrderDocId: "exp2047-d6", finalOrderVerified: true, completedAt: d(-60) },
    history: hist("s-jp", [d(-157), "Not Started"], [d(-138), "Preparing"], [d(-125), "Awaiting Client Approval"], [d(-120), "Ready for Filing"], [d(-115), "Submitted"], [d(-112), "Awaiting Agency / Court Response"], [d(-70), "Granted", "signed order received and verified against the court record"], [d(-60), "Completed", "order delivered to client; agencies notified per procedure"]),
  }),
  // Morgan — LA Caddo: on hold (court costs outstanding).
  mkCase({
    id: "EXP-2047-C2", number: "EXP-2047-C2", matterId: "EXP-2047", clientId: "c-1009", jurisdictionId: "J-LA", state: "LA", localityId: "LA-caddo", locality: "Caddo Parish", arrestingAgency: "Parish sheriff (sample)", arrestDate: "2016-01-09", arrestNumber: "SAMPLE-CD-160109",
    dockets: [dk("dk1", "Caddo Parish district court (sample entry)", "SAMPLE-CD-16-0450", [ch("c1", "Charge description (sample)", "Convicted", { classification: "Misdemeanor", convictionDate: "2016-06-02", sentence: "Fine and court costs (sample)" })])],
    obligations: "outstanding", sentenceCompleted: "no", assignedTo: "s-jp", status: "On Hold", holdFrom: "Not Started", holdReason: "Client is paying outstanding court costs; resume when the clerk confirms payment.", createdAt: d(-90),
    records: [["Criminal history report", "criminal_history", "verified", { requestedAt: day(-88), method: "Mail", fee: 26, feePaid: true, receivedAt: day(-80), docId: "exp2047-d7", custodianName: "State criminal history repository (sample)" }], ["Court minutes", "court_minutes", "verified", { requestedAt: day(-88), method: "Mail", fee: 10, feePaid: true, receivedAt: day(-78), docId: "exp2047-d8", custodianName: "Caddo Parish clerk (sample)" }]],
    screening: { obligationsOutstanding: "yes", outcome: "Potentially Ineligible — Further Review Required", disqualifyingIssues: "Outstanding court costs reported by the clerk (sample).", reviews: [{ id: "rv1", at: d(-75), byId: "s-jp", outcome: "Potentially Ineligible — Further Review Required", sources: ["Clerk statement of costs (sample)"], explanation: "Court costs outstanding. Paused at the client's request while they pay." }] },
    history: hist("s-jp", [d(-90), "Not Started"], [d(-74), "On Hold", "court costs outstanding"]),
  }),
];

/* ------------------------------------------------------------------ */
/* Records on the central client profile                               */
/* ------------------------------------------------------------------ */

const DOC_NAMES: Record<string, string> = {};
EXP_CASES.forEach((c) => {
  c.records.forEach((r) => r.docId && (DOC_NAMES[r.docId] = `${r.docType} — ${c.number}`));
  c.prep.forms.forEach((f) => f.docId && (DOC_NAMES[f.docId] = `${f.name} — ${c.number} (prepared by MKB, not filed)`));
  if (c.filing.confirmationDocId) DOC_NAMES[c.filing.confirmationDocId] = `Filing confirmation ${c.filing.confirmationNumber} — ${c.number}`;
  if (c.filing.finalOrderDocId) DOC_NAMES[c.filing.finalOrderDocId] = `Signed order (court-issued) — ${c.number}`;
});

const INVOICES: Record<string, { id: string; number: string; caseId?: string; issued: number; due: number; lines: InvoiceLine[]; paid: "all" | number; paidAt?: number; refund?: number }[]> = {
  "EXP-2041": [{ id: "exp2041-i1", number: "INV-E301", issued: -15, due: -1, lines: [{ kind: "service", label: "Document preparation & filing coordination — LA, standard", amount: 750 }, { kind: "records", label: "Records request fees (sample amounts)", amount: 51 }], paid: 400 }],
  "EXP-2042": [{ id: "exp2042-i1", number: "INV-E302", issued: -27, due: -13, lines: [{ kind: "service", label: "Document preparation & filing coordination — TX, moderate", amount: 900 }, { kind: "service", label: "Document preparation & filing coordination — LA, moderate", amount: 950 }, { kind: "discount", label: "Multiple-case discount", amount: -150 }, { kind: "records", label: "Records request fees (sample amounts)", amount: 68 }], paid: "all", paidAt: -20 }],
  "EXP-2043": [{ id: "exp2043-i1", number: "INV-E303", issued: -7, due: 7, lines: [{ kind: "service", label: "Records collection — 3 cases, moderate", amount: 450 }, { kind: "records", label: "Records request fees (sample amounts)", amount: 61 }], paid: 0 }],
  "EXP-2044": [{ id: "exp2044-i1", number: "INV-E304", issued: -72, due: -58, lines: [{ kind: "service", label: "Document preparation & filing coordination — LA, standard", amount: 750 }, { kind: "records", label: "Records request fees (sample amounts)", amount: 36 }, { kind: "clerk", label: "Clerk certified copy fee (sample amount)", amount: 20 }], paid: "all", paidAt: -60 }],
  "EXP-2047": [{ id: "exp2047-i1", number: "INV-E305", issued: -157, due: -143, lines: [{ kind: "service", label: "Document preparation & filing coordination — TX, standard", amount: 700 }, { kind: "service", label: "Records collection — LA, standard", amount: 150 }, { kind: "records", label: "Records request fees (sample amounts)", amount: 84 }], paid: "all", paidAt: -150, refund: 50 }],
};

export const expRequestsFor = (clientId: string) => EXP_MATTERS.filter((m) => m.clientId === clientId);

export function expClientRecords(clientId: string): { documents: ClientDocument[]; invoices: Invoice[]; messages: Message[] } {
  const documents: ClientDocument[] = [];
  const invoices: Invoice[] = [];
  const messages: Message[] = [];
  EXP_MATTERS.filter((m) => m.clientId === clientId).forEach((m) => {
    EXP_CASES.filter((c) => c.matterId === m.id).forEach((c) => {
      const all = [...c.records.map((r) => ({ id: r.docId, at: r.receivedAt ? `${r.receivedAt}T11:00:00` : undefined, by: r.method === "Client provided" ? "client" : "staff", cat: "Court & agency records" })), ...c.prep.forms.map((f) => ({ id: f.docId, at: c.history[c.history.length - 1]?.at, by: "staff", cat: "Prepared documents (not filed)" })), { id: c.filing.confirmationDocId, at: c.filing.filedAt ? `${c.filing.filedAt}T15:00:00` : undefined, by: "staff", cat: "Filing confirmation" }, { id: c.filing.finalOrderDocId, at: c.filing.completedAt, by: "staff", cat: "Court order" }];
      all.forEach((x) => x.id && documents.push({ id: x.id, name: DOC_NAMES[x.id], service: "expunge", category: x.cat, status: "reviewed", sensitive: true, requestedAt: x.at ?? m.createdAt, uploadedAt: x.at ?? m.createdAt, uploadedBy: x.by as "client" | "staff", sizeKb: 120 + (x.id.length * 37) % 400, expMatterId: m.id, expCaseId: c.id, deliveredAt: x.cat === "Court order" || (x.cat === "Prepared documents (not filed)" && c.prep.delivery === "delivered") ? c.prep.deliveredAt ?? c.filing.completedAt : undefined }));
    });
    m.info.filter((i) => i.file && i.status === "open").forEach((i) => documents.push({ id: `${m.id}-${i.id}-req`, name: i.label, service: "expunge", category: "Requested from client", status: "requested", sensitive: true, requestedAt: i.createdAt, expMatterId: m.id, expCaseId: i.caseId }));
    (INVOICES[m.id] ?? []).forEach((iv) => {
      const total = iv.lines.reduce((s, l) => s + l.amount, 0);
      const paid = iv.paid === "all" ? total : iv.paid;
      const inv: Invoice = { id: iv.id, number: iv.number, service: "expunge", description: `Record expungement assistance — ${m.number}`, amount: total, paid, status: paid >= total ? "paid" : iv.due < 0 ? (paid > 0 ? "partial" : "overdue") : paid > 0 ? "partial" : "open", issuedAt: d(iv.issued), dueAt: d(iv.due), lines: iv.lines, paidAt: iv.paidAt != null ? d(iv.paidAt) : undefined, expMatterId: m.id };
      if (iv.refund) {
        inv.adjustments = [{ id: `${iv.id}-adj`, kind: "refund", amount: iv.refund, note: "Unused records fee refunded (sample)", at: d(-100), byId: "s-mk" }];
        inv.amount = total - iv.refund;
        inv.paid = paid - iv.refund;
      }
      invoices.push(inv);
    });
    if (m.id === "EXP-2042") messages.push({ id: `${m.id}-m1`, from: "staff", author: "Jesse Park", body: "Your Louisiana documents are ready for your review in the portal.", at: d(-1, 14), service: "expunge", read: true, expMatterId: m.id });
    if (m.id === "EXP-2043") messages.push({ id: `${m.id}-m1`, from: "client", author: "Quinn Example", body: "I'll sign the release this week.", at: d(-5, 18), service: "expunge", read: true, expMatterId: m.id });
  });
  return { documents, invoices, messages };
}
