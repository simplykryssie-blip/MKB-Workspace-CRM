/**
 * Service intakes for payroll, Business Solutions and MKB Record Relief — the
 * same guided-interview engine as the tax interview and bookkeeping intake
 * (branching questions, repeating rows, document list). The client fills them
 * in on a private link (no login), signs and submits; MKB gets a signed PDF,
 * the document requests and an updated profile.
 *
 * Sensitive data: no SSNs, bank or account numbers are asked here. Documents
 * that contain them (W-4s, direct deposit forms, photo ID) are requested as
 * uploads in the secure client portal.
 */
import type { DocSpec } from "@/lib/tax/config";
import { has, is, not, yes, type Answers, type Section } from "@/lib/tax/interview/engine";

export type ServiceIntakeKind = "payroll" | "biz" | "relief";
const YN = "yesno" as const;
const doc = (name: string, category: string, sensitive = false): DocSpec => ({ name, category, sensitive });
const ENTITIES = ["Sole proprietorship", "Single-member LLC", "Multi-member LLC", "S corporation", "C corporation", "Partnership", "Nonprofit"];

/* ================================================================ Payroll */
const pBusiness: Section = {
  id: "business", title: "Your business", group: "About you", covers: ["Business details"],
  intro: "Tell us who we'll be running payroll for.",
  questions: [
    { id: "legalName", label: "Legal business name", type: "text", prefill: "bizName" },
    { id: "entity", label: "Type of business", type: "choice", options: ENTITIES },
    { id: "formState", label: "State where the business operates", type: "state", prefill: "bizState" },
    { id: "street", label: "Business street address", type: "text", prefill: "street" },
    { id: "city", label: "City", type: "text", prefill: "city" },
    { id: "state", label: "State", type: "state", prefill: "state" },
    { id: "zip", label: "ZIP", type: "zip", prefill: "zip" },
    { id: "phone", label: "Business phone", type: "phone", prefill: "phone" },
    { id: "email", label: "Business email", type: "email", prefill: "email" },
    { id: "contactName", label: "Who approves payroll each period?", type: "text", placeholder: "Full name" },
    { id: "contactTitle", label: "Their title or role", type: "text", placeholder: "Owner, office manager…" },
  ],
};
const pSetup: Section = {
  id: "setup", title: "Payroll schedule", group: "Payroll", covers: ["Schedule", "Current provider"],
  questions: [
    { id: "frequency", label: "How often do you pay your team?", type: "choice", options: ["Weekly", "Every two weeks", "Twice a month", "Monthly"] },
    { id: "firstPay", label: "First payday you'd like MKB to run", type: "date" },
    { id: "provider", label: "How is payroll run today?", type: "choice", options: ["Gusto", "ADP", "Paychex", "QuickBooks Payroll", "OnPay", "Another provider", "We do it by hand", "We haven't run payroll yet"] },
    { id: "providerOther", label: "Which provider?", type: "text", show: is("provider", "Another provider") },
    { id: "ranThisYear", label: "Have you already paid employees this calendar year?", type: YN, show: not(is("provider", "We haven't run payroll yet")),
      docs: [doc("Payroll register / year-to-date payroll summary for this year", "Payroll"), doc("Last quarterly payroll tax returns (Form 941 and state)", "Payroll")],
      help: "If so, we need your year-to-date totals so W-2s are correct at year end." },
    { id: "timekeeping", label: "How do you track hours?", type: "choice", options: ["Time clock or app", "Paper timesheets", "Employees report hours to me", "Everyone is salaried", "Not sure yet"] },
  ],
};
const pPeople: Section = {
  id: "people", title: "Your team", group: "Payroll", covers: ["Team size", "Pay types"],
  questions: [
    { id: "w2Count", label: "How many W-2 employees will be paid?", type: "number" },
    { id: "contractors", label: "How many 1099 contractors will be paid through payroll?", type: "number" },
    { id: "ownersPaid", label: "Will any owners be paid through payroll?", type: YN, help: "S corporation owners who work in the business usually must be paid a reasonable salary through payroll." },
    { id: "payTypes", label: "How are people paid? (choose all that apply)", type: "multi", options: ["Hourly", "Salary", "Commission", "Tips", "Bonuses", "Piece rate"] },
    { id: "payMethod", label: "How will people receive their pay?", type: "choice", options: ["Direct deposit", "Paper checks", "Both"] },
    { id: "states", label: "Do any employees live or work outside your state?", type: YN },
    { id: "statesWhich", label: "Which states?", type: "text", show: yes("states"), help: "Each additional state usually needs its own payroll tax accounts." },
  ],
};
const pRoster: Section = {
  id: "roster", title: "Employees & contractors", group: "Payroll", covers: ["Roster"],
  intro: "List each person you'll pay. Please don't enter Social Security or bank account numbers here — we'll request W-4s and direct deposit forms as secure uploads in your client portal.",
  repeat: {
    noun: "person", min: 1,
    rowTitle: (r, i) => r.name || `Person ${i + 1}`,
    rowDocs: (r) => {
      const who = r.name ? ` — ${r.name}` : "";
      if (r.kind === "1099 contractor") return [doc(`Form W-9${who}`, "Payroll", true)];
      return [doc(`Form W-4${who}`, "Payroll", true), doc(`Form I-9${who}`, "Payroll", true), doc(`State withholding certificate${who}`, "Payroll", true), ...(r.deposit === "Yes" ? [doc(`Direct deposit authorization${who}`, "Payroll", true)] : [])];
    },
  },
  questions: [
    { id: "name", label: "Full name", type: "text" },
    { id: "kind", label: "Worker type", type: "choice", options: ["W-2 employee", "1099 contractor", "Owner on payroll"] },
    { id: "role", label: "Job title or role", type: "text", optional: true },
    { id: "payType", label: "Pay type", type: "choice", options: ["Hourly", "Salary", "Commission", "Per job / piece rate"] },
    { id: "rate", label: "Pay rate (hourly rate or yearly salary)", type: "money", optional: true },
    { id: "start", label: "Start date (or date of hire)", type: "date", optional: true },
    { id: "workState", label: "State where they work", type: "state" },
    { id: "deposit", label: "Direct deposit?", type: YN, show: not(is("kind", "1099 contractor")) },
  ],
};
const pTaxes: Section = {
  id: "taxes", title: "Payroll taxes & deductions", group: "Payroll", covers: ["Tax accounts", "Deductions", "Services"],
  questions: [
    { id: "services", label: "Which payroll services do you want from MKB?", type: "multi", options: ["Payroll processing", "Payroll tax compliance (federal + 1 state)", "Payroll bookkeeping"] },
    { id: "hasEin", label: "Does the business have an EIN?", type: YN, warn: "You need an EIN before you can run payroll. Our Business Solutions team can apply for one for you.", warnWhen: "No" },
    { id: "withholding", label: "Do you have a state withholding (income tax) account?", type: "choice", options: ["Yes", "No", "Not sure", "My state has no income tax"], docsWhen: "Yes", docs: [doc("State withholding account letter (shows your account number)", "Payroll", true)] },
    { id: "suta", label: "Do you have a state unemployment (SUTA) account?", type: "choice", options: ["Yes", "No", "Not sure"], docsWhen: "Yes", docs: [doc("State unemployment tax rate notice for this year", "Payroll", true)] },
    { id: "deposits", label: "How often do you deposit federal payroll taxes?", type: "choice", options: ["Monthly", "Semi-weekly", "Not sure"], show: is("hasEin", "Yes") },
    { id: "workersComp", label: "Do you have workers' compensation insurance?", type: YN, docs: [doc("Workers' compensation policy declarations page", "Payroll")] },
    { id: "deductions", label: "Any deductions from pay? (choose all that apply)", type: "multi", options: ["Health insurance", "Retirement plan (401(k), SIMPLE IRA…)", "Wage garnishment or child support", "Loans or advances", "None"] },
  ],
  docs: (a) => [
    ...(has("deductions", "Wage garnishment or child support")(a) ? [doc("Garnishment or child support withholding orders", "Payroll", true)] : []),
    ...(has("deductions", "Retirement plan (401(k), SIMPLE IRA…)")(a) ? [doc("Retirement plan contribution details", "Payroll")] : []),
  ],
};
const pFinish: Section = {
  id: "finish", title: "Anything else", group: "Finish", covers: ["Notes"],
  questions: [{ id: "notes", label: "Anything else we should know about your payroll?", type: "textarea", optional: true }],
};

/* ================================================================ Business Solutions */
const FORMING = ["Form a new LLC", "Form a corporation", "Form a nonprofit"];
const forming = (a: Answers) => FORMING.some((x) => has("need", x)(a));
const existing = (a: Answers) => ["Annual report", "Amendment or name change", "Dissolution", "Register in another state"].some((x) => has("need", x)(a));
const bNeed: Section = {
  id: "need", title: "What you need", group: "About you", covers: ["Services"],
  questions: [
    { id: "need", label: "What can we help you file? (choose all that apply)", type: "multi", options: [...FORMING, "IRS EIN application", "Trade name (DBA)", "Register in another state", "Annual report", "Amendment or name change", "Dissolution", "Operating agreement", "Resolutions or minutes"] },
    { id: "timing", label: "When do you need it done?", type: "choice", options: ["As soon as possible", "Within a month", "No rush"] },
  ],
};
const bBusiness: Section = {
  id: "business", title: "Your business", group: "Business", covers: ["Name", "Type", "Address"],
  questions: [
    { id: "legalName", label: "Business name", type: "text", prefill: "bizName", help: "For a new business, the name you want first." },
    { id: "name2", label: "Second-choice name", type: "text", optional: true, show: forming },
    { id: "name3", label: "Third-choice name", type: "text", optional: true, show: forming },
    { id: "entity", label: "Type of business", type: "choice", options: ENTITIES },
    { id: "formState", label: "State of formation", type: "state", prefill: "bizState" },
    { id: "purpose", label: "In a sentence or two, what does (or will) the business do?", type: "textarea" },
    { id: "street", label: "Principal business address (street)", type: "text", prefill: "street", help: "Most states require a physical street address — not a P.O. box." },
    { id: "city", label: "City", type: "text", prefill: "city" },
    { id: "state", label: "State", type: "state", prefill: "state" },
    { id: "zip", label: "ZIP", type: "zip", prefill: "zip" },
    { id: "phone", label: "Phone", type: "phone", prefill: "phone" },
    { id: "email", label: "Email for state notices", type: "email", prefill: "email" },
  ],
};
const bOwners: Section = {
  id: "owners", title: "Owners & managers", group: "Business", covers: ["Members", "Officers"],
  intro: "List each owner, member, manager or officer that should appear on the filings.",
  repeat: { noun: "person", min: 1, rowTitle: (r, i) => r.name || `Person ${i + 1}`, rowDocs: (r) => [doc(`Government-issued photo ID${r.name ? ` — ${r.name}` : ""}`, "Identity", true)] },
  check: (a) => {
    const total = (Array.isArray(a.owners) ? a.owners : []).reduce((n, r) => n + (Number(r.pct) || 0), 0);
    return total > 100 ? `Ownership adds up to ${total}% — it can't be more than 100%.` : undefined;
  },
  questions: [
    { id: "name", label: "Full legal name", type: "text" },
    { id: "title", label: "Title", type: "choice", options: ["Member", "Managing member", "Manager", "President", "Vice president", "Secretary", "Treasurer", "Director", "Owner"] },
    { id: "pct", label: "Ownership percentage", type: "percent", help: "Enter 0 if this person doesn't own part of the business." },
    { id: "address", label: "Mailing address", type: "text" },
    { id: "email", label: "Email", type: "email", optional: true },
    { id: "phone", label: "Phone", type: "phone", optional: true },
  ],
};
const bAgent: Section = {
  id: "agent", title: "Registered agent", group: "Business", covers: ["Registered agent"], show: (a) => forming(a) || has("need", "Register in another state")(a),
  intro: "Every business needs a registered agent in its state — a person or company that accepts legal mail during business hours.",
  questions: [
    { id: "agent", label: "Who will be your registered agent?", type: "choice", options: ["Me (an owner)", "Someone I'll name", "I'd like MKB to help me choose a registered agent service"] },
    { id: "agentName", label: "Registered agent's name", type: "text", show: is("agent", "Someone I'll name") },
    { id: "agentAddress", label: "Registered agent's street address in the state", type: "text", show: is("agent", "Someone I'll name", "Me (an owner)") },
  ],
};
const bExisting: Section = {
  id: "existing", title: "Your existing business", group: "Business", covers: ["State records"], show: existing,
  questions: [
    { id: "charter", label: "State business ID or charter number (if you know it)", type: "text", optional: true },
    { id: "change", label: "What needs to change?", type: "textarea", show: has("need", "Amendment or name change") },
    { id: "dissolveDate", label: "Date you want the business closed", type: "date", show: has("need", "Dissolution") },
    { id: "foreignState", label: "Which state do you want to register in?", type: "state", show: has("need", "Register in another state"), docs: [doc("Certificate of good standing from your home state", "Formation")] },
    { id: "haveArticles", label: "Do you have a copy of your articles of organization or incorporation?", type: YN, docs: [doc("Articles of organization / incorporation", "Formation")] },
  ],
};
const bEin: Section = {
  id: "ein", title: "EIN application", group: "Business", covers: ["IRS EIN"], show: has("need", "IRS EIN application"),
  intro: "The IRS needs a \"responsible party\" — an owner or officer. We'll collect their Social Security number by phone or secure upload, never here.",
  questions: [
    { id: "rpName", label: "Responsible party's full name", type: "text" },
    { id: "rpTitle", label: "Their title", type: "text" },
    { id: "einReason", label: "Why do you need the EIN?", type: "choice", options: ["Started a new business", "Hiring employees", "Opening a bank account", "Changed business structure", "Other"] },
    { id: "employees", label: "How many employees do you expect in the next 12 months?", type: "number" },
    { id: "firstWages", label: "When will you first pay wages?", type: "date", optional: true, show: (a) => Number(a.employees) > 0 },
  ],
};
const bFinish: Section = {
  id: "finish", title: "Anything else", group: "Finish", covers: ["Notes"],
  intro: "State filing fees are separate from MKB's fee. We confirm them with you before anything is filed. MKB prepares filings from your information and standard templates and is not a law firm.",
  questions: [{ id: "notes", label: "Anything else we should know?", type: "textarea", optional: true }],
};

/* ================================================================ MKB Record Relief (Louisiana) */
const rAbout: Section = {
  id: "about", title: "About you", group: "About you", covers: ["Identity", "Contact"],
  intro: "We use this to organize your paperwork and request your records. MKB Record Relief currently assists with Louisiana records only.",
  questions: [
    { id: "fullName", label: "Full legal name", type: "text", prefill: "firstName" },
    { id: "otherNames", label: "Other names you've used (maiden name, nicknames on records)", type: "text", optional: true },
    { id: "dob", label: "Date of birth", type: "date", help: "Courts and agencies use it to find your records." },
    { id: "phone", label: "Phone", type: "phone", prefill: "phone" },
    { id: "email", label: "Email", type: "email", prefill: "email" },
    { id: "street", label: "Mailing address (street)", type: "text", prefill: "street" },
    { id: "city", label: "City", type: "text", prefill: "city" },
    { id: "state", label: "State", type: "state", prefill: "state" },
    { id: "zip", label: "ZIP", type: "zip", prefill: "zip" },
  ],
};
const rRecords: Section = {
  id: "records", title: "Your records", group: "Records", covers: ["Records"],
  intro: "Add each record you're asking about. Share what you know — it's okay to estimate dates. Helping you request what's missing is part of what we do.",
  repeat: { noun: "record", min: 1, rowTitle: (r, i) => (r.parish ? `${r.parish} Parish${r.when ? ` · ${r.when}` : ""}` : `Record ${i + 1}`), rowDocs: (r) => (r.papers === "Yes" ? [doc(`Court papers you have — ${r.parish || "record"} ${r.when || ""}`.trim(), "Records")] : []) },
  questions: [
    { id: "inLa", label: "Is this record in Louisiana?", type: YN, warn: "We currently assist with Louisiana records only, so we may not be able to help with this one. We'll let you know.", warnWhen: "No" },
    { id: "parish", label: "Parish", type: "text", placeholder: "e.g. Caddo", show: is("inLa", "Yes") },
    { id: "when", label: "About when did it happen?", type: "text", placeholder: "e.g. Summer 2016" },
    { id: "agency", label: "Arresting agency or court, if you know it", type: "text", optional: true },
    { id: "caseNo", label: "Case or docket number, if you have it", type: "text", optional: true },
    { id: "stage", label: "How far did it go?", type: "choice", options: ["Arrest only — no charges filed", "Charges filed", "Not sure"] },
    { id: "outcome", label: "How did it end, as you understand it?", type: "choice", options: ["Dismissed or not prosecuted", "Found not guilty", "Pleaded or found guilty — sentence completed", "Still on probation or parole", "Not sure"], show: not(is("stage", "Arrest only — no charges filed")) },
    { id: "papers", label: "Do you have any court papers for this record?", type: YN },
  ],
};
const rSituation: Section = {
  id: "situation", title: "Your situation", group: "Records", covers: ["Status"],
  questions: [
    { id: "pending", label: "Do you have any open or pending cases right now, anywhere?", type: YN, warn: "Pending cases can affect what's possible. Please talk with a licensed attorney — we'll point you to the Louisiana State Bar Association's lawyer referral service.", warnWhen: "Yes" },
    { id: "supervision", label: "Are you currently on probation or parole?", type: YN },
    { id: "prior", label: "Have you had a record expunged before?", type: YN },
    { id: "why", label: "What's prompting you to seek record relief? (optional)", type: "multi", optional: true, options: ["Employment", "Housing", "Professional license", "School", "Peace of mind", "Other"] },
  ],
  docs: () => [doc("Government-issued photo ID", "Identity", true)],
};
const rAck: Section = {
  id: "ack", title: "Before you submit", group: "Finish", covers: ["Acknowledgement"],
  intro: "MKB Financial Group provides administrative assistance and document preparation. MKB is not a law firm and does not give legal advice or representation. We do not decide whether you are eligible, and courts and agencies make their own decisions — we can't promise an outcome or a timeline.",
  questions: [
    { id: "understand", label: "I understand MKB is not a law firm and can't promise an outcome", type: "choice", options: ["I understand"] },
    { id: "notes", label: "Anything else we should know?", type: "textarea", optional: true },
  ],
};

export const SERVICE_INTAKES: Record<ServiceIntakeKind, { label: string; title: string; sections: Section[]; module: "books" | "biz" | "exp"; service: "books" | "biz" | "expunge"; next: string }> = {
  payroll: { label: "Payroll", title: "Payroll Intake", sections: [pBusiness, pSetup, pPeople, pRoster, pTaxes, pFinish], module: "books", service: "books", next: "We review your answers, confirm your payroll setup and price, and schedule your first payroll." },
  biz: { label: "Business Solutions", title: "Business Solutions Intake", sections: [bNeed, bBusiness, bOwners, bAgent, bExisting, bEin, bFinish], module: "biz", service: "biz", next: "We review your answers, confirm the state filing fees with you, and prepare your filings for your approval." },
  relief: { label: "Record Relief", title: "Record Relief Intake", sections: [rAbout, rRecords, rSituation, rAck], module: "exp", service: "expunge", next: "We review your answers, go over our fees with you, and start requesting your records." },
};
export const SERVICE_INTAKE_KINDS = Object.keys(SERVICE_INTAKES) as ServiceIntakeKind[];
export const isServiceIntakeKind = (k: unknown): k is ServiceIntakeKind => typeof k === "string" && k in SERVICE_INTAKES;
