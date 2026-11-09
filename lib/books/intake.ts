/**
 * Bookkeeping client intake — everything MKB needs to set up and run a
 * business's books: who they are, where the money moves, what's behind, what
 * they want each month. Uses the same guided-interview engine as the tax
 * interview (branching questions, repeating rows, document list).
 *
 * Sensitive data: the EIN goes to the client's encrypted vault; bank, card and
 * loan accounts are collected as the last 4 digits only.
 */
import type { DocSpec } from "@/lib/tax/config";
import { all, has, is, not, rowsOf, yes, type Answers, type Q, type Section } from "@/lib/tax/interview/engine";
import type { BooksPlan } from "@/lib/fees/config";

const YN = "yesno" as const;
const doc = (name: string, category: string, sensitive = false): DocSpec => ({ name, category, sensitive });
const LLC = is("entity", "Single-member LLC", "Multi-member LLC");

export const BOOKS_INTAKE_VERSION = { version: "1.0", status: "Draft" };

const business: Section = {
  id: "business",
  title: "Your business",
  group: "About the business",
  intro: "The basics we need to set up your books correctly.",
  covers: ["Business profile", "Entity and tax classification", "Fiscal year"],
  questions: [
    { id: "legalName", label: "Legal business name", type: "text", prefill: "bizName" },
    { id: "dba", label: "Doing business as (DBA / trade name)", type: "text", optional: true },
    { id: "entity", label: "Type of business", type: "choice", options: ["Sole proprietorship", "Single-member LLC", "Multi-member LLC", "S corporation", "C corporation", "Partnership", "Nonprofit"] },
    { id: "llcTax", label: "How is the LLC taxed?", type: "choice", options: ["Default (Schedule C or partnership)", "Elected S corporation", "Elected C corporation", "Not sure"], show: LLC, help: "If you filed IRS Form 2553 or 8832, the LLC elected to be taxed as a corporation." },
    { id: "ein", label: "Employer Identification Number (EIN)", type: "ein", prefill: "ein", show: not(is("entity", "Sole proprietorship")), help: "Stored encrypted. Only the last 4 digits are shown afterwards." },
    { id: "einSole", label: "Does the business have its own EIN?", type: YN, show: is("entity", "Sole proprietorship") },
    { id: "einSoleNum", label: "EIN", type: "ein", show: all(is("entity", "Sole proprietorship"), yes("einSole")) },
    { id: "formState", label: "State where the business was formed or registered", type: "state", prefill: "bizState" },
    { id: "formed", label: "Date the business started", type: "date", prefill: "formed" },
    { id: "industry", label: "Industry", type: "choice", options: ["Retail / e-commerce", "Restaurant / food service", "Construction / trades", "Professional services", "Health / wellness / beauty", "Real estate", "Transportation / trucking", "Cleaning / home services", "Childcare / education", "Creative / media", "Nonprofit", "Other"] },
    { id: "industryOther", label: "What industry?", type: "text", show: is("industry", "Other") },
    { id: "describe", label: "In a sentence or two, what does the business sell or do?", type: "textarea" },
    { id: "fyEnd", label: "When does your business year end?", type: "choice", options: ["December 31 (calendar year)", "Another month"], help: "Most small businesses use the calendar year." },
    { id: "fyEndMonth", label: "Which month does the business year end?", type: "choice", options: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November"], show: is("fyEnd", "Another month") },
    { id: "accounting", label: "Do you want your books kept on a cash or accrual basis?", type: "choice", options: ["Cash (record when money moves)", "Accrual (record when earned / billed)", "Not sure — recommend one"], help: "Most small businesses use cash basis." },
  ],
};

const contact: Section = {
  id: "contact",
  title: "Business address and contact",
  group: "About the business",
  covers: ["Business address", "Contact details"],
  questions: [
    { id: "street", label: "Business street address", type: "text", prefill: "street" },
    { id: "city", label: "City", type: "text", prefill: "city" },
    { id: "state", label: "State", type: "state", prefill: "state" },
    { id: "zip", label: "ZIP", type: "zip", prefill: "zip" },
    { id: "phone", label: "Business phone", type: "phone", prefill: "phone" },
    { id: "email", label: "Business email", type: "email", prefill: "email" },
    { id: "website", label: "Website", type: "text", optional: true },
    { id: "locations", label: "How many locations does the business operate from?", type: "number" },
    { id: "otherStates", label: "Do you sell, have employees, or have property in any other state?", type: YN },
    { id: "otherStatesWhich", label: "Which states?", type: "text", show: yes("otherStates") },
  ],
};

const people: Section = {
  id: "owners",
  title: "Owners and decision makers",
  group: "About the business",
  intro: "Everyone who owns part of the business, and anyone allowed to answer our questions or approve the books.",
  covers: ["Ownership", "Authorized contacts"],
  check: (a) => {
    const t = rowsOf(a, "owners").reduce((s, r) => s + (Number(r.pct) || 0), 0);
    return t > 100.0001 ? `Ownership adds up to ${+t.toFixed(4)}% — it can't be more than 100%.` : undefined;
  },
  repeat: { noun: "person", rowTitle: (r, i) => r.name || `Person ${i + 1}` },
  questions: [
    { id: "name", label: "Full name", type: "text" },
    { id: "title", label: "Title or role", type: "text", placeholder: "Owner, CEO, Office manager…" },
    { id: "pct", label: "Ownership percentage", type: "percent", help: "Enter 0 if this person doesn't own part of the business." },
    { id: "email", label: "Email", type: "email" },
    { id: "phone", label: "Phone", type: "phone" },
    { id: "approve", label: "Can this person answer our questions and approve the books?", type: YN },
  ],
};

const software: Section = {
  id: "software",
  title: "Accounting software and apps",
  group: "Your books today",
  covers: ["Accounting system", "Connected apps"],
  questions: [
    { id: "system", label: "What do you use to keep your books today?", type: "choice", options: ["QuickBooks Online", "QuickBooks Desktop", "Xero", "Wave", "FreshBooks", "Spreadsheets", "Paper / receipts only", "Nothing yet", "Other"] },
    { id: "systemOther", label: "Which software?", type: "text", show: is("system", "Other") },
    { id: "qboPlan", label: "Which QuickBooks Online plan?", type: "choice", options: ["Simple Start", "Essentials", "Plus", "Advanced", "Not sure"], show: is("system", "QuickBooks Online") },
    { id: "qboInvite", label: "Can you invite MKB as your accountant user in QuickBooks?", type: YN, show: is("system", "QuickBooks Online"), help: "In QuickBooks: Settings (gear) → Manage users → Accountants → Invite, then enter our email.", warn: "We'll need access to your QuickBooks to start. We'll walk you through the invite.", warnWhen: "No" },
    { id: "bankFeeds", label: "Are your bank and credit card accounts connected to QuickBooks (bank feeds)?", type: "choice", options: ["Yes, all of them", "Some of them", "No", "Not sure"], show: is("system", "QuickBooks Online") },
    { id: "desktopMove", label: "Would you like us to move you to QuickBooks Online?", type: "choice", options: ["Yes", "No — stay on Desktop", "Let's discuss"], show: is("system", "QuickBooks Desktop") },
    { id: "setupQbo", label: "Would you like MKB to set up QuickBooks Online for you?", type: "choice", options: ["Yes", "No", "Let's discuss"], show: is("system", "Spreadsheets", "Paper / receipts only", "Nothing yet", "Wave", "FreshBooks", "Other"), help: "You own the subscription and the data; it's billed by Intuit to you." },
    { id: "apps", label: "Which other apps does the business use? (choose all that apply)", type: "multi", options: ["Square", "Stripe", "PayPal", "Shopify", "Clover", "Toast", "Amazon", "Etsy", "Gusto", "ADP", "Paychex", "QuickBooks Payroll", "Bill.com", "Expensify", "Housecall Pro / Jobber", "None", "Other"] },
    { id: "appsOther", label: "Which other apps?", type: "text", show: has("apps", "Other") },
  ],
};

const status: Section = {
  id: "status",
  title: "Where your books stand",
  group: "Your books today",
  intro: "This tells us whether we start fresh this month or need to catch up first.",
  covers: ["Catch-up scope", "Opening balances", "Prior bookkeeper"],
  questions: [
    { id: "upToDate", label: "How up to date are your books?", type: "choice", options: ["Current — reconciled through last month", "Behind a few months", "Behind a year or more", "Never been kept", "Not sure"] },
    { id: "lastReconciled", label: "About when were the books last reconciled?", type: "text", placeholder: "e.g. June 2025", show: is("upToDate", "Behind a few months", "Behind a year or more", "Not sure") },
    { id: "catchUpFrom", label: "From what month do the books need to be caught up?", type: "text", placeholder: "e.g. January 2025", show: not(is("upToDate", "Current — reconciled through last month")), help: "Usually the start of the last year a tax return wasn't filed from good books. Catch-up work is quoted separately." },
    { id: "keptBy", label: "Who has been keeping the books?", type: "choice", options: ["I do it myself", "An employee", "An outside bookkeeper or CPA", "No one"] },
    { id: "priorAccess", label: "Can we get files or access from the previous bookkeeper?", type: YN, show: is("keptBy", "An outside bookkeeper or CPA") },
    { id: "priorFinancials", label: "Do you have a balance sheet or financial statements from the end of last year?", type: YN, docs: [doc("Prior year-end balance sheet and profit & loss", "Financial statements")] },
    { id: "lastReturnYear", label: "Most recent year the business filed a tax return", type: "year", optional: true },
    { id: "lastReturnBy", label: "Who prepared that return?", type: "choice", options: ["MKB", "Another preparer", "We did it ourselves", "Not filed yet"], docsWhen: "Another preparer", docs: [doc("Most recent business tax return (all pages)", "Tax returns", true)] },
    { id: "unfiled", label: "Are any business tax returns unfiled or late?", type: YN, warn: "Let us know now — catching up unfiled returns early limits penalties. Your bookkeeper will coordinate with tax preparation.", warnWhen: "Yes" },
  ],
};

const accounts: Section = {
  id: "accounts",
  title: "Bank, credit card and payment accounts",
  group: "Money accounts",
  intro: "List every account the business uses — checking, savings, credit cards, lines of credit, and payment-app balances (PayPal, Square, Cash App Business). Only the last 4 digits; never enter full account numbers.",
  covers: ["Accounts to reconcile", "Statement access", "Commingling"],
  repeat: {
    noun: "account",
    rowTitle: (r, i) => [r.bank, r.kind, r.last4 && `••••${r.last4}`].filter(Boolean).join(" · ") || `Account ${i + 1}`,
    rowDocs: (r) => [doc(`Statements for the last 3 months — ${[r.bank, r.kind, r.last4 && `••••${r.last4}`].filter(Boolean).join(" ")}`.trim(), "Bank statements", true)],
  },
  questions: [
    { id: "kind", label: "Type of account", type: "choice", options: ["Checking", "Savings", "Credit card", "Line of credit", "Payment app (PayPal, Square, Cash App…)", "Merchant / clearing account", "Other"] },
    { id: "bank", label: "Bank or company", type: "text", placeholder: "e.g. Chase, Capital One, PayPal" },
    { id: "last4", label: "Last 4 digits of the account or card", type: "last4" },
    { id: "nickname", label: "What is it used for?", type: "text", placeholder: "e.g. Operating account, Payroll, Company card", optional: true },
    { id: "personal", label: "Is this account also used for personal spending?", type: YN, warn: "Mixing personal and business money makes the books harder (and costlier) and can weaken an LLC's liability protection. We recommend a separate business account.", warnWhen: "Yes" },
    { id: "access", label: "How will we get the statements?", type: "choice", options: ["Bank feed in the accounting software", "I'll upload statements each month", "Read-only access for MKB", "Not sure"] },
    { id: "opened", label: "Was this account opened or closed this year?", type: YN, optional: true },
  ],
};

const debts: Section = {
  id: "debtsQ",
  title: "Loans and financing",
  group: "Money accounts",
  covers: ["Loans, leases and financing"],
  questions: [
    { id: "hasLoans", label: "Does the business have any loans, lines of credit, equipment or vehicle financing, SBA/EIDL loans, or merchant cash advances?", type: YN },
    { id: "ownerLoans", label: "Has an owner lent money to the business, or borrowed from it?", type: YN, docs: [doc("Owner loan details or agreements", "Loans")] },
    { id: "leases", label: "Does the business lease property, vehicles or equipment?", type: YN, docs: [doc("Current lease agreements", "Leases")] },
  ],
};

const loans: Section = {
  id: "loans",
  title: "Loan details",
  group: "Money accounts",
  show: yes("hasLoans"),
  covers: ["Loan balances and payments"],
  repeat: { noun: "loan", rowTitle: (r, i) => r.lender || `Loan ${i + 1}`, rowDocs: (r) => [doc(`Latest loan statement — ${r.lender || "loan"}${r.last4 ? ` ••••${r.last4}` : ""}`, "Loans", true)] },
  questions: [
    { id: "lender", label: "Lender", type: "text" },
    { id: "type", label: "Type", type: "choice", options: ["Bank or SBA loan", "EIDL", "Line of credit", "Equipment financing", "Vehicle loan", "Merchant cash advance", "Personal loan used for the business", "Other"] },
    { id: "last4", label: "Last 4 digits of the loan number", type: "last4", optional: true },
    { id: "original", label: "Original amount", type: "money" },
    { id: "balance", label: "Current balance (about)", type: "money" },
    { id: "payment", label: "Monthly payment", type: "money" },
    { id: "start", label: "Start date", type: "date", optional: true },
  ],
};

const income: Section = {
  id: "income",
  title: "Money coming in",
  group: "Income",
  covers: ["Revenue sources", "Payment processors", "Customer invoicing", "Sales tax"],
  docs: (a) => [
    ...((a.channels as string | undefined)?.split("|").some((c) => ["Card terminal / point of sale", "Online store", "Payment apps (Cash App, Zelle, Venmo, PayPal)", "Marketplace (Amazon, Etsy, eBay)"].includes(c)) ? [doc("Processor / payment-app monthly statements or payout reports (last 3 months)", "Income")] : []),
  ],
  questions: [
    { id: "revenue", label: "About how much does the business bring in per year?", type: "choice", options: ["Under $50,000", "$50,000 – $150,000", "$150,000 – $500,000", "$500,000 – $1 million", "Over $1 million", "Brand new — no sales yet"] },
    { id: "channels", label: "How do customers pay you? (choose all that apply)", type: "multi", options: ["Cash", "Checks", "Card terminal / point of sale", "Online store", "Payment apps (Cash App, Zelle, Venmo, PayPal)", "Invoices paid later (net terms)", "Marketplace (Amazon, Etsy, eBay)", "Insurance or government payments", "Other"] },
    { id: "cashHow", label: "How are cash sales recorded and deposited?", type: "textarea", show: has("channels", "Cash"), warn: "All cash income is taxable. Deposit cash regularly and keep a daily sales log so the books match." },
    { id: "invoices", label: "Do you send invoices and track who owes you money?", type: YN, show: has("channels", "Invoices paid later (net terms)") },
    { id: "invoiceTool", label: "What do you use to send invoices?", type: "text", show: yes("invoices"), optional: true },
    { id: "deposits", label: "Do customers pay deposits or retainers before the work is done?", type: YN },
    { id: "refunds", label: "Do you give refunds or chargebacks regularly?", type: YN, optional: true },
    { id: "salesTax", label: "Does the business collect sales tax?", type: YN },
    { id: "salesTaxStates", label: "Which states or parishes do you file sales tax in?", type: "text", show: yes("salesTax") },
    { id: "salesTaxFreq", label: "How often do you file sales tax?", type: "choice", options: ["Monthly", "Quarterly", "Yearly", "Not sure"], show: yes("salesTax") },
    { id: "salesTaxWho", label: "Who files the sales tax returns?", type: "choice", options: ["We do", "Our software files automatically", "We'd like MKB to", "Not sure"], show: yes("salesTax"), docsWhen: "We do", docs: [doc("Last 2 sales tax returns filed", "Sales tax")] },
    { id: "salesTaxShould", label: "Do you sell taxable products or services but don't collect sales tax?", type: YN, show: not(yes("salesTax")), warn: "You may be required to collect sales tax. We'll review this with you — uncollected sales tax can become a business debt.", warnWhen: "Yes" },
  ],
};

const spending: Section = {
  id: "spending",
  title: "Money going out",
  group: "Expenses",
  covers: ["How bills are paid", "Receipts", "Inventory", "Vehicles", "Assets"],
  questions: [
    { id: "payHow", label: "How does the business pay its bills? (choose all that apply)", type: "multi", options: ["Business debit card", "Business credit card", "Checks", "Online bank payments (ACH)", "Cash", "Personal card or account (sometimes)"] },
    { id: "personalPaid", label: "Do owners ever pay business expenses with personal money?", type: YN, warn: "Keep those receipts — we'll record them as owner contributions or reimburse them properly so you get the deduction.", warnWhen: "Yes" },
    { id: "receipts", label: "How do you keep receipts?", type: "choice", options: ["Photos in an app", "Email folder", "Paper receipts", "I don't keep them consistently"], warn: "The IRS expects receipts for business expenses. We'll set you up with a simple way to snap and send them.", warnWhen: "I don't keep them consistently" },
    { id: "bills", label: "Do you have regular vendor bills to track (rent, suppliers, utilities)?", type: YN },
    { id: "inventory", label: "Does the business buy or hold inventory (products for resale, materials)?", type: YN },
    { id: "invMethod", label: "How do you track inventory?", type: "choice", options: ["Point-of-sale or inventory software", "Spreadsheet", "Physical count only", "We don't track it"], show: yes("inventory") },
    { id: "invCount", label: "Do you count inventory at year-end?", type: YN, show: yes("inventory"), docs: [doc("Most recent inventory count or report", "Inventory")] },
    { id: "vehicles", label: "Does the business use vehicles?", type: YN },
    { id: "vehicleCount", label: "How many vehicles?", type: "number", show: yes("vehicles") },
    { id: "vehicleOwner", label: "Who owns them?", type: "choice", options: ["The business", "The owner (personal vehicles)", "Both"], show: yes("vehicles") },
    { id: "mileage", label: "Do you keep a mileage log?", type: YN, show: yes("vehicles"), warn: "A mileage log is required to deduct vehicle use. Apps like MileIQ or QuickBooks mileage tracking make this easy.", warnWhen: "No" },
    { id: "assets", label: "Did the business buy equipment, furniture, computers or other assets over $2,500 this year?", type: YN, docs: [doc("Receipts or invoices for equipment and asset purchases", "Assets")] },
    { id: "homeOffice", label: "Does an owner work from a home office?", type: YN },
  ],
};

const payroll: Section = {
  id: "payroll",
  title: "Employees, contractors and owner pay",
  group: "People",
  covers: ["Payroll", "1099 contractors", "Owner compensation"],
  docs: (a) => [
    ...(a.hasEmployees === "Yes" ? [doc("Payroll summary reports for this year (by month or quarter)", "Payroll"), doc("Last quarterly payroll tax returns (Form 941 and state)", "Payroll", true)] : []),
    ...(a.contractors === "Yes" ? [doc("List of contractors with W-9 forms", "Contractors", true)] : []),
  ],
  questions: [
    { id: "hasEmployees", label: "Does the business have employees on payroll (W-2)?", type: YN },
    { id: "employeeCount", label: "How many employees?", type: "number", show: yes("hasEmployees") },
    { id: "payrollBy", label: "Who runs payroll?", type: "choice", options: ["Gusto", "ADP", "Paychex", "QuickBooks Payroll", "OnPay", "We do it by hand", "Other"], show: yes("hasEmployees") },
    { id: "payFreq", label: "How often is payroll run?", type: "choice", options: ["Weekly", "Every two weeks", "Twice a month", "Monthly"], show: yes("hasEmployees") },
    { id: "payrollTaxes", label: "Are payroll taxes deposited and filed by the payroll provider?", type: "choice", options: ["Yes", "No — we do it", "Not sure"], show: yes("hasEmployees"), warn: "Unpaid payroll taxes carry heavy penalties and owners can be held personally responsible. We'll check this first.", warnWhen: "Not sure" },
    { id: "contractors", label: "Does the business pay independent contractors (1099 workers)?", type: YN },
    { id: "contractorCount", label: "About how many contractors per year?", type: "number", show: yes("contractors") },
    { id: "w9", label: "Do you have a signed W-9 for every contractor?", type: YN, show: yes("contractors"), warn: "Get a W-9 before paying a contractor. Without it, filing their 1099 by January 31 is difficult and penalties can apply.", warnWhen: "No" },
    { id: "file1099", label: "Who files 1099s for your contractors?", type: "choice", options: ["We do", "Our payroll or accounting software", "We'd like MKB to", "They haven't been filed"], show: yes("contractors") },
    { id: "ownerPay", label: "How do the owners get paid?", type: "choice", options: ["Owner draws / transfers", "Salary through payroll", "Guaranteed payments (partnership)", "Not paid yet", "Not sure"] },
    { id: "ownerPayWarn", label: "Is the business taxed as an S corporation?", type: YN, show: is("ownerPay", "Owner draws / transfers"), warn: "S-corp owners who work in the business must receive a reasonable salary through payroll — draws alone are a common IRS issue. We'll review this with you.", warnWhen: "Yes" },
  ],
};

const taxes: Section = {
  id: "taxes",
  title: "Taxes and compliance",
  group: "Taxes",
  covers: ["Estimated taxes", "Other tax accounts", "Notices", "Licenses"],
  // Every bookkeeping client needs these on file, whatever they answer.
  docs: (a) => [
    ...(a.entity && a.entity !== "Sole proprietorship" ? [doc("Formation documents (articles, operating agreement or bylaws)", "Formation")] : []),
    ...(a.entity !== "Sole proprietorship" || a.einSole === "Yes" ? [doc("IRS EIN confirmation letter (CP 575 or 147C)", "Formation", true)] : []),
    ...(a.llcTax === "Elected S corporation" || a.entity === "S corporation" ? [doc("IRS S-election acceptance letter (Form 2553 approval)", "Formation", true)] : []),
  ],
  questions: [
    { id: "estimates", label: "Does the business or owner make quarterly estimated tax payments?", type: YN },
    { id: "estimateWho", label: "Who calculates them?", type: "choice", options: ["MKB", "Another preparer", "We do", "Not sure"], show: yes("estimates") },
    { id: "taxAccounts", label: "Which tax accounts does the business have? (choose all that apply)", type: "multi", options: ["Sales tax", "Payroll / withholding", "State unemployment", "Local / parish business tax", "Excise tax", "None that I know of"] },
    { id: "notices", label: "Any IRS or state notices, or tax balances owed?", type: YN, warn: "Send us copies right away — notices have deadlines.", warnWhen: "Yes", docs: [doc("Copies of IRS or state notices", "Notices", true)] },
    { id: "license", label: "Does the business need licenses or permits that renew?", type: YN, optional: true },
    { id: "formationDocs", label: "Do you have copies of the business formation documents and EIN letter?", type: YN, help: "Articles of organization or incorporation, operating agreement or bylaws, and the IRS EIN letter (CP 575 or 147C).", warn: "No problem — we'll help you request copies from the state and the IRS. We need them on file.", warnWhen: "No" },
  ],
};

const goals: Section = {
  id: "goals",
  title: "Reports, goals and your plan",
  group: "What you need",
  covers: ["Monthly reports", "Review meetings", "Plan sizing"],
  questions: [
    { id: "volume", label: "About how many transactions go through the business accounts each month?", type: "choice", options: ["Under 150", "150 – 400", "400 – 750", "750 – 1,500", "Over 1,500", "Not sure"], help: "Count every deposit, card swipe and payment across all accounts. A busy checking account plus one credit card is often 150–400." },
    { id: "reports", label: "Which reports do you want each month? (choose all that apply)", type: "multi", options: ["Profit and Loss", "Balance Sheet", "Cash Flow Statement", "Who owes us (A/R aging)", "Who we owe (A/P aging)", "Budget vs. actual", "Sales by customer", "Expenses by vendor", "Profit by job or location"] },
    { id: "review", label: "How would you like to go over your numbers?", type: "choice", options: ["Monthly review call", "Quarterly review call", "Email summary is fine"] },
    { id: "sharedWith", label: "Who else uses your financial reports? (choose all that apply)", type: "multi", options: ["Just the owners", "Bank or lender", "Investors or partners", "Grant funders", "Tax preparer"], optional: true },
    { id: "goal", label: "What do you most want from your bookkeeping?", type: "textarea", placeholder: "e.g. Know my real profit, get ready for a loan, stop scrambling at tax time…" },
    { id: "deadline", label: "Any deadline coming up? (loan application, tax filing, audit)", type: "text", optional: true },
  ],
};

const finish: Section = {
  id: "finish",
  title: "Anything else",
  group: "Finish",
  covers: ["Communication preferences"],
  questions: [
    { id: "contactPref", label: "How should we reach you? (choose all that apply)", type: "multi", options: ["Phone call", "Text", "Email", "Client portal messages"] },
    { id: "bestTime", label: "Best time to reach you", type: "choice", options: ["Mornings", "Afternoons", "Evenings", "Any time"] },
    { id: "notes", label: "Anything else we should know?", type: "textarea", optional: true },
  ],
};

export const BOOKS_SECTIONS: Section[] = [business, contact, people, software, status, accounts, debts, loans, income, spending, payroll, taxes, goals, finish];

/** Plan that fits the stated volume and number of accounts (using the plan limits in Settings → Fees). */
export function recommendPlan(a: Answers, plans: BooksPlan[]) {
  const accts = rowsOf(a, "accounts").length;
  const tx = ({ "Under 150": 150, "150 – 400": 400, "400 – 750": 750, "750 – 1,500": 1500, "Over 1,500": 1501 } as Record<string, number>)[(a.volume as string) ?? ""] ?? 0;
  const sorted = [...plans].sort((x, y) => x.fee - y.fee);
  return sorted.find((p) => p.transactions >= tx && p.accounts >= accts) ?? sorted[sorted.length - 1];
}

/** Reports the workspace should produce, mapped from the intake answer. */
export function reportsFrom(a: Answers): ("Profit and Loss" | "Balance Sheet" | "Cash Flow Statement")[] {
  const chosen = ((a.reports as string) ?? "").split("|");
  const core = (["Profit and Loss", "Balance Sheet", "Cash Flow Statement"] as const).filter((r) => chosen.includes(r));
  return core.length ? [...core] : ["Profit and Loss", "Balance Sheet"];
}

export const ENTITY_TO_WORKSPACE: Record<string, string> = {
  "Sole proprietorship": "Sole proprietorship", "Single-member LLC": "LLC", "Multi-member LLC": "LLC", "S corporation": "S Corporation", "C corporation": "C Corporation", Partnership: "Partnership", Nonprofit: "Nonprofit",
};

export type { Q, Answers };
