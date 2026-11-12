/**
 * Form 8821 — shared types and rules (browser + server).
 */

export type Designee = { name: string; address: string; city: string; state: string; zip: string; caf: string; ptin: string; phone: string; fax: string };
export const EMPTY_DESIGNEE: Designee = { name: "", address: "", city: "", state: "", zip: "", caf: "", ptin: "", phone: "", fax: "" };
/** MKB as its own e-file service bureau (staff only). Blank designee name/address/phone/fax on Form 8821 fall back to these. */
export type Bureau = { name: string; ein: string; efin: string; etin: string; address: string; city: string; state: string; zip: string; phone: string; fax: string; email: string };
export const EMPTY_BUREAU: Bureau = { name: "", ein: "", efin: "", etin: "", address: "", city: "", state: "", zip: "", phone: "", fax: "", email: "" };
export const designeeReady = (d: Designee) => !!(d.name.trim() && d.address.trim() && d.city.trim() && d.state.trim() && d.zip.trim() && d.caf.trim());

export type F8821Status = "needs_signature" | "signed" | "submitted" | "on_file" | "revoked";
export type MatterRow = { type: string; form: string; years: string; specific: string };

export type F8821 = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: "individual" | "business";
  status: F8821Status;
  yearsFrom: number;
  yearsTo: number;
  matters: MatterRow[];
  createdAt: string;
  signedAt?: string;
  signerName?: string;
  signerTitle?: string;
  signMethod?: "online" | "in_office" | "paper";
  idCheck?: string;
  copyFileId?: string;
  submittedAt?: string;
  onFileAt?: string;
  revokedAt?: string;
  note?: string;
};

export const STATUS_LABEL: Record<F8821Status, string> = {
  needs_signature: "Needs signature",
  signed: "Signed — upload to IRS",
  submitted: "Submitted to IRS",
  on_file: "On file",
  revoked: "Revoked",
};

/** IRS page where the designee uploads signed 8821s (sign-in required). */
export const IRS_SUBMIT_URL = "https://www.irs.gov/tax-professionals/submit-forms-2848-and-8821-online";

/**
 * Years covered: the last 4 tax years through 3 years ahead. Future years can
 * go at most 3 years past the year the IRS receives the form.
 */
export function yearsFor(today = new Date()) {
  const y = today.getFullYear();
  return { from: y - 4, to: y + 3 };
}

const BIZ_FORM: Record<string, string> = { "S Corporation": "1120-S", "C Corporation": "1120", Partnership: "1065", LLC: "1065", Nonprofit: "990" };

/** Line 3 rows: income tax (+ payroll for businesses) and civil penalties, with notices to the designee. */
export function mattersFor(kind: "individual" | "business", years: { from: number; to: number }, returnForm?: string, entityType?: string): MatterRow[] {
  const yrs = `${years.from} through ${years.to}`;
  if (kind === "individual") return [
    { type: "Income", form: "1040", years: yrs, specific: "" },
    { type: "Civil Penalty", form: "Not applicable", years: yrs, specific: "" },
  ];
  const form = returnForm && returnForm !== "990" ? returnForm : BIZ_FORM[entityType ?? ""] ?? "1120-S";
  return [
    { type: "Income", form, years: yrs, specific: "" },
    { type: "Employment", form: "941, 940", years: yrs, specific: "" },
    { type: "Civil Penalty", form: "Not applicable", years: yrs, specific: "" },
  ];
}
