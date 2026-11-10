/**
 * Tax interview engine — data-driven, branching questionnaire.
 *
 * One interview per return. The return's form (1040, 1040 + Sch C, 1040-X, 1065,
 * 1120-S, 1120) picks the sections; every answer can reveal or hide later
 * questions, and some sections repeat (one per W-2, dependent, rental, owner…).
 *
 * Production (Phase 3): question sets are versioned per tax year and approved
 * by the preparer; answers are saved server-side as the client goes, and
 * SSN/EIN/bank fields go straight to the encrypted vault (only the last four
 * digits are ever kept with the answers — the prototype does the same).
 */
import type { DocSpec, TaxForm } from "@/lib/tax/config";

export type Row = Record<string, string>;
export type Answers = Record<string, string | Row[]>;
export type Cond = (a: Answers, row?: Row) => boolean;

export type QType =
  | "yesno"
  | "choice"
  | "multi"
  | "text"
  | "textarea"
  | "money"
  | "number"
  | "percent"
  | "date"
  | "year"
  | "state"
  /** US ZIP code: 5 digits or ZIP+4. */
  | "zip"
  /** Last four digits of an account number (full numbers are never collected). */
  | "last4"
  | "phone"
  | "email"
  /** SSN / ITIN — kept as last four only. */
  | "ssn"
  /** EIN — kept as last four only. */
  | "ein"
  /** SSN or EIN depending on the owner type — last four only. */
  | "tin"
  /** Bank routing / account — last four only. */
  | "bank"
  /** IRS Identity Protection PIN (6 digits) — encrypted like an SSN, last four only. */
  | "ippin";
/** Kinds of numbers that go straight to the encrypted vault. */
export type SecureKind = "ssn" | "ein" | "bank" | "pin";

export type Q = {
  id: string;
  label: string;
  type: QType;
  help?: string;
  options?: readonly string[];
  optional?: boolean;
  show?: Cond;
  /** Documents requested when the answer is "Yes" (or equals `docsWhen`). */
  docs?: DocSpec[];
  docsWhen?: string;
  /** Profile field used to pre-fill the answer. */
  prefill?: PrefillKey;
  placeholder?: string;
  /** Firm warning shown prominently (always, or only when the answer equals `warnWhen`). */
  warn?: string;
  warnWhen?: string;
  /** A helpful outside link shown with the help or warning (opens in a new tab). */
  link?: { href: string; label: string };
};

export type Section = {
  id: string;
  title: string;
  /** Navigation group, e.g. "About you", "Income". */
  group: string;
  intro?: string;
  /** Which parts of the return this section supplies (coverage map). */
  covers: string[];
  show?: Cond;
  repeat?: { noun: string; min?: number; rowTitle?: (r: Row, i: number) => string; rowDocs?: (r: Row, a: Answers) => DocSpec[] };
  /** Whole-section rule (e.g. ownership can't add up to more than 100%). Returns the problem, or nothing. */
  check?: (a: Answers) => string | undefined;
  /** Documents this section calls for that depend on several answers (e.g. multiple-choice). */
  docs?: (a: Answers) => DocSpec[];
  questions: Q[];
};

export type PrefillKey = "firstName" | "lastName" | "taxId" | "dob" | "phone" | "email" | "street" | "city" | "state" | "zip" | "bizName" | "ein" | "formed" | "bizState" | "activity" | "fiscal";
export type Prefill = Partial<Record<PrefillKey, string>>;

/* ---------------- condition helpers ---------------- */

const val = (a: Answers, row: Row | undefined, id: string) => (row && id in row ? row[id] : typeof a[id] === "string" ? (a[id] as string) : undefined);
export const is = (id: string, ...vals: string[]): Cond => (a, row) => vals.includes(val(a, row, id) ?? "");
export const yes = (id: string): Cond => is(id, "Yes");
export const has = (id: string, v: string): Cond => (a, row) => (val(a, row, id) ?? "").split("|").includes(v);
export const gt = (id: string, n: number): Cond => (a, row) => Number(val(a, row, id) ?? 0) > n;
export const not = (c: Cond): Cond => (a, row) => !c(a, row);
export const all = (...cs: Cond[]): Cond => (a, row) => cs.every((c) => c(a, row));
export const any = (...cs: Cond[]): Cond => (a, row) => cs.some((c) => c(a, row));
export const form = (...forms: TaxForm[]): Cond => (a) => forms.includes(a.__form as TaxForm);

/* ---------------- evaluation ---------------- */

export const sectionVisible = (s: Section, a: Answers) => !s.show || s.show(a);
export const qVisible = (q: Q, a: Answers, row?: Row) => !q.show || q.show(a, row);
export const rowsOf = (a: Answers, sectionId: string): Row[] => (Array.isArray(a[sectionId]) ? (a[sectionId] as Row[]) : []);
const filled = (v?: string) => v !== undefined && v.trim() !== "";

/** Required questions still unanswered in a section (counts every repeat row). */
/** Why an answer isn't acceptable as entered (format problems), or nothing. */
export function invalidReason(q: Q, v?: string): string | undefined {
  if (!filled(v)) return undefined;
  const t = v!.trim();
  if (q.type === "zip" && !/^\d{5}(-\d{4})?$/.test(t)) return "Enter a 5-digit ZIP (or ZIP+4).";
  if (q.type === "last4" && !/^\d{4}$/.test(t)) return "Enter only the last 4 digits.";
  if (q.type === "percent" && !(Number(t) >= 0 && Number(t) <= 100)) return "Enter a percentage from 0 to 100.";
  if (q.type === "state" && !/^[A-Z]{2}$/.test(t)) return "Choose a state.";
  return undefined;
}
/** Shown red: required and empty, or filled in the wrong format. */
export const needsFix = (q: Q, v?: string) => (!q.optional && !filled(v)) || !!invalidReason(q, v);

export function missingIn(s: Section, a: Answers): { id: string; label: string; row?: number }[] {
  if (!sectionVisible(s, a)) return [];
  const out: { id: string; label: string; row?: number }[] = [];
  if (s.repeat) {
    const rows = rowsOf(a, s.id);
    if (rows.length < (s.repeat.min ?? 1)) out.push({ id: `${s.id}:rows`, label: `Add at least one ${s.repeat.noun}` });
    rows.forEach((r, i) => s.questions.forEach((q) => qVisible(q, a, r) && needsFix(q, r[q.id]) && out.push({ id: q.id, label: q.label, row: i })));
  } else {
    s.questions.filter((q) => qVisible(q, a) && needsFix(q, val(a, undefined, q.id))).forEach((q) => out.push({ id: q.id, label: q.label }));
  }
  const problem = s.check?.(a);
  if (problem) out.push({ id: `${s.id}:check`, label: problem });
  return out;
}

export function progress(sections: Section[], a: Answers) {
  let need = 0;
  let done = 0;
  sections.filter((s) => sectionVisible(s, a)).forEach((s) => {
    if (s.repeat) {
      const rows = rowsOf(a, s.id);
      need += 1;
      if (rows.length >= (s.repeat.min ?? 1)) done += 1;
      rows.forEach((r) => s.questions.forEach((q) => { if (!q.optional && qVisible(q, a, r)) { need++; if (filled(r[q.id])) done++; } }));
    } else
      s.questions.forEach((q) => { if (!q.optional && qVisible(q, a)) { need++; if (filled(val(a, undefined, q.id))) done++; } });
  });
  return { need, done, pct: need ? Math.round((done / need) * 100) : 0 };
}

/** Documents the answers call for. */
export function docsFor(sections: Section[], a: Answers): DocSpec[] {
  const out: DocSpec[] = [];
  const add = (d: DocSpec) => !out.some((x) => x.name === d.name) && out.push(d);
  sections.filter((s) => sectionVisible(s, a)).forEach((s) => {
    if (s.repeat) {
      rowsOf(a, s.id).forEach((r) => {
        s.repeat!.rowDocs?.(r, a).forEach(add);
        s.questions.forEach((q) => q.docs && qVisible(q, a, r) && r[q.id] === (q.docsWhen ?? "Yes") && q.docs.forEach(add));
      });
    } else s.questions.forEach((q) => q.docs && qVisible(q, a) && val(a, undefined, q.id) === (q.docsWhen ?? "Yes") && q.docs.forEach(add));
    s.docs?.(a).forEach(add);
  });
  return out;
}

export type CoverageItem = { part: string; section: string; sectionId: string; status: "complete" | "incomplete" | "not_applicable" };
/** Which parts of the return the interview has collected information for. */
export function coverage(sections: Section[], a: Answers): CoverageItem[] {
  return sections.flatMap((s) => {
    const status: CoverageItem["status"] = !sectionVisible(s, a) ? "not_applicable" : missingIn(s, a).length ? "incomplete" : "complete";
    return s.covers.map((part) => ({ part, section: s.title, sectionId: s.id, status }));
  });
}

/** Human-readable answer. */
export function display(q: Q, v?: string) {
  if (!filled(v)) return "—";
  if (q.type === "last4") return `••••${v}`;
  if (q.type === "money") return `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (q.type === "percent") return `${v}%`;
  if (q.type === "multi") return v!.split("|").join(", ");
  return v!;
}

/** Keep only the last four digits of a sensitive number. */
export const maskLast4 = (raw: string, kind: SecureKind) => {
  const d = raw.replace(/\D/g, "");
  if (d.length < 4) return "";
  const l4 = d.slice(-4);
  return kind === "ssn" ? `•••-••-${l4}` : kind === "ein" ? `••-•••${l4}` : kind === "pin" ? `••${l4}` : `••••${l4}`;
};
