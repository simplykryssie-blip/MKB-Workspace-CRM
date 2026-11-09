/**
 * Tax interview question sets (TY 2026, version 1 — DRAFT pending preparer review).
 *
 * Coverage notes reference the parts of each IRS form the answers feed. The
 * individual set follows the structure of IRS Form 13614-C (the intake sheet
 * used by the IRS's VITA program); business sets follow each return's own
 * schedules. MKB's preparer must review and approve each set before use, and
 * re-approve every tax year.
 */
import type { DocSpec, TaxForm } from "@/lib/tax/config";
import { all, any, form, gt, has, is, not, rowsOf, yes, type Answers, type Cond, type Q, type Row, type Section } from "./engine";

export const INTERVIEW_VERSION = { taxYear: 2026, version: "v1", status: "Draft — pending preparer approval" };

const doc = (name: string, category: string, sensitive = false): DocSpec => ({ name, category, sensitive });
const YN = "yesno" as const;
const married = is("marital", "Married");
const joint = all(married, is("mfj", "File jointly with my spouse"));
const enterTotals = is("records", "I'll enter my totals here");
const BIZ: TaxForm[] = ["1065", "1120-S", "1120"];
const owners = (f: TaxForm) => (f === "1065" ? "partner" : "shareholder");

/* ---------------- age (from date of birth; tax year from the return) ---------------- */
const yearOf = (a: Answers) => Number(a.__year) || INTERVIEW_VERSION.taxYear;
/** Age on December 31 of the tax year. */
export const ageAt = (dob: unknown, year: number) => (typeof dob === "string" && /^\d{4}-/.test(dob) ? year - Number(dob.slice(0, 4)) : undefined);
/** IRS rule: you're 65 for the year if born before January 2 of (tax year − 64). */
const is65 = (dob: unknown, year: number) => typeof dob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dob) && dob < `${year - 64}-01-02`;
/** Oldest age in the household filing (taxpayer, and spouse when married). */
export const oldest = (a: Answers) => Math.max(ageAt(a.dob, yearOf(a)) ?? 0, a.marital === "Married" ? (ageAt(a.sdob, yearOf(a)) ?? 0) : 0);
/** Taxpayer or spouse is 65 or older. */
export const senior = (a: Answers) => is65(a.dob, yearOf(a)) || (a.marital === "Married" && is65(a.sdob, yearOf(a)));
const ageAtLeast = (n: number): Cond => (a) => oldest(a) >= n;

/* ================================================================== */
/* Individual — Form 1040                                              */
/* ================================================================== */

const amended: Section = {
  id: "amend",
  title: "What needs to change",
  group: "Amendment",
  show: form("1040-X"),
  intro: "An amended return (Form 1040-X) corrects a return you already filed. Tell us what was missed or wrong — then confirm the rest of your information.",
  covers: ["Form 1040-X — explanation of changes", "Form 1040-X — original return figures"],
  questions: [
    { id: "amendYear", label: "Which tax year are you amending?", type: "year" },
    { id: "amendReason", label: "What needs to be corrected?", type: "multi", options: ["Missed income (a W-2 or 1099 arrived late)", "Missed a deduction or credit", "Wrong filing status", "Dependents changed", "IRS or state notice", "Other"] },
    { id: "amendExplain", label: "Briefly explain what happened", type: "textarea" },
    { id: "amendOriginal", label: "Do you have a copy of the original return?", type: YN, docs: [doc("Original return as filed", "Prior returns")] },
    { id: "amendNoMkb", label: "Was the original prepared by someone other than MKB?", type: YN },
    { id: "amendNotice", label: "Did you receive an IRS or state notice about this return?", type: YN, docs: [doc("IRS/state notice about the original return", "Notices")] },
  ],
};

const you: Section = {
  id: "you",
  title: "Your information",
  group: "About you",
  intro: "We've filled in what's already in your MKB profile — please check it's still correct.",
  covers: ["Form 1040 — taxpayer name, SSN and address", "Form 1040 — age 65+/blind standard deduction boxes", "E-file identity verification (IP PIN, prior-year AGI)"],
  questions: [
    { id: "fname", label: "First name (as on your Social Security card)", type: "text", prefill: "firstName" },
    { id: "lname", label: "Last name", type: "text", prefill: "lastName" },
    { id: "ssn", label: "Social Security number or ITIN", type: "ssn", prefill: "taxId" },
    { id: "dob", label: "Date of birth", type: "date", prefill: "dob" },
    { id: "occupation", label: "Occupation", type: "text" },
    { id: "phone", label: "Phone", type: "phone", prefill: "phone" },
    { id: "email", label: "Email", type: "email", prefill: "email" },
    { id: "street", label: "Home address", type: "text", prefill: "street" },
    { id: "city", label: "City", type: "text", prefill: "city" },
    { id: "state", label: "State", type: "state", prefill: "state" },
    { id: "zip", label: "ZIP", type: "zip", prefill: "zip" },
    { id: "moved", label: "Did you live in more than one state during the year?", type: YN, help: "Part-year residents usually file a return in each state." },
    { id: "prevState", label: "Which other state did you live in?", type: "state", show: yes("moved") },
    { id: "moveDate", label: "Date you moved", type: "date", show: yes("moved") },
    { id: "blind", label: "Are you legally blind?", type: YN },
    { id: "dependentOfOther", label: "Can someone else (like a parent) claim you as a dependent?", type: YN },
    { id: "ippin", label: "Did the IRS give you an Identity Protection PIN (IP PIN)?", type: YN, help: "A 6-digit number the IRS mails each year (letter CP01A) to prevent identity theft.", docs: [doc("IRS IP PIN letter (CP01A)", "Identity", true)] },
    { id: "mkbBefore", label: "Did MKB prepare your tax return last year?", type: YN, help: "This is only about who prepared last year's return — not about amending a return.", docsWhen: "No", docs: [doc("Last year's tax return (federal and state)", "Prior returns")] },
    { id: "priorAgi", label: "Last year's adjusted gross income (AGI), if you know it", type: "money", optional: true, help: "Used to verify your identity when e-filing. It's on line 11 of last year's Form 1040." },
    { id: "photoId", label: "Can you upload a photo ID (driver's license or state ID)?", type: YN, docs: [doc("Photo ID — taxpayer", "Identity", true)], help: "Many states ask for ID details to process e-filed returns." },
  ],
};

const filing: Section = {
  id: "filing",
  title: "Marital status",
  group: "About you",
  intro: "Your status on December 31 decides your filing status. Answer a few questions and we'll work out the best one.",
  covers: ["Form 1040 — filing status"],
  questions: [
    { id: "marital", label: "On December 31, were you…", type: "choice", options: ["Single (never married)", "Married", "Divorced or legally separated", "Widowed"] },
    { id: "spouseDied", label: "When did your spouse pass away?", type: "choice", options: ["This year", "Last year", "Two years ago", "Earlier than that"], show: is("marital", "Widowed") },
    { id: "mfj", label: "How do you want to file?", type: "choice", options: ["File jointly with my spouse", "File separately"], show: married, help: "Filing jointly is usually lower tax. Your preparer will compare both if you're unsure." },
    { id: "livedApart", label: "Did you live apart from your spouse for the last 6 months of the year?", type: YN, show: all(married, is("mfj", "File separately")) },
    { id: "paidHome", label: "Did you pay more than half the cost of keeping up your home (rent, mortgage, utilities, food)?", type: YN, show: any(is("marital", "Single (never married)", "Divorced or legally separated", "Widowed"), yes("livedApart")) },
  ],
};

const spouse: Section = {
  id: "spouse",
  title: "Your spouse",
  group: "About you",
  show: married,
  covers: ["Form 1040 — spouse name and SSN", "Form 1040 — spouse 65+/blind boxes"],
  questions: [
    { id: "sfname", label: "Spouse's first name", type: "text" },
    { id: "slname", label: "Spouse's last name", type: "text" },
    { id: "sssn", label: "Spouse's SSN or ITIN", type: "ssn" },
    { id: "sdob", label: "Spouse's date of birth", type: "date" },
    { id: "soccupation", label: "Spouse's occupation", type: "text" },
    { id: "sblind", label: "Is your spouse legally blind?", type: YN },
    { id: "sippin", label: "Did the IRS give your spouse an IP PIN?", type: YN, docs: [doc("IRS IP PIN letter (CP01A) — spouse", "Identity", true)] },
    { id: "sphotoId", label: "Can you upload your spouse's photo ID?", type: YN, show: joint, docs: [doc("Photo ID — spouse", "Identity", true)] },
  ],
};

const seniors: Section = {
  id: "seniors",
  title: "Retirement years",
  group: "About you",
  show: (a) => senior(a) && form("1040", "1040 + Sch C", "1040-X")(a),
  intro: "Because you (or your spouse) are 65 or older, a few extra questions can lower your tax.",
  covers: ["Form 1040 / 1040-SR — 65+ additional standard deduction", "Senior deduction for age 65+ (tax years 2025–2028)", "Schedule R — credit for the elderly or disabled", "Schedule A — medical: Medicare, long-term care, assisted living", "Form 8821 / 2848 — someone authorized to help", "State retirement income exclusions"],
  questions: [
    { id: "srForm", label: "Would you like your return on Form 1040-SR (larger print, made for seniors)?", type: YN, help: "Same tax either way — it's just easier to read." },
    { id: "srHelp", label: "Does a family member, caregiver or someone with power of attorney help you with your finances?", type: YN },
    { id: "srHelperName", label: "Their name and relationship to you", type: "text", show: yes("srHelp") },
    { id: "srHelperPhone", label: "Their phone number", type: "phone", show: yes("srHelp") },
    { id: "srHelperTalk", label: "May MKB discuss your return with them?", type: YN, show: yes("srHelp"), help: "We'll send a form for you to sign authorizing this." },
    { id: "srPoa", label: "Do they hold a power of attorney for you?", type: YN, show: yes("srHelp"), docs: [doc("Power of attorney document", "Identity", true)] },
    { id: "srAssist", label: "How would you like to finish this interview?", type: "choice", options: ["I'll finish it myself online", "Please go through it with me by phone", "I'd like an appointment in the office"] },
    { id: "srMedigap", label: "Do you pay for a Medicare supplement (Medigap), dental/vision plan or long-term care insurance?", type: YN, docs: [doc("Medicare supplement / long-term care premium statements", "Deductions")] },
    { id: "srCare", label: "Do you live in, or pay for, a nursing home or assisted-living facility (for you or your spouse)?", type: YN, docs: [doc("Nursing home / assisted-living statements", "Deductions")] },
    { id: "srHomeMods", label: "Any medical home changes this year — ramps, grab bars, stair lifts, walk-in tub?", type: YN, optional: true, docs: [doc("Receipts for medical home modifications", "Deductions")] },
    { id: "srDisabled", label: "Are you (or your spouse) retired on permanent and total disability?", type: YN, docs: [doc("Physician's statement of permanent and total disability", "Credits", true)] },
    { id: "srReverse", label: "Do you have a reverse mortgage?", type: YN, optional: true },
    { id: "srCheck", label: "Do you prefer paper mail over email and the portal for anything we send?", type: YN, optional: true },
  ],
};

const household: Section = {
  id: "household",
  title: "Your household",
  group: "About you",
  covers: ["Form 1040 — dependents checklist"],
  questions: [
    { id: "hasDeps", label: "Did anyone else live with you or depend on you for support — children, relatives or others?", type: YN },
  ],
};

const dependents: Section = {
  id: "deps",
  title: "Dependents",
  group: "About you",
  show: yes("hasDeps"),
  intro: "Add each person separately. We use this to decide who qualifies for the child tax credit, earned income credit and other credits.",
  covers: ["Form 1040 — dependents (name, SSN, relationship)", "Schedule 8812 — child tax credit", "Schedule EIC — qualifying children", "Form 2441 — qualifying persons"],
  repeat: { noun: "dependent", rowTitle: (r, i) => r.dname || `Dependent ${i + 1}` },
  questions: [
    { id: "dname", label: "Full name", type: "text" },
    { id: "dssn", label: "SSN, ITIN or ATIN", type: "ssn" },
    { id: "ddob", label: "Date of birth", type: "date" },
    { id: "drel", label: "Relationship to you", type: "choice", options: ["Son or daughter", "Stepchild", "Foster child", "Grandchild", "Brother or sister", "Niece or nephew", "Parent", "Other relative", "Not related"] },
    { id: "dmonths", label: "How many months did they live with you this year?", type: "number", help: "Count temporary absences (school, hospital) as time at home." },
    { id: "dstudent", label: "Full-time student for at least 5 months of the year?", type: YN },
    { id: "ddisabled", label: "Permanently and totally disabled?", type: YN },
    { id: "dselfSupport", label: "Did they pay more than half of their own living costs?", type: YN },
    { id: "dincome", label: "Their own gross income for the year (if any)", type: "money", optional: true, show: is("drel", "Parent", "Other relative", "Not related") },
    { id: "dmarried", label: "Are they married and filing a joint return?", type: YN, optional: true },
    { id: "dcustody", label: "Is another parent claiming this child this year (custody agreement or Form 8332)?", type: YN, show: is("drel", "Son or daughter", "Stepchild"), docs: [doc("Form 8332 or custody agreement", "Dependents")] },
  ],
};

const incomeScreen: Section = {
  id: "income",
  title: "Your income this year",
  group: "Income",
  intro: "Answer yes to everything that applies to you (and your spouse if filing jointly). We'll ask for details next.",
  covers: ["Form 1040 lines 1–8 — income types", "Form 1040 — digital asset question"],
  questions: [
    { id: "w2", label: "Worked as an employee and received a W-2?", type: YN },
    { id: "se", label: "Self-employment, freelance, gig or side-business income (1099-NEC, 1099-K, cash or apps)?", type: YN, show: form("1040", "1040-X"), help: "If yes, your return needs Schedule C — we'll let your preparer know." },
    { id: "unemp", label: "Unemployment benefits (1099-G)?", type: YN, docs: [doc("Form 1099-G (unemployment)", "Income")] },
    { id: "interest", label: "Bank interest or dividends (1099-INT, 1099-DIV)?", type: YN },
    { id: "invest", label: "Sold stocks, bonds, mutual funds or other investments (1099-B)?", type: YN },
    { id: "crypto", label: "At any time this year, did you receive, sell, exchange or otherwise dispose of a digital asset (crypto, stablecoins, NFTs)?", type: YN, warn: "This question is printed on Form 1040 and must be answered truthfully — the IRS checks it against exchange reports." },
    { id: "retire", label: "Withdrawals from a retirement plan, IRA or pension (1099-R)?", type: YN },
    { id: "ssa", label: "Social Security or railroad retirement benefits (SSA-1099 / RRB-1099)?", type: YN },
    { id: "rental", label: "Owned rental property or received royalties?", type: YN },
    { id: "k1", label: "Partner, S-corp shareholder or trust beneficiary who receives a Schedule K-1?", type: YN },
    { id: "homesale", label: "Sold your home?", type: YN },
    { id: "gambling", label: "Gambling or lottery winnings (W-2G)?", type: YN },
    { id: "alimonyIn", label: "Alimony received under a divorce finalized before 2019?", type: YN },
    { id: "foreign", label: "Foreign income, or a bank or financial account in another country?", type: YN },
    { id: "otherInc", label: "Any other income — jury duty, prizes, cancelled debt (1099-C), 1099-MISC, HSA or 529 withdrawals?", type: YN },
  ],
};

const w2s: Section = {
  id: "w2s",
  title: "W-2 jobs",
  group: "Income",
  show: yes("w2"),
  intro: "Add one entry per W-2 you received (yours and your spouse's).",
  covers: ["Form 1040 line 1a — wages", "Form 1040 line 25a — W-2 withholding", "State wage allocation"],
  repeat: { noun: "W-2", rowTitle: (r, i) => r.employer || `W-2 ${i + 1}`, rowDocs: (r) => [doc(`W-2 — ${r.employer || "employer"}`, "Income")] },
  questions: [
    { id: "employer", label: "Employer name", type: "text" },
    { id: "whose", label: "Whose W-2 is it?", type: "choice", options: ["Mine", "My spouse's"], show: (a) => joint(a) },
    { id: "wstate", label: "State shown on the W-2", type: "state" },
    { id: "wmulti", label: "Did you work in more than one state for this employer?", type: YN, optional: true },
    { id: "whave", label: "Do you have this W-2 now?", type: YN },
  ],
};

const investments: Section = {
  id: "invest",
  title: "Interest, dividends and investments",
  group: "Income",
  show: any(yes("interest"), yes("invest"), yes("crypto")),
  covers: ["Schedule B — interest and ordinary dividends", "Schedule D / Form 8949 — capital gains", "Digital asset reporting (1099-DA)"],
  questions: [
    { id: "intCount", label: "How many 1099-INT / 1099-DIV forms did you receive?", type: "number", show: yes("interest"), docs: [], },
    { id: "brokers", label: "How many brokerage or investment accounts sent you a 1099-B?", type: "number", show: yes("invest") },
    { id: "basis", label: "Do you know what you originally paid for everything you sold (cost basis)?", type: YN, show: yes("invest"), help: "Your 1099-B usually shows it. If not, we'll need purchase records." },
    { id: "cryptoActivity", label: "What did you do with digital assets?", type: "multi", options: ["Bought and held only", "Sold or exchanged", "Received as payment or rewards", "Staking or mining"], show: yes("crypto") },
    { id: "cryptoPlatforms", label: "Which exchanges or wallets?", type: "text", show: all(yes("crypto"), not(is("cryptoActivity", "Bought and held only"))) },
    { id: "washOrInherited", label: "Did you sell anything you inherited or received as a gift?", type: YN, show: yes("invest"), optional: true },
  ],
};

const retirement: Section = {
  id: "retirement",
  title: "Retirement distributions",
  group: "Income",
  show: yes("retire"),
  covers: ["Form 1040 lines 4–5 — IRA, pension and annuity distributions", "Form 5329 — early withdrawal penalty"],
  questions: [
    { id: "rCount", label: "How many 1099-R forms did you receive?", type: "number", docs: [] },
    { id: "rDocs", label: "Can you upload every 1099-R?", type: YN, docs: [doc("Forms 1099-R (retirement, pension and annuity distributions)", "Income")] },
    { id: "rRollover", label: "Was any of it rolled over into another retirement account within 60 days?", type: YN },
    { id: "rEarly", label: "Were you under 59½ when you took the money out?", type: YN },
    { id: "rReason", label: "What was it used for?", type: "choice", options: ["Medical expenses", "First home purchase (up to $10,000)", "Higher education", "Birth or adoption", "Disability", "Other / none of these"], show: yes("rEarly"), help: "Some uses avoid the 10% early-withdrawal penalty." },
    { id: "rWithheld", label: "Was federal tax withheld from the distribution?", type: YN, optional: true },
    { id: "rPension", label: "Do you receive a pension or annuity?", type: YN },
    { id: "rPensionNew", label: "Did the pension or annuity start this year?", type: YN, show: yes("rPension"), help: "We may need the plan's statement of your after-tax contributions.", docs: [doc("Pension/annuity starting statement (after-tax contributions)", "Income")] },
    { id: "rRmd", label: "Did you take your required minimum distribution (RMD) from every IRA and retirement plan?", type: "choice", options: ["Yes, from every account", "No, or not from every account", "Not sure"], show: ageAtLeast(73), help: "Required each year once you reach 73.", warn: "A missed RMD can mean a penalty of up to 25% of the amount not taken. Tell us right away — it can often be reduced if it's fixed quickly.", warnWhen: "No, or not from every account" },
    { id: "rQcd", label: "Did you send any IRA money directly to a charity (a qualified charitable distribution)?", type: YN, show: ageAtLeast(70), help: "Done right, it isn't taxed — we need the charity's acknowledgment letter.", docs: [doc("Charity acknowledgment for IRA charitable distribution (QCD)", "Income")] },
    { id: "rQcdAmt", label: "Total sent directly to charities", type: "money", show: all(ageAtLeast(70), yes("rQcd")) },
    { id: "rInherited", label: "Did any of it come from an inherited IRA or retirement plan?", type: YN },
  ],
};

const socialSecurity: Section = {
  id: "socialSecurity",
  title: "Social Security",
  group: "Income",
  show: yes("ssa"),
  covers: ["Form 1040 line 6 — Social Security benefits (taxable portion)", "Lump-sum election for back payments (Pub. 915)", "Withholding on benefits (Form W-4V)"],
  questions: [
    { id: "ssaWho", label: "Who receives benefits?", type: "choice", options: ["Me", "My spouse", "Both of us"], show: married },
    { id: "ssaDocs", label: "Can you upload the SSA-1099 for each person? (mailed every January)", type: YN, docs: [doc("Form SSA-1099 (Social Security benefit statement)", "Income")] },
    { id: "rrb", label: "Railroad retirement benefits (RRB-1099)?", type: YN, docs: [doc("Form RRB-1099 / RRB-1099-R", "Income")] },
    { id: "ssaLump", label: "Did you receive a lump-sum back payment that covers earlier years?", type: YN, help: "This can lower the tax — we'll need the SSA letter that shows which years it was for.", docs: [doc("SSA letter explaining the back payment", "Income")] },
    { id: "ssaWithheld", label: "Do you have federal tax taken out of your Social Security (Form W-4V)?", type: YN },
    { id: "ssaMedicare", label: "Are Medicare premiums (Part B, Part D or a Medicare Advantage plan) taken out of your benefits?", type: YN, help: "They're listed on the SSA-1099 and can count as medical expenses." },
  ],
};

const rentals: Section = {
  id: "rentals",
  title: "Rental properties",
  group: "Income",
  show: yes("rental"),
  intro: "Add each property separately.",
  covers: ["Schedule E Part I — rental and royalty income", "Form 4562 — rental depreciation", "Form 8582 — passive activity limits"],
  repeat: {
    noun: "property",
    rowTitle: (r, i) => r.paddr || `Property ${i + 1}`,
    rowDocs: (r) => [doc(`Rental income & expense summary — ${r.paddr || "property"}`, "Rental"), ...(r.pmortgage === "Yes" ? [doc(`Form 1098 mortgage interest — ${r.paddr || "property"}`, "Rental")] : []), ...(r.pbought === "Yes" ? [doc(`Closing statement — ${r.paddr || "property"}`, "Rental")] : [])],
  },
  questions: [
    { id: "paddr", label: "Property address", type: "text" },
    { id: "ptype", label: "Type of property", type: "choice", options: ["Single-family home", "Multi-unit", "Short-term rental (Airbnb, VRBO)", "Commercial", "Land", "Royalties (oil, gas, books, music)"] },
    { id: "pown", label: "Your ownership share", type: "percent" },
    { id: "pdays", label: "Days rented at fair rent this year", type: "number", show: not(is("ptype", "Royalties (oil, gas, books, music)")) },
    { id: "ppersonal", label: "Days used personally by you or family", type: "number", show: not(is("ptype", "Royalties (oil, gas, books, music)")) },
    { id: "pincome", label: "Total rent or royalties received", type: "money" },
    { id: "pmortgage", label: "Is there a mortgage on this property?", type: YN },
    { id: "pbought", label: "Bought, sold or made major improvements this year?", type: YN },
    { id: "pmanage", label: "Do you actively manage it (approve tenants, set rent)?", type: YN },
  ],
};

const k1s: Section = {
  id: "k1s",
  title: "Schedule K-1s you received",
  group: "Income",
  show: yes("k1"),
  covers: ["Schedule E Part II — partnerships and S corporations", "Schedule E Part III — estates and trusts"],
  repeat: { noun: "K-1", rowTitle: (r, i) => r.kname || `K-1 ${i + 1}`, rowDocs: (r) => [doc(`Schedule K-1 — ${r.kname || "entity"}`, "Income")] },
  questions: [
    { id: "kname", label: "Name of the business, trust or estate", type: "text" },
    { id: "ktype", label: "Type", type: "choice", options: ["Partnership / LLC", "S corporation", "Trust or estate"] },
    { id: "khave", label: "Have you received the K-1 yet?", type: YN, help: "K-1s often arrive in March or later. We can wait or file an extension." },
    { id: "kmkb", label: "Does MKB prepare that business's return?", type: YN, optional: true },
  ],
};

const otherIncome: Section = {
  id: "otherIncome",
  title: "Other income details",
  group: "Income",
  show: any(yes("homesale"), yes("gambling"), yes("alimonyIn"), yes("foreign"), yes("otherInc")),
  covers: ["Form 8949 / Section 121 — sale of main home", "Schedule 1 — gambling, alimony and other income", "FinCEN 114 (FBAR) / Form 8938 — foreign accounts", "Form 2555 / 1116 — foreign income"],
  questions: [
    { id: "hsPrice", label: "Sale price of your home", type: "money", show: yes("homesale"), docs: [] },
    { id: "hsLived", label: "Did you own it and live in it for at least 2 of the last 5 years?", type: YN, show: yes("homesale") },
    { id: "hsDocs", label: "Can you upload the closing statement and purchase records?", type: YN, show: yes("homesale"), docs: [doc("Home sale closing statement", "Income"), doc("Home purchase closing statement and improvement records", "Income")] },
    { id: "gLosses", label: "Do you have records of gambling losses?", type: YN, show: yes("gambling"), docs: [doc("Forms W-2G", "Income")], docsWhen: "No" },
    { id: "gDocs", label: "Upload your W-2Gs and loss records (win/loss statements)", type: YN, show: yes("gambling"), docs: [doc("Forms W-2G and gambling win/loss statements", "Income")] },
    { id: "alAmount", label: "Total alimony received", type: "money", show: yes("alimonyIn") },
    { id: "fBalance", label: "Highest combined balance of all foreign accounts at any time during the year", type: "choice", options: ["Under $10,000", "$10,000 or more"], show: yes("foreign"), help: "$10,000 or more requires a separate FBAR filing." },
    { id: "fCountries", label: "Which countries?", type: "text", show: yes("foreign") },
    { id: "fIncome", label: "Did you earn income or pay tax in another country?", type: YN, show: yes("foreign"), docs: [doc("Foreign income and foreign tax paid statements", "Income")] },
    { id: "oDescribe", label: "Describe the other income", type: "textarea", show: yes("otherInc"), help: "e.g. 1099-C cancelled credit card debt $2,400; jury duty $120." },
    { id: "oDocs", label: "Do you have forms for it (1099-MISC, 1099-C, 1099-SA, 1099-Q)?", type: YN, show: yes("otherInc"), docs: [doc("Other income forms (1099-MISC / 1099-C / 1099-SA / 1099-Q)", "Income")] },
  ],
};

const deductions: Section = {
  id: "deductions",
  title: "Deductions",
  group: "Deductions & credits",
  intro: "We'll compare itemizing with the standard deduction and use whichever is better.",
  covers: ["Schedule 1 Part II — adjustments (HSA, IRA, student loan interest, educator)", "Schedule A — itemized deductions"],
  questions: [
    { id: "hsa", label: "Contributed to or used a Health Savings Account (HSA)?", type: YN, docs: [doc("Forms 5498-SA / 1099-SA (HSA)", "Deductions")] },
    { id: "ira", label: "Contributed to a traditional or Roth IRA for this tax year?", type: YN, docs: [doc("IRA contribution statement (Form 5498)", "Deductions")] },
    { id: "studentLoan", label: "Paid student loan interest?", type: YN, docs: [doc("Form 1098-E (student loan interest)", "Deductions")] },
    { id: "educator", label: "K–12 teacher who paid for classroom supplies?", type: YN },
    { id: "educatorAmt", label: "Amount spent on supplies", type: "money", show: yes("educator") },
    { id: "mortgage", label: "Paid mortgage interest on your home?", type: YN, docs: [doc("Form 1098 (mortgage interest)", "Deductions")] },
    { id: "propTax", label: "Paid real estate or personal property (car) taxes?", type: YN, docs: [doc("Property tax statements", "Deductions")] },
    { id: "charity", label: "Gave to charity (cash or donated items)?", type: YN },
    { id: "charityCash", label: "Total cash / check / card donations", type: "money", show: yes("charity") },
    { id: "charityItems", label: "Value of donated items (clothes, furniture, cars)", type: "money", show: yes("charity"), optional: true },
    { id: "charityDocs", label: "Do you have receipts or acknowledgment letters?", type: YN, show: yes("charity"), docs: [doc("Charitable donation receipts", "Deductions")] },
    { id: "medical", label: "Large medical or dental costs not covered by insurance?", type: YN },
    { id: "medicalAmt", label: "Approximate total", type: "money", show: yes("medical"), docs: [] },
    { id: "alimonyPaid", label: "Paid alimony under a divorce finalized before 2019?", type: YN },
    { id: "alimonyPaidAmt", label: "Total alimony paid", type: "money", show: yes("alimonyPaid") },
    { id: "alimonySsn", label: "Recipient's SSN", type: "ssn", show: yes("alimonyPaid") },
  ],
};

const credits: Section = {
  id: "credits",
  title: "Credits",
  group: "Deductions & credits",
  covers: ["Form 2441 — child and dependent care credit", "Form 8863 — education credits", "Form 8962 — premium tax credit", "Form 5695 / 8936 — energy and clean vehicle credits", "Form 8839 — adoption credit", "Form 8880 — saver's credit"],
  questions: [
    { id: "childcare", label: "Paid for child care or dependent care so you (and your spouse) could work or look for work?", type: YN, show: yes("hasDeps") },
    { id: "ccProvider", label: "Care provider's name", type: "text", show: yes("childcare") },
    { id: "ccTin", label: "Provider's EIN or SSN", type: "tin", show: yes("childcare"), help: "Ask the daycare for a statement — it usually lists it.", warn: "Required on Form 2441 — without the provider's ID number the child care credit can be denied." },
    { id: "ccAmount", label: "Total paid for care", type: "money", show: yes("childcare"), docs: [] },
    { id: "ccStatement", label: "Do you have the provider's year-end statement?", type: YN, show: yes("childcare"), docs: [doc("Child care provider statement", "Credits")] },
    { id: "tuition", label: "Paid college or vocational school tuition for you, your spouse or a dependent?", type: YN, docs: [doc("Form 1098-T (tuition)", "Credits")] },
    { id: "tStudent", label: "Which student(s)?", type: "text", show: yes("tuition") },
    { id: "tYears", label: "Has any student already claimed an education credit for 4 years?", type: YN, show: yes("tuition") },
    { id: "marketplace", label: "Anyone in your household had health insurance through the Marketplace (Healthcare.gov or a state exchange)?", type: YN, docs: [doc("Form 1095-A (Marketplace statement)", "Credits")] },
    { id: "energy", label: "Installed solar, a heat pump, insulation or efficient windows/doors — or bought an electric or plug-in vehicle?", type: YN, docs: [doc("Energy improvement / vehicle purchase receipts", "Credits")] },
    { id: "energyWhat", label: "What did you buy or install, and when?", type: "textarea", show: yes("energy") },
    { id: "adopt", label: "Adopted a child or paid adoption expenses?", type: YN, docs: [doc("Adoption expense records", "Credits")] },
    { id: "retireContrib", label: "Contributed to a 401(k), 403(b) or similar workplace plan?", type: YN, optional: true, help: "May qualify for the saver's credit." },
  ],
};

const payments: Section = {
  id: "payments",
  title: "Payments and letters",
  group: "Payments & refund",
  covers: ["Form 1040 line 26 — estimated payments", "Form 1040 — prior-year overpayment applied", "IRS/state notices"],
  questions: [
    { id: "estimates", label: "Made estimated tax payments for this year (federal or state)?", type: YN },
    { id: "estFed", label: "Total federal estimated payments", type: "money", show: yes("estimates") },
    { id: "estState", label: "Total state estimated payments", type: "money", show: yes("estimates"), optional: true },
    { id: "estDates", label: "Dates and amounts, if you have them", type: "textarea", show: yes("estimates"), optional: true, docs: [] },
    { id: "estProof", label: "Can you upload payment confirmations?", type: YN, show: yes("estimates"), docs: [doc("Estimated payment confirmations", "Payments")] },
    { id: "applied", label: "Did you apply last year's refund to this year's taxes?", type: YN },
    { id: "letters", label: "Received any letters from the IRS or your state this year?", type: YN, docs: [doc("IRS/state letters received", "Notices")] },
  ],
};

const refund: Section = {
  id: "refund",
  title: "Refund or balance due",
  group: "Payments & refund",
  covers: ["Form 1040 lines 35–37 — refund and amount owed", "Form 8888 — direct deposit"],
  questions: [
    { id: "refundHow", label: "If you get a refund, how would you like it?", type: "choice", options: ["Direct deposit", "Paper check", "Apply to next year's taxes"] },
    { id: "oweHow", label: "If you owe, how would you like to pay?", type: "choice", options: ["Direct debit from my bank account", "I'll pay online or by check myself", "I need a payment plan"] },
    { id: "bankType", label: "Account type", type: "choice", options: ["Checking", "Savings"], show: any(is("refundHow", "Direct deposit"), is("oweHow", "Direct debit from my bank account")) },
    { id: "routing", label: "Routing number", type: "bank", show: any(is("refundHow", "Direct deposit"), is("oweHow", "Direct debit from my bank account")) },
    { id: "account", label: "Account number", type: "bank", show: any(is("refundHow", "Direct deposit"), is("oweHow", "Direct debit from my bank account")) },
  ],
};

/* ================================================================== */
/* Schedule C — sole proprietor / single-member LLC                    */
/* ================================================================== */

const schC: Section = {
  id: "schc",
  title: "Your business",
  group: "Your business",
  show: form("1040 + Sch C"),
  intro: "Schedule C reports a business you own by yourself — a sole proprietorship or a single-member LLC that hasn't elected to be taxed as a corporation.",
  covers: ["Schedule C header — business name, EIN, activity code", "Schedule C line F — accounting method", "Schedule C line G — material participation"],
  questions: [
    { id: "bizName", label: "Business name (or your name if you don't use one)", type: "text", prefill: "bizName" },
    { id: "bizStructure", label: "How is the business set up?", type: "choice", options: ["Sole proprietor (no LLC)", "Single-member LLC", "LLC with more than one owner", "LLC or corporation that elected S-corp status"], help: "The last two need a different return — we'll let your preparer know." },
    { id: "bizEinYn", label: "Does the business have its own EIN?", type: YN },
    { id: "bizEin", label: "Business EIN", type: "ein", show: yes("bizEinYn"), prefill: "ein" },
    { id: "bizWhat", label: "What does the business do?", type: "text", prefill: "activity", placeholder: "e.g. landscaping, hair stylist, rideshare driver" },
    { id: "bizStarted", label: "Did the business start this year?", type: YN },
    { id: "bizMethod", label: "How do you track income and expenses?", type: "choice", options: ["Cash (when money comes in or goes out)", "Accrual (when invoiced or billed)", "Not sure"] },
    { id: "bizHours", label: "Did you work in the business regularly — more than 500 hours this year?", type: YN },
    { id: "bizState", label: "Main state where the business operates", type: "state", prefill: "bizState" },
    { id: "bizMore", label: "Do you have another self-employment business?", type: YN, help: "Each business needs its own Schedule C." },
  ],
};

/** Income & expenses — shared by Schedule C and business returns. */
const bizIncome: Section = {
  id: "bizIncome",
  title: "Income",
  group: "Income & expenses",
  show: form("1040 + Sch C", ...BIZ),
  covers: ["Schedule C Part I / business return page 1 — gross receipts", "Form 1099-K / 1099-NEC reconciliation"],
  questions: [
    { id: "records", label: "How will you give us the year's income and expenses?", type: "choice", options: ["MKB keeps my books", "I'll upload a profit & loss report and bank statements", "I'll enter my totals here"] },
    { id: "plDocs", label: "Upload your year-end profit & loss and every business bank and credit card statement", type: YN, show: is("records", "I'll upload a profit & loss report and bank statements"), docs: [doc("Year-end profit & loss report", "Business"), doc("Business bank and credit card statements (all 12 months)", "Business")] },
    { id: "gross", label: "Total sales / gross receipts", type: "money", show: enterTotals },
    { id: "refunds", label: "Refunds and returns given to customers", type: "money", show: enterTotals, optional: true },
    { id: "nec", label: "Did you receive 1099-NEC forms from customers?", type: YN, docs: [doc("Forms 1099-NEC received", "Business")] },
    { id: "k1099", label: "Received 1099-K forms (card processors, PayPal, Venmo, Square, Etsy, Uber…)?", type: YN, docs: [doc("Forms 1099-K", "Business")] },
    { id: "cashInc", label: "Any cash or payment-app income not on a 1099?", type: YN, warn: "All business income is taxable, even without a 1099. Leaving out cash or app income is one of the most common reasons for IRS notices.", warnWhen: "Yes" },
    { id: "cashAmt", label: "About how much cash or payment-app income wasn't on a 1099?", type: "money", show: yes("cashInc") },
    { id: "salesChannels", label: "Where do you sell?", type: "multi", optional: true, options: ["In person / storefront", "My own website", "Online marketplaces (Etsy, Amazon, eBay…)", "Social media / payment apps", "Wholesale to other businesses", "Services only — no products"] },
    { id: "salesTax", label: "Did you collect sales tax from customers?", type: YN, help: "Sales tax you collected and paid to the state isn't income — we'll back it out.", show: (a) => !String(a.salesChannels ?? "").startsWith("Services only") },
    { id: "salesTaxAmt", label: "Total sales tax collected (included in your sales total)", type: "money", optional: true, show: all(yes("salesTax"), enterTotals) },
    { id: "otherBizInc", label: "Other business income (grants, interest, insurance payouts, sale of equipment)?", type: YN, optional: true },
  ],
};

const cogs: Section = {
  id: "cogs",
  title: "Products and inventory",
  group: "Income & expenses",
  show: form("1040 + Sch C", ...BIZ),
  covers: ["Schedule C Part III / Form 1125-A — cost of goods sold"],
  questions: [
    { id: "inventory", label: "Do you sell products or keep inventory?", type: YN },
    { id: "invBegin", label: "Inventory value at the start of the year", type: "money", show: yes("inventory") },
    { id: "invPurchases", label: "Inventory purchased during the year", type: "money", show: all(yes("inventory"), enterTotals) },
    { id: "invEnd", label: "Inventory value at the end of the year (count or estimate)", type: "money", show: yes("inventory"), docs: [] },
    { id: "invMethod", label: "How do you value inventory?", type: "choice", options: ["Cost", "Lower of cost or market", "Not sure"], show: yes("inventory") },
    { id: "invMaterials", label: "Materials and supplies used to make your products", type: "money", optional: true, show: all(yes("inventory"), enterTotals) },
    { id: "invLabor", label: "Labor paid to make products (not your own pay)", type: "money", optional: true, show: all(yes("inventory"), enterTotals) },
    { id: "invShipping", label: "Shipping and freight to get products to you", type: "money", optional: true, show: all(yes("inventory"), enterTotals) },
    { id: "invOther", label: "Other product costs (packaging, marketplace fees counted in cost)", type: "money", optional: true, show: all(yes("inventory"), enterTotals) },
    { id: "invPersonal", label: "Did you take any products for personal use or give any away?", type: YN, show: yes("inventory"), help: "Their cost comes out of cost of goods sold." },
    { id: "invPersonalAmt", label: "Cost of products taken for personal use", type: "money", show: all(yes("inventory"), yes("invPersonal")) },
    { id: "invCount", label: "Did you count your inventory at year-end?", type: YN, show: yes("inventory"), warn: "An inventory count (or a reliable estimate) at year-end is needed to figure cost of goods sold. Without it, your profit — and tax — may be overstated.", warnWhen: "No", docsWhen: "Yes", docs: [doc("Year-end inventory count or report", "Business")] },
  ],
};

const EXPENSES: [string, string][] = [
  ["exAdvertising", "Advertising and marketing"],
  ["exContract", "Contract labor (1099 workers)"],
  ["exInsurance", "Business insurance (not health)"],
  ["exInterest", "Interest on business loans and cards"],
  ["exLegal", "Legal and professional fees"],
  ["exOffice", "Office expenses and supplies"],
  ["exRentEquip", "Rent — vehicles, machinery, equipment"],
  ["exRentPlace", "Rent — office, shop or storage"],
  ["exRepairs", "Repairs and maintenance"],
  ["exSupplies", "Materials and supplies"],
  ["exTaxes", "Business taxes and licenses"],
  ["exTravel", "Travel (airfare, hotel)"],
  ["exMeals", "Business meals"],
  ["exUtilities", "Utilities"],
  ["exPhone", "Phone and internet"],
  ["exSoftware", "Software and subscriptions"],
  ["exFees", "Bank and merchant fees"],
  ["exTraining", "Education and training"],
];

const expenses: Section = {
  id: "expenses",
  title: "Expenses",
  group: "Income & expenses",
  show: all(form("1040 + Sch C", ...BIZ), enterTotals),
  intro: "Enter yearly totals. Leave any that don't apply blank. Payroll, vehicles, home office and big purchases come next.",
  covers: ["Schedule C Part II / business return page 1 — deductions"],
  questions: [
    ...EXPENSES.map(([id, label]): Q => ({ id, label, type: "money", optional: true })),
    { id: "exOther", label: "Other expenses (describe and give amounts)", type: "textarea", optional: true },
    { id: "exReceipts", label: "Can you back these up with receipts or statements if asked?", type: YN },
  ],
};

const people: Section = {
  id: "people",
  title: "Employees and contractors",
  group: "Income & expenses",
  show: form("1040 + Sch C", ...BIZ),
  covers: ["Wages and payroll taxes", "Form 1099-NEC filing for contractors", "Schedule C lines I–J / Schedule B — 1099 filing questions"],
  questions: [
    { id: "employees", label: "Did the business have employees (W-2 payroll)?", type: YN },
    { id: "payroll", label: "Who runs payroll?", type: "choice", options: ["Payroll service (Gusto, ADP, QuickBooks…)", "MKB", "We do it ourselves"], show: yes("employees") },
    { id: "payrollDocs", label: "Upload the year-end payroll reports (W-3, 940, all four 941s)", type: YN, show: yes("employees"), docs: [doc("Payroll reports — W-3, Form 940, Forms 941", "Business")] },
    { id: "contractors", label: "Paid any person or unincorporated business $600 or more for services?", type: YN, help: "Usually requires filing Form 1099-NEC by January 31." },
    { id: "filed1099", label: "Have those 1099s been filed?", type: "choice", options: ["Yes, they're filed", "No — I'd like MKB to file them", "Not sure"], show: yes("contractors") },
    { id: "w9s", label: "Do you have a W-9 from each contractor?", type: YN, show: yes("contractors") },
    { id: "contractorList", label: "List each contractor and the total paid", type: "textarea", show: all(yes("contractors"), not(is("filed1099", "Yes, they're filed"))) },
  ],
};

const vehicleQ: Section = {
  id: "vehicleQ",
  title: "Vehicles",
  group: "Assets",
  show: form("1040 + Sch C", ...BIZ),
  covers: ["Form 4562 Part V — listed property (vehicles)", "Schedule C Part IV — vehicle information"],
  questions: [{ id: "usesVehicle", label: "Did you use a car, truck or van for the business (other than commuting)?", type: YN }],
};
const vehicles: Section = {
  id: "vehicles",
  title: "Vehicle details",
  group: "Assets",
  show: all(form("1040 + Sch C", ...BIZ), yes("usesVehicle")),
  intro: "Add each vehicle used for business.",
  covers: ["Form 4562 Part V — business-use percentage", "Standard mileage or actual expenses"],
  repeat: { noun: "vehicle", rowTitle: (r, i) => r.vdesc || `Vehicle ${i + 1}`, rowDocs: (r) => (r.vlog === "Yes" ? [doc(`Mileage log — ${r.vdesc || "vehicle"}`, "Business")] : []) },
  questions: [
    { id: "vdesc", label: "Year, make and model", type: "text" },
    { id: "vowner", label: "Who owns it?", type: "choice", options: ["Me personally", "The business", "Leased"] },
    { id: "vdate", label: "Date you first used it for business", type: "date" },
    { id: "vbiz", label: "Business miles this year", type: "number" },
    { id: "vtotal", label: "Total miles this year (all use)", type: "number" },
    { id: "vcommute", label: "Commuting miles (home to regular workplace)", type: "number", optional: true },
    { id: "vmethod", label: "How do you want to deduct it?", type: "choice", options: ["Standard mileage rate", "Actual expenses (gas, repairs, insurance…)", "Not sure — let my preparer decide"] },
    { id: "vlog", label: "Do you have a mileage log or other written record?", type: YN, warn: "The IRS requires a written record of business miles. Without one, vehicle deductions can be denied in an audit — start a log now (an app works).", warnWhen: "No" },
    { id: "vanother", label: "Is another vehicle available for personal use?", type: YN },
  ],
};

const homeOffice: Section = {
  id: "homeOffice",
  title: "Home office",
  group: "Assets",
  show: form("1040 + Sch C"),
  covers: ["Form 8829 — business use of home", "Simplified home office method"],
  questions: [
    { id: "ho", label: "Do you use part of your home regularly and only for the business?", type: YN },
    { id: "hoSqft", label: "Square footage of the office space", type: "number", show: yes("ho") },
    { id: "hoTotal", label: "Total square footage of the home", type: "number", show: yes("ho") },
    { id: "hoOwnRent", label: "Do you rent or own?", type: "choice", options: ["Rent", "Own"], show: yes("ho") },
    { id: "hoRent", label: "Total rent paid this year", type: "money", show: all(yes("ho"), is("hoOwnRent", "Rent")) },
    { id: "hoUtilities", label: "Total utilities for the home", type: "money", show: yes("ho"), optional: true },
    { id: "hoInsurance", label: "Homeowner's / renter's insurance", type: "money", show: yes("ho"), optional: true },
  ],
};

const assets: Section = {
  id: "assets",
  title: "Equipment and large purchases",
  group: "Assets",
  show: form("1040 + Sch C", ...BIZ),
  covers: ["Form 4562 — depreciation and section 179", "Form 4797 — sale of business property"],
  questions: [
    { id: "bought", label: "Bought equipment, furniture, computers, machinery or improvements costing more than $2,500 each?", type: YN },
    { id: "boughtList", label: "List each item, purchase date and cost", type: "textarea", show: yes("bought"), docs: [] },
    { id: "boughtReceipts", label: "Can you upload receipts or invoices for them?", type: YN, show: yes("bought"), docs: [doc("Receipts for equipment and large purchases", "Business")] },
    { id: "sold", label: "Sold, traded in or disposed of any business equipment or vehicles?", type: YN },
    { id: "soldList", label: "What, when, and for how much?", type: "textarea", show: yes("sold") },
    { id: "assetList", label: "Do you have last year's depreciation schedule?", type: YN, optional: true, show: form(...BIZ, "1040 + Sch C") },
  ],
};

const schCOther: Section = {
  id: "schcOther",
  title: "Health insurance and retirement",
  group: "Assets",
  show: form("1040 + Sch C"),
  covers: ["Schedule SE — self-employment tax", "Schedule 1 — self-employed health insurance", "Schedule 1 — SEP, SIMPLE and solo 401(k)"],
  questions: [
    { id: "seHealth", label: "Did you pay for your own health insurance (not through a job or the Marketplace)?", type: YN },
    { id: "seHealthAmt", label: "Total premiums paid", type: "money", show: yes("seHealth") },
    { id: "seRetire", label: "Contributed to a SEP-IRA, SIMPLE IRA or solo 401(k)?", type: YN },
    { id: "seRetireAmt", label: "Total contributed for this year", type: "money", show: yes("seRetire") },
    { id: "seLoans", label: "Any business loans or lines of credit?", type: YN, docs: [doc("Business loan statements (year-end balance and interest)", "Business")] },
  ],
};

/* ================================================================== */
/* Business returns — 1065, 1120-S, 1120                               */
/* ================================================================== */

const STRUCTURES: Record<"1065" | "1120-S" | "1120", string[]> = {
  "1065": ["Partnership", "LLC with two or more members"],
  "1120-S": ["S corporation", "LLC that elected S-corp status"],
  "1120": ["C corporation", "LLC that elected to be taxed as a corporation"],
};

const entity: Section = {
  id: "entity",
  title: "Business information",
  group: "Your business",
  show: form(...BIZ),
  intro: "We've filled in what's on your MKB profile — please confirm.",
  covers: ["Return header — legal name, EIN, address", "Date incorporated / formed", "Principal business activity and product (activity code)", "Accounting method and tax year", "Initial / final / amended return boxes"],
  questions: [
    { id: "legalName", label: "Legal business name", type: "text", prefill: "bizName" },
    { id: "dba", label: "Doing business as (DBA), if different", type: "text", optional: true },
    { id: "ein", label: "EIN", type: "ein", prefill: "ein" },
    { id: "structure", label: "How is the business set up?", type: "choice", options: [...new Set([...STRUCTURES["1065"], ...STRUCTURES["1120-S"], ...STRUCTURES["1120"]]), "Not sure"], help: "This decides the type of return. If it doesn't match how we set up your return, your preparer will follow up." },
    { id: "sElection", label: "Date the S-corp election took effect", type: "date", show: form("1120-S") },
    { id: "s2553", label: "Do you have the IRS letter accepting the S-corp election (CP261)?", type: YN, show: form("1120-S"), docs: [doc("IRS S-corp acceptance letter (CP261) or Form 2553", "Business")] },
    { id: "formed", label: "Date formed", type: "date", prefill: "formed" },
    { id: "formedState", label: "State formed in", type: "state", prefill: "bizState" },
    { id: "bstreet", label: "Business address", type: "text", prefill: "street" },
    { id: "bcity", label: "City", type: "text", prefill: "city" },
    { id: "bstate", label: "State", type: "state", prefill: "state" },
    { id: "bzip", label: "ZIP", type: "zip", prefill: "zip" },
    { id: "activity", label: "Main business activity", type: "text", prefill: "activity" },
    { id: "product", label: "Main product or service", type: "text" },
    { id: "taxYearEnd", label: "Tax year", type: "choice", options: ["Calendar year (ends December 31)", "Fiscal year (ends another month)"] },
    { id: "firstYear", label: "Is this the business's first tax year?", type: YN },
    { id: "finalYear", label: "Is this the final year (closing, selling or merging)?", type: YN },
    { id: "addrChanged", label: "Did the business name or address change this year?", type: YN },
    { id: "bizMkbBefore", label: "Did MKB prepare this business's tax return last year?", type: YN, help: "This is only about who prepared last year's return — not about amending a return.", docsWhen: "No", docs: [doc("Prior-year business return with all schedules", "Prior returns"), doc("Prior-year depreciation schedule", "Prior returns")] },
  ],
};

const ownerRows: Section = {
  id: "owners",
  title: "Owners",
  group: "Owners",
  show: form(...BIZ),
  intro: "Add every owner. Each partner or S-corp shareholder receives a Schedule K-1; corporations list owners of 20% or more.",
  covers: ["Schedule K-1 for each partner / shareholder", "Schedule B-1 / Schedule G — owners of 50% / 20% or more", "Guaranteed payments (1065) and officer compensation (1120-S, 1120)", "Capital accounts and shareholder basis"],
  // Ownership can be less than 100% while owners are still being added, but never more.
  check: (a) => {
    const total = rowsOf(a, "owners").reduce((s, r) => s + (Number(r.opct) || 0), 0);
    return total > 100.0001 ? `Ownership adds up to ${+total.toFixed(4)}% — it can't be more than 100%. Check each owner's percentage.` : undefined;
  },
  repeat: { noun: "owner", rowTitle: (r, i) => r.oname || `Owner ${i + 1}`, rowDocs: (r, a) => (a.__form === "1120-S" && r.obasis === "No" ? [doc(`Shareholder basis history — ${r.oname || "shareholder"}`, "Business")] : []) },
  questions: [
    { id: "oname", label: "Owner's name", type: "text" },
    { id: "okind", label: "Type of owner", type: "choice", options: ["Individual", "Business or other entity", "Trust or estate"] },
    { id: "otin", label: "SSN (individual) or EIN (entity)", type: "tin" },
    { id: "oaddr", label: "Mailing address — street", type: "text", placeholder: "123 Main St, Apt 4" },
    { id: "ocity", label: "City", type: "text" },
    { id: "ostate", label: "State", type: "state" },
    { id: "ozip", label: "ZIP", type: "zip" },
    { id: "opct", label: "Ownership percentage at year-end", type: "percent" },
    { id: "ochange", label: "Did this owner's percentage change during the year (bought, sold, joined, left)?", type: YN },
    { id: "ochangeWhat", label: "What changed and when?", type: "textarea", show: yes("ochange") },
    { id: "orole", label: "Role", type: "choice", options: ["General partner / managing member", "Limited partner / non-managing member"], show: form("1065") },
    { id: "oguaranteed", label: "Guaranteed payments to this partner (paid for services, like a salary)", type: "money", show: form("1065"), optional: true },
    { id: "ocontrib", label: "Money or property this owner put into the business this year", type: "money", optional: true },
    { id: "odistrib", label: "Money or property this owner took out (distributions)", type: "money", optional: true, show: form("1065", "1120-S") },
    { id: "oofficer", label: "Is this owner an officer who works in the business?", type: YN, show: form("1120-S", "1120") },
    { id: "owages", label: "W-2 wages paid to them this year", type: "money", show: all(form("1120-S", "1120"), yes("oofficer")), warn: "S-corp owners who work in the business must be paid a reasonable salary through payroll. Taking only distributions is a common IRS audit issue." },
    { id: "ohealth", label: "Did the company pay their health insurance?", type: YN, show: form("1120-S") },
    { id: "oloan", label: "Loans this owner made to the company (balance at year-end)", type: "money", optional: true, show: form("1120-S", "1065") },
    { id: "obasis", label: "Do you have this shareholder's stock basis from prior years?", type: YN, show: form("1120-S") },
  ],
};

const balance: Section = {
  id: "balance",
  title: "Accounts and balance sheet",
  group: "Assets",
  show: form(...BIZ),
  covers: ["Schedule L — balance sheet", "Schedules M-1 / M-2 — book-to-tax reconciliation", "Schedule B — total assets and receipts tests"],
  questions: [
    { id: "statements", label: "Can you upload December statements for every bank, credit card and loan account?", type: YN, docs: [doc("December statements — all bank, credit card and loan accounts", "Business")] },
    { id: "totalAssets", label: "Total assets at year-end (approximately)", type: "choice", options: ["Under $250,000", "$250,000 – $1 million", "Over $1 million"], help: "Under $250,000 with receipts under $250,000 may not need a full balance sheet." },
    { id: "receipts250", label: "Were total receipts for the year under $250,000?", type: YN },
    { id: "loansOwed", label: "Does the business owe money on loans, lines of credit or SBA/EIDL loans?", type: YN, docs: [doc("Loan statements with year-end balances", "Business")] },
    { id: "ownerLoans", label: "Any loans between the business and its owners?", type: YN },
    { id: "bizCrypto", label: "Did the business receive, sell or exchange any digital assets?", type: YN },
  ],
};

const compliance: Section = {
  id: "compliance",
  title: "Other information",
  group: "Compliance",
  show: form(...BIZ),
  covers: ["Schedule B / Schedule K — other information questions", "State returns and nexus", "Estimated tax payments", "Foreign ownership and accounts (Forms 5472, FBAR)"],
  questions: [
    { id: "otherStates", label: "Did the business have employees, property, or sales in other states?", type: YN, help: "May require state returns there." },
    { id: "whichStates", label: "Which states?", type: "text", show: yes("otherStates") },
    { id: "ownsOther", label: "Does the business own 20% or more of another business?", type: YN },
    { id: "ownedByEntity", label: "Is 50% or more of the business owned by another company, trust or foreign person?", type: YN },
    { id: "foreignAcct", label: "Any foreign bank accounts or foreign owners?", type: YN },
    { id: "bizEstimates", label: "Did the business make estimated tax payments (federal or state)?", type: YN, docs: [doc("Business estimated payment confirmations", "Payments")] },
    { id: "bizEstAmt", label: "Total estimated payments", type: "money", show: yes("bizEstimates") },
    { id: "dividends", label: "Did the corporation pay dividends to shareholders?", type: YN, show: form("1120") },
    { id: "dividendAmt", label: "Total dividends paid", type: "money", show: all(form("1120"), yes("dividends")) },
    { id: "nol", label: "Does the corporation have losses carried over from prior years?", type: YN, show: form("1120") },
    { id: "bizLetters", label: "Did the business receive IRS or state letters this year?", type: YN, docs: [doc("IRS/state letters received (business)", "Notices")] },
    { id: "signer", label: "Who will sign the return? (name and title)", type: "text", help: "A general partner/managing member (1065) or a corporate officer (1120-S, 1120)." },
  ],
};

/* ================================================================== */
/* Finish                                                              */
/* ================================================================== */

const finish: Section = {
  id: "finish",
  title: "Anything else?",
  group: "Finish",
  covers: ["Preparer notes — life events and questions"],
  questions: [
    { id: "lifeEvents", label: "Any big changes this year we should know about?", type: "multi", optional: true, options: ["New baby or adoption", "Marriage or divorce", "Bought or sold a home", "Started or closed a business", "Changed jobs", "Moved states", "Death in the family", "None of these"], show: form("1040", "1040 + Sch C", "1040-X") },
    { id: "notes", label: "Anything else you'd like your preparer to know, or questions you have?", type: "textarea", optional: true },
    { id: "contactPref", label: "If we have a question, how can we reach you? Choose all that work for you.", type: "multi", options: ["Client portal message", "Email", "Text", "Phone call"] },
  ],
};

/* ================================================================== */

const INDIVIDUAL = [amended, you, filing, spouse, seniors, household, dependents, incomeScreen, w2s, investments, retirement, socialSecurity, rentals, k1s, otherIncome, schC, bizIncome, cogs, expenses, people, vehicleQ, vehicles, homeOffice, assets, schCOther, deductions, credits, payments, refund, finish];
const BUSINESS = [entity, ownerRows, bizIncome, cogs, expenses, people, vehicleQ, vehicles, assets, balance, compliance, finish];

/** Sections for a return's form, in interview order. */
export function sectionsFor(f: TaxForm): Section[] {
  if (f === "990") return [];
  return BIZ.includes(f) ? BUSINESS : INDIVIDUAL;
}

export const ownerNoun = owners;

/* ================================================================== */
/* Derived results for the preparer                                    */
/* ================================================================== */

/** Filing status implied by the marital-status answers. */
export function impliedFilingStatus(a: Answers): string | undefined {
  const m = a.marital as string | undefined;
  if (!m) return undefined;
  const deps = a.hasDeps === "Yes";
  const home = a.paidHome === "Yes";
  if (m === "Married") {
    if (a.mfj === "File jointly with my spouse") return "Married filing jointly";
    if (a.mfj === "File separately") return a.livedApart === "Yes" && home && deps ? "Head of household" : "Married filing separately";
    return undefined;
  }
  if (m === "Widowed") {
    if (a.spouseDied === "This year") return "Married filing jointly";
    if ((a.spouseDied === "Last year" || a.spouseDied === "Two years ago") && deps && home) return "Qualifying surviving spouse";
  }
  return deps && home ? "Head of household" : "Single";
}

/** Questions to raise with the preparer: routing mismatches and inconsistencies. */
export function flagsFor(f: TaxForm, a: Answers): string[] {
  const out: string[] = [];
  const rows = (id: string) => (Array.isArray(a[id]) ? (a[id] as Row[]) : []);
  if (f === "1040" && a.se === "Yes") out.push("Self-employment income reported — this return probably needs Schedule C (change the return to 1040 + Sch C).");
  if (f === "1040 + Sch C" && a.bizStructure === "LLC with more than one owner") out.push("Multi-member LLC — usually files a partnership return (Form 1065), not Schedule C.");
  if (f === "1040 + Sch C" && a.bizStructure === "LLC or corporation that elected S-corp status") out.push("S-corp election — the business files Form 1120-S; the owner's return reports the K-1.");
  if (f === "1040 + Sch C" && a.bizMore === "Yes") out.push("Client has another business — an additional Schedule C is needed.");
  if (BIZ.includes(f) && a.structure) {
    const ok = STRUCTURES[f as "1065"]?.includes(a.structure as string);
    if (!ok) out.push(`Client says the business is "${a.structure}", but this return is set up as Form ${f}. Confirm the entity's tax classification.`);
  }
  if (BIZ.includes(f)) {
    const total = rows("owners").reduce((s, r) => s + Number(r.opct || 0), 0);
    if (rows("owners").length && Math.round(total) !== 100) out.push(`Ownership adds up to ${total}%, not 100%.`);
    if (f === "1120-S" && rows("owners").some((r) => r.oofficer === "Yes" && !Number(r.owages))) out.push("An S-corp officer received no W-2 wages — reasonable compensation needs review.");
    if (f === "1120-S" && rows("owners").some((r) => r.okind && r.okind !== "Individual")) out.push("An S-corp shareholder is an entity — most entities can't own S-corp stock. Check eligibility.");
    if (f === "1065" && rows("owners").length === 1) out.push("Only one owner listed — a partnership needs at least two.");
  }
  if (a.foreign === "Yes" && a.fBalance === "$10,000 or more") out.push("Foreign accounts of $10,000 or more — FBAR (FinCEN 114) filing required.");
  if (a.k1 === "Yes" && rows("k1s").some((r) => r.khave === "No")) out.push("Waiting on a K-1 — consider an extension if it hasn't arrived by the deadline.");
  if (a.contractors === "Yes" && a.filed1099 !== "Yes, they're filed") out.push("1099-NEC forms for contractors haven't been filed — due January 31.");
  if (a.rEarly === "Yes" && a.rRollover !== "Yes") out.push("Early retirement withdrawal — check for the 10% penalty and any exception.");
  if (a.rRmd === "No, or not from every account") out.push("Possible missed RMD — ask the client to take it now and consider requesting a penalty waiver (Form 5329).");
  if (a.rRmd === "Not sure") out.push("Client isn't sure their RMDs were taken — confirm with the IRA custodian.");
  if (a.rQcd === "Yes") out.push("Qualified charitable distribution — exclude it from taxable IRA income (\"QCD\" on line 4b) and don't deduct it again as a donation.");
  if (senior(a) && a.ssa === "Yes" && a.ssaWithheld !== "Yes" && a.rWithheld !== "Yes" && a.estimates !== "Yes") out.push("Retirement income with no withholding or estimates — the client may owe; suggest Form W-4V or estimated payments.");
  if (a.srAssist === "Please go through it with me by phone") out.push("Client asked to finish the interview by phone — schedule a call.");
  if (a.srAssist === "I'd like an appointment in the office") out.push("Client asked to finish the interview in the office — schedule an appointment.");
  if (a.srHelperTalk === "Yes") out.push("Send Form 8821 (or 2848) so MKB may speak with the client's helper.");
  if (rows("vehicles").some((r) => r.vlog === "No")) out.push("Vehicle used for business without a mileage log — ask the client to reconstruct one.");
  if (a.usesVehicle === "Yes" && rows("vehicles").some((r) => Number(r.vbiz) > Number(r.vtotal))) out.push("Business miles are higher than total miles for a vehicle.");
  return out;
}

/** Schedules and forms the answers indicate, with matching price codes. */
export function returnNeeds(f: TaxForm, a: Answers): { label: string; code?: string; qty?: number }[] {
  const rows = (id: string) => (Array.isArray(a[id]) ? (a[id] as Row[]) : []);
  const out: { label: string; code?: string; qty?: number }[] = [];
  const add = (label: string, code?: string, qty?: number) => out.push({ label, code, qty });
  if (BIZ.includes(f)) {
    const n = rows("owners").length;
    if (f !== "1120" && n) add(`Schedule K-1 × ${n}`, "K1", n);
    if (a.inventory === "Yes") add("Form 1125-A (cost of goods sold)");
    if (a.bought === "Yes" || a.usesVehicle === "Yes") add("Form 4562 (depreciation)");
    if (a.totalAssets && a.totalAssets !== "Under $250,000") add("Schedule L balance sheet");
    const st = new Set<string>([a.bstate as string].filter(Boolean));
    if (a.otherStates === "Yes" && a.whichStates) (a.whichStates as string).split(/[,\s]+/).filter((x) => x.length === 2).forEach((x) => st.add(x.toUpperCase()));
    if (st.size) add(`State business return${st.size > 1 ? "s" : ""}: ${[...st].join(", ")}`, "STATE-B", st.size);
    if (a.contractors === "Yes" && a.filed1099 === "No — I'd like MKB to file them") add("1099-NEC filing for contractors", "PAY", 1);
    return out;
  }
  if (f === "1040 + Sch C") { add("Schedule C", "SCHC"); add("Schedule SE"); }
  if (a.ho === "Yes") add("Form 8829 (home office)");
  if (a.bought === "Yes" || a.usesVehicle === "Yes") add("Form 4562 (depreciation)");
  const rentalsN = rows("rentals").length;
  if (rentalsN) add(`Schedule E — ${rentalsN} propert${rentalsN > 1 ? "ies" : "y"}`, "SCHE", rentalsN);
  if (rows("k1s").length) add(`Schedule E Part II — ${rows("k1s").length} K-1(s)`);
  if (a.invest === "Yes" || (a.crypto === "Yes" && a.cryptoActivity !== "Bought and held only") || a.homesale === "Yes") add("Schedule D / Form 8949", "SCHD");
  if (a.interest === "Yes") add("Schedule B");
  if (a.mortgage === "Yes" || a.charity === "Yes" || a.medical === "Yes" || a.propTax === "Yes") add("Schedule A (compare with standard deduction)", "SCHA");
  if (rows("deps").length) add(`Dependents & credits — ${rows("deps").length} dependent(s)`, "DEP");
  if (a.childcare === "Yes") add("Form 2441 (child care credit)");
  if (a.tuition === "Yes") add("Form 8863 (education credits)");
  if (a.marketplace === "Yes") add("Form 8962 (premium tax credit)");
  if (a.hsa === "Yes") add("Form 8889 (HSA)");
  if (a.energy === "Yes") add("Form 5695 / 8936 (energy or vehicle credit)");
  if (a.foreign === "Yes" && a.fBalance === "$10,000 or more") add("FinCEN 114 (FBAR)");
  if (senior(a)) {
    if (a.srForm === "Yes") add("File on Form 1040-SR");
    add("Additional standard deduction for 65+");
    add("Senior deduction for 65+ (2025–2028) — check income limit");
    if (a.srDisabled === "Yes") add("Schedule R (credit for the elderly or disabled) — check income limits");
    if (a.state) add(`${a.state} retirement income exclusion — check state rules`);
  }
  if (a.rQcd === "Yes") add("Qualified charitable distribution (QCD) on line 4b");
  if (a.ssa === "Yes") add("Social Security benefits worksheet");
  const st = new Set<string>([a.state as string, a.moved === "Yes" ? (a.prevState as string) : "", ...rows("w2s").map((r) => r.wstate)].filter(Boolean));
  if (st.size) add(`State return${st.size > 1 ? "s" : ""}: ${[...st].join(", ")}`, "STATE", st.size);
  return out;
}

export { has, gt };
