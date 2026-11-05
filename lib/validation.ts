/**
 * Formatting + validation for client identity and contact fields.
 *
 * Formatters are "progressive": safe to run on every keystroke, they keep only
 * the allowed characters and insert separators as the user types.
 * Validators return an error message, or null when the value is valid.
 * Phase 3 repeats every validator on the server — the UI is never trusted.
 */

export const digits = (s: string) => s.replace(/\D/g, "");

/* ----------------------------- Phone ----------------------------- */

/** (555) 010-0142 — strips a leading US country code "1". */
export function formatPhone(input: string) {
  let d = digits(input);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
export function validatePhone(v: string, required = false) {
  const d = digits(v);
  if (!d) return required ? "Phone number is required" : null;
  if (d.length !== 10) return "Enter a 10-digit US phone number";
  if (/^[01]/.test(d)) return "Area code can't start with 0 or 1";
  return null;
}

/* ----------------------------- Email ----------------------------- */

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export function validateEmail(v: string, required = true) {
  const e = normalizeEmail(v);
  if (!e) return required ? "Email is required" : null;
  if (e.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(e))
    return "Enter a valid email, like name@example.com";
  if (/\.\./.test(e)) return "Email can't contain two dots in a row";
  return null;
}

/* ------------------------- SSN / ITIN ---------------------------- */

export type TaxIdType = "SSN" | "ITIN";

/** 123-45-6789 */
export function formatTaxId(input: string) {
  const d = digits(input).slice(0, 9);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** ITINs always begin with 9; SSNs never do. */
export const detectTaxIdType = (v: string): TaxIdType => (digits(v).startsWith("9") ? "ITIN" : "SSN");

export function validateSSN(v: string) {
  const d = digits(v);
  if (d.length !== 9) return "SSN must be 9 digits (123-45-6789)";
  const area = d.slice(0, 3), group = d.slice(3, 5), serial = d.slice(5);
  if (area === "000" || area === "666") return "This SSN area number is never issued";
  if (area.startsWith("9")) return "Numbers starting with 9 are ITINs, not SSNs";
  if (group === "00") return "The middle two digits can't be 00";
  if (serial === "0000") return "The last four digits can't be 0000";
  return null;
}

/** IRS ITIN: 9XX-[50-65 | 70-88 | 90-92 | 94-99]-XXXX */
export function validateITIN(v: string) {
  const d = digits(v);
  if (d.length !== 9) return "ITIN must be 9 digits (9XX-XX-XXXX)";
  if (!d.startsWith("9")) return "An ITIN always starts with 9";
  const g = Number(d.slice(3, 5));
  const ok = (g >= 50 && g <= 65) || (g >= 70 && g <= 88) || (g >= 90 && g <= 92) || (g >= 94 && g <= 99);
  if (!ok) return "Digits 4–5 must be 50–65, 70–88, 90–92 or 94–99";
  return null;
}

export function validateTaxId(v: string, type: TaxIdType, required = false) {
  if (!digits(v)) return required ? `${type} is required for tax preparation` : null;
  return type === "SSN" ? validateSSN(v) : validateITIN(v);
}

/* ------------------------------ EIN ------------------------------ */

/** Prefixes the IRS assigns (campus / online codes). */
const EIN_PREFIXES = new Set(
  "01 02 03 04 05 06 10 11 12 13 14 15 16 20 21 22 23 24 25 26 27 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 50 51 52 53 54 55 56 57 58 59 60 61 62 63 64 65 66 67 68 71 72 73 74 75 76 77 80 81 82 83 84 85 86 87 88 90 91 92 93 94 95 98 99".split(" "),
);

/** 12-3456789 */
export function formatEIN(input: string) {
  const d = digits(input).slice(0, 9);
  return d.length < 3 ? d : `${d.slice(0, 2)}-${d.slice(2)}`;
}
export function validateEIN(v: string, required = false) {
  const d = digits(v);
  if (!d) return required ? "EIN is required for business tax preparation" : null;
  if (d.length !== 9) return "EIN must be 9 digits (12-3456789)";
  if (!EIN_PREFIXES.has(d.slice(0, 2))) return `"${d.slice(0, 2)}" is not a prefix the IRS assigns`;
  return null;
}

/* ------------------------------ DOB ------------------------------ */

/** MM/DD/YYYY */
export function formatDOB(input: string) {
  const d = digits(input).slice(0, 8);
  if (d.length < 3) return d;
  if (d.length < 5) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
/** "04/12/1988" → "1988-04-12" (or null if not a real calendar date). */
export function dobToIso(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (dt.getFullYear() !== Number(yyyy) || dt.getMonth() !== Number(mm) - 1 || dt.getDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}
export const isoToDob = (iso?: string) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : "");
export function validateDOB(v: string, required = false, today = new Date()) {
  if (!digits(v)) return required ? "Date of birth is required for tax preparation" : null;
  if (digits(v).length !== 8) return "Use MM/DD/YYYY";
  const iso = dobToIso(v);
  if (!iso) return "That date doesn't exist";
  const dt = new Date(iso + "T00:00");
  if (dt > today) return "Date of birth can't be in the future";
  if (today.getFullYear() - dt.getFullYear() > 120) return "Check the year — that's over 120 years ago";
  return null;
}

/* ---------------------------- Address ---------------------------- */

export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ["PR", "Puerto Rico"], ["GU", "Guam"], ["VI", "U.S. Virgin Islands"], ["AS", "American Samoa"], ["MP", "Northern Mariana Islands"],
];

/** 12345 or 12345-6789 */
export function formatZip(input: string) {
  const d = digits(input).slice(0, 9);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}
export function validateZip(v: string, required = false) {
  const d = digits(v);
  if (!d) return required ? "ZIP code is required" : null;
  if (d.length !== 5 && d.length !== 9) return "ZIP must be 5 digits or ZIP+4 (12345-6789)";
  return null;
}

export type Address = { line1: string; line2?: string; city: string; state: string; zip: string };

/** Title-cases words typed in all caps/lowercase, keeps things like "NW" and "PO". */
export function tidyLine(s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  // Only re-case text typed entirely in upper or lower case; leave mixed case ("McDonald") alone.
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) return t;
  return t
    .replace(/\b([A-Za-z])([A-Za-z']*)\b/g, (w, a: string, b: string) => (w.length <= 2 && w === w.toUpperCase() ? w : a.toUpperCase() + b.toLowerCase()));
}

export function validateAddress(a: Address, required = false) {
  const e: Partial<Record<keyof Address, string>> = {};
  // State has a default selection, so it alone doesn't count as "started".
  const any = a.line1.trim() || (a.line2 ?? "").trim() || a.city.trim() || digits(a.zip);
  if (!any && !required) return e;
  if (!a.line1.trim()) e.line1 = "Street address is required";
  if (!a.city.trim()) e.city = "City is required";
  if (!a.state) e.state = "Choose a state";
  const z = validateZip(a.zip, true);
  if (z) e.zip = z;
  return e;
}

/** One-line display: "100 Example Ave, Apt 4, Springfield, GA 30000" */
export const addressOneLine = (a: Address) => [a.line1, a.line2, a.city && a.state ? `${a.city}, ${a.state} ${a.zip}`.trim() : a.city].filter((x) => x && x !== "—").join(", ");

export const RESPONSIBLE_PARTY_TITLES = ["Owner", "Sole proprietor", "Managing member", "Member", "President", "CEO", "Partner", "Treasurer", "Other officer"];

/* ----------------------------- Masks ----------------------------- */

export const maskTaxId = (last4?: string) => (last4 ? `•••-••-${last4}` : "");
export const maskEIN = (last4?: string) => (last4 ? `••-•••${last4}` : "");
export const maskDOB = (iso?: string) => (iso ? `••/••/${iso.slice(0, 4)}` : "");
