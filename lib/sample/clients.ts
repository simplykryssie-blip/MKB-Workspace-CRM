/**
 * SAMPLE DATA — DESIGN PREVIEW ONLY.
 * Every person, business, email, phone number, ID and amount here is fictional.
 * Emails use example.com and phones use the reserved 555-01xx range. Tax IDs
 * are only ever stored masked. Never add real client information to this file.
 */
import type {
  ActivityItem,
  Appointment,
  Client,
  ClientDocument,
  Enrollment,
  Invoice,
  Message,
  Note,
  ServiceKey,
  Signature,
  Staff,
} from "@/lib/types";

/** Fixed "now" for sample data so relative dates stay stable in the preview. */
import { SAMPLE_NOW } from "./time";
import { BOOKS_SEEDS, booksClientRecords } from "./books-seed";
export { SAMPLE_NOW };

export const STAFF: Staff[] = [
  { id: "s-mk", name: "MKB Owner", initials: "MK", title: "Owner" },
  { id: "s-al", name: "Alex Lane", initials: "AL", title: "Tax preparer" },
  { id: "s-rt", name: "Robin Tate", initials: "RT", title: "Bookkeeper" },
  { id: "s-jp", name: "Jesse Park", initials: "JP", title: "Case coordinator" },
];
export const staffById = (id: string) => STAFF.find((s) => s.id === id)!;

/** Workflow stages per division (also used by the service workspaces). */
export const STAGES: Record<ServiceKey, string[]> = {
  // Tax engagements follow the return workflow ("Rejected" is a status, not a stage).
  tax: ["Intake", "Awaiting Documents", "Ready for Review", "In Preparation", "Awaiting Client Approval", "Ready to E-file", "Submitted", "Accepted", "Completed"],
  // Bookkeeping engagements mirror the current month's close stage (see lib/books/config.ts).
  books: ["Client Entry in Progress", "Ready for MKB Review", "MKB Reviewing", "Reconciliation in Progress", "Client Follow-up Needed", "MKB Final Review", "Reports Ready", "Month Closed"],
  biz: ["Intake", "Name search", "Filing submitted", "State approved", "EIN obtained", "Complete"],
  expunge: ["Intake", "Records requested", "Eligibility review", "Petition drafted", "Filed", "Hearing", "Order granted"],
};

const d = (daysFromNow: number, hour = 10, min = 0) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + daysFromNow);
  t.setHours(hour, min, 0, 0);
  return t.toISOString();
};

type Seed = Omit<
  Client,
  "documents" | "messages" | "appointments" | "invoices" | "signatures" | "notes" | "activity" | "enrollments"
> & {
  enrollments: Omit<Enrollment, "id">[];
  /** Completed prior-year tax returns (paid in full) — creates history + paid invoices. */
  pastTax?: { year: number; fee: number }[];
  extraNotes?: Omit<Note, "id">[];
  extraMessages?: Omit<Message, "id">[];
};

const SEEDS: Seed[] = [
  {
    id: "c-1001",
    type: "individual",
    name: "Jordan Sample",
    email: "jordan.sample@example.com",
    phone: "(555) 010-0142",
    preferredContact: "Portal",
    address: { line1: "100 Example Ave, Apt 4", city: "Springfield", state: "GA", zip: "30000" },
    dob: "1988-04-12",
    taxIdType: "SSN", taxIdLast4: "0142",
    staffIds: ["s-al"],
    status: "active",
    portal: "active",
    tags: ["Returning client", "W-2 + side income"],
    source: "Referral",
    since: d(-720),
    lastActivityAt: d(0, 14, 48),
    pastTax: [{ year: 2024, fee: 400 }, { year: 2023, fee: 375 }],
    enrollments: [
      { service: "tax", title: "2025 Individual return (1040)", stage: "In Preparation", progress: 38, status: "active", staffId: "s-al", startedAt: d(-40), fee: 425 },
      { service: "expunge", title: "Record review — 1 county", stage: "Eligibility review", progress: 35, status: "in_review", staffId: "s-jp", startedAt: d(-18), fee: 750 },
    ],
    extraMessages: [
      { from: "client", author: "Jordan Sample", body: "Just uploaded my second W-2 from the part-time job. Do you also need my 1098-T?", at: d(0, 14, 50), service: "tax", read: false },
    ],
    extraNotes: [
      { authorId: "s-al", body: "Client started a side business mid-year — ask about Schedule C expenses and home office.", at: d(-6), pinned: true, service: "tax" },
    ],
  },
  {
    id: "c-1002",
    type: "business",
    name: "Maple Example LLC",
    contactName: "Pat Example",
    email: "pat@maple-example.example.com",
    phone: "(555) 010-0177",
    preferredContact: "Email",
    address: { line1: "220 Sample Blvd, Suite 300", city: "Riverton", state: "GA", zip: "30001" },
    business: { legalName: "Maple Example LLC", entityType: "LLC", state: "GA", formedAt: "2019-03-01", einLast4: "0177", responsibleParty: { name: "Pat Example", title: "Managing member", taxIdType: "SSN", taxIdLast4: "7014" }, industry: "Landscaping", fiscalYearEnd: "December" },
    staffIds: ["s-rt", "s-al"],
    status: "active",
    portal: "active",
    tags: ["Monthly retainer", "Payroll"],
    source: "Website",
    since: d(-540),
    lastActivityAt: d(0, 14, 12),
    pastTax: [{ year: 2025, fee: 1150 }],
    enrollments: [
      { service: "books", title: "Monthly bookkeeping", stage: "Reconciliation in Progress", progress: 43, status: "active", staffId: "s-rt", startedAt: d(-534), fee: 650 },
      { service: "tax", title: "2026 Business return (1065)", stage: "Intake", progress: 5, status: "active", staffId: "s-al", startedAt: d(-3), fee: 1200 },
    ],
  },
  {
    id: "c-1003",
    type: "business",
    name: "Northwind Demo Co.",
    contactName: "Sam Northwind",
    email: "sam@northwind-demo.example.com",
    phone: "(555) 010-0118",
    preferredContact: "Phone",
    address: { line1: "9 Placeholder Pkwy", city: "Lakeside", state: "GA", zip: "30002" },
    business: { legalName: "Northwind Demo Co. LLC", entityType: "LLC", state: "GA", responsibleParty: { name: "Sam Northwind", title: "Member" }, industry: "Consulting", fiscalYearEnd: "December" },
    staffIds: ["s-mk"],
    status: "onboarding",
    portal: "active",
    tags: ["New business"],
    source: "Google",
    leadId: "L-2015",
    since: d(-12),
    lastActivityAt: d(-1, 16, 20),
    enrollments: [
      { service: "biz", title: "LLC formation + EIN", stage: "Filing submitted", progress: 50, status: "active", staffId: "s-mk", startedAt: d(-12), dueAt: d(14), fee: 899 },
    ],
    extraMessages: [
      { from: "client", author: "Sam Northwind", body: "Quick question about the EIN — will we be able to open a bank account before the state approves the filing?", at: d(-1, 16, 20), service: "biz", read: false },
    ],
  },
  {
    id: "c-1004",
    type: "individual",
    name: "Casey Placeholder",
    email: "casey.placeholder@example.com",
    phone: "(555) 010-0163",
    preferredContact: "Text",
    address: { line1: "48 Demo Street", city: "Fairview", state: "GA", zip: "30003" },
    dob: "1993-09-30",
    staffIds: ["s-jp"],
    status: "active",
    portal: "active",
    tags: ["Employment-motivated"],
    source: "Community partner referral",
    since: d(-30),
    lastActivityAt: d(0, 13, 5),
    enrollments: [
      { service: "expunge", title: "Record restriction — 2 cases", stage: "Petition drafted", progress: 55, status: "active", staffId: "s-jp", startedAt: d(-30), dueAt: d(21), fee: 750 },
    ],
    extraNotes: [
      { authorId: "s-jp", body: "Referred by community workforce partner (sample). Client has an interview scheduled in 6 weeks — keep timeline updates frequent.", at: d(-29), pinned: true, service: "expunge" },
    ],
  },
  {
    id: "c-1005",
    type: "individual",
    name: "Riley Testcase",
    email: "riley.testcase@example.com",
    phone: "(555) 010-0105",
    preferredContact: "Email",
    address: { line1: "7 Mock Lane", city: "Springfield", state: "GA", zip: "30000" },
    staffIds: ["s-mk"],
    status: "onboarding",
    portal: "invited",
    tags: ["Lead converted"],
    source: "Instagram",
    leadId: "L-2014",
    since: d(-2),
    lastActivityAt: d(0, 12, 0),
    enrollments: [
      { service: "biz", title: "Business formation consult", stage: "Intake", progress: 10, status: "active", staffId: "s-mk", startedAt: d(-2), fee: 499 },
    ],
  },
  {
    id: "c-1006",
    type: "individual",
    name: "Avery Fictional",
    email: "avery.fictional@example.com",
    phone: "(555) 010-0136",
    preferredContact: "Phone",
    address: { line1: "512 Sample Ridge", city: "Oakdale", state: "GA", zip: "30004" },
    taxIdType: "SSN", taxIdLast4: "0136",
    staffIds: ["s-al"],
    status: "active",
    portal: "active",
    tags: ["Payment plan"],
    source: "Returning",
    since: d(-1100),
    lastActivityAt: d(-4),
    enrollments: [
      { service: "tax", title: "2024 Amended return (1040-X)", stage: "Submitted", progress: 75, status: "active", staffId: "s-al", startedAt: d(-60), fee: 425 },
    ],
  },
  {
    id: "c-1007",
    type: "business",
    name: "Bluebird Sample Inc.",
    contactName: "Lee Bluebird",
    email: "accounts@bluebird-sample.example.com",
    phone: "(555) 010-0191",
    preferredContact: "Email",
    address: { line1: "1 Demo Plaza, Floor 2", city: "Riverton", state: "GA", zip: "30001" },
    business: { legalName: "Bluebird Sample Inc.", entityType: "S-Corp", state: "GA", formedAt: "2016-07-15", einLast4: "0191", responsibleParty: { name: "Lee Bluebird", title: "President", taxIdType: "SSN", taxIdLast4: "7049" }, industry: "Retail", fiscalYearEnd: "December" },
    staffIds: ["s-rt", "s-al"],
    status: "active",
    portal: "active",
    tags: ["Monthly retainer", "Sales tax"],
    source: "Referral",
    since: d(-860),
    lastActivityAt: d(-2),
    enrollments: [
      { service: "tax", title: "2025 Business return (1120-S)", stage: "Submitted", progress: 75, status: "on_hold", staffId: "s-al", startedAt: d(-80), fee: 1000 },
      { service: "books", title: "Monthly bookkeeping", stage: "Client Follow-up Needed", progress: 57, status: "waiting_on_client", staffId: "s-rt", startedAt: d(-857), fee: 950 },
      { service: "biz", title: "Annual report filing (state)", stage: "Complete", progress: 100, status: "complete", staffId: "s-mk", startedAt: d(-90), fee: 150 },
    ],
  },
  {
    id: "c-1008",
    type: "business",
    name: "Harbor Demo Bakery LLC",
    contactName: "Morgan Harbor",
    email: "hello@harbor-demo.example.com",
    phone: "(555) 010-0155",
    preferredContact: "Portal",
    address: { line1: "33 Example Wharf", city: "Bayview", state: "GA", zip: "30005" },
    business: { legalName: "Harbor Demo Bakery LLC", entityType: "LLC", state: "GA", formedAt: "2022-02-01", einLast4: "0155", responsibleParty: { name: "Morgan Harbor", title: "Owner", taxIdType: "SSN", taxIdLast4: "7056" }, industry: "Food & beverage", fiscalYearEnd: "December" },
    staffIds: ["s-rt", "s-mk", "s-al"],
    status: "active",
    portal: "active",
    tags: ["Licenses", "Monthly retainer"],
    source: "Website",
    since: d(-400),
    lastActivityAt: d(-1),
    enrollments: [
      { service: "tax", title: "2025 Business return (1065)", stage: "Ready to E-file", progress: 63, status: "active", staffId: "s-al", startedAt: d(-60), fee: 900 },
      { service: "books", title: "Monthly bookkeeping", stage: "MKB Final Review", progress: 71, status: "in_review", staffId: "s-rt", startedAt: d(-100), fee: 550 },
      { service: "biz", title: "Health permit renewal", stage: "Filing submitted", progress: 60, status: "active", staffId: "s-mk", startedAt: d(-14), dueAt: d(25), fee: 175 },
    ],
  },
  {
    id: "c-1009",
    type: "individual",
    name: "Morgan Mockwell",
    email: "morgan.mockwell@example.com",
    phone: "(555) 010-0124",
    preferredContact: "Email",
    address: { line1: "6 Test Court", city: "Lakeside", state: "GA", zip: "30002" },
    taxIdType: "SSN", taxIdLast4: "0124",
    staffIds: ["s-al", "s-rt"],
    status: "active",
    portal: "active",
    tags: ["Self-employed"],
    source: "Referral",
    since: d(-380),
    lastActivityAt: d(-3),
    pastTax: [{ year: 2025, fee: 550 }],
    enrollments: [
      { service: "tax", title: "2026 Individual return (1040 + Sch C)", stage: "Awaiting Documents", progress: 13, status: "waiting_on_client", staffId: "s-al", startedAt: d(-20), fee: 650 },
      { service: "books", title: "Monthly bookkeeping — Mockwell Design Studio", stage: "Ready for MKB Review", progress: 14, status: "active", staffId: "s-rt", startedAt: d(-399), fee: 300 },
      { service: "books", title: "Monthly bookkeeping — Mockwell Rental Properties", stage: "Reports Ready", progress: 86, status: "active", staffId: "s-mk", startedAt: d(-297), fee: 300 },
    ],
  },
  {
    id: "c-1010",
    type: "individual",
    name: "Quinn Example",
    email: "quinn.example@example.com",
    phone: "(555) 010-0109",
    preferredContact: "Text",
    address: { line1: "90 Sample Hollow", city: "Fairview", state: "GA", zip: "30003" },
    staffIds: ["s-jp", "s-al"],
    status: "active",
    portal: "invited",
    tags: [],
    source: "Walk-in",
    since: d(-9),
    lastActivityAt: d(-5),
    enrollments: [
      { service: "tax", title: "2025 Individual return (1040)", stage: "Ready for Review", progress: 25, status: "in_review", staffId: "s-al", startedAt: d(-14), fee: 325 },
      { service: "expunge", title: "Record review — 3 counties", stage: "Records requested", progress: 20, status: "waiting_on_client", staffId: "s-jp", startedAt: d(-9), fee: 950 },
    ],
  },
  {
    id: "c-1011",
    type: "business",
    name: "Pine & Oak Demo Studio",
    contactName: "Drew Pine",
    email: "studio@pineoak-demo.example.com",
    phone: "(555) 010-0170",
    preferredContact: "Email",
    address: { line1: "15 Placeholder Row", city: "Oakdale", state: "GA", zip: "30004" },
    business: { legalName: "Pine & Oak Demo Studio LLC", entityType: "LLC", state: "GA", formedAt: "2020-10-10", einLast4: "0170", responsibleParty: { name: "Drew Pine", title: "Managing member", taxIdType: "SSN", taxIdLast4: "7077" }, industry: "Design", fiscalYearEnd: "December" },
    staffIds: ["s-al"],
    status: "inactive",
    portal: "not_invited",
    tags: ["Seasonal"],
    source: "Returning",
    since: d(-1400),
    lastActivityAt: d(-120),
    enrollments: [
      { service: "tax", title: "2025 Business return (1120-S)", stage: "Completed", progress: 100, status: "complete", staffId: "s-al", startedAt: d(-230), fee: 1100 },
    ],
  },
  {
    id: "c-1012",
    type: "individual",
    name: "Taylor Demo-Reyes",
    email: "taylor.demoreyes@example.com",
    phone: "(555) 010-0148",
    preferredContact: "Phone",
    address: { line1: "3 Mockingbird Example Rd", city: "Bayview", state: "GA", zip: "30005" },
    taxIdType: "SSN", taxIdLast4: "0148",
    staffIds: ["s-al", "s-jp"],
    status: "active",
    portal: "active",
    tags: ["Multi-service"],
    source: "Referral",
    since: d(-200),
    lastActivityAt: d(-1, 11),
    pastTax: [{ year: 2024, fee: 400 }],
    enrollments: [
      { service: "tax", title: "2025 Individual return (1040)", stage: "Awaiting Client Approval", progress: 50, status: "waiting_on_client", staffId: "s-al", startedAt: d(-28), fee: 425 },
      { service: "expunge", title: "Record restriction — 1 case", stage: "Filed", progress: 75, status: "active", staffId: "s-jp", startedAt: d(-75), fee: 750 },
      { service: "biz", title: "Sole prop → LLC conversion", stage: "Name search", progress: 25, status: "active", staffId: "s-mk", startedAt: d(-6), fee: 599 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Generators — build realistic related records from each enrollment so every
// client profile tab has consistent content without hand-writing everything.
// ---------------------------------------------------------------------------

const DOC_TEMPLATES: Record<ServiceKey, { name: string; category: string; sensitive: boolean }[]> = {
  tax: [
    { name: "Government photo ID", category: "Identity", sensitive: true },
    { name: "W-2 forms (all employers)", category: "Income", sensitive: false },
    { name: "1099-NEC / 1099-K", category: "Income", sensitive: false },
    { name: "Prior-year tax return", category: "Tax return", sensitive: true },
    { name: "Tax organizer (completed)", category: "Organizer", sensitive: false },
  ],
  books: [
    { name: "Bank statement — October", category: "Statements", sensitive: false },
    { name: "Credit card statement — October", category: "Statements", sensitive: false },
    { name: "Payroll summary — October", category: "Payroll", sensitive: false },
    { name: "Receipts batch — October", category: "Receipts", sensitive: false },
  ],
  biz: [
    { name: "Owner photo ID", category: "Identity", sensitive: true },
    { name: "Business formation questionnaire", category: "Intake", sensitive: false },
    { name: "Articles of organization (filed)", category: "Formation", sensitive: false },
    { name: "EIN confirmation letter (CP 575)", category: "Tax ID", sensitive: true },
  ],
  expunge: [
    { name: "Government photo ID", category: "Identity", sensitive: true },
    { name: "Criminal history report", category: "Court records", sensitive: true },
    { name: "Case disposition(s)", category: "Court records", sensitive: true },
    { name: "Petition draft for review", category: "Filings", sensitive: true },
  ],
};

/** Business returns need different documents than individual returns. */
const BIZ_TAX_DOCS: { name: string; category: string; sensitive: boolean }[] = [
  { name: "EIN confirmation letter (CP 575 / 147C)", category: "Tax ID", sensitive: true },
  { name: "Year-end profit & loss and balance sheet", category: "Financials", sensitive: false },
  { name: "Prior-year business return", category: "Tax return", sensitive: true },
  { name: "Payroll reports (941 / 940 / W-3)", category: "Payroll", sensitive: false },
  { name: "Responsible party photo ID", category: "Identity", sensitive: true },
];

/** "2025 Individual return (1040)" → 2025 */
export const yearFromTitle = (title: string) => Number(/^(20\d\d)/.exec(title)?.[1] ?? 0) || undefined;

const SIGN_TEMPLATES: Record<ServiceKey, string[]> = {
  tax: ["Engagement letter — tax preparation", "Form 8879 (e-file authorization)"],
  books: ["Bookkeeping services agreement"],
  biz: ["Engagement letter — business services", "Registered agent consent"],
  expunge: ["Engagement letter — record expungement", "Records release authorization"],
};

const APPT_TITLES: Record<ServiceKey, string[]> = {
  tax: ["Tax intake interview", "Tax return review"],
  books: ["Bookkeeping onboarding call", "Monthly close review"],
  biz: ["Business formation consult", "Filing status check-in"],
  expunge: ["Expungement consultation", "Petition review meeting"],
};

function build(seed: Seed, ci: number): Client {
  const enrollments: Enrollment[] = seed.enrollments.map((e, i) => ({ ...e, id: `${seed.id}-e${i + 1}` }));
  const documents: ClientDocument[] = [];
  const signatures: Signature[] = [];
  const appointments: Appointment[] = [];
  const invoices: Invoice[] = [];
  const messages: Message[] = [];
  const notes: Note[] = [];
  const activity: ActivityItem[] = [];
  let inv = 1030 + ci * 3;

  enrollments.forEach((e, ei) => {
    const stageIdx = Math.max(0, STAGES[e.service].indexOf(e.stage));
    const started = new Date(e.startedAt);
    const daysAgo = Math.round((SAMPLE_NOW.getTime() - started.getTime()) / 86400000);
    const at = (frac: number, h = 10) => d(-Math.round(daysAgo * (1 - frac)), h);

    // Documents — earlier docs received, later ones still requested, based on progress.
    const tpl = e.service === "tax" && seed.type === "business" ? BIZ_TAX_DOCS : DOC_TEMPLATES[e.service];
    const taxYear = e.service === "tax" ? yearFromTitle(e.title) : undefined;
    const taxReturnId = taxYear ? `TR-${seed.id}-${taxYear}` : undefined;
    const booksSeed = e.service === "books" ? BOOKS_SEEDS.find((b) => b.clientId === seed.id && b.title === e.title) : undefined;
    if (booksSeed) {
      const rec = booksClientRecords(booksSeed, e.id, seed.contactName ?? seed.name, 100 + ci * 10 + ei * 5);
      documents.push(...rec.documents);
      invoices.push(...rec.invoices);
      messages.push(...rec.messages);
    }
    (booksSeed ? [] : tpl).forEach((t, ti) => {
      const done = e.status === "complete" || ti / tpl.length < e.progress / 100 + 0.15;
      // Staff-produced documents (filed articles, petition drafts) are never "requested" from the client.
      const staffMade = t.category === "Filings" || t.category === "Formation";
      if (staffMade && !done) return;
      const reviewed = done && (e.status === "complete" || ti / tpl.length < e.progress / 100 - 0.2);
      documents.push({
        id: `${e.id}-d${ti + 1}`,
        name: t.name,
        service: e.service,
        category: t.category,
        sensitive: t.sensitive,
        status: reviewed ? "reviewed" : done ? "received" : "requested",
        requestedAt: at(0.05),
        uploadedAt: done ? at(0.1 + (ti / tpl.length) * 0.6, 9 + ti) : undefined,
        sizeKb: done ? 180 + ((ci * 37 + ti * 91) % 2400) : undefined,
        uploadedBy: done ? (staffMade ? "staff" : "client") : undefined,
        taxYear,
      });
    });

    // Signatures
    SIGN_TEMPLATES[e.service].forEach((doc, si) => {
      const needsLater = si > 0 && e.status !== "complete" && (e.service === "tax" ? stageIdx < STAGES.tax.indexOf("Ready to E-file") : stageIdx < STAGES[e.service].length - 2);
      signatures.push({
        id: `${e.id}-s${si + 1}`,
        document: doc,
        service: e.service,
        status: needsLater ? (stageIdx >= 3 ? "pending" : "pending") : "signed",
        sentAt: at(si === 0 ? 0.02 : 0.7),
        signedAt: needsLater ? undefined : at(si === 0 ? 0.04 : 0.75, 15),
      });
    });

    // Appointments: one past, one upcoming for active work.
    const titles = APPT_TITLES[e.service];
    appointments.push({
      id: `${e.id}-a1`,
      title: titles[0],
      service: e.service,
      at: at(0.03, 11),
      durationMin: 45,
      mode: e.service === "books" ? "Video" : "In person",
      staffId: e.staffId,
      status: "completed",
    });
    if (e.status !== "complete")
      appointments.push({
        id: `${e.id}-a2`,
        title: titles[1],
        service: e.service,
        at: d(((ci + ei) % 9) + (ci === 0 && ei === 0 ? 0 : 1), 9 + ((ci * 2 + ei * 3) % 8), (ci % 2) * 30),
        durationMin: 30,
        mode: (["Video", "Phone", "In person"] as const)[(ci + ei) % 3],
        staffId: e.staffId,
        status: "scheduled",
      });

    // Invoices: deposit (paid) + balance (status depends on progress/seed). Bookkeeping bills monthly (above).
    const deposit = Math.round(e.fee * 0.5);
    if (!booksSeed) invoices.push({
      id: `${e.id}-i1`,
      number: `INV-${inv++}`,
      service: e.service,
      description: `${e.title} — deposit`,
      amount: deposit,
      paid: deposit,
      status: "paid",
      issuedAt: at(0.02),
      dueAt: at(0.1),
      taxReturnId,
    });
    if (!booksSeed && (e.progress >= 50 || e.status === "complete")) {
      const balance = e.fee - deposit;
      const st: Invoice["status"] =
        e.status === "complete" ? "paid" : ci % 4 === 1 ? "overdue" : ci % 4 === 2 ? "partial" : "open";
      invoices.push({
        id: `${e.id}-i2`,
        number: `INV-${inv++}`,
        service: e.service,
        description: `${e.title} — balance`,
        amount: balance,
        paid: st === "paid" ? balance : st === "partial" ? Math.round(balance * 0.4) : 0,
        status: st,
        issuedAt: at(0.6),
        dueAt: st === "overdue" ? d(-6) : d(14),
        taxReturnId,
      });
    }

    // Messages
    messages.push(
      { id: `${e.id}-m1`, from: "staff", author: staffById(e.staffId).name, body: `Welcome! I'll be handling your ${e.title.toLowerCase()}. Your checklist is in the portal — upload anything you have and I'll follow up on the rest.`, at: at(0.03, 12), service: e.service, read: true },
      { id: `${e.id}-m2`, from: "client", author: seed.contactName ?? seed.name, body: "Thanks — I'll get started on the documents this week.", at: at(0.05, 18), service: e.service, read: true },
    );

    // Activity
    activity.push(
      { id: `${e.id}-x1`, kind: "intake", text: `Completed intake for ${e.title}`, at: at(0.02, 9), actor: "client" },
      { id: `${e.id}-x2`, kind: "status", text: `Moved to "${e.stage}"`, at: at(0.9, 16), actor: "staff" },
    );
    documents
      .filter((x) => x.service === e.service && x.uploadedAt)
      .slice(-2)
      .forEach((x) => activity.push({ id: `${x.id}-x`, kind: "upload", text: `Uploaded ${x.name}`, at: x.uploadedAt!, actor: x.uploadedBy === "staff" ? "staff" : "client" }));
    invoices
      .filter((x) => x.service === e.service && x.paid > 0)
      .forEach((x) => activity.push({ id: `${x.id}-x`, kind: "payment", text: `Paid ${x.number}`, at: x.dueAt < SAMPLE_NOW.toISOString() ? x.dueAt : x.issuedAt, actor: "client" }));
  });

  (seed.pastTax ?? []).forEach((pt) => {
    const issued = new Date(`${pt.year + 1}-02-10T10:00:00`).toISOString();
    invoices.push({
      id: `${seed.id}-pt${pt.year}`,
      number: `INV-${pt.year}${seed.id.slice(-2)}`,
      service: "tax",
      description: `${pt.year} ${seed.type === "business" ? "Business" : "Individual"} return — paid in full`,
      amount: pt.fee,
      paid: pt.fee,
      status: "paid",
      issuedAt: issued,
      dueAt: issued,
      taxReturnId: `TR-${seed.id}-${pt.year}`,
    });
  });

  (seed.extraMessages ?? []).forEach((m, i) => {
    messages.push({ ...m, id: `${seed.id}-xm${i}` });
    activity.push({ id: `${seed.id}-xma${i}`, kind: "message", text: "Sent a message", at: m.at, actor: "client" });
  });
  (seed.extraNotes ?? []).forEach((n, i) => notes.push({ ...n, id: `${seed.id}-n${i}` }));
  notes.push({
    id: `${seed.id}-n-gen`,
    authorId: seed.staffIds[0],
    body: `Preferred contact: ${seed.preferredContact}. ${seed.type === "business" ? `Primary contact is ${seed.contactName}.` : "Prefers afternoon appointments."}`,
    at: seed.since,
  });

  const byDateDesc = <T extends { at: string }>(a: T, b: T) => b.at.localeCompare(a.at);
  const { extraMessages: _m, extraNotes: _n, pastTax: _p, ...rest } = seed;
  return {
    ...rest,
    enrollments,
    documents,
    signatures,
    appointments: appointments.sort((a, b) => a.at.localeCompare(b.at)),
    invoices,
    messages: messages.sort((a, b) => a.at.localeCompare(b.at)),
    notes: notes.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at)),
    activity: activity.sort(byDateDesc),
  };
}

export const CLIENTS: Client[] = SEEDS.map(build);
export const clientById = (id: string) => CLIENTS.find((c) => c.id === id);

/** Outstanding balance across all of a client's invoices. */
export const balanceDue = (c: Client) =>
  c.invoices.filter((i) => i.status !== "paid" && i.status !== "draft").reduce((s, i) => s + (i.amount - i.paid), 0);

export const openRequirements = (c: Client) =>
  c.documents.filter((x) => x.status === "requested").length + c.signatures.filter((s) => s.status === "pending").length;
