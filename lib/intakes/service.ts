/**
 * Service intakes for payroll, Business Solutions and MKB Expungement Relief — the
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
import { anyGuilty, has, is, not, parseCharges, yes, type Answers, type Section } from "@/lib/tax/interview/engine";

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
/** The services a client can ask for (one section of questions each). Names match the Business Services catalog. */
export const BIZ_NEED = {
  llc: "Form an LLC",
  corp: "Form a corporation",
  nonprofit: "Form a nonprofit",
  pkgFormation: "LLC Formation Package — LLCs only (formation, operating agreement, resolutions, digital record book)",
  pkgComplete: "LLC Formation Complete — LLCs only (LLC Formation Package plus physical record book, one DBA, license report and year 1 of the Good Standing Plan)",
  ein: "EIN application",
  dba: "Trade name (DBA)",
  foreign: "Register in another state (foreign registration)",
  amend: "Amendment or name change",
  dissolve: "Dissolution (closing the business)",
  annual: "Louisiana annual report",
  txPir: "Texas franchise tax / Public Information Report",
  license: "Licenses & deadlines tracking (yearly)",
  licenseReport: "One-time license report",
  goodStanding: "Annual Good Standing Plan",
  goodStandingPremium: "Annual Good Standing Plan — Premium (adds the resolutions package)",
  oa: "Operating agreement",
  resolutions: "Resolutions",
  records: "Business record book",
} as const;
const N = BIZ_NEED;
const any = (...xs: string[]) => (a: Answers) => xs.some((x) => has("need", x)(a));
const forming = any(N.llc, N.corp, N.nonprofit, N.pkgFormation, N.pkgComplete);
const goodStanding = any(N.goodStanding, N.goodStandingPremium, N.pkgComplete);
const existing = any(N.ein, N.dba, N.foreign, N.amend, N.dissolve, N.annual, N.txPir, N.license, N.licenseReport, N.goodStanding, N.goodStandingPremium, N.oa, N.resolutions, N.records);
const bNeed: Section = {
  id: "need", title: "What you need", group: "About you", covers: ["Services"],
  intro: "Choose everything you'd like MKB to handle. You'll only see the questions for what you choose.",
  questions: [
    { id: "need", label: "What can we help you with? (choose all that apply)", type: "multi", options: Object.values(N) },
    { id: "timing", label: "When do you need it done?", type: "choice", options: ["As soon as possible", "Within a month", "No rush"] },
  ],
};
const bBusiness: Section = {
  id: "business", title: "Your business", group: "Business", covers: ["Name", "Type", "Addresses"],
  // The formation packages are for LLCs only; corporations choose each service on its own.
  check: (a) => any(N.pkgFormation, N.pkgComplete)(a) && typeof a.entity === "string" && a.entity && !/LLC/.test(a.entity)
    ? "The LLC Formation Package and LLC Formation Complete are for LLCs only. For a corporation, go back and choose “Form a corporation” and any other services you need separately." : undefined,
  questions: [
    { id: "legalName", label: "Business name", type: "text", prefill: "bizName", help: "For a new business, the name you want first." },
    { id: "name2", label: "Second-choice name", type: "text", show: forming },
    { id: "name3", label: "Third-choice name", type: "text", show: forming },
    { id: "entity", label: "Type of business", type: "choice", options: ENTITIES },
    { id: "formState", label: "State of formation", type: "state", prefill: "bizState" },
    { id: "purpose", label: "Business activity — in a sentence or two, what does (or will) the business do?", type: "textarea" },
    { id: "street", label: "Principal business address (street)", type: "text", prefill: "street", help: "Most states require a physical street address — not a P.O. box." },
    { id: "city", label: "City", type: "text", prefill: "city" },
    { id: "state", label: "State", type: "state", prefill: "state" },
    { id: "zip", label: "ZIP", type: "zip", prefill: "zip" },
    { id: "mailSame", label: "Is the mailing address the same?", type: YN },
    { id: "mailing", label: "Mailing address (street, city, state, ZIP)", type: "text", show: is("mailSame", "No") },
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
const bStructure: Section = {
  id: "structure", title: "How the business is run", group: "Business", covers: ["Management"], show: (a) => forming(a) || has("need", N.oa)(a),
  questions: [
    { id: "management", label: "Management structure", type: "choice", options: ["Member-managed (the owners run it)", "Manager-managed (named managers run it)", "Board of directors and officers (corporation)", "Not sure yet — let's discuss"] },
  ],
};
const bAgent: Section = {
  id: "agent", title: "Your registered agent", group: "Business", covers: ["Registered agent"], show: (a) => forming(a) || has("need", N.foreign)(a),
  intro: "Every business needs a registered agent in its state — a person or company with a street address in that state who accepts legal mail during business hours. You choose and handle your own registered agent: MKB is not a registered agent and doesn't provide or arrange one. We'll list the agent you name on your filings.",
  questions: [
    { id: "agent", label: "Who is your registered agent?", type: "choice", options: ["Me (an owner)", "Another person I've chosen", "A registered agent company I've chosen"] },
    { id: "agentName", label: "Registered agent's full name (or company name)", type: "text" },
    { id: "agentAddress", label: "Registered agent's street address in the state (no P.O. boxes)", type: "text" },
  ],
};
const bEin: Section = {
  id: "ein", title: "EIN (IRS tax ID)", group: "Business", covers: ["IRS EIN"], show: (a) => forming(a) || has("need", N.ein)(a),
  intro: "The IRS needs a \"responsible party\" — an owner or officer. Never enter a Social Security number here: after you submit, we'll ask for it through your secure client portal.",
  questions: [
    { id: "rpName", label: "Responsible party's full name", type: "text" },
    { id: "rpTitle", label: "Their title", type: "text" },
    { id: "einReason", label: "Why do you need the EIN?", type: "choice", options: ["Started a new business", "Hiring employees", "Opening a bank account", "Changed business structure", "Other"] },
    { id: "employees", label: "How many employees do you expect in the next 12 months?", type: "number" },
    { id: "firstWages", label: "When will you first pay wages?", type: "date", optional: true, show: (a) => Number(a.employees) > 0 },
  ],
};
const bExisting: Section = {
  id: "existing", title: "Your existing business", group: "Business", covers: ["State records"], show: (a) => existing(a) && !forming(a),
  questions: [
    { id: "charter", label: "State business ID or charter number (if you know it)", type: "text", optional: true },
    { id: "haveArticles", label: "Do you have a copy of your articles of organization or incorporation?", type: YN, docs: [doc("Articles of organization / incorporation", "Formation")] },
  ],
};
const bDba: Section = {
  id: "dba", title: "Trade name (DBA)", group: "Services", covers: ["Trade name"], show: any(N.dba, N.pkgComplete),
  intro: "In Louisiana a trade name is registered with the Secretary of State and recorded in each parish where you do business.",
  questions: [
    { id: "dbaName", label: "Trade name you want to use", type: "text" },
    { id: "dbaWhere", label: "Parish(es) or county where you'll use it", type: "text", placeholder: "e.g. Calcasieu" },
    { id: "dbaUse", label: "What will you sell or do under this name?", type: "textarea", optional: true },
  ],
};
const bForeign: Section = {
  id: "foreign", title: "Registering in another state", group: "Services", covers: ["Foreign registration"], show: any(N.foreign),
  intro: "We order a certificate of good standing from your home state and file your registration in the new state.",
  questions: [
    { id: "foreignState", label: "Which state do you want to register in?", type: "state" },
    { id: "foreignStart", label: "When will you start doing business there?", type: "date", optional: true },
  ],
};
const bAmend: Section = {
  id: "amend", title: "Amendment or name change", group: "Services", covers: ["Changes"], show: any(N.amend),
  questions: [
    { id: "change", label: "What needs to change?", type: "multi", options: ["Business name", "Members or managers", "Address", "Business purpose", "Something else"] },
    { id: "newName", label: "New business name", type: "text", show: has("change", "Business name") },
    { id: "changeDetail", label: "Describe the change", type: "textarea" },
    { id: "changeDate", label: "Date the change should take effect", type: "date", optional: true },
  ],
};
const bDissolve: Section = {
  id: "dissolve", title: "Closing the business", group: "Services", covers: ["Dissolution"], show: any(N.dissolve),
  questions: [
    { id: "dissolveDate", label: "Date you want the business closed", type: "date" },
    { id: "ownersAgree", label: "Have all owners agreed to close the business?", type: YN },
    { id: "debts", label: "Have all business debts been paid or arranged?", type: "choice", options: ["Yes", "No", "Not sure"], warn: "Debts usually need to be paid or arranged before a business is closed. We'll go over this with you.", warnWhen: "No" },
    { id: "finalFilings", label: "Have the business's final tax returns been filed?", type: "choice", options: ["Yes", "No — I need them filed", "Not sure"], help: "We'll set a reminder for the final tax return either way." },
    { id: "openAccounts", label: "Does the business still have employees, payroll or sales-tax accounts open?", type: YN },
  ],
};
const bAnnual: Section = {
  id: "annual", title: "Yearly state report", group: "Services", covers: ["Annual report"], show: (a) => any(N.annual, N.txPir)(a) || goodStanding(a),
  questions: [
    { id: "officersChanged", label: "Have your officers, members, managers or addresses changed since the last report?", type: YN },
    { id: "officersDetail", label: "What changed?", type: "textarea", show: yes("officersChanged") },
    { id: "lastReport", label: "When was the last report filed? (an estimate is fine)", type: "text", optional: true },
    { id: "txRevenue", label: "Total revenue for the report year (Texas report)", type: "money", optional: true, show: has("need", N.txPir) },
  ],
};
const bLicenses: Section = {
  id: "licenses", title: "Licenses & permits", group: "Services", covers: ["Licenses"], show: (a) => any(N.license, N.licenseReport)(a) || goodStanding(a),
  questions: [
    { id: "bizType", label: "What type of business is it? (what you sell or do)", type: "textarea" },
    { id: "locations", label: "Where do you operate? (city and parish/county for each location, or \"online only\")", type: "textarea" },
    { id: "hasLicenses", label: "Do you have any business licenses or permits now?", type: YN, docs: [doc("Current business licenses and permits", "Compliance")] },
    { id: "licenseList", label: "Which ones? (name and renewal date if you know it)", type: "textarea", optional: true, show: yes("hasLicenses") },
  ],
};
const bOa: Section = {
  id: "oa", title: "Operating agreement", group: "Services", covers: ["Operating agreement"], show: any(N.oa, N.pkgFormation, N.pkgComplete),
  intro: "We prepare your operating agreement from a standard template and your answers. It's not legal advice — you can have an attorney review it before you sign.",
  questions: [
    { id: "contributions", label: "What is each member contributing to start? (money, property, work)", type: "textarea" },
    { id: "distributions", label: "How will profits be shared?", type: "choice", options: ["By ownership percentage", "Another way — I'll explain"] },
    { id: "distributionsOther", label: "Explain how profits will be shared", type: "textarea", show: is("distributions", "Another way — I'll explain") },
    { id: "voting", label: "How will members vote?", type: "choice", options: ["By ownership percentage", "One vote per member", "Another way — I'll explain"] },
    { id: "votingOther", label: "Explain how members will vote", type: "textarea", show: is("voting", "Another way — I'll explain") },
    { id: "transfer", label: "Can a member sell or transfer their share?", type: "choice", options: ["Only with the other members' approval", "Other members get the first chance to buy", "Freely", "Not sure — let's discuss"] },
    { id: "oaNotes", label: "Anything else the agreement should cover?", type: "textarea", optional: true },
  ],
};
const bResolutions: Section = {
  id: "resolutions", title: "Resolutions", group: "Services", covers: ["Resolutions"], show: any(N.resolutions, N.goodStandingPremium),
  intro: "A resolution records a decision your members or board made.",
  repeat: { noun: "resolution", min: 1, rowTitle: (r, i) => r.resAction ? String(r.resAction).slice(0, 40) : `Resolution ${i + 1}` },
  questions: [
    { id: "resAction", label: "What was approved?", type: "textarea", placeholder: "e.g. Open a business bank account at …" },
    { id: "resDate", label: "Date it was approved", type: "date" },
    { id: "resBy", label: "Who approved it?", type: "text", placeholder: "e.g. All members" },
  ],
};
const bRecords: Section = {
  id: "records", title: "Business record book", group: "Services", covers: ["Record book"], show: any(N.records, N.pkgFormation, N.pkgComplete),
  questions: [
    { id: "bookFormat", label: "Digital or physical record book?", type: "choice", options: ["Digital", "Physical binder (digital copy included)"], show: has("need", N.records) },
    { id: "haveDocs", label: "Which documents do you already have? (choose all that apply)", type: "multi", optional: true, options: ["Articles of organization / incorporation", "Operating agreement or bylaws", "EIN letter", "Past annual reports", "Licenses and permits", "Meeting minutes or resolutions", "None yet"], show: (a) => !forming(a),
      help: "You can upload them in your client portal after you submit." },
  ],
};
const bFinish: Section = {
  id: "finish", title: "Anything else", group: "Finish", covers: ["Notes"],
  intro: "MKB's fee is separate from state and government filing fees, which are passed through at cost — we confirm them with you before anything is filed. MKB prepares filings from your information and standard templates and is not a law firm or a registered agent.",
  questions: [{ id: "notes", label: "Anything else we should know?", type: "textarea", optional: true }],
};

/* ================================================================ MKB Expungement Relief (Louisiana) */
const rAbout: Section = {
  id: "about", title: "About you", group: "About you", covers: ["Identity", "Contact"],
  intro: "We use this to organize your paperwork and request your records. MKB Expungement Relief currently assists with Louisiana records only.",
  questions: [
    { id: "fullName", label: "Full legal name", type: "text", prefill: "firstName" },
    { id: "otherNames", label: "Other names you've used (maiden name, nicknames on records)", type: "text", optional: true },
    { id: "dob", label: "Date of birth", type: "date", help: "Courts and agencies use it to find your records." },
    { id: "ssn", label: "Social Security number", type: "ssn", help: "Courts and agencies use it to find your records. It's encrypted as soon as you save it, and only the last 4 digits are shown." },
    { id: "phone", label: "Phone", type: "phone", prefill: "phone" },
    { id: "email", label: "Email", type: "email", prefill: "email" },
    { id: "street", label: "Mailing address (street)", type: "text", prefill: "street" },
    { id: "city", label: "City", type: "text", prefill: "city" },
    { id: "state", label: "State", type: "state", prefill: "state" },
    { id: "zip", label: "ZIP", type: "zip", prefill: "zip" },
  ],
};
const rRecords: Section = {
  id: "records", title: "Your arrests and charges", group: "Records", covers: ["Records"],
  intro: "Add each arrest separately. One arrest can have several charges — list every charge from that arrest and how each one ended. It's okay to estimate dates, and you don't need a docket number: helping you request what's missing is part of what we do.",
  repeat: { noun: "arrest", min: 1, rowTitle: (r, i) => [r.parish ? `${r.parish} Parish` : `Arrest ${i + 1}`, r.when, (() => { const n = parseCharges(r.charges).length; return n ? `${n} charge${n === 1 ? "" : "s"}` : ""; })()].filter(Boolean).join(" · "), rowDocs: (r) => (r.papers === "Yes" ? [doc(`Court papers you have — ${r.parish || "arrest"} ${r.when || ""}`.trim(), "Records")] : []) },
  questions: [
    { id: "inLa", label: "Was this arrest in Louisiana?", type: YN, warn: "We currently assist with Louisiana records only, so we may not be able to help with this one. We'll let you know.", warnWhen: "No" },
    { id: "parish", label: "Parish", type: "text", placeholder: "e.g. Caddo", show: is("inLa", "Yes") },
    { id: "when", label: "When was the arrest?", type: "text", placeholder: "e.g. March 2013", help: "An estimate is fine." },
    { id: "agency", label: "Arresting agency or court, if you know it", type: "text", optional: true },
    { id: "caseNo", label: "Docket or case number, if you have it", type: "text", optional: true, help: "Not required — we can find it from your records." },
    { id: "charges", label: "List every charge from this arrest and how each one ended", type: "charges", help: "Example: one arrest with 3 charges — 2 were not prosecuted (NPO) and 1 was a guilty plea. Add all 3 charges here, each with its own outcome." },
    { id: "sentenceDone", label: "For the guilty charge(s): is the sentence finished (jail, probation or parole, fines and fees)?", type: "choice", options: ["Yes — all finished", "No — still on probation or parole", "No — fines or fees still owed", "Not sure"], show: anyGuilty("charges") },
    { id: "papers", label: "Do you have any court papers for this arrest?", type: YN },
  ],
};
const rSituation: Section = {
  id: "situation", title: "Your situation", group: "Records", covers: ["Status"],
  questions: [
    { id: "pending", label: "Do you have any open or pending cases right now, anywhere?", type: YN, warn: "Pending cases can affect what's possible. Please talk with a licensed attorney — we'll point you to the Louisiana State Bar Association's lawyer referral service.", warnWhen: "Yes" },
    { id: "supervision", label: "Are you currently on probation or parole?", type: YN },
    { id: "prior", label: "Have you had a record expunged before?", type: YN },
    { id: "why", label: "What's prompting you to seek expungement relief? (optional)", type: "multi", optional: true, options: ["Employment", "Housing", "Professional license", "School", "Peace of mind", "Other"] },
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
  biz: { label: "Business Solutions", title: "Business Solutions Intake", sections: [bNeed, bBusiness, bOwners, bStructure, bAgent, bEin, bExisting, bDba, bForeign, bAmend, bDissolve, bAnnual, bLicenses, bOa, bResolutions, bRecords, bFinish], module: "biz", service: "biz", next: "We review your answers, confirm the state filing fees with you, and prepare your filings for your approval." },
  relief: { label: "Expungement Relief", title: "Expungement Relief Intake", sections: [rAbout, rRecords, rSituation, rAck], module: "exp", service: "expunge", next: "We review your answers, go over our fees with you, and start requesting your records." },
};
export const SERVICE_INTAKE_KINDS = Object.keys(SERVICE_INTAKES) as ServiceIntakeKind[];
export const isServiceIntakeKind = (k: unknown): k is ServiceIntakeKind => typeof k === "string" && k in SERVICE_INTAKES;
