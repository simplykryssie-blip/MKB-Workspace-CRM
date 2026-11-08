/**
 * Engagement letters: default wording (version 1). Staff edit them in
 * Settings → Engagement letters; every saved edit becomes a new version and
 * each client's acceptance records the exact versions they agreed to.
 *
 * DRAFT wording — MKB's attorney should review before clients sign.
 *
 * Format: "## " starts a heading, "- " starts a bullet, a blank line starts a
 * new paragraph. Placeholders in {{double braces}} are filled in when shown.
 */

export type LetterKey = "terms" | "tax_individual" | "tax_business" | "books" | "biz" | "exp";
export type Letter = { key: LetterKey; title: string; body: string; version: number; updatedAt?: string; updatedBy?: string };

export const LETTER_INFO: Record<LetterKey, { name: string; when: string }> = {
  terms: { name: "Standard terms", when: "Part of every engagement letter (all services)." },
  tax_individual: { name: "Individual tax preparation", when: "Accepted with the individual tax interview (1040, Schedule C, 1040-X, extensions)." },
  tax_business: { name: "Business tax preparation", when: "Accepted with the business tax interview (1065, 1120-S, 1120, 990)." },
  books: { name: "Bookkeeping", when: "Accepted when a bookkeeping plan starts." },
  biz: { name: "Business services", when: "Accepted when a business service request starts." },
  exp: { name: "Record expungement", when: "Accepted when an expungement matter opens." },
};

export const LETTER_KEYS = Object.keys(LETTER_INFO) as LetterKey[];

export const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "clientName", label: "Client's full name (or business name)" },
  { key: "date", label: "Today's date" },
  { key: "taxYear", label: "Tax year (tax letters)" },
  { key: "service", label: "Service or plan name" },
  { key: "fee", label: "Fee or monthly plan price, if known" },
  { key: "lateGrace", label: "Days before a payment is late (Settings → Fees)" },
  { key: "lateAdmin", label: "Late admin fee (Settings → Fees)" },
  { key: "lateRate", label: "Late interest rate (Settings → Fees)" },
  { key: "courtDays", label: "Days late before court action (Settings → Fees)" },
  { key: "booksOverage", label: "Bookkeeping overage rates (Settings → Fees)" },
  { key: "upgradeMonths", label: "Months over the limit before a plan change (Settings → Fees)" },
  { key: "expungeFee", label: "Expungement fee wording (Settings → Fees)" },
];

const T = (title: string, body: string) => ({ title, body: body.trim() });

export const DEFAULT_LETTERS: Record<LetterKey, { title: string; body: string }> = {
  terms: T("Standard Terms of Engagement", `
These standard terms are part of every engagement between {{clientName}} ("you") and MKB Financial Group LLC ("MKB", "we", "us"). They apply together with the letter for the service you chose. If the two ever conflict, the service letter controls.

## Who we are
MKB Financial Group LLC is a tax preparation and business services firm. Our tax preparers hold Preparer Tax Identification Numbers (PTINs) and participate in the IRS Annual Filing Season Program (AFSP). We are not a CPA firm or a law firm, and we do not give legal advice.

Because of our AFSP status, we may represent you before the IRS only for returns we prepared and signed, and only before IRS revenue agents, customer service representatives and similar employees, including the Taxpayer Advocate Service. We cannot represent you in IRS appeals, collections or Tax Court. If you need that kind of help, we will tell you and can refer you to an Enrolled Agent, CPA or attorney.

## Your responsibilities
- Give us complete, accurate and timely information and documents.
- Keep your original records and receipts. We work from copies.
- Answer our questions honestly, including the due diligence questions the IRS requires us to ask for certain credits and filing statuses.
- Review your return or work product carefully before you sign or approve it. You are legally responsible for the accuracy of your own returns and filings.
- Tell us promptly about changes to your address, family, business or finances.

## Our responsibilities
- Prepare your work using the information you provide and current law, with professional care.
- Ask follow-up questions when something is unclear, missing or inconsistent.
- Keep your information confidential and secure.

We do not audit or independently verify the information you give us, although we may ask for documents to support it. Our work cannot be relied on to find errors, fraud or theft.

## Fees and payment
Fees are listed on your invoice and our fee schedule. Unless your service letter says otherwise, fees are due before we file or deliver your work.

For tax returns, you may pay upfront or, when available, have our fees taken from your refund through a refund transfer bank product. Bank product fees are charged by the bank, not by MKB, and are shown separately. We do not control or guarantee when the IRS or a state releases a refund, or its amount.

If your refund is reduced, delayed, offset or intercepted (for example, for back taxes, child support or student loans), you still owe our fees and agree to pay them directly within 15 days of our invoice.

Fees are non-refundable once work has started. We may hold work we prepared until fees are paid, but we will always return your original records.

## Late payments
- If fees are not paid within {{lateGrace}} days of the due date, a {{lateAdmin}} late administrative fee is added.
- After that, the unpaid balance accrues interest at {{lateRate}} until paid.
- If fees remain unpaid {{courtDays}} days after the due date, MKB may pursue collection, including filing suit in court, and you agree to pay reasonable collection costs and attorney fees allowed by law.

## IRS and state notices
If you receive a notice about a return we prepared, send it to us right away.
- Simple notices (for example, a request to verify your identity or information, or a small math or document correction) are handled at no charge.
- Complex notices (for example, audits or examinations, proposed changes to your tax, penalties, collections or anything that needs extensive research or correspondence) are a separate service. We will quote the fee before we begin.

## LegalShield (optional)
We may share information about LegalShield, a separate company that offers prepaid legal plans. LegalShield is not part of MKB's services and enrolling is completely optional.

Someone connected to MKB may earn a commission if you enroll.

## Privacy and your tax information
We protect your information with secure systems and limit access to the people working on your file. Federal law (Internal Revenue Code section 7216) limits how tax preparers may use and share tax return information. We will not use or share your tax return information for any purpose other than preparing your return and providing the services you engaged us for without your separate written consent.

Please never email Social Security numbers or tax documents. Use your secure client portal, or bring them to our office.

## Electronic signatures and communications
You agree that typing your name and confirming acceptance online is your legal signature on this letter, as permitted by the federal E-SIGN Act and Louisiana law. You agree to receive letters, invoices, notices and documents electronically through email and your client portal.

## Records
We keep copies of your returns and supporting documents for at least 3 years from the date the return is filed or the work is delivered, then securely destroy them. You should keep your own copies permanently.

## Ending the engagement
Either of us may end this engagement in writing at any time. You agree to pay for work done up to that date. We may withdraw if information is incomplete or inaccurate, if fees are not paid, or if continuing would violate professional or legal requirements.

## Limitation of liability
Our liability for any claim related to this engagement is limited to the fees you paid for the service involved. We are not responsible for taxes, penalties or interest caused by incomplete or inaccurate information you provided, or by documents or approvals you delivered late. You are always responsible for the tax you owe.

## Resolving disagreements
If a disagreement arises, we both agree to first try to resolve it in good faith by talking for at least 30 days. If that does not resolve it, the disagreement will be settled by binding arbitration in Louisiana under the Consumer Arbitration Rules of the American Arbitration Association, instead of in court. Either of us may still use small claims court for claims within its limits, and MKB may go to court to collect unpaid fees as described under Late payments. This letter is governed by the laws of the State of Louisiana.

## The whole agreement
These terms and your service letter are our entire agreement about the service. Any change must be in writing. An electronic copy is as valid as the original.
`),

  tax_individual: T("Engagement Letter — Individual Tax Preparation ({{taxYear}})", `
Dear {{clientName}},

Thank you for choosing MKB Financial Group LLC. This letter explains the tax preparation services we will provide for tax year {{taxYear}}.

## What we will do
- Prepare your {{taxYear}} federal individual income tax return (Form 1040) with the schedules and forms it needs, and the state returns you ask us to prepare.
- E-file your returns once you have reviewed and signed them (including IRS Form 8879, the e-file signature authorization).
- File an extension (Form 4868 and any state extension) if you ask us to or if your documents are not ready in time. An extension gives more time to file, not more time to pay. Any tax you owe is still due by the original deadline.
- Prepare an amended return (Form 1040-X) only if you ask. Amended returns are a separate service with their own fee.

## What is not included
Unless we agree in writing, this engagement does not include bookkeeping, tax planning beyond your return, prior-year returns, payroll or sales tax filings, complex IRS or state notices, or representation beyond what is described in the Standard Terms.

## Credits and due diligence
If you claim the Earned Income Tax Credit, Child Tax Credit, American Opportunity Tax Credit or Head of Household filing status, IRS rules require us to ask additional questions and, in some cases, see documents (for example, school or medical records showing where a child lived). We may not be able to claim a credit or filing status if the requirements are not met.

## Deadlines
To file by the April deadline, please give us all of your documents by March 15. Documents received later may require an extension.

## Fees
Your fees are based on the forms and schedules your return needs and are shown on your invoice. They are due before we e-file, either paid upfront or taken from your refund through a refund transfer bank product, as described in the Standard Terms.

By accepting below, you confirm that you have read this letter and the Standard Terms and agree to them.

MKB Financial Group LLC
{{date}}
`),

  tax_business: T("Engagement Letter — Business Tax Preparation ({{taxYear}})", `
Dear {{clientName}},

Thank you for choosing MKB Financial Group LLC. This letter explains the business tax services we will provide for tax year {{taxYear}}. The person accepting this letter confirms they are authorized to sign for the business.

## What we will do
- Prepare the business's {{taxYear}} federal income tax return (Form 1065, 1120-S, 1120 or 990, as applicable), the Schedules K-1 for owners, and the state returns you ask us to prepare.
- E-file the returns once an authorized officer or partner has reviewed and signed them.
- File an extension (Form 7004 and any state extension) if you ask us to or if your books are not ready in time. An extension gives more time to file, not more time to pay.
- Prepare an amended or superseding return only if you ask. That is a separate service with its own fee.

## Your books and records
We prepare the return from the books, bank statements and records you provide. Your books should be complete and reconciled through the end of the tax year. If they are not, we can provide bookkeeping as a separate service. We do not audit, review or compile your financial statements.

## What is not included
Unless we agree in writing, this engagement does not include bookkeeping, payroll or sales tax filings, owners' individual returns, tax planning, business formation or compliance filings, complex IRS or state notices, or representation beyond what is described in the Standard Terms.

## Deadlines
Partnership and S corporation returns are due March 15, and C corporation returns are due April 15 (for calendar-year businesses). Please give us your complete records at least 30 days before the deadline, or we may need to file an extension.

## Fees
Fees are based on the return type, the number of owners and states, and the condition of your books, and are shown on your invoice. They are due before we e-file.

By accepting below, you confirm that you have read this letter and the Standard Terms and agree to them on behalf of the business.

MKB Financial Group LLC
{{date}}
`),

  books: T("Engagement Letter — Bookkeeping Services", `
Dear {{clientName}},

Thank you for choosing MKB Financial Group LLC for your bookkeeping. This letter explains the monthly services in your {{service}} plan.

## What we will do each month
- Categorize transactions in your accounting software.
- Reconcile the bank and credit card accounts listed in your plan.
- Prepare a monthly Profit and Loss statement, Balance Sheet and the other reports in your plan.
- Close the month and keep your financial records organized.

## Your responsibilities
- Keep your own accounting software subscription (such as QuickBooks Online). You own your books and your data.
- Give us access to your accounting software and provide statements, receipts and answers to our questions by the 10th of each month.
- Tell us about new accounts, loans, large purchases, owner contributions or withdrawals.

## What is not included
Unless we agree in writing, bookkeeping does not include payroll processing, sales tax filings, tax returns, catch-up or clean-up work for prior months, or financial statements prepared under CPA standards (audits, reviews or compilations). We are not a CPA firm.

## Fees
Your plan is {{fee}} per month, billed monthly in advance.

- Overage: in any month your transactions or accounts go over your plan's limits, you will receive an additional bill for the overage at {{booksOverage}}.
- Plan change: if you are over your plan's limits for {{upgradeMonths}} months in a row, we will move you to the plan that fits your volume, starting with the next month's bill, and let you know when we do.
- Catch-up and clean-up work is quoted separately.

## Ending the plan
Either of us may end the plan with 30 days' written notice. Fees already billed are non-refundable.

By accepting below, you confirm that you have read this letter and the Standard Terms and agree to them.

MKB Financial Group LLC
{{date}}
`),

  biz: T("Engagement Letter — Business Services", `
Dear {{clientName}},

Thank you for choosing MKB Financial Group LLC. This letter covers the business service you requested: {{service}}.

## What we will do
We will prepare and submit the filings, applications or documents described in your service request (for example, business formation, EIN application, registered agent, annual reports, licenses or other compliance filings), using the information you provide.

## What we do not do
We are not a law firm and do not give legal advice. We do not choose your business structure for you or advise on legal rights and obligations. If your situation needs legal advice, please consult an attorney. We are happy to refer you.

## Your responsibilities
You are responsible for the accuracy of the ownership, address and other information in your filings, and for keeping your business in good standing after we complete the service (unless an ongoing compliance plan is part of your service).

## Government decisions and timing
Approvals, processing times and outcomes are decided by government agencies. We cannot guarantee approval or a specific timeline.

## Fees
Our service fee is {{fee}}. State and government filing fees are separate, passed through at cost, and shown on your invoice. Fees are due before we submit filings and are non-refundable once a filing has been submitted.

By accepting below, you confirm that you have read this letter and the Standard Terms and agree to them.

MKB Financial Group LLC
{{date}}
`),

  exp: T("Engagement Letter — Record Expungement Services", `
Dear {{clientName}},

Thank you for choosing MKB Financial Group LLC. This letter explains the expungement support services we will provide.

## Basic expungements only
We handle basic expungements only. If we find that your record needs a complex expungement, we will tell you before any fee is charged for that part and refer you to a licensed attorney.

## What we will do
- Help you gather your criminal history records and court documents.
- Organize your information and prepare the expungement paperwork for your review, using the information and records you provide.
- Track deadlines and keep you updated on your matter's progress.
- Where a filing or court appearance requires a licensed attorney, coordinate with or refer you to a licensed attorney. Any attorney fees are separate and agreed between you and the attorney.

## What we do not do
MKB is not a law firm. We do not give legal advice, decide whether you are eligible, represent you in court or appear for you. Eligibility and the final decision are made by the court and the law.

## No guarantee of outcome
We cannot guarantee that any record will be expunged, sealed or removed, or how long the process will take. Some background check companies may continue to show information until their records are updated.

## Your responsibilities
You agree to give us complete and truthful information about your full criminal history, including all arrests and charges in every state. Missing information can delay or prevent expungement.

## Fees
Our service fee is {{expungeFee}}. This fee does not include third-party fees such as court costs, clerk fees, fingerprinting and records fees, which are separate and shown on your invoice. Fees are non-refundable once we have requested records or prepared paperwork.

By accepting below, you confirm that you have read this letter and the Standard Terms and agree to them.

MKB Financial Group LLC
{{date}}
`),
};

/** Fills {{placeholders}}; unknown ones are left blank. */
export const fillLetter = (s: string, v: Record<string, string>) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => v[k] ?? "");

/** Parsed blocks for display and PDF. */
export type Block = { kind: "h" | "p" | "li"; text: string };
export function parseLetter(body: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ kind: "p", text: para.join(" ") }); para = []; } };
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("## ")) { flush(); out.push({ kind: "h", text: line.slice(3) }); continue; }
    if (line.startsWith("- ")) { flush(); out.push({ kind: "li", text: line.slice(2) }); continue; }
    para.push(line);
  }
  flush();
  return out;
}

/** Which service letter goes with a tax return form. */
export const taxLetterFor = (kind: "individual" | "business"): "tax_individual" | "tax_business" => (kind === "business" ? "tax_business" : "tax_individual");
