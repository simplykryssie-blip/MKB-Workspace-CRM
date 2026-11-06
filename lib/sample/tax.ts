/**
 * SAMPLE TAX RETURNS — DESIGN PREVIEW ONLY.
 * Every return belongs to a fictional sample client. No real SSNs, ITINs,
 * EINs or tax documents exist anywhere in this preview.
 */
import { CLIENTS, SAMPLE_NOW } from "@/lib/sample/clients";
import {
  DEFAULT_FEE_SCHEDULE,
  ORGANIZERS,
  baseChecklist,
  dueDates,
  type ChecklistItem,
  type EfileAttempt,
  type FilingStatus,
  type OrganizerState,
  type PriceLine,
  type ReturnStatus,
  type TaxForm,
  type TaxReturn,
} from "@/lib/tax/config";
import type { ActivityItem } from "@/lib/types";

const d = (days: number, h = 10, m = 0) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};
const iso = (s: string) => new Date(s).toISOString();

type Spec = {
  clientId: string;
  year: number;
  form: TaxForm;
  filingStatus?: FilingStatus;
  status: ReturnStatus;
  preparerId: string;
  reviewerId: string;
  /** Link to the client's current Tax Preparation engagement. */
  current?: boolean;
  createdAt: string;
  extensionFiledAt?: string;
  organizer: OrganizerState["status"];
  answers?: Record<string, string>;
  price: { code?: string; description?: string; qty?: number; unit?: number }[];
  discount?: number;
  efile?: Omit<EfileAttempt, "id">[];
  signoff?: string;
  approvedAt?: string;
  completedAt?: string;
  note?: string;
};

const fee = (code: string) => DEFAULT_FEE_SCHEDULE.find((f) => f.code === code)!;

const SPECS: Spec[] = [
  // Jordan Sample — current (late, on extension) + two completed prior years
  {
    clientId: "c-1001", year: 2025, form: "1040", filingStatus: "Single", status: "In Preparation", preparerId: "s-al", reviewerId: "s-mk", current: true,
    createdAt: d(-40), extensionFiledAt: iso("2026-04-10T15:00:00"), organizer: "reviewed",
    answers: { fs_change: "No", dependents: "0", moved: "No", w2: "2", se: "Yes", unemp: "No", interest: "No", sales: "No", rental: "No", retire: "No", mortgage: "No", education: "Yes", childcare: "No", marketplace: "No", charity: "Yes", estimates: "No", refund: "Direct deposit", notices: "No" },
    price: [{ code: "F1040" }, { code: "STATE" }, { code: "DEP" }],
    note: "Extension expired Oct 15 — filing late. Refund expected, so no failure-to-file penalty (sample).",
  },
  { clientId: "c-1001", year: 2024, form: "1040", filingStatus: "Single", status: "Completed", preparerId: "s-al", reviewerId: "s-mk", createdAt: iso("2025-02-01T10:00:00"), organizer: "reviewed", price: [{ code: "F1040" }, { code: "STATE" }], efile: [{ jurisdiction: "Federal", submittedAt: iso("2025-03-03T14:00:00"), submissionId: "SAMPLE-24-0001", result: "accepted", resultAt: iso("2025-03-04T09:00:00") }, { jurisdiction: "GA", submittedAt: iso("2025-03-03T14:00:00"), submissionId: "SAMPLE-24-0002", result: "accepted", resultAt: iso("2025-03-05T09:00:00") }], completedAt: iso("2025-03-10T10:00:00") },
  { clientId: "c-1001", year: 2023, form: "1040", filingStatus: "Single", status: "Completed", preparerId: "s-al", reviewerId: "s-mk", createdAt: iso("2024-02-05T10:00:00"), organizer: "reviewed", price: [{ code: "F1040", unit: 300, description: "Form 1040 — base return (2023 rate)" }, { code: "STATE" }], efile: [{ jurisdiction: "Federal", submittedAt: iso("2024-03-11T14:00:00"), submissionId: "SAMPLE-23-0001", result: "accepted", resultAt: iso("2024-03-12T09:00:00") }], completedAt: iso("2024-03-15T10:00:00") },

  // Maple Example LLC — upcoming season intake + last year completed
  { clientId: "c-1002", year: 2026, form: "1065", status: "Intake", preparerId: "s-al", reviewerId: "s-mk", current: true, createdAt: d(-3), organizer: "not_sent", price: [{ code: "F1065" }, { code: "K1", qty: 2 }, { code: "STATE-B" }, { code: "PLAN" }], discount: 50 },
  { clientId: "c-1002", year: 2025, form: "1065", status: "Completed", preparerId: "s-al", reviewerId: "s-mk", createdAt: iso("2026-01-15T10:00:00"), organizer: "reviewed", price: [{ code: "F1065" }, { code: "K1", qty: 2 }, { code: "STATE-B" }], efile: [{ jurisdiction: "Federal", submittedAt: iso("2026-03-09T14:00:00"), submissionId: "SAMPLE-25-1065", result: "accepted", resultAt: iso("2026-03-10T09:00:00") }], completedAt: iso("2026-03-12T10:00:00") },

  // Avery Fictional — amended prior-year return, transmitted, awaiting acknowledgement
  { clientId: "c-1006", year: 2024, form: "1040-X", filingStatus: "Head of household", status: "Submitted", preparerId: "s-al", reviewerId: "s-mk", current: true, createdAt: d(-60), organizer: "reviewed", answers: { dependents: "2", w2: "1", childcare: "Yes", refund: "Direct deposit" }, price: [{ code: "F1040X" }, { code: "STATE" }, { code: "PRIOR" }], signoff: "s-mk", approvedAt: d(-6, 15), efile: [{ jurisdiction: "Federal", submittedAt: d(-4, 11), submissionId: "SAMPLE-1040X-7731", result: "pending" }] },

  // Morgan Mockwell — upcoming season, organizer partly answered
  { clientId: "c-1009", year: 2026, form: "1040 + Sch C", filingStatus: "Single", status: "Awaiting Documents", preparerId: "s-al", reviewerId: "s-mk", current: true, createdAt: d(-20), organizer: "in_progress", answers: { w2: "0", se: "Yes", estimates: "Yes" }, price: [{ code: "F1040" }, { code: "SCHC" }, { code: "STATE" }, { code: "PLAN" }] },
  { clientId: "c-1009", year: 2025, form: "1040 + Sch C", filingStatus: "Single", status: "Completed", preparerId: "s-al", reviewerId: "s-mk", createdAt: iso("2026-02-01T10:00:00"), organizer: "reviewed", price: [{ code: "F1040" }, { code: "SCHC" }, { code: "STATE" }], efile: [{ jurisdiction: "Federal", submittedAt: iso("2026-04-02T14:00:00"), submissionId: "SAMPLE-25-0919", result: "accepted", resultAt: iso("2026-04-03T09:00:00") }], completedAt: iso("2026-04-08T10:00:00") },

  // Pine & Oak Demo Studio — filed on extension, done
  { clientId: "c-1011", year: 2025, form: "1120-S", status: "Completed", preparerId: "s-al", reviewerId: "s-mk", current: true, createdAt: d(-230), extensionFiledAt: iso("2026-03-12T15:00:00"), organizer: "reviewed", answers: { owners: "2", method: "Cash", payroll: "Yes" }, price: [{ code: "F1120S" }, { code: "K1", qty: 2 }], signoff: "s-mk", approvedAt: iso("2026-09-08T15:00:00"), efile: [{ jurisdiction: "Federal", submittedAt: iso("2026-09-10T14:00:00"), submissionId: "SAMPLE-1120S-4410", result: "accepted", resultAt: iso("2026-09-11T09:00:00") }], completedAt: iso("2026-09-14T10:00:00") },

  // Taylor Demo-Reyes — reviewer signed off, waiting on client's e-file authorization; prior year accepted
  { clientId: "c-1012", year: 2025, form: "1040", filingStatus: "Head of household", status: "Awaiting Client Approval", preparerId: "s-al", reviewerId: "s-mk", current: true, createdAt: d(-28), extensionFiledAt: iso("2026-04-14T15:00:00"), organizer: "reviewed", answers: { dependents: "1", w2: "1", childcare: "Yes", marketplace: "No", refund: "Direct deposit" }, price: [{ code: "F1040" }, { code: "STATE" }, { code: "DEP" }], signoff: "s-mk" },
  { clientId: "c-1012", year: 2024, form: "1040", filingStatus: "Head of household", status: "Completed", preparerId: "s-al", reviewerId: "s-mk", createdAt: iso("2025-02-10T10:00:00"), organizer: "reviewed", price: [{ code: "F1040" }, { code: "STATE" }], efile: [{ jurisdiction: "Federal", submittedAt: iso("2025-04-01T14:00:00"), submissionId: "SAMPLE-24-0777", result: "accepted", resultAt: iso("2025-04-02T09:00:00") }], completedAt: iso("2025-04-05T10:00:00") },

  // Bluebird Sample Inc. — rejected for an EIN / name-control mismatch
  { clientId: "c-1007", year: 2025, form: "1120-S", status: "Rejected", preparerId: "s-al", reviewerId: "s-mk", current: true, createdAt: d(-80), extensionFiledAt: iso("2026-03-13T15:00:00"), organizer: "reviewed", answers: { owners: "1", method: "Accrual", payroll: "Yes", inventory: "Yes" }, price: [{ code: "F1120S" }], signoff: "s-mk", approvedAt: d(-12, 15), efile: [{ jurisdiction: "Federal", submittedAt: d(-9, 11), submissionId: "SAMPLE-1120S-5521", result: "rejected", resultAt: d(-8, 9), code: "R0000-902-01", reason: "Business name control does not match the EIN" }] },

  // Harbor Demo Bakery — approved and signed, ready to transmit
  { clientId: "c-1008", year: 2025, form: "1065", status: "Ready to E-file", preparerId: "s-al", reviewerId: "s-mk", current: true, createdAt: d(-60), extensionFiledAt: iso("2026-03-10T15:00:00"), organizer: "reviewed", answers: { owners: "2", method: "Cash", payroll: "Yes", merchant: "Yes" }, price: [{ code: "F1065" }], signoff: "s-mk", approvedAt: d(-2, 16) },

  // Quinn Example — first-time client, documents in, ready for preparer review
  { clientId: "c-1010", year: 2025, form: "1040", filingStatus: "Single", status: "Ready for Review", preparerId: "s-al", reviewerId: "s-mk", current: true, createdAt: d(-14), organizer: "submitted", answers: { w2: "1", unemp: "Yes", refund: "Paper check" }, price: [{ code: "F1040" }] },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function buildReturn(sp: Spec): TaxReturn {
  const client = CLIENTS.find((c) => c.id === sp.clientId)!;
  const id = `TR-${sp.clientId}-${sp.year}`;
  const enrollment = sp.current ? client.enrollments.find((e) => e.service === "tax") : undefined;
  const { due, extended } = dueDates(sp.form, sp.year);
  const past = !sp.current;
  const advanced = ["Ready for Review", "In Preparation", "Awaiting Client Approval", "Ready to E-file", "Submitted", "Accepted", "Rejected", "Completed"].includes(sp.status);

  // Checklist: standard items + organizer-driven items, linked to the client's own documents.
  const specs = [...baseChecklist(client.type, { hasEin: !!client.business?.einLast4, form: sp.form })];
  const answers = sp.answers ?? {};
  ORGANIZERS[client.type].questions.forEach((q) => {
    const a = answers[q.id];
    if (q.docs && (a === "Yes" || (q.type === "number" && Number(a) > 0))) q.docs.forEach((doc) => !specs.some((x) => x.name === doc.name) && specs.push(doc));
  });
  const clientDocs = client.documents.filter((x) => x.service === "tax" && x.taxYear === sp.year);
  const checklist: ChecklistItem[] = specs.map((s, i) => {
    const linked = clientDocs.find((x) => x.name === s.name);
    return {
      id: `${id}-c${i}-${slug(s.name).slice(0, 20)}`,
      name: s.name,
      category: s.category,
      sensitive: s.sensitive,
      required: true,
      source: i < baseChecklist(client.type, { hasEin: !!client.business?.einLast4, form: sp.form }).length ? "standard" : "organizer",
      docId: linked?.id,
      archived: past || (!linked && advanced) || undefined,
    };
  });

  const organizer: OrganizerState = {
    status: sp.organizer,
    answers,
    sentAt: sp.organizer === "not_sent" ? undefined : new Date(new Date(sp.createdAt).getTime() + 86400000).toISOString(),
    submittedAt: ["submitted", "reviewed"].includes(sp.organizer) ? new Date(new Date(sp.createdAt).getTime() + 6 * 86400000).toISOString() : undefined,
    reviewedAt: sp.organizer === "reviewed" ? new Date(new Date(sp.createdAt).getTime() + 8 * 86400000).toISOString() : undefined,
  };

  const lines: PriceLine[] = sp.price.map((p, i) => {
    const f = p.code ? fee(p.code) : undefined;
    return { id: `${id}-p${i}`, code: p.code, description: p.description ?? f?.label ?? "Custom", qty: p.qty ?? 1, unit: p.unit ?? f?.price ?? 0 };
  });

  // Status history along the path up to the current status.
  const path: ReturnStatus[] = ["Intake", "Awaiting Documents", "Ready for Review", "In Preparation", "Awaiting Client Approval", "Ready to E-file", "Submitted"];
  const target = sp.status === "Rejected" ? "Submitted" : sp.status;
  const upto = ["Accepted", "Completed"].includes(target) ? path.length : Math.max(0, path.indexOf(target as ReturnStatus)) + 1;
  const start = new Date(sp.createdAt).getTime();
  const end = sp.completedAt ? new Date(sp.completedAt).getTime() : SAMPLE_NOW.getTime() - 3600000;
  const hist = path.slice(0, upto).map((st, i) => ({ status: st, at: new Date(start + ((end - start) * i) / Math.max(upto, 2)).toISOString(), by: i === 0 ? "s-mk" : sp.preparerId }));
  if (sp.status === "Rejected") hist.push({ status: "Rejected", at: sp.efile?.[0]?.resultAt ?? d(-8), by: "system" });
  if (sp.status === "Accepted" || sp.status === "Completed") hist.push({ status: "Accepted", at: sp.efile?.find((e) => e.result === "accepted")?.resultAt ?? d(-5), by: "system" });
  if (sp.status === "Completed") hist.push({ status: "Completed", at: sp.completedAt ?? d(-1), by: sp.preparerId });

  const activity: ActivityItem[] = hist
    .map((h, i) => ({ id: `${id}-h${i}`, kind: (h.status === "Intake" ? "intake" : "status") as ActivityItem["kind"], text: h.status === "Intake" ? `Return created — TY ${sp.year} ${sp.form}` : `Status → ${h.status}`, at: h.at, actor: (h.by === "system" ? "system" : "staff") as ActivityItem["actor"] }))
    .concat(organizer.sentAt ? [{ id: `${id}-o1`, kind: "message", text: "Organizer sent to client portal", at: organizer.sentAt, actor: "staff" }] : [])
    .concat(organizer.submittedAt ? [{ id: `${id}-o2`, kind: "intake", text: "Client submitted organizer", at: organizer.submittedAt, actor: "client" }] : [])
    .concat(sp.extensionFiledAt ? [{ id: `${id}-ext`, kind: "status", text: `Extension filed — new due date ${new Date(extended!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, at: sp.extensionFiledAt, actor: "staff" }] : [])
    .concat((sp.efile ?? []).flatMap((e, i) => [
      { id: `${id}-ef${i}`, kind: "status" as const, text: `E-filed (${e.jurisdiction}) · ${e.submissionId}`, at: e.submittedAt, actor: "staff" as const },
      ...(e.resultAt ? [{ id: `${id}-ack${i}`, kind: "status" as const, text: `${e.jurisdiction} ${e.result === "accepted" ? "accepted" : `rejected — ${e.code}`}`, at: e.resultAt, actor: "system" as const }] : []),
    ]))
    .sort((a, b) => b.at.localeCompare(a.at));

  const approvalSig = client.signatures.find((s) => s.service === "tax" && /8879/.test(s.document));

  return {
    id,
    clientId: sp.clientId,
    enrollmentId: enrollment?.id,
    taxYear: sp.year,
    kind: client.type,
    form: sp.form,
    filingStatus: sp.filingStatus,
    states: ["GA"],
    status: sp.status,
    preparerId: sp.preparerId,
    reviewerId: sp.reviewerId,
    dueAt: due,
    extension: sp.extensionFiledAt && extended ? { filedAt: sp.extensionFiledAt, dueAt: extended } : undefined,
    reviewSignoff: sp.signoff ? { by: sp.signoff, at: sp.approvedAt ? new Date(new Date(sp.approvedAt).getTime() - 3 * 86400000).toISOString() : d(-3), note: "Reviewed — ties to source documents." } : undefined,
    approvalSignatureId: sp.current && sp.signoff ? approvalSig?.id : undefined,
    clientApprovedAt: sp.approvedAt,
    organizer,
    checklist,
    efile: (sp.efile ?? []).map((e, i) => ({ ...e, id: `${id}-e${i}` })),
    pricing: { lines, discount: sp.discount ?? 0 },
    statusHistory: hist,
    notes: sp.note ? [{ id: `${id}-n0`, authorId: sp.preparerId, body: sp.note, at: d(-5), pinned: true }] : [],
    activity,
    createdAt: sp.createdAt,
    completedAt: sp.completedAt,
  };
}

/** Sample: Morgan started the 2026 interview in the portal and stopped partway through the business section. */
const MORGAN_INTERVIEW = {
  fname: "Morgan", lname: "Mockwell", ssn: "•••-••-0124", dob: "1979-08-21", occupation: "Property manager", phone: "(555) 010-0124", email: "morgan.mockwell@example.com",
  street: "6 Test Court", city: "Lakeside", state: "GA", zip: "30002", moved: "No", blind: "No", dependentOfOther: "No", ippin: "No", newClient: "No", photoId: "Yes",
  marital: "Single (never married)", paidHome: "No", hasDeps: "No",
  w2: "No", unemp: "No", interest: "Yes", invest: "No", crypto: "No", retire: "No", ssa: "No", rental: "Yes", k1: "No", homesale: "No", gambling: "No", alimonyIn: "No", foreign: "No", otherInc: "No",
  intCount: "1",
  rentals: [{ paddr: "14 Sample Lane, Lakeside GA", ptype: "Single-family home", pown: "100", pdays: "365", ppersonal: "0", pincome: "21600", pmortgage: "Yes", pbought: "No", pmanage: "Yes" }],
  bizName: "Mockwell Rental Properties", bizStructure: "Single-member LLC", bizEinYn: "No", bizWhat: "Property management",
};

export const TAX_RETURNS: TaxReturn[] = SPECS.map(buildReturn).map((r) =>
  r.clientId === "c-1009" && r.taxYear === 2026 ? { ...r, organizer: { ...r.organizer, interview: { answers: MORGAN_INTERVIEW, updatedAt: "2026-11-03T19:20:00.000Z", enteredBy: "client" as const, step: 14 } } } : r,
);
export const TAX_YEARS = [2026, 2025, 2024, 2023];
