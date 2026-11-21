/**
 * Turns a submitted Business Solutions or Expungement Relief intake into the staff
 * work record: a Business Services request (pre-filled request form) or an
 * Expungement matter with the client's records as draft cases for staff review.
 * Nothing here decides eligibility or files anything.
 */
import type { EntityType, FormationDetails } from "@/lib/biz/config";
import { BIZ_NEED } from "@/lib/intakes/service";
import type { Disposition } from "@/lib/expunge/config";
import { parseCharges, type Answers, type Row } from "@/lib/tax/interview/engine";

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const rows = (a: Answers, id: string): Row[] => (Array.isArray(a[id]) ? (a[id] as Row[]) : []);

/** "What can we help you with?" answer → Business Services catalog service (older wording kept for intakes already submitted). */
const NEED_SERVICE: Record<string, string> = {
  [BIZ_NEED.llc]: "llc",
  [BIZ_NEED.corp]: "corp",
  [BIZ_NEED.nonprofit]: "nonprofit",
  [BIZ_NEED.pkgFormation]: "pkg-formation",
  [BIZ_NEED.pkgComplete]: "pkg-complete",
  [BIZ_NEED.ein]: "ein",
  [BIZ_NEED.dba]: "dba",
  [BIZ_NEED.foreign]: "foreign",
  [BIZ_NEED.amend]: "amend",
  [BIZ_NEED.dissolve]: "dissolve",
  [BIZ_NEED.annual]: "annual",
  [BIZ_NEED.txPir]: "tx-pir",
  [BIZ_NEED.license]: "license",
  [BIZ_NEED.licenseReport]: "license-report",
  [BIZ_NEED.goodStanding]: "good-standing",
  [BIZ_NEED.goodStandingPremium]: "good-standing-premium",
  [BIZ_NEED.oa]: "oa",
  [BIZ_NEED.resolutions]: "resolutions",
  [BIZ_NEED.records]: "records",
  "Form a new LLC": "llc",
  "Formation Package (formation, operating agreement, resolutions, digital record book)": "pkg-formation",
  "Formation Complete (Formation Package plus physical record book, one DBA, license report and year 1 of the Good Standing Plan)": "pkg-complete",
  "IRS EIN application": "ein",
  "Register in another state": "foreign",
  "Annual report": "annual",
  Dissolution: "dissolve",
  "Resolutions or minutes": "resolutions",
};
/** The catalog service for one need, using the answers to pick the right version (multi-member agreement, physical book). */
export function serviceForNeed(need: string, a: Answers): string | undefined {
  const id = NEED_SERVICE[need];
  if (id === "oa" && (s(a.entity) === "Multi-member LLC" || rows(a, "owners").filter((r) => Number(r.pct) > 0).length > 1)) return "oa-multi";
  if (id === "records" && /^Physical/.test(s(a.bookFormat))) return "records-physical";
  return id;
}
const ENTITY: Record<string, EntityType> = {
  "Sole proprietorship": "Sole Prop",
  "Single-member LLC": "LLC",
  "Multi-member LLC": "LLC",
  "S corporation": "S-Corp",
  "C corporation": "C-Corp",
  Partnership: "Partnership",
  Nonprofit: "Nonprofit",
};

export type BizPreset = { clientId: string; serviceId?: string; businessName: string; structure?: EntityType; state?: string; description: string; intakeId: string; others: string[]; formation?: Partial<FormationDetails> };

/** Pre-fills the New request form. The first item asked for becomes the request; others are listed so staff can start them too. */
export function bizPresetFrom(intakeId: string, clientId: string, a: Answers, submittedAt?: string): BizPreset {
  const needs = s(a.need).split("|").map((x) => x.trim()).filter(Boolean);
  const first = needs.find((n) => serviceForNeed(n, a));
  const when = submittedAt ? new Date(submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const parts = [
    `From the client's Business Solutions intake${when ? ` (${when})` : ""}: ${needs.join(", ") || "see intake"}.`,
    s(a.timing) && `Timing: ${s(a.timing)}.`,
    s(a.purpose) && `Business activity: ${s(a.purpose)}.`,
    [s(a.name2), s(a.name3)].some(Boolean) && `Alternate names: ${[s(a.name2), s(a.name3)].filter(Boolean).join("; ")}.`,
    s(a.management) && `Management: ${s(a.management)}.`,
    s(a.agentName) && `Client's registered agent: ${s(a.agentName)}, ${s(a.agentAddress)}.`,
    s(a.mailing) && `Mailing address: ${s(a.mailing)}.`,
    s(a.dbaName) && `Trade name: ${s(a.dbaName)} (${s(a.dbaWhere)}).`,
    s(a.foreignState) && `Register in: ${s(a.foreignState)}.`,
    s(a.changeDetail) && `Change: ${s(a.changeDetail)}.`,
    s(a.dissolveDate) && `Close on ${s(a.dissolveDate)}; debts paid: ${s(a.debts) || "?"}; final returns: ${s(a.finalFilings) || "?"}.`,
  ].filter(Boolean);
  return {
    clientId,
    intakeId,
    serviceId: first ? serviceForNeed(first, a) : undefined,
    businessName: s(a.legalName),
    structure: ENTITY[s(a.entity)],
    state: s(a.formState) || undefined,
    description: parts.join(" "),
    others: needs.filter((n) => n !== first),
    formation: {
      alternates: [s(a.name2), s(a.name3)].filter(Boolean),
      purpose: s(a.purpose),
      businessAddress: [s(a.street), s(a.city), [s(a.state), s(a.zip)].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      principalLocation: s(a.mailing) ? `Mailing: ${s(a.mailing)}` : "",
      organizer: { name: s(a.rpName), title: s(a.rpTitle) || undefined },
      owners: rows(a, "owners").filter((r) => s(r.name)).map((r, i) => ({ id: `o${i + 1}`, name: s(r.name), role: s(r.title), pct: Number(r.pct) || 0 })),
      ...(s(a.agentName) ? { agent: { type: s(a.agent).startsWith("Me") ? "self" as const : "third_party" as const, name: s(a.agentName), address: s(a.agentAddress) } } : {}),
    },
  };
}

const OUTCOME: Record<string, Disposition> = {
  "Dismissed or not prosecuted": "Dismissed",
  "Found not guilty": "Acquitted / not guilty",
  "Pleaded or found guilty — sentence completed": "Convicted",
  "Still on probation or parole": "Convicted",
};
/** The client's words for how a charge ended → the case's disposition. */
const CHARGE_OUTCOME: Record<string, Disposition> = {
  Dismissed: "Dismissed",
  "Not prosecuted (NPO / nolle prosequi / refused)": "Refused / not prosecuted",
  "Pleaded guilty": "Convicted",
  "Pleaded no contest": "Convicted",
  "Found guilty at trial": "Convicted",
  "Found not guilty": "Acquitted / not guilty",
  "Deferred / pretrial diversion": "Deferred adjudication",
  "Still pending": "Pending",
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
    const listed = parseCharges(s(r.charges));
    // Older intakes (before charges were listed one by one) had one outcome for the whole record.
    const oldDisposition: Disposition = s(r.stage) === "Arrest only — no charges filed" ? "Refused / not prosecuted" : OUTCOME[s(r.outcome)] ?? "Unknown";
    const charges = listed.length
      ? listed.map((e) => ({ id: `ch-${Math.random().toString(36).slice(2, 9)}`, description: e.c || "Charge to confirm from records", disposition: CHARGE_OUTCOME[e.o] ?? ("Unknown" as Disposition), notes: e.o ? `Client says: ${e.o}` : undefined }))
      : [{ id: `ch-${Math.random().toString(36).slice(2, 9)}`, description: "Charge details to confirm from records", disposition: oldDisposition }];
    const done = s(r.sentenceDone);
    const sentenceCompleted = done.startsWith("Yes") || s(r.outcome) === "Pleaded or found guilty — sentence completed" ? ("yes" as const) : done.startsWith("No") || s(r.outcome) === "Still on probation or parole" ? ("no" as const) : ("unknown" as const);
    return {
      // MKB Expungement Relief works Louisiana records; a non-Louisiana record is flagged in the notes for staff.
      jurisdictionId: "J-LA",
      state: "LA",
      remedyId: undefined,
      locality: parish ? `${parish} Parish` : "",
      arrestingAgency: s(r.agency),
      arrestingJurisdiction: parish ? `${parish} Parish` : undefined,
      sentenceCompleted,
      notes: [s(r.when) && `Arrest date (about): ${s(r.when)}`, done && `Sentence finished: ${done}`, s(r.stage) && `How far it went: ${s(r.stage)}`, s(r.outcome) && `Outcome (client's understanding): ${s(r.outcome)}`, s(r.papers) && `Has court papers: ${s(r.papers)}`, !inLa && "Client says this record is NOT in Louisiana."].filter(Boolean).join("\n"),
      dockets: [{ id: `dk-${Math.random().toString(36).slice(2, 9)}`, court: s(r.agency), docketNumber: s(r.caseNo), charges }],
    };
  });
  const notes = [s(a.why) && `Why they're seeking relief: ${s(a.why).split("|").join(", ")}`, s(a.notes) && `Client's notes: ${s(a.notes)}`].filter(Boolean).join("\n");
  return { intake, cases, notes };
}
