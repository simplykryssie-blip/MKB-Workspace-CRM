/**
 * Automatic client emails: default wording plus the branded layout.
 * Staff can change the wording in Settings (stored per template); the layout,
 * security footer and placeholders stay fixed. Used by the server to send and
 * by Settings to preview. Never put SSNs, EINs, amounts owed by the IRS or
 * document contents in an email.
 */

export type TemplateKey = "tax_intake_received" | "tax_document_reminder" | "tax_document_request" | "tax_extension_filed" | "invoice_sent" | "books_intake_received";

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
  books_intake_received: {
    key: "books_intake_received",
    name: "Bookkeeping intake received",
    when: "Sent right after a bookkeeping intake is submitted. The PDF copy is attached.",
    placeholders: ["firstName", "businessName", "date", "plan"],
    subject: "We received your bookkeeping intake — here's what happens next",
    heading: "Thank you, {{firstName}} — we're getting {{businessName}} set up.",
    intro: "We received your bookkeeping intake on {{date}}. A copy is attached and saved in your client portal. Recommended plan: {{plan}}.",
    docsTitle: "What we need from you",
    docsNote: "Upload these in your portal. Please don't email bank statements or tax documents.",
    steps: "Invite MKB to your accounting software (we'll send instructions if you need them).\nWe connect your accounts and review your books, including any catch-up months.\nWe confirm your plan and your first monthly close date.\nEach month you get your reports and a list of anything we need from you.",
    button: "Open your client portal",
    closing: "Questions? Reply through your portal or call us at 833-379-3320.",
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
