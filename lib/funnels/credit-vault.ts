/**
 * "The Credit Comeback Vault" — MKB's free do-it-yourself credit packet (Black Friday /
 * Cyber Monday 2026 lead magnet). One source for the PDF and the in-browser letter builder.
 *
 * Educational material for consumers disputing their own reports for free; MKB does not
 * perform credit repair through it. Text format: "## " heading, "- " bullet, blank line =
 * paragraph. Letter templates use {{field}} placeholders filled by the builder (or left as
 * blanks in the PDF).
 */

export const CREDIT_VAULT = {
  key: "credit-vault",
  title: "The Credit Comeback Vault",
  subtitle: "Your 3-round do-it-yourself credit dispute system",
  path: "/credit-comeback",
  campaignId: "mkb_bfcm_2026_credit_vault",
  formId: "form-credit-vault-2026",
  slug: "credit-comeback-vault-2026",
  tags: ["BFCM 2026", "VIP Waitlist", "Credit Comeback Vault"],
};

export const CREDIT_DISCLAIMER =
  "MKB Financial Group is not a law firm and does not provide legal advice or credit repair services through this packet. It is free educational material to help you exercise your own rights under the Fair Credit Reporting Act and Fair Debt Collection Practices Act. You can dispute errors on your credit reports yourself, at no cost. No one can legally remove accurate, timely information from your credit report. Results vary.";

/** The mailing addresses the bureaus publish for disputes (confirm on each bureau's website before mailing). */
export const BUREAUS = {
  equifax: { name: "Equifax Information Services LLC", lines: ["P.O. Box 740256", "Atlanta, GA 30374-0256"], web: "equifax.com/personal/credit-report-services" },
  experian: { name: "Experian", lines: ["P.O. Box 4500", "Allen, TX 75013"], web: "experian.com/disputes" },
  transunion: { name: "TransUnion LLC Consumer Dispute Center", lines: ["P.O. Box 2000", "Chester, PA 19016"], web: "transunion.com/credit-disputes" },
} as const;
export type BureauKey = keyof typeof BUREAUS;

/* ---------------------------------------------------------------- the guide */
export type GuideSection = { id: string; title: string; body: string };

export const GUIDE: GuideSection[] = [
  {
    id: "start",
    title: "Start here: how the Vault works",
    body: `Most credit "repair" is something you have the legal right to do yourself, for free. What makes it work is not a magic letter; it is finding real errors, disputing them in the right order, keeping proof, and following up on time. This packet gives you that system.

## The plan in one page
- Step 1. Pull all 3 credit reports and audit them with the checklist (page 3).
- Step 2. Clean up your personal information first (old names, addresses, employers).
- Step 3. Round 1: dispute specific errors with each bureau.
- Step 4. Round 2: if an error is "verified," ask how it was verified.
- Step 5. Round 3: dispute directly with the company that reported it, and file a CFPB complaint if needed.
- Step 6. While you wait, build positive credit with the Score-Building Playbook.

## What you will need
- A printer, envelopes and about $5 to $10 per letter for certified mail with return receipt.
- A copy of your driver's license or state ID, and a recent utility bill or bank statement showing your address.
- A folder (paper or digital) to keep every letter, receipt and response.
- About 90 to 120 days. Each round takes 30 to 45 days.

## Two rules that protect you
- Only dispute information you believe is inaccurate, incomplete, outdated or not yours. Disputing everything at once can get your disputes labeled "frivolous" and ignored.
- Never pay anyone to do what this packet shows you how to do for free until you have read it.`,
  },
  {
    id: "audit",
    title: "Step 1: The credit report audit",
    body: `Get your free reports from all three bureaus at annualcreditreport.com, the only official site for free reports. You can check each report every week for free. Download them as PDFs so you have dated copies.

## Check your personal information
- Misspelled names or names you have never used
- Addresses where you never lived
- Employers you never worked for
- Wrong Social Security number or date of birth (this can mean someone else's file is mixed with yours)

## Check every account, line by line
- Accounts you do not recognize: possible identity theft or a mixed file
- The same debt listed twice (often once by the original creditor and once by a collector, both showing a balance)
- Wrong balance, wrong credit limit, or a paid account still showing a balance
- Late payments in months you paid on time
- A "date of first delinquency" that seems newer than it really is: old debts sometimes get re-aged to stay on your report longer
- Accounts closed by you that say "closed by creditor"
- Accounts included in a bankruptcy that still show a balance due

## Check the dates (outdated items)
- Most negative items, including collections, charge-offs and late payments, must come off 7 years after the original delinquency.
- Chapter 7 bankruptcy: 10 years. Chapter 13: usually 7 years at the bureaus.
- Hard inquiries stay 2 years but only count in scores for about 1 year.

## Check the inquiries
- Every hard inquiry should be from a company you applied with. One you did not authorize can be challenged.

## Write it down
Use the Dispute Worksheet at the back of this packet. For each error, write: the bureau, the company name, the last 4 digits of the account number, what is wrong, and what is correct. Specific disputes get results. Vague ones ("this is not mine, delete it") get "verified."`,
  },
  {
    id: "personal",
    title: "Step 2: Clean up your personal information first",
    body: `Before disputing accounts, ask each bureau to remove old or wrong names, addresses and employers (Letter 9). This matters because bureaus match disputes and new reports to your file using that information. A clean file reduces mix-ups with other people and keeps your later disputes tied to the right person.

Keep your current legal name, current address, and one previous address if you moved in the last 2 years.`,
  },
  {
    id: "rounds",
    title: "Steps 3 to 5: The 3-round dispute strategy",
    body: `## Round 1: Dispute with the bureaus (Letter 1)
Send a specific dispute to each bureau that shows the error. Under the Fair Credit Reporting Act (section 611), the bureau must investigate, usually within 30 days of receiving your letter (up to 45 days in some cases, such as when you send more information during the investigation). It must forward your dispute and documents to the company that reported the information, and send you the results in writing. If the item cannot be verified, it must be corrected or deleted.

Include: a copy of your ID, proof of address, a copy of the report page with the error circled, and any proof you have (a payment confirmation, a paid-in-full letter, a police or FTC report).

## Round 2: Ask how it was verified (Letter 2)
If the bureau says an item was "verified," you have the right to ask for a description of how it reached that result, including the name, address and phone number of the company it contacted (FCRA section 611(a)(6)(B)(iii) and (a)(7)). The bureau must answer within 15 days of your request. This often reveals that the "investigation" was a quick electronic check, and it gives you the company's contact information for Round 3.

## Round 3: Go to the source (Letter 3)
Dispute directly with the company that reported the information (the "furnisher"). Under FCRA section 623(a)(8) and its regulation (12 CFR 1022.43), it must investigate a direct dispute sent to the address it lists for disputes, usually within 30 days, and correct anything inaccurate with every bureau it reports to.

## If an error still is not fixed
- File a complaint with the Consumer Financial Protection Bureau at consumerfinance.gov/complaint. Companies must respond, usually within 15 days.
- You can also report problems to the Federal Trade Commission and your state attorney general.
- Add a short statement to your report explaining the dispute (up to 100 words).
- If a company keeps reporting information it knows is wrong, consider talking with a consumer-law attorney; many take these cases at no upfront cost.

## Timing
- Send each round only after you receive the results of the previous one, or after 45 days with no answer.
- Mail everything certified, return receipt requested. Your deadlines start when they receive it.`,
  },
  {
    id: "situations",
    title: "Situation letters: what to use when",
    body: `- Collection agency just contacted you, or a collection appears that you do not recognize: Letter 4, Debt Validation. Send it within 30 days of their first written notice for the strongest rights (Fair Debt Collection Practices Act section 809(b)). Until they validate, they must stop collecting.
- One late payment on an otherwise good account: Letter 5, Goodwill Request. A courtesy request, not a dispute. Best for a long-time account with a single slip and a good reason.
- A collection you owe and can afford to settle: Letter 6, Pay-for-Delete Offer. Get any agreement in writing before you pay. Many collectors will not agree to delete, but some will, and paid collections still help some newer scoring models.
- Identity theft: file a report at IdentityTheft.gov first, then send Letter 7. Under FCRA section 605B, the bureau must block the fraudulent information within 4 business days of receiving your identity theft report, proof of identity and the list of items.
- A hard inquiry you did not authorize: Letter 8.
- Wrong or old personal information: Letter 9.
- Negative items older than the reporting limit: Letter 10.`,
  },
  {
    id: "mailing",
    title: "Mailing and tracking kit",
    body: `## How to mail a dispute
- Print and sign each letter. Write your full Social Security number and date of birth by hand only on the copy you mail, never in email or a web form you do not trust.
- Enclose copies, never originals, of your ID and proof of address.
- Circle or highlight the error on a copy of your report.
- Mail by USPS Certified Mail with Return Receipt. Keep the receipt.
- Make a copy of everything before it goes in the envelope.

## Bureau dispute addresses
- Equifax Information Services LLC, P.O. Box 740256, Atlanta, GA 30374-0256
- Experian, P.O. Box 4500, Allen, TX 75013
- TransUnion LLC Consumer Dispute Center, P.O. Box 2000, Chester, PA 19016

Bureaus occasionally change these addresses. Check each bureau's website before mailing.

## Your deadline calendar
- Day 0: they receive your letter (from the return receipt).
- Day 30: most investigations must be finished (up to day 45 in some cases).
- About day 35: results should arrive by mail. Pull your free report again to confirm.
- 15 days after a Round 2 request: the bureau's description of how it verified should arrive.
- No response by day 45: send a follow-up with a copy of your first letter and the return receipt, and file a CFPB complaint.

Use the Dispute Log at the back to track each letter.`,
  },
  {
    id: "scripts",
    title: "Phone scripts for creditors and collectors",
    body: `## Before any call
- Have the account number, your notes and a pen. Write down the date, time, the person's name and what they said.
- Ask for anything important in writing. A promise on the phone is hard to prove.

## Asking a creditor for a goodwill adjustment
"Hi, I have been a customer since [year] and I am calling about a late payment reported in [month and year]. It happened because [brief reason], and I have paid on time since. Would you consider a goodwill adjustment to remove that late payment from my credit reports? If you can't do it today, who can I write to?"

## A collector calls about a debt you don't recognize
"Please send me written validation of this debt. I am not agreeing that I owe it. Please communicate with me in writing from now on."

## Negotiating a pay-for-delete
"I'm able to resolve this account for [amount] if you agree in writing to request deletion of the account from all three credit bureaus. Can you send me that agreement before I pay?"

## Never say
- "Yes, that's my debt" or agree to make a small "good-faith" payment on an old debt before you understand your rights. In some states, a payment or written acknowledgment can restart the time limit to sue (the statute of limitations).
- Never give a collector your bank account or card information until you have a written agreement.`,
  },
  {
    id: "builder",
    title: "Step 6: The score-building playbook",
    body: `Removing errors helps. Adding positive history is what lifts scores and keeps them high.

## Payment history (the biggest factor)
- Pay every account on time, every month. Set up autopay for at least the minimum.
- Even one 30-day late can drop a good score significantly.

## Credit card balances (utilization)
- Keep each card's reported balance below 30% of its limit; below 10% scores best.
- Pay before the statement closing date, so a lower balance gets reported.
- Ask for a credit limit increase on cards in good standing (ask whether it requires a hard inquiry).

## Building from thin or damaged credit
- Secured credit card: a refundable deposit becomes your limit. Choose one that reports to all three bureaus and lets you graduate to unsecured.
- Credit-builder loan from a credit union or community bank: payments are saved for you and reported as on-time loan payments.
- Become an authorized user on a trusted family member's old, low-balance, always-on-time card.
- Rent and utility reporting services can add on-time rent payments to some reports.

## Protect your progress
- Don't close your oldest credit cards; account age helps.
- Apply for new credit only when you need it.
- Freeze your credit at all three bureaus when you aren't applying for anything. It's free, and it blocks most new-account fraud.`,
  },
  {
    id: "refund",
    title: "Your tax refund, your comeback",
    body: `Tax season is the best time of year to fix credit fast, because a refund can do in one month what small payments take a year to do.

## A simple refund plan
- First: bring any account that is currently late back to current.
- Next: pay credit cards down below 30% of their limits, starting with the card closest to its limit.
- Then: open a secured card or credit-builder account if your file is thin.
- Finally: put what is left in savings so a surprise expense doesn't become a new late payment.

## Get the refund you are owed
MKB Financial Group prepares individual and small-business tax returns virtually for clients in Louisiana and Texas. Make sure you are claiming every credit you qualify for, and get your refund working on your comeback.

Book your tax appointment at mkbfinancialgroup.com or call 888-379-9372.`,
  },
];

/* ---------------------------------------------------------------- the letters */
export type LetterField = { id: string; label: string; type?: "text" | "textarea" | "date" | "bureau"; help?: string; placeholder?: string; required?: boolean };
export type LetterDef = { key: string; n: number; title: string; when: string; to: "bureau" | "company"; fields: LetterField[]; body: string; enclosures: string[] };

const ITEMS_HELP = "One per line: company name, last 4 digits of the account, what is wrong, and what is correct.";

export const LETTERS: LetterDef[] = [
  {
    key: "round1", n: 1, title: "Round 1: Dispute with a credit bureau", when: "Your first dispute of specific errors on a bureau's report.", to: "bureau",
    fields: [
      { id: "bureau", label: "Credit bureau", type: "bureau", required: true },
      { id: "reportDate", label: "Date of the credit report you are disputing", type: "date" },
      { id: "items", label: "The errors", type: "textarea", required: true, help: ITEMS_HELP, placeholder: "Capital Bank, account ending 4471: shows 60 days late in March 2025. I paid on time; proof enclosed.\nABC Collections, account ending 9930: this account is not mine." },
    ],
    body: `I am writing to dispute the following information in my credit file{{reportDateText}}. The items listed below are inaccurate or incomplete:

{{items}}

Under the Fair Credit Reporting Act, section 611 (15 U.S.C. § 1681i), please conduct a reasonable reinvestigation of each item, forward all relevant information I am providing to the companies that reported it, and correct or delete any information that is inaccurate, incomplete or cannot be verified.

Please send me written results of your reinvestigation and an updated copy of my credit report.`,
    enclosures: ["Copy of my driver's license or state ID", "Copy of a utility bill or bank statement showing my address", "Copy of my credit report with the disputed items marked", "Supporting documents (if any)"],
  },
  {
    key: "round2", n: 2, title: "Round 2: Request for method of verification", when: "A bureau said a disputed item was \"verified\" and you disagree.", to: "bureau",
    fields: [
      { id: "bureau", label: "Credit bureau", type: "bureau", required: true },
      { id: "priorDate", label: "Date of your first dispute letter", type: "date", required: true },
      { id: "resultDate", label: "Date of the bureau's results letter", type: "date" },
      { id: "items", label: "Items the bureau said were verified", type: "textarea", required: true, help: "Company name and last 4 digits of the account for each." },
    ],
    body: `On {{priorDate}}, I disputed the items below. Your response{{resultDateText}} stated that they were verified. I continue to dispute their accuracy:

{{items}}

Under the Fair Credit Reporting Act, sections 611(a)(6)(B)(iii) and 611(a)(7) (15 U.S.C. § 1681i), I request a description of the procedure you used to determine the accuracy and completeness of this information, including the business name, address and telephone number of each company you contacted. Please provide this within 15 days of receiving this request.

If you cannot show that the information was properly verified, please delete or correct it and send me an updated copy of my credit report.`,
    enclosures: ["Copy of my driver's license or state ID", "Copy of a utility bill or bank statement showing my address", "Copy of my first dispute letter and certified mail receipt", "Copy of your results letter"],
  },
  {
    key: "round3", n: 3, title: "Round 3: Direct dispute to the company that reported it", when: "The bureau didn't fix it; dispute with the creditor or collector directly.", to: "company",
    fields: [
      { id: "company", label: "Company name", required: true },
      { id: "companyAddress", label: "Company's address for credit disputes", type: "textarea", required: true, help: "Use the dispute address on your credit report or the company's website, or the one the bureau gave you in Round 2." },
      { id: "account", label: "Account number (last 4 digits)", required: true },
      { id: "error", label: "What is inaccurate, and what is correct", type: "textarea", required: true },
    ],
    body: `I am disputing information your company reports to the credit bureaus about the account referenced above. The information is inaccurate:

{{error}}

Under the Fair Credit Reporting Act, section 623(a)(8) (15 U.S.C. § 1681s-2(a)(8)), and 12 CFR 1022.43, please investigate this direct dispute, review the information I have enclosed, and report the results to me. If the information is inaccurate or incomplete, please correct it with every credit bureau to which you reported it.`,
    enclosures: ["Copy of my driver's license or state ID", "Copy of a utility bill or bank statement showing my address", "Copy of the credit report page showing the account", "Supporting documents"],
  },
  {
    key: "validation", n: 4, title: "Debt validation request (to a collection agency)", when: "A collector contacted you or a collection appears that you don't recognize. Best sent within 30 days of their first written notice.", to: "company",
    fields: [
      { id: "company", label: "Collection agency name", required: true },
      { id: "companyAddress", label: "Collection agency address", type: "textarea", required: true },
      { id: "account", label: "Their reference or account number", required: true },
      { id: "noticeDate", label: "Date of their first letter to you (if any)", type: "date" },
    ],
    body: `I am responding to your attempt to collect the debt referenced above{{noticeDateText}}. I dispute this debt and request validation under the Fair Debt Collection Practices Act, section 809(b) (15 U.S.C. § 1692g).

Please provide:
- The name of the original creditor and the original account number
- The amount owed, with an itemization of interest, fees and payments since the account was charged off or placed for collection
- Proof that your company owns or is authorized to collect this debt
- A copy of the agreement or the last statement from the original creditor

Until you provide validation, please stop collection activity on this account. If you report this account to a credit bureau, it must be reported as disputed. Please communicate with me only in writing at the address above.

This letter is not an acknowledgment that I owe this debt.`,
    enclosures: [],
  },
  {
    key: "goodwill", n: 5, title: "Goodwill request (one late payment)", when: "A single late payment on an account that's otherwise in good standing.", to: "company",
    fields: [
      { id: "company", label: "Creditor name", required: true },
      { id: "companyAddress", label: "Creditor address", type: "textarea", required: true },
      { id: "account", label: "Account number (last 4 digits)", required: true },
      { id: "lateMonth", label: "Month and year of the late payment", required: true, placeholder: "March 2025" },
      { id: "reason", label: "What happened (briefly)", type: "textarea", required: true, placeholder: "I was hospitalized and missed the due date by a week." },
      { id: "since", label: "Your history with them", placeholder: "a customer since 2019, with on-time payments every other month" },
      { id: "goal", label: "What you're working toward (optional)", placeholder: "buy my first home this year" },
    ],
    body: `I am writing to ask for a goodwill adjustment on my account. I have been {{since}}. In {{lateMonth}}, my payment was late because {{reason}}

I take my credit seriously, and I have paid on time since then. That one late payment is now affecting my ability to {{goal}}. I would be grateful if you would consider removing the late payment from my credit reports as a courtesy.

Thank you for your time and for considering my request.`,
    enclosures: [],
  },
  {
    key: "paydelete", n: 6, title: "Pay-for-delete offer (collection you owe)", when: "A valid collection you can afford to settle. Get the agreement in writing before you pay.", to: "company",
    fields: [
      { id: "company", label: "Collection agency name", required: true },
      { id: "companyAddress", label: "Collection agency address", type: "textarea", required: true },
      { id: "account", label: "Their reference or account number", required: true },
      { id: "amount", label: "Amount you offer to pay", required: true, placeholder: "$450" },
    ],
    body: `I am writing about the account referenced above. This letter is not an acknowledgment that I owe the amount you claim, and it is not a promise to pay unless you accept the terms below in writing.

I am prepared to pay {{amount}} to resolve this account in full, on one condition: that your company agrees to request deletion of this account from Equifax, Experian and TransUnion within 30 days of receiving payment, and to stop reporting it.

If you accept, please sign and return a copy of this letter, or send me your written agreement on company letterhead. I will send payment within 10 days of receiving your signed agreement.

Agreed by (name and title): ______________________________   Date: ______________`,
    enclosures: [],
  },
  {
    key: "idtheft", n: 7, title: "Identity theft block (to a credit bureau)", when: "Accounts or inquiries on your report from identity theft. File at IdentityTheft.gov first.", to: "bureau",
    fields: [
      { id: "bureau", label: "Credit bureau", type: "bureau", required: true },
      { id: "ftc", label: "FTC Identity Theft Report number", required: true },
      { id: "items", label: "Fraudulent accounts or inquiries", type: "textarea", required: true, help: "Company name and last 4 digits of each account, or the inquiry date." },
    ],
    body: `I am a victim of identity theft. The information listed below in my credit file is the result of identity theft and was not opened, used or authorized by me:

{{items}}

Under the Fair Credit Reporting Act, section 605B (15 U.S.C. § 1681c-2), please block this information from my credit file within 4 business days of receiving this request, and notify each company that reported it that the information may be the result of identity theft.

My Identity Theft Report (FTC report number {{ftc}}) is enclosed.`,
    enclosures: ["Copy of my FTC Identity Theft Report", "Copy of my driver's license or state ID", "Copy of a utility bill or bank statement showing my address"],
  },
  {
    key: "inquiry", n: 8, title: "Unauthorized hard inquiry", when: "A hard inquiry from a company you never applied with.", to: "bureau",
    fields: [
      { id: "bureau", label: "Credit bureau", type: "bureau", required: true },
      { id: "items", label: "The inquiries", type: "textarea", required: true, help: "Company name and inquiry date for each." },
    ],
    body: `My credit file shows the following hard inquiries that I did not authorize. I did not apply for credit with these companies or give them permission to obtain my credit report:

{{items}}

Under the Fair Credit Reporting Act, a company may obtain a consumer report only for a permissible purpose (section 604, 15 U.S.C. § 1681b). Please investigate these inquiries under section 611 and remove any that cannot be verified as authorized.`,
    enclosures: ["Copy of my driver's license or state ID", "Copy of a utility bill or bank statement showing my address", "Copy of my credit report with the inquiries marked"],
  },
  {
    key: "personal", n: 9, title: "Remove outdated personal information", when: "Old or wrong names, addresses or employers on your report.", to: "bureau",
    fields: [
      { id: "bureau", label: "Credit bureau", type: "bureau", required: true },
      { id: "items", label: "Information to remove", type: "textarea", required: true, help: "Each wrong name, address or employer, one per line." },
    ],
    body: `My credit file contains personal information that is inaccurate or outdated. Please remove the following:

{{items}}

My correct current information is shown at the top of this letter. Under the Fair Credit Reporting Act, section 611, please correct my file and send me an updated copy of my credit report.`,
    enclosures: ["Copy of my driver's license or state ID", "Copy of a utility bill or bank statement showing my current address"],
  },
  {
    key: "obsolete", n: 10, title: "Outdated negative items (past the reporting limit)", when: "Collections, charge-offs or late payments more than 7 years past the original delinquency.", to: "bureau",
    fields: [
      { id: "bureau", label: "Credit bureau", type: "bureau", required: true },
      { id: "items", label: "The outdated items", type: "textarea", required: true, help: "Company name, last 4 digits, and the date of first delinquency for each." },
    ],
    body: `The following negative items in my credit file are past the time allowed for reporting. Under the Fair Credit Reporting Act, section 605(a) (15 U.S.C. § 1681c), most adverse items may not be reported more than 7 years after the date of the original delinquency:

{{items}}

Please verify the date of first delinquency for each item and remove any item that is past the reporting period. Please send me the results and an updated copy of my credit report.`,
    enclosures: ["Copy of my driver's license or state ID", "Copy of a utility bill or bank statement showing my address", "Copy of my credit report with the items marked"],
  },
];

export type Sender = { name: string; address1: string; address2: string; city: string; state: string; zip: string };

const fmtDay = (iso: string) => {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

/** The finished letter as plain text blocks (the builder prints it; the PDF prints it with blanks). */
export function renderLetter(l: LetterDef, sender: Sender | null, v: Record<string, string>, today = new Date()) {
  const blank = (s: string | undefined, w = 28) => (s && s.trim() ? s.trim() : "_".repeat(w));
  const vals: Record<string, string> = {
    ...v,
    items: blank(v.items, 60),
    error: blank(v.error, 60),
    priorDate: v.priorDate ? fmtDay(v.priorDate) : "_______________",
    lateMonth: blank(v.lateMonth, 16),
    reason: v.reason ? v.reason.trim().replace(/\.?$/, ".") : "_____________________________.",
    since: blank(v.since, 30),
    amount: blank(v.amount, 10),
    ftc: blank(v.ftc, 14),
    goal: blank(v.goal, 24),
    reportDateText: v.reportDate ? ` (credit report dated ${fmtDay(v.reportDate)})` : "",
    resultDateText: v.resultDate ? ` dated ${fmtDay(v.resultDate)}` : "",
    noticeDateText: v.noticeDate ? ` in your letter dated ${fmtDay(v.noticeDate)}` : "",
  };
  if (!v.goal) vals.goal = "qualify for the best rates";
  const body = l.body.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vals[k] ?? "");
  const s = sender;
  const from = s ? [s.name, s.address1, s.address2, `${s.city}${s.city ? ", " : ""}${s.state} ${s.zip}`.trim()].filter((x) => x && x.trim()) : ["Your full legal name", "Street address", "City, State ZIP"];
  const bureau = l.to === "bureau" && v.bureau && v.bureau in BUREAUS ? BUREAUS[v.bureau as BureauKey] : null;
  const to = l.to === "bureau" ? (bureau ? [bureau.name, ...bureau.lines] : ["Credit bureau name", "Dispute address"]) : [blank(v.company, 30), ...(v.companyAddress ? v.companyAddress.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : ["Address"])];
  const re = l.to === "bureau" ? `Re: ${l.key === "idtheft" ? "Request to block information resulting from identity theft" : l.key === "inquiry" ? "Dispute of unauthorized inquiries" : l.key === "personal" ? "Correction of personal information" : l.key === "round2" ? "Request for method of verification" : "Dispute of inaccurate information"}` : `Re: Account ${blank(v.account, 10)}`;
  return {
    from,
    idLines: ["Date of birth: ____________", "Social Security number: ____-____-____ (write by hand on the mailed copy only)"],
    date: today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    to,
    re,
    body,
    enclosures: l.enclosures,
    signName: s?.name || "",
  };
}
