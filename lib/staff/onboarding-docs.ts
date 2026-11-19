/**
 * Staff onboarding documents: what every team member (VA, contractor) signs or provides
 * before they can use the CRM. Shared by the server and the screens.
 *
 * Wording is editable in Settings → Staff onboarding; each edit is a new version and the
 * version someone signed is kept with their signature. These defaults are starting drafts
 * for the Owner's attorney to review.
 *
 * Text format (same as engagement letters): "## " starts a heading, "- " a bullet,
 * blank line = new paragraph. {{name}} = the signer, {{company}} = MKB Financial Group,
 * {{date}} = today.
 */

export type StaffDocKind = "sign" | "upload";
export type StaffDoc = { key: string; version: number; title: string; kind: StaffDocKind; body: string; required: boolean; active: boolean; position: number; updatedAt?: string; updatedBy?: string };
export type StaffDocStatus = StaffDoc & { done: { id: string; at: string; version: number; name: string; fileName?: string } | null };
export type StaffOnboarding = { required: boolean; docs: StaffDocStatus[]; identity: { verifiedAt: string | null; verifiedBy: string | null; note: string }; complete: boolean };

export const COMPANY = "MKB Financial Group";

type Def = Omit<StaffDoc, "version" | "updatedAt" | "updatedBy">;

export const DEFAULT_STAFF_DOCS: Def[] = [
  {
    key: "contractor",
    title: "Independent Contractor Agreement",
    kind: "sign",
    required: true,
    active: true,
    position: 1,
    body: `This agreement is between {{company}} ("MKB"), a Louisiana business owned by Krystal Esters, and {{name}} ("Contractor"), effective {{date}}.

## 1. Services
Contractor will provide administrative and virtual-assistant services that MKB assigns from time to time, such as data entry, scheduling, client follow-up and document organization. MKB decides what work is assigned; Contractor decides how and when to do it, within agreed deadlines.

## 2. Independent contractor
Contractor is an independent contractor, not an employee, partner or agent of MKB. Contractor is not entitled to employee benefits. Contractor is solely responsible for all taxes, registrations and insurance required where Contractor lives and works. Contractor may not sign anything or make promises on MKB's behalf.

## 3. Payment
MKB will pay the rate agreed in writing for each assignment or period, after Contractor submits an invoice or time record. Contractor provides MKB a completed Form W-8BEN (if outside the United States) or Form W-9 (if a U.S. person) before the first payment.

## 4. Equipment
Contractor supplies and maintains their own computer, phone and internet connection, and must keep them secured as required by MKB's Information Security & Acceptable Use Policy.

## 5. Confidentiality and security
Contractor's Confidentiality & Non-Disclosure Agreement, Information Security & Acceptable Use Policy and Taxpayer Information Privacy Acknowledgment are part of this agreement. Breaking any of them is a material breach.

## 6. Work product
Everything Contractor creates for MKB (documents, lists, templates, messages and data) belongs to MKB. Contractor assigns to MKB all rights in that work.

## 7. Term and ending
Either party may end this agreement at any time with written notice (email is enough). MKB may end it immediately for a breach of confidentiality or security. When it ends, Contractor stops all work, returns or permanently deletes all MKB and client information in their possession, and confirms this in writing within 2 business days. MKB removes Contractor's access the same day.

## 8. Other terms
This agreement is governed by the laws of the State of Louisiana, USA. If any part is unenforceable, the rest still applies. This agreement, with the documents named in section 5, is the whole agreement and can only be changed in writing by both parties.`,
  },
  {
    key: "nda",
    title: "Confidentiality & Non-Disclosure Agreement",
    kind: "sign",
    required: true,
    active: true,
    position: 2,
    body: `I, {{name}}, will have access to confidential information of {{company}} and its clients. In exchange for that access, I agree to the following.

## What is confidential
- All client information: names, contact details, Social Security and taxpayer numbers, tax returns and tax information, bank and financial information, income, documents and anything a client tells MKB.
- MKB's business information: prices, processes, client lists, passwords, systems, templates and plans.

## What I will do
- Use confidential information only to do the tasks MKB assigns me, and only inside MKB's systems (the MKB CRM and tools MKB approves).
- Keep it private, even from family and friends, and even after my work for MKB ends.
- Report to the Owner right away (within 1 hour) if I think confidential information was seen, sent, lost or accessed by someone who should not have it.

## What I will not do
- Copy, download, print, photograph, screenshot or forward client information, unless a task requires it and MKB approves; anything I must download I delete as soon as the task is done.
- Put client information in personal email, texts, WhatsApp, social media, personal cloud storage, or any AI tool or chatbot.
- Discuss clients or their information with anyone outside MKB.
- Keep any MKB or client information after my work ends.

## Legal notice
Disclosing or misusing tax return information can lead to civil penalties and criminal prosecution under U.S. law (Internal Revenue Code sections 6713 and 7216), in addition to MKB's own remedies, including ending my work immediately and seeking damages.

My duties under this agreement continue after my work for MKB ends, for as long as the information stays confidential.`,
  },
  {
    key: "security",
    title: "Information Security & Acceptable Use Policy",
    kind: "sign",
    required: true,
    active: true,
    position: 3,
    body: `{{company}} protects client information under a Written Information Security Plan (WISP), as the FTC Safeguards Rule and the IRS require of tax professionals. These are the rules I, {{name}}, must follow.

## My accounts
- I use only my own CRM login and never share it. I keep two-step verification on.
- I use a strong, unique password stored in a password manager.
- I sign out on any device I am not using.

## My devices
- I work only on my own computer and phone, never on shared or public computers.
- Each device has a passcode or password, locks itself after 5 minutes or less, and has current system updates and antivirus protection.
- I work on a private, password-protected internet connection, or a VPN on any public network.
- If a device with MKB access is lost or stolen, I tell the Owner immediately.

## Handling client information
- Client information stays in the MKB CRM. I never move it to email, chat apps, spreadsheets or personal storage.
- I never send or accept Social Security numbers, bank numbers or tax documents by text or email; I ask clients to use their secure portal.
- I never enter client information into an AI tool, chatbot or browser extension.
- I see only what my role allows. I do not try to access anything else.

## Monitoring
The CRM records sign-ins and actions. MKB may review these records at any time.

## Reporting problems
I report anything suspicious (an odd sign-in alert, a strange request, a lost device, a mistake with client data) to the Owner right away, within 1 hour, by phone or text at 888-379-9372 or by email at info@mkbfinancialgroup.com.

Breaking these rules can end my work with MKB immediately.`,
  },
  {
    key: "taxpayer_privacy",
    title: "Taxpayer Information Privacy Acknowledgment",
    kind: "sign",
    required: true,
    active: true,
    position: 4,
    body: `I, {{name}}, understand that {{company}} is a tax return preparer and that the information I may see is protected by U.S. federal law.

- Tax return information may be used only to prepare returns and provide the services the client asked for, and may be disclosed only as the law allows or the client has consented in writing (Internal Revenue Code section 7216 and Treasury Regulations).
- The Gramm-Leach-Bliley Act and the FTC Safeguards Rule require MKB, and everyone working for MKB, to protect client financial information.
- I work from outside MKB's office, and possibly outside the United States. I will access only the client information MKB makes available to my role, and only inside MKB's systems.
- Unauthorized use or disclosure of tax return information can result in civil penalties for each disclosure and criminal penalties, including fines and imprisonment.

I have read MKB's Confidentiality & Non-Disclosure Agreement and Information Security & Acceptable Use Policy, and I agree to follow them.`,
  },
  {
    key: "training",
    title: "Security Awareness Training",
    kind: "sign",
    required: true,
    active: true,
    position: 5,
    body: `Read this training carefully. Signing confirms that you, {{name}}, completed it and will apply it. It is repeated every year.

## 1. Phishing
Criminals send emails and texts that look like they come from clients, the IRS, banks or the Owner. Warning signs: urgency ("today", "account locked"), a request for passwords, codes or client data, an unexpected attachment or link, or a sender address that is slightly off. Never click; report it to the Owner.

## 2. Verify every unusual request
If anyone (even someone who sounds like a client or the Owner) asks you to change bank details, send documents, reset a login or share information, stop. Confirm through a known phone number or inside the CRM before acting.

## 3. The IRS does not call, text or email first
The IRS contacts people by mail. Calls or messages claiming to be the IRS demanding payment or information are scams. Never give information; tell the Owner.

## 4. Passwords and two-step codes
Never share your password or a two-step code, with anyone, for any reason. MKB will never ask for them.

## 5. Safe handling
Client information stays in the CRM. No screenshots, no downloads unless required, no personal email or chat apps, no AI tools. Lock your screen whenever you step away.

## 6. Social engineering by phone
Callers may pretend to be a client to get information. Verify identity using the details in the CRM before discussing anything; when unsure, take a message for the Owner.

## 7. Report fast
Mistakes happen. Report them within 1 hour (888-379-9372 or info@mkbfinancialgroup.com). Fast reporting protects clients and you.`,
  },
  {
    key: "tax_form",
    title: "Tax form (W-8BEN or W-9)",
    kind: "upload",
    required: true,
    active: true,
    position: 6,
    body: `Upload your completed and signed tax form so MKB can pay you.

- Outside the United States: Form W-8BEN. Download it from irs.gov/w8ben, fill it in, sign and date it.
- U.S. citizen or resident: Form W-9. Download it from irs.gov/w9.

A clear PDF or photo is fine. It is stored privately and only the Owner can open it.`,
  },
];

/** "{{name}}" etc. filled in for one signer. */
export function fillStaffDoc(body: string, v: { name: string; date: string }) {
  return body.replace(/\{\{\s*name\s*\}\}/g, v.name).replace(/\{\{\s*company\s*\}\}/g, COMPANY).replace(/\{\{\s*date\s*\}\}/g, v.date);
}
