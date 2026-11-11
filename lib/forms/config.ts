/**
 * Forms — public lead-capture forms built inside MKB's own platform.
 *
 * Every submission becomes (or updates) a lead in the Leads pipeline. Public
 * forms never collect sensitive information (SSNs, bank details, dates of
 * birth, criminal-history details): that is collected later through the
 * secure client-portal interviews. Production (Phase 3): forms are served
 * from MKB's domain, submissions go to the backend with spam protection and
 * rate limiting, and the lead is created server-side.
 */
import type { ServiceKey } from "@/lib/types";

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "state"
  | "select"
  | "radio"
  | "checkboxes"
  | "yesno"
  | "services"
  | "consent"
  | "heading"
  | "paragraph";

export const FIELD_TYPES: { key: FieldType; label: string; input: boolean }[] = [
  { key: "text", label: "Short answer", input: true },
  { key: "textarea", label: "Paragraph answer", input: true },
  { key: "email", label: "Email", input: true },
  { key: "phone", label: "Phone", input: true },
  { key: "radio", label: "Multiple choice (one)", input: true },
  { key: "checkboxes", label: "Checkboxes (many)", input: true },
  { key: "select", label: "Dropdown", input: true },
  { key: "yesno", label: "Yes / No", input: true },
  { key: "state", label: "State", input: true },
  { key: "number", label: "Number", input: true },
  { key: "date", label: "Date", input: true },
  { key: "services", label: "MKB services picker", input: true },
  { key: "consent", label: "Consent checkbox", input: true },
  { key: "heading", label: "Section heading", input: false },
  { key: "paragraph", label: "Text block", input: false },
];
export const hasOptions = (t: FieldType) => t === "radio" || t === "checkboxes" || t === "select";

/** Where an answer goes on the lead. */
export type MapTarget = "none" | "fullName" | "firstName" | "lastName" | "email" | "phone" | "businessName" | "entityType" | "city" | "state" | "zip" | "services" | "preferredContact" | "notes";
export const MAP_TARGETS: { key: MapTarget; label: string }[] = [
  { key: "none", label: "Not mapped (kept with the submission)" },
  { key: "fullName", label: "Lead — full name" },
  { key: "firstName", label: "Lead — first name" },
  { key: "lastName", label: "Lead — last name" },
  { key: "email", label: "Lead — email" },
  { key: "phone", label: "Lead — phone" },
  { key: "businessName", label: "Lead — business name (makes it a business lead)" },
  { key: "entityType", label: "Lead — business type" },
  { key: "city", label: "Lead — city" },
  { key: "state", label: "Lead — state" },
  { key: "zip", label: "Lead — ZIP" },
  { key: "services", label: "Lead — services interested in" },
  { key: "preferredContact", label: "Lead — preferred contact method (note)" },
  { key: "notes", label: "Lead — first note" },
];

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  options?: string[];
  map: MapTarget;
  /** Show only when another field has a given answer. */
  showIf?: { fieldId: string; equals: string };
};

export type FormStatus = "draft" | "published" | "archived";

export type LeadForm = {
  id: string;
  name: string;
  slug: string;
  title: string;
  intro?: string;
  status: FormStatus;
  fields: FormField[];
  /** Services added to every lead from this form. */
  services: ServiceKey[];
  routing: { ownerId: string; stageId: string; source: string; sourceDetail?: string; tags: string[]; followUpHours: number; autoIntake?: AutoIntake };
  thankYou: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type SubmissionOutcome = "new_lead" | "existing_lead" | "existing_client" | "spam";
export const OUTCOME_META: Record<SubmissionOutcome, { label: string; tone: "success" | "info" | "neutral" | "danger" }> = {
  new_lead: { label: "New lead", tone: "success" },
  existing_lead: { label: "Added to existing lead", tone: "info" },
  existing_client: { label: "Existing client", tone: "neutral" },
  spam: { label: "Spam", tone: "danger" },
};

export type Submission = {
  id: string;
  formId: string;
  at: string;
  data: Record<string, string>;
  channel: "Website embed" | "Direct link" | "Staff test";
  outcome: SubmissionOutcome;
  leadId?: string;
  clientId?: string;
};

/** Words that suggest a field would collect sensitive information — not allowed on public forms. */
const SENSITIVE = /\b(ssn|social security|tax ?id|itin|\bein\b|bank|routing|account number|credit card|card number|password|date of birth|birth ?date|dob|arrest|conviction|convicted|criminal|charges?|offense|felony|misdemeanor|diagnos|medical record)/i;
export const sensitiveReason = (f: Pick<FormField, "label" | "help" | "options">) => {
  // Help text that warns visitors NOT to share something ("Please don't include SSNs") is fine.
  const helpAsks = f.help && !/\b(don['’]?t|do not|never|not include|without)\b/i.test(f.help) ? f.help : "";
  const text = [f.label, helpAsks, ...(f.options ?? [])].join(" ");
  const m = text.match(SENSITIVE);
  return m ? `Mentions “${m[0]}”. Public forms can't collect sensitive information — collect it later in the secure client portal.` : null;
};
/** Date fields are blocked when the label suggests a date of birth (caught above); other dates are fine. */

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "form";
/**
 * "Start" forms: after submitting, the visitor is emailed their private intake
 * link automatically (the tax interview or the bookkeeping intake) — the public
 * form only asks for contact details, never sensitive information.
 * Tax: `returnFieldId` is the question whose answer (one of TAX_RETURN_CHOICES)
 * picks the return; `yearFieldId` is sent only when the answer is "Most recent tax year".
 */
export type AutoIntake = {
  kind: "tax" | "books" | "payroll" | "biz" | "relief"; returnFieldId?: string; yearFieldId?: string;
  /** Send only when this question's answer equals `onlyIfEquals` (e.g. "Is the record in Louisiana?" → "Yes"). */
  onlyIfFieldId?: string; onlyIfEquals?: string;
};
export const TAX_RETURN_CHOICES: Record<string, string> = {
  "Personal return": "1040",
  "Self-employed or single-member LLC (Schedule C)": "1040 + Sch C",
  "S corporation": "1120-S",
  "Partnership or multi-member LLC": "1065",
  "C corporation": "1120",
};
export const MOST_RECENT_YEAR = "Most recent tax year";
export const publicPath = (slug: string) => `/f/${slug}`;
/**
 * Where a form's public page lives. On the live workspace that's MKB's website
 * (www.mkbfinancialgroup.com/f/<slug>); on preview and local copies it's the
 * address you're using, so links point at that copy's own forms.
 */
export const publicOrigin = () => {
  if (typeof window === "undefined") return "https://www.mkbfinancialgroup.com";
  return window.location.hostname === "app.mkbfinancialgroup.com" ? "https://www.mkbfinancialgroup.com" : window.location.origin;
};

export const PREFERRED_CONTACT = ["Phone call", "Text message", "Email"];

let n = 0;
export const fid = () => `fld-${Date.now().toString(36)}${(n++).toString(36)}`;

/** Fields every lead form starts with. */
export const baseFields = (): FormField[] => [
  { id: fid(), type: "text", label: "Full name", required: true, map: "fullName" },
  { id: fid(), type: "email", label: "Email", required: true, map: "email" },
  { id: fid(), type: "phone", label: "Phone", required: true, map: "phone" },
];
export const consentField = (): FormField => ({
  id: fid(),
  type: "consent",
  label: "I agree that MKB Financial Group may contact me by phone, text or email about my request. Message and data rates may apply. I can opt out at any time.",
  required: true,
  map: "none",
});
