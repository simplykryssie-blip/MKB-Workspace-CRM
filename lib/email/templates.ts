/**
 * Automatic client emails: default wording plus the branded layout.
 * Staff can change the wording in Settings (stored per template); the layout,
 * security footer and placeholders stay fixed. Used by the server to send and
 * by Settings to preview. Never put SSNs, EINs, amounts owed by the IRS or
 * document contents in an email.
 */

export type TemplateKey = "tax_intake_received" | "tax_document_reminder" | "document_reminder" | "tax_document_request" | "tax_extension_filed" | "invoice_sent" | "books_intake_received" | "books_intake_link" | "books_proposal" | "books_proposal_signed" | "tax_interview_link" | "portal_invite" | "portal_message" | "books_items" | "books_reminder" | "books_reports_ready" | "service_intake_link" | "service_intake_received" | "booking_confirmed" | "booking_reminder" | "booking_changed" | "booking_cancelled";

export type EmailWording = {
  subject: string;
  heading: string;
  intro: string;
  /** Shown under the list of documents (if any). */
  docsNote: string;
  /** "What happens next" steps — one per line. Empty = no steps. */
  steps: string;
  button: string;
  closing: string;
};

export type TemplateDef = EmailWording & { key: TemplateKey; name: string; when: string; placeholders: string[]; docsTitle: string };

export const FIRM = { name: "MKB Financial Group", tagline: "STRATEGY • GROWTH • LEGACY", phone: "833-379-3320", email: "info@mkbfinancialgroup.com", areas: "Louisiana • Texas • Virtual" };

export const EMAIL_TEMPLATES: Record<TemplateKey, TemplateDef> = {
  tax_intake_received: {
    key: "tax_intake_received",
    name: "Tax interview received",
    when: "Sent right after a tax interview is submitted (by the client, or by staff in the office). The PDF copy is attached.",
    placeholders: ["firstName", "taxYear", "date"],
    subject: "We received your {{taxYear}} tax interview — here's what happens next",
    heading: "Thank you, {{firstName}} — your interview is in.",
    intro: "We received your {{taxYear}} tax interview on {{date}}. A copy is attached for your records and is saved in your client portal.",
    docsTitle: "Documents we still need",
    docsNote: "Upload them in your portal, or drop them off at our office. Please don't email tax documents.",
    steps: "We gather your documents. As they arrive we check them off — you'll see the list update in your portal.\nYour preparer works on your return and reaches out only if something is unclear.\nYou review and sign. We'll send your return for approval and e-signature.\nWe file and confirm. You'll get an email when the IRS accepts it.",
    button: "Open your client portal",
    closing: "Questions? Reply through your portal or call us at 833-379-3320.",
  },
  tax_document_reminder: {
    key: "tax_document_reminder",
    name: "Document reminder",
    when: "Sent when staff click Remind on outstanding documents.",
    placeholders: ["firstName", "taxYear", "count"],
    subject: "Reminder: {{count}} still needed for your {{taxYear}} tax return",
    heading: "Just a friendly reminder, {{firstName}}.",
    intro: "We're ready to keep working on your {{taxYear}} return as soon as we have:",
    docsTitle: "Still needed",
    docsNote: "Already sent these? You can ignore this message — it can take a business day for us to check them off.",
    steps: "",
    button: "Upload in your portal",
    closing: "Prefer paper? Drop them off at our office. Please don't email tax documents.",
  },
  document_reminder: {
    key: "document_reminder",
    name: "Document reminder (any service)",
    when: "Sent when staff click Remind on an outstanding document in Documents.",
    placeholders: ["firstName", "count"],
    subject: "Reminder: {{count}} still needed from you",
    heading: "Just a friendly reminder, {{firstName}}.",
    intro: "We're ready to keep working as soon as we have:",
    docsTitle: "Still needed",
    docsNote: "Already sent these? You can ignore this message — it can take a business day for us to check them off.",
    steps: "",
    button: "Upload in your portal",
    closing: "Please upload documents in your secure portal — don't email documents with personal or financial information.",
  },
  tax_extension_filed: {
    key: "tax_extension_filed",
    name: "Extension filed",
    when: "Sent when staff record an extension (if they leave the email box ticked).",
    placeholders: ["firstName", "taxYear", "dueDate", "payNote"],
    subject: "We filed your {{taxYear}} tax extension",
    heading: "Your extension is filed, {{firstName}}.",
    intro: "We filed an extension for your {{taxYear}} tax return. Your new filing deadline is {{dueDate}}. {{payNote}}",
    docsTitle: "Documents we still need",
    docsNote: "Upload them in your portal, or drop them off at our office. Please don't email tax documents.",
    steps: "An extension gives you more time to file, not more time to pay. Interest applies to any tax not paid by the original due date.\nWe'll keep working on your return as your documents come in.\nWe'll let you know when it's ready for your review and signature.",
    button: "Open your client portal",
    closing: "Questions? Reply through your portal or call us at 833-379-3320.",
  },
  portal_invite: {
    key: "portal_invite",
    name: "Client portal invitation",
    when: "Sent when staff invite a client to the portal (or resend the invitation). The button lets them choose a password.",
    placeholders: ["firstName", "staffName", "expires"],
    subject: "Your MKB Financial Group client portal is ready",
    heading: "Welcome, {{firstName}} — your secure client portal is ready.",
    intro: "{{staffName}} invited you to the MKB Financial Group client portal. In one place you can see where your services stand, upload the documents we need, view and pay invoices, download your signed documents and message our team securely.",
    docsTitle: "",
    docsNote: "",
    steps: "Choose your password using the button below.\nEach time you sign in, we'll email you a 6-digit code to confirm it's you.\nOpen your to-do list to see anything we need from you.",
    button: "Set up my portal",
    closing: "This invitation link expires on {{expires}}. Didn't expect this email? Call us at 833-379-3320.",
  },
  books_items: {
    key: "books_items",
    name: "Bookkeeping — items needed",
    when: "Sent when a month opens with tasks for the client, or when MKB sends questions or adds a task. Lists what's needed; the client completes it in the portal.",
    placeholders: ["firstName", "business", "period"],
    subject: "{{business}}: we need a few items for {{period}}",
    heading: "Hi {{firstName}}, here's what we need for {{period}}.",
    intro: "To keep the books for {{business}} on schedule, please take care of these in your client portal.",
    docsTitle: "Your to-do list",
    docsNote: "Upload files and answer questions right in the portal — please don't email bank statements or receipts.",
    steps: "",
    button: "Open my portal",
    closing: "Questions? Reply in the portal or call us at 833-379-3320.",
  },
  books_reminder: {
    key: "books_reminder",
    name: "Bookkeeping — reminder",
    when: "Sent when staff click Remind on a bookkeeping month with open client items.",
    placeholders: ["firstName", "business", "period"],
    subject: "Reminder: {{period}} items for {{business}}",
    heading: "Hi {{firstName}}, a friendly reminder.",
    intro: "We're still waiting on a few items for {{business}} for {{period}}. Once they're in, we can finish your books for the month.",
    docsTitle: "Still open",
    docsNote: "",
    steps: "",
    button: "Open my portal",
    closing: "Questions? Reply in the portal or call us at 833-379-3320.",
  },
  books_reports_ready: {
    key: "books_reports_ready",
    name: "Bookkeeping — reports ready",
    when: "Sent when MKB delivers a month's financial reports (and when a month is closed). The reports are in the client's portal — never attached to the email.",
    placeholders: ["firstName", "business", "period"],
    subject: "Your {{period}} financial reports are ready",
    heading: "Hi {{firstName}}, your {{period}} reports are ready.",
    intro: "We've finished the books for {{business}} for {{period}}. Your reports are waiting in your client portal under Documents.",
    docsTitle: "Reports",
    docsNote: "",
    steps: "",
    button: "View my reports",
    closing: "Questions about your numbers? Message us in the portal or call 833-379-3320.",
  },
  portal_message: {
    key: "portal_message",
    name: "New portal message",
    when: "Sent when MKB writes to a client who uses the portal. The message itself is never in the email — they read it after signing in.",
    placeholders: ["firstName"],
    subject: "You have a new secure message from MKB Financial Group",
    heading: "Hi {{firstName}}, you have a new message.",
    intro: "Our team sent you a secure message. For your privacy, sign in to your client portal to read and reply.",
    docsTitle: "",
    docsNote: "",
    steps: "",
    button: "Read my message",
    closing: "Questions? Call us at 833-379-3320.",
  },
  tax_interview_link: {
    key: "tax_interview_link",
    name: "Tax interview link",
    when: "Sent when staff click Send interview link (on a return, or to a lead). The button opens the client's private tax interview — no portal login. The link expires and stops working once the interview is submitted.",
    placeholders: ["firstName", "taxYear", "expires", "staffName"],
    subject: "Your {{taxYear}} MKB tax interview — private link inside",
    heading: "Hi {{firstName}}, let's get your {{taxYear}} taxes started.",
    intro: "{{staffName}} at MKB Financial Group sent you a private link to complete your {{taxYear}} tax interview on your phone or computer — no account or password needed. Your answers save as you go, so you can stop and come back.",
    docsTitle: "",
    docsNote: "",
    steps: "Answer the questions about your household, income and deductions.\nRead and sign our engagement letter, then sign and submit.\nWe email you a copy and the list of documents to upload in your client portal.",
    button: "Start my interview",
    closing: "This link is just for you — please don't forward it. It expires on {{expires}} and stops working once you submit. Didn't expect this email or need a new link? Call us at 833-379-3320.",
  },
  books_intake_received: {
    key: "books_intake_received",
    name: "Bookkeeping intake received",
    when: "Sent right after a bookkeeping intake is submitted. The signed PDF copy is attached. No price yet — MKB reviews it first and sends the proposal.",
    placeholders: ["firstName", "businessName", "date"],
    subject: "We received your bookkeeping intake — here's what happens next",
    heading: "Thank you, {{firstName}} — we received {{businessName}}'s intake.",
    intro: "We received your signed bookkeeping intake on {{date}}. A copy is attached. Our team is reviewing your answers to put together the right plan and price for you.",
    docsTitle: "What we need from you",
    docsNote: "Upload these in your client portal. Please don't email bank statements or tax documents.",
    steps: "We review your answers and confirm the right plan and price.\nWe email you your proposal and engagement letter to review and sign online.\nOnce you sign, we connect your accounts and set your first monthly close date.\nEach month you get your reports and a list of anything we need from you.",
    button: "Open your client portal",
    closing: "Questions? Reply through your portal or call us at 833-379-3320.",
  },
  books_proposal: {
    key: "books_proposal",
    name: "Bookkeeping proposal",
    when: "Sent when staff send the reviewed proposal. The button opens the client's private link to review the price and sign the engagement letter.",
    placeholders: ["firstName", "businessName", "expires", "staffName"],
    subject: "Your MKB bookkeeping proposal is ready to review and sign",
    heading: "Hi {{firstName}}, your proposal for {{businessName}} is ready.",
    intro: "{{staffName}} reviewed your intake and prepared your bookkeeping proposal. Open your private link to see your plan and price, read the engagement letter and sign it online — no account or password needed.",
    docsTitle: "",
    docsNote: "",
    steps: "Review your plan and price.\nRead the engagement letter.\nSign with your finger or mouse and submit.",
    button: "Review and sign",
    closing: "This link is just for you — please don't forward it. It expires on {{expires}}. Questions about your price? Call us at 833-379-3320 before you sign.",
  },
  books_proposal_signed: {
    key: "books_proposal_signed",
    name: "Bookkeeping proposal signed",
    when: "Sent when the client signs the bookkeeping proposal and engagement letter. The signed PDF is attached.",
    placeholders: ["firstName", "businessName", "date", "plan"],
    subject: "Your signed MKB bookkeeping engagement letter",
    heading: "Welcome aboard, {{firstName}}!",
    intro: "Thank you for signing your bookkeeping proposal and engagement letter on {{date}}. A signed copy is attached. Your plan: {{plan}}.",
    docsTitle: "",
    docsNote: "",
    steps: "We connect your accounts and review your books, including any catch-up months.\nWe confirm your first monthly close date.\nEach month you get your reports and a list of anything we need from you.",
    button: "Open your client portal",
    closing: "Questions? Reply through your portal or call us at 833-379-3320.",
  },
  service_intake_link: {
    key: "service_intake_link",
    name: "Service intake link (payroll, Business Solutions, Record Relief)",
    when: "Sent when staff send a payroll, Business Solutions or Record Relief intake, or automatically after a website Get Started form. The button opens the client's private intake — no portal login.",
    placeholders: ["firstName", "service", "expires", "days", "staffName"],
    subject: "Your MKB {{service}} intake — private link inside",
    heading: "Hi {{firstName}}, let's get started.",
    intro: "MKB Financial Group sent you a private link to complete your {{service}} intake on your phone or computer — no account or password needed. Your answers save as you go, so you can stop and come back. At the end you'll sign and submit.",
    docsTitle: "",
    docsNote: "",
    steps: "Answer the questions.\nSign with your finger or mouse and submit.\nWe review your answers and reach out with next steps.",
    button: "Start my intake",
    closing: "This link is just for you — please don't forward it. It expires on {{expires}} ({{days}} days) and stops working once you submit. Didn't expect this email or need a new link? Call us at 833-379-3320.",
  },
  service_intake_received: {
    key: "service_intake_received",
    name: "Service intake received (payroll, Business Solutions, Record Relief)",
    when: "Sent right after a payroll, Business Solutions or Record Relief intake is submitted. The signed PDF copy is attached.",
    placeholders: ["firstName", "service", "date", "next"],
    subject: "We received your {{service}} intake — here's what happens next",
    heading: "Thank you, {{firstName}} — we received your intake.",
    intro: "We received your signed {{service}} intake on {{date}}. A copy is attached. {{next}}",
    docsTitle: "What we need from you",
    docsNote: "Upload these in your client portal. Please don't email documents with Social Security or account numbers.",
    steps: "",
    button: "Open your client portal",
    closing: "Questions? Reply through your portal or call us at 833-379-3320.",
  },
  books_intake_link: {
    key: "books_intake_link",
    name: "Bookkeeping intake link",
    when: "Sent when staff click Send intake link. The button opens the client's private intake — no portal login. The link expires and stops working once the intake is submitted.",
    placeholders: ["firstName", "businessName", "expires", "days", "staffName"],
    subject: "Your MKB bookkeeping intake — private link inside",
    heading: "Hi {{firstName}}, let's get {{businessName}} set up.",
    intro: "{{staffName}} at MKB Financial Group sent you a private link to complete your bookkeeping intake on your phone or computer — no account or password needed. Your answers save as you go, so you can stop and come back. At the end you'll sign and submit. We then review your answers and email you your proposal and engagement letter.",
    docsTitle: "",
    docsNote: "",
    steps: "Answer the questions about your business, accounts and goals.\nSign with your finger or mouse and submit.\nWe review your answers and email you your proposal and engagement letter to sign.",
    button: "Start my intake",
    closing: "This link is just for you — please don't forward it. It expires on {{expires}} ({{days}} days) and stops working once you submit. Didn't expect this email or need a new link? Call us at 833-379-3320.",
  },
  invoice_sent: {
    key: "invoice_sent",
    name: "Invoice",
    when: "Sent when staff send or resend an invoice. The branded invoice PDF is attached.",
    placeholders: ["firstName", "number", "amount", "dueDate", "payNote"],
    subject: "Invoice {{number}} from MKB Financial Group",
    heading: "Hi {{firstName}}, here's your invoice.",
    intro: "Invoice {{number}} for {{amount}} is attached. {{payNote}}",
    docsTitle: "Invoice",
    docsNote: "",
    steps: "",
    button: "View and pay",
    closing: "Questions about your invoice? Call us at 833-379-3320.",
  },
  tax_document_request: {
    key: "tax_document_request",
    name: "Documents requested",
    when: "Sent when staff request documents for a tax return.",
    placeholders: ["firstName", "taxYear", "count"],
    subject: "Documents needed for your {{taxYear}} tax return",
    heading: "Hi {{firstName}}, we need a few documents.",
    intro: "To keep your {{taxYear}} return moving, please send us:",
    docsTitle: "Documents needed",
    docsNote: "Upload them in your portal, or drop them off at our office. Please don't email tax documents.",
    steps: "",
    button: "Upload in your portal",
    closing: "Questions? Reply through your portal or call us at 833-379-3320.",
  },
  booking_confirmed: {
    key: "booking_confirmed",
    name: "Appointment confirmed",
    when: "Sent when someone books online (after payment, for paid appointments) or when staff schedule an appointment and leave “Email them” ticked. A calendar invite is attached.",
    placeholders: ["firstName", "typeName", "when", "where", "staffName", "paid"],
    subject: "You're booked: {{typeName}} on {{when}}",
    heading: "You're all set, {{firstName}}.",
    intro: "Your {{typeName}} with {{staffName}} is confirmed for {{when}}. {{paid}}",
    docsTitle: "Appointment details",
    docsNote: "A calendar invite is attached — add it to your calendar so you don't miss it.",
    steps: "",
    button: "Reschedule or cancel",
    closing: "Questions before we meet? Call us at 833-379-3320. Please don't email tax documents or your Social Security number.",
  },
  booking_reminder: {
    key: "booking_reminder",
    name: "Appointment reminder",
    when: "Sent automatically before an appointment (24 hours and 1 hour before, by default — change it in Calendar → Booking settings).",
    placeholders: ["firstName", "typeName", "when", "where", "staffName"],
    subject: "Reminder: {{typeName}} on {{when}}",
    heading: "See you soon, {{firstName}}.",
    intro: "This is a reminder of your {{typeName}} with {{staffName}} on {{when}}.",
    docsTitle: "Appointment details",
    docsNote: "",
    steps: "",
    button: "Reschedule or cancel",
    closing: "Running late or need to change the time? Call us at 833-379-3320.",
  },
  booking_changed: {
    key: "booking_changed",
    name: "Appointment moved",
    when: "Sent when an appointment's time changes (rescheduled by the client online, or moved by staff with “Email them” ticked). An updated calendar invite is attached.",
    placeholders: ["firstName", "typeName", "when", "where", "staffName"],
    subject: "New time: {{typeName}} on {{when}}",
    heading: "Your appointment has a new time, {{firstName}}.",
    intro: "Your {{typeName}} with {{staffName}} is now {{when}}.",
    docsTitle: "Appointment details",
    docsNote: "An updated calendar invite is attached.",
    steps: "",
    button: "Reschedule or cancel",
    closing: "Questions? Call us at 833-379-3320.",
  },
  booking_cancelled: {
    key: "booking_cancelled",
    name: "Appointment cancelled",
    when: "Sent when an appointment is cancelled (by the client online, or by staff with “Email them” ticked).",
    placeholders: ["firstName", "typeName", "when", "staffName"],
    subject: "Cancelled: {{typeName}} on {{when}}",
    heading: "Your appointment is cancelled, {{firstName}}.",
    intro: "Your {{typeName}} with {{staffName}} on {{when}} has been cancelled.",
    docsTitle: "",
    docsNote: "",
    steps: "",
    button: "Book a new time",
    closing: "Paid for this appointment? We'll be in touch about your refund. Questions? Call us at 833-379-3320.",
  },
};

export const WORDING_FIELDS: { key: keyof EmailWording; label: string; long?: boolean }[] = [
  { key: "subject", label: "Subject" },
  { key: "heading", label: "Heading" },
  { key: "intro", label: "Opening paragraph", long: true },
  { key: "docsNote", label: "Note under the document list", long: true },
  { key: "steps", label: "What happens next (one step per line)", long: true },
  { key: "button", label: "Button text" },
  { key: "closing", label: "Closing line", long: true },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (s: string, v: Record<string, string>) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => v[k] ?? "");

export type RenderInput = { wording: EmailWording; docsTitle: string; vars: Record<string, string>; documents?: string[]; buttonUrl: string; logoUrl: string };

/** Branded email (HTML + plain text). Wording is escaped; only the fixed layout is HTML. */
export function renderEmail({ wording: w, docsTitle, vars, documents = [], buttonUrl, logoUrl }: RenderInput) {
  const t = (s: string) => fill(s, vars);
  const steps = w.steps.split("\n").map((x) => x.trim()).filter(Boolean).map(t);
  const gold = "#b87912";
  const html = `<!doctype html><html><body style="margin:0;background:#eceae4;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceae4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:20px 24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><img src="${esc(logoUrl)}" width="52" height="52" alt="${FIRM.name}" style="display:block;border:0"></td>
<td style="padding-left:14px"><div style="font:600 18px Georgia,serif;color:#ffffff">${FIRM.name}</div><div style="font-size:10px;letter-spacing:3px;color:#f6d37a;font-weight:bold">${FIRM.tagline}</div></td>
</tr></table></td></tr>
<tr><td style="height:4px;background:${gold};background-image:linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)"></td></tr>
<tr><td style="padding:26px 24px;font-size:15px;line-height:1.6">
<h1 style="font:500 24px/1.2 Georgia,serif;margin:0 0 12px">${esc(t(w.heading))}</h1>
<p style="margin:0 0 12px">${esc(t(w.intro))}</p>
${documents.length ? `<div style="background:#f7f6f2;border:1px solid #e5e1d8;border-radius:10px;padding:14px 16px;margin:16px 0"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a6a2a;font-weight:bold;margin-bottom:6px">${esc(docsTitle)}</div><ul style="margin:0;padding-left:18px">${documents.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>${w.docsNote ? `<p style="margin:8px 0 0;font-size:13px;color:#555">${esc(t(w.docsNote))}</p>` : ""}</div>` : ""}
${steps.length ? `<div style="font:500 19px Georgia,serif;margin:20px 0 6px">What happens next</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps.map((s, i) => `<tr><td width="34" valign="top" style="padding:8px 0"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:#0b0b0b;color:#f6d37a;font-weight:bold;font-size:13px;text-align:center">${i + 1}</div></td><td style="padding:8px 0;border-bottom:1px solid #f0ede6">${esc(s)}</td></tr>`).join("")}</table>` : ""}
<p style="text-align:center;margin:24px 0 8px"><a href="${esc(buttonUrl)}" style="display:inline-block;background:${gold};color:#111111;font-weight:bold;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;padding:13px 22px;text-decoration:none;border-radius:4px">${esc(t(w.button))}</a></p>
<p style="font-size:13px;color:#555;margin:12px 0 0">${esc(t(w.closing))}</p>
</td></tr>
<tr><td style="background:#0b0b0b;color:#aaaaaa;font-size:12px;padding:16px 24px;line-height:1.5"><b style="color:#f6d37a">${FIRM.name}</b> · ${FIRM.phone} · ${FIRM.email}<br>${FIRM.areas} — For your security we never ask you to email tax documents or your Social Security number.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    t(w.heading), "", t(w.intro),
    ...(documents.length ? ["", `${docsTitle}:`, ...documents.map((d) => `- ${d}`), ...(w.docsNote ? [t(w.docsNote)] : [])] : []),
    ...(steps.length ? ["", "What happens next:", ...steps.map((s, i) => `${i + 1}. ${s}`)] : []),
    "", `${t(w.button)}: ${buttonUrl}`, "", t(w.closing), "", `${FIRM.name} · ${FIRM.phone} · ${FIRM.email}`, "For your security we never ask you to email tax documents or your Social Security number.",
  ].join("\n");
  return { subject: t(w.subject), html, text };
}

/** Saved wording over the defaults (unknown or empty fields fall back). */
export function wordingFor(key: TemplateKey, saved?: Partial<EmailWording> | null): EmailWording {
  const d = EMAIL_TEMPLATES[key];
  const pick = (k: keyof EmailWording) => (typeof saved?.[k] === "string" ? (saved[k] as string) : d[k]);
  return { subject: pick("subject") || d.subject, heading: pick("heading") || d.heading, intro: pick("intro"), docsNote: pick("docsNote"), steps: pick("steps"), button: pick("button") || d.button, closing: pick("closing") };
}
