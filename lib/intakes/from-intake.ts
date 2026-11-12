/**
 * Turns a submitted Business Solutions or Record Relief intake into the staff
 * work record: a Business Services request (pre-filled request form) or an
 * Expungement matter with the client's records as draft cases for staff review.
 * Nothing here decides eligibility or files anything.
 */
import type { EntityType } from "@/lib/biz/config";
import type { Disposition } from "@/lib/expunge/config";
import type { Answers, Row } from "@/lib/tax/interview/engine";

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const rows = (a: Answers, id: string): Row[] => (Array.isArray(a[id]) ? (a[id] as Row[]) : []);

/** "What can we help you file?" answer → Business Services catalog service. */
const NEED_SERVICE: Record<string, string> = {
  "Form a new LLC": "llc",
  "Form a corporation": "corp",
  "Form a nonprofit": "corp",
  "IRS EIN application": "ein",
  "Trade name (DBA)": "registration",
  "Register in another state": "foreign",
  "Annual report": "annual",
  "Amendment or name change": "amend",
  Dissolution: "dissolve",
  "Operating agreement": "oa",
  "Resolutions or minutes": "resolutions",
};
const ENTITY: Record<string, EntityType> = {
  "Sole proprietorship": "Sole Prop",
  "Single-member LLC": "LLC",
  "Multi-member LLC": "LLC",
  "S corporation": "S-Corp",
  "C corporation": "C-Corp",
  Partnership: "Partnership",
  Nonprofit: "Nonprofit",
};

export type BizPreset = { clientId: string; serviceId?: string; businessName: string; structure?: EntityType; state?: string; description: string; intakeId: string; others: string[] };

/** Pre-fills the New request form. The first item asked for becomes the request; others are listed so staff can start them too. */
export function bizPresetFrom(intakeId: string, clientId: string, a: Answers, submittedAt?: string): BizPreset {
  const needs = s(a.need).split("|").map((x) => x.trim()).filter(Boolean);
  const first = needs.find((n) => NEED_SERVICE[n]);
  const when = submittedAt ? new Date(submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const parts = [
    `From the client's Business Solutions intake${when ? ` (${when})` : ""}: ${needs.join(", ") || "see intake"}.`,
    s(a.timing) && `Timing: ${s(a.timing)}.`,
    s(a.purpose) && `Business purpose: ${s(a.purpose)}`,
  ].filter(Boolean);
  return {
    clientId,
    intakeId,
    serviceId: first ? NEED_SERVICE[first] : undefined,
    businessName: s(a.legalName),
    structure: ENTITY[s(a.entity)],
    state: s(a.formState) || undefined,
    description: parts.join(" "),
    others: needs.filter((n) => n !== first),
  };
}

const OUTCOME: Record<string, Disposition> = {
  "Dismissed or not prosecuted": "Dismissed",
  "Found not guilty": "Acquitted / not guilty",
  "Pleaded or found guilty — sentence completed": "Convicted",
  "Still on probation or parole": "Convicted",
};
const tri = (v: unknown) => (s(v) === "Yes" ? "yes" : s(v) === "No" ? "no" : "unknown") as "yes" | "no" | "unknown";

/** Matter intake details + one draft case per record the client listed (staff review each before it opens). */
export function reliefFrom(a: Answers) {
  const [first, ...rest] = s(a.fullName).split(/\s+/).filter(Boolean);
  const last = rest.length ? rest[rest.length - 1] : "";
  const middle = rest.slice(0, -1).join(" ");
  const intake = {
    first: first ?? "",
    middle,
    last,
    aliases: s(a.otherNames) ? s(a.otherNames).split(/[,;]/).map((x) => x.trim()).filter(Boolean) : [],
    currentAddress: [s(a.street), s(a.city), s(a.state), s(a.zip)].filter(Boolean).join(", "),
    additional: { pendingCharges: tri(a.pending), onSupervision: tri(a.supervision), priorExpungements: tri(a.prior), previousApplications: "unknown" as const, deniedApplications: "unknown" as const, hasRecords: "yes" as const },
  };
  const cases = rows(a, "records").map((r) => {
    const inLa = s(r.inLa) !== "No";
    const parish = s(r.parish);
    const disposition: Disposition = s(r.stage) === "Arrest only — no charges filed" ? "Refused / not prosecuted" : OUTCOME[s(r.outcome)] ?? "Unknown";
    return {
      // MKB Record Relief works Louisiana records; a non-Louisiana record is flagged in the notes for staff.
      jurisdictionId: "J-LA",
      state: "LA",
      remedyId: undefined,
      locality: parish ? `${parish} Parish` : "",
      arrestingAgency: s(r.agency),
      arrestingJurisdiction: parish ? `${parish} Parish` : undefined,
      sentenceCompleted: s(r.outcome) === "Pleaded or found guilty — sentence completed" ? ("yes" as const) : s(r.outcome) === "Still on probation or parole" ? ("no" as const) : ("unknown" as const),
      notes: [s(r.when) && `About when: ${s(r.when)}`, s(r.stage) && `How far it went: ${s(r.stage)}`, s(r.outcome) && `Outcome (client's understanding): ${s(r.outcome)}`, s(r.papers) && `Has court papers: ${s(r.papers)}`, !inLa && "Client says this record is NOT in Louisiana."].filter(Boolean).join("\n"),
      dockets: [{ id: `dk-${Math.random().toString(36).slice(2, 9)}`, court: s(r.agency), docketNumber: s(r.caseNo), charges: [{ id: `ch-${Math.random().toString(36).slice(2, 9)}`, description: "Charge details to confirm from records", disposition }] }],
    };
  });
  const notes = [s(a.why) && `Why they're seeking relief: ${s(a.why).split("|").join(", ")}`, s(a.notes) && `Client's notes: ${s(a.notes)}`].filter(Boolean).join("\n");
  return { intake, cases, notes };
}
