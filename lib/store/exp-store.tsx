"use client";

/**
 * Expungement Center store (Phase 2 — in-browser sample data only).
 *
 * Criminal-history details live only in this in-memory sample state: nothing is
 * written to localStorage, cookies or any server, and everything resets on reload.
 * Phase 3 moves this to an encrypted backend with role-based access and audit logs.
 *
 * Single source of truth: clients are the central CRM records; documents,
 * invoices and client-visible messages are stored on the client record, tagged
 * with the matter and case. Each case keeps its own records, screening,
 * documents, filing history and outcome.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BACKEND, RemoteError, call, debouncer, notify, pendingClientCreates } from "@/lib/sync/remote";
import { EXP_CASES, EXP_JURISDICTIONS, EXP_MATTERS, EXP_PRICES, EXP_SERVICES } from "@/lib/sample/exp-seed";
import { SAMPLE_NOW, staffById, meId } from "@/lib/sample/clients";
import { nowIso, useClients } from "@/lib/store/clients-store";
import {
  ASSIGNMENT_ROLES,
  EXP_ROLES,
  RELEASE_STATES,
  type AckKey,
  type AssignmentRole,
  type CaseStatus,
  type Docket,
  type ExpCase,
  type ExpMatter,
  type ExpRole,
  type Filing,
  type InfoRequest,
  type Intake,
  type Jurisdiction,
  type Prep,
  type PriceRule,
  type RecordItem,
  type Screening,
  type ScreeningReview,
  type ServiceType,
} from "@/lib/expunge/config";
import { approvalBlockers, expEnrollmentId, matterEnrollment } from "@/lib/expunge/derive";
import type { InvoiceLine } from "@/lib/types";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
type ClientsApi = ReturnType<typeof useClients>;
type FileIn = { name: string; sizeKb: number };

type State = { jurisdictions: Jurisdiction[]; services: ServiceType[]; prices: PriceRule[]; matters: ExpMatter[]; cases: ExpCase[]; nextMatter: number };
const init = (): State => ({
  jurisdictions: structuredClone(EXP_JURISDICTIONS),
  services: structuredClone(EXP_SERVICES),
  prices: structuredClone(EXP_PRICES),
  // The live CRM starts empty and loads what the person may open from the server.
  matters: BACKEND ? [] : structuredClone(EXP_MATTERS).map((m) => ({ ...m, enrollmentId: expEnrollmentId(m) })),
  cases: BACKEND ? [] : structuredClone(EXP_CASES),
  nextMatter: BACKEND ? 1001 : 2048,
});
type Action = { type: "reset" } | { type: "fn"; fn: (s: State) => State };
const reducer = (s: State, a: Action): State => (a.type === "reset" ? init() : a.fn(s));

export const matterCases = (s: { cases: ExpCase[] }, matterId: string) => s.cases.filter((c) => c.matterId === matterId);

/** Records checklist for a case: its own workflow's "Any case" list plus lists whose case type matches the dispositions. */
export function checklistFor(j: Jurisdiction | undefined, remedyId: string | undefined, dockets: Docket[]): RecordItem["docType"][] {
  if (!j || !remedyId) return [];
  const disp = dockets.flatMap((d) => d.charges.map((c) => c.disposition));
  const lists = j.requiredDocs.filter((r) => r.remedyId === remedyId).filter((r) => r.caseType === "Any case" || (r.caseType.startsWith("Conviction") && disp.includes("Convicted")) || (r.caseType.startsWith("Dismissal") && disp.some((x) => ["Dismissed", "Acquitted / not guilty", "Refused / not prosecuted"].includes(x))) || (r.caseType.startsWith("Deferred") && disp.some((x) => ["Deferred adjudication", "Diverted / pretrial intervention"].includes(x))));
  return [...new Set(lists.flatMap((l) => l.docs))];
}
const kindOf = (doc: string): RecordItem["kind"] => (/criminal history/i.test(doc) ? "criminal_history" : /arrest/i.test(doc) ? "arrest" : /minutes/i.test(doc) ? "court_minutes" : /disposition|judgment|dismissal|acquittal/i.test(doc) ? "disposition" : "other");

export type NewCaseInput = Pick<ExpCase, "jurisdictionId" | "state" | "locality" | "arrestingAgency" | "dockets"> & Partial<Pick<ExpCase, "remedyId" | "localityId" | "arrestDate" | "arrestNumber" | "arrestingJurisdiction" | "supervision" | "sentenceCompleted" | "obligations" | "resolution" | "notes" | "serviceType" | "complexity">>;

function makeActions(dispatch: React.Dispatch<Action>, get: () => State, clients: () => ClientsApi, role: () => ExpRole) {
  const set = (fn: (s: State) => State) => dispatch({ type: "fn", fn });
  const M = (id: string) => get().matters.find((m) => m.id === id)!;
  const C = (id: string) => get().cases.find((c) => c.id === id)!;
  const upM = (id: string, fn: (m: ExpMatter) => ExpMatter) => set((s) => ({ ...s, matters: s.matters.map((m) => (m.id === id ? fn(m) : m)) }));
  const upC = (id: string, fn: (c: ExpCase) => ExpCase) => set((s) => ({ ...s, cases: s.cases.map((c) => (c.id === id ? fn(c) : c)) }));
  const msg = (m: ExpMatter, body: string, from: "staff" | "client" = "staff") => clients().sendMessage(m.clientId, body, "expunge", { expMatterId: m.id, from, author: from === "staff" ? staffById(m.assignments["Client follow-up"]).name : undefined });
  const logClient = (clientId: string, text: string, actor: "staff" | "client" = "staff") => clients().logActivity(clientId, "status", text, actor);
  const who = () => ({ who: role() === "owner" ? "MKB Owner" : role() === "coordinator" ? "Jesse Park" : role() === "intake" ? "Alex Lane" : "Robin Tate", role: EXP_ROLES[role()].label });

  const moveTo = (caseId: string, status: CaseStatus, note?: string, byId = meId(), extra: Partial<ExpCase> = {}) => {
    const c = C(caseId);
    const at = nowIso();
    upC(caseId, (x) => ({ ...x, ...extra, status, history: [...x.history, { at, byId, status, note }] }));
    logClient(c.clientId, `${c.number}: ${status}${note ? ` — ${note}` : ""}`, byId === "client" ? "client" : "staff");
  };
  const upload = (c: ExpCase, f: FileIn, category: string, name: string, by: "client" | "staff" = "staff") =>
    clients().uploadDocument(c.clientId, { name, service: "expunge", category, sensitive: true, sizeKb: f.sizeKb, file: (f as { file?: File }).file, expMatterId: c.matterId, expCaseId: c.id, by });

  const a = {
    reset: () => dispatch({ type: "reset" }),
    /** Audit trail for access to criminal-history details (logged server-side in Phase 3). */
    logAccess(matterId: string, action: string, caseId?: string) {
      const w = who();
      upM(matterId, (m) => ({ ...m, access: [{ id: uid("ax"), at: nowIso(), ...w, action, caseId }, ...m.access].slice(0, 60) }));
    },

    /* ---------------- Matters + intake ---------------- */
    createInquiry(clientId: string, source: ExpMatter["source"], note?: string, staffId = BACKEND ? meId() : "s-jp"): string {
      const s = get();
      const nextNo = Math.max(s.nextMatter, ...s.matters.map((x) => Number(x.number.replace(/\D/g, "")) + 1).filter(Number.isFinite));
      const id = `EXP-${nextNo}`;
      const c = clients().clients.find((x) => x.id === clientId)!;
      const [first, ...rest] = (c.type === "individual" ? c.name : c.contactName ?? c.name).split(" ");
      const enrollmentId = clients().enroll(clientId, { service: "expunge", title: "Record expungement — no cases", staffId, fee: 0 });
      const m: ExpMatter = {
        id, number: id, clientId, enrollmentId, source, createdAt: nowIso(),
        intake: { status: "inquiry", step: 0, first, middle: "", last: rest.join(" "), aliases: [], currentAddress: [c.address.line1, c.address.city, c.address.state, c.address.zip].filter(Boolean).join(", "), previousAddresses: [], preferredContact: c.preferredContact, idDoc: "not_requested", additional: { pendingCharges: "unknown", onSupervision: "unknown", priorExpungements: "unknown", previousApplications: "unknown", deniedApplications: "unknown", hasRecords: "unknown" }, acks: {} },
        assignments: Object.fromEntries(ASSIGNMENT_ROLES.map((r) => [r, staffId])) as Record<AssignmentRole, string>,
        info: [], notes: note ? [{ id: uid("n"), authorId: staffId, body: note, at: nowIso() }] : [], access: [],
      };
      set((x) => ({ ...x, matters: [m, ...x.matters], nextMatter: nextNo + 1 }));
      return id;
    },
    /** Opened from the client's Record Relief intake: remember it and copy their details (marked submitted). */
    exists: (kind: "matter" | "case", id: string) => (kind === "matter" ? get().matters : get().cases).some((x) => x.id === id),
    linkIntake(matterId: string, intakeId: string, details: Partial<Intake>) {
      upM(matterId, (m) => ({ ...m, intakeId, intake: { ...m.intake, ...details, additional: { ...m.intake.additional, ...(details.additional ?? {}) }, status: "submitted", submittedAt: nowIso() } }));
      logClient(M(matterId).clientId, `${M(matterId).number}: opened from the client's Record Relief intake`);
    },
    sendIntake(matterId: string) {
      const m = M(matterId);
      upM(matterId, (x) => ({ ...x, intake: { ...x.intake, status: "sent", idDoc: x.intake.idDoc === "not_requested" ? "requested" : x.intake.idDoc } }));
      msg(m, "Your expungement intake is ready in the client portal. It takes about 15 minutes — add every arrest or case you know about, even if you're not sure of the details.");
    },
    saveIntake(matterId: string, patch: Partial<Intake>, by: "client" | "staff") {
      upM(matterId, (x) => ({ ...x, intake: { ...x.intake, ...patch, status: by === "client" && (x.intake.status === "sent" || x.intake.status === "inquiry") ? "in_progress" : patch.status ?? x.intake.status } }));
    },
    setAck(matterId: string, key: AckKey, on: boolean) {
      upM(matterId, (x) => {
        const acks = { ...x.intake.acks };
        if (on) acks[key] = nowIso();
        else delete acks[key];
        return { ...x, intake: { ...x.intake, acks } };
      });
    },
    uploadId(matterId: string, f: FileIn, by: "client" | "staff") {
      const m = M(matterId);
      const docId = clients().uploadDocument(m.clientId, { name: "Identification document", service: "expunge", category: "Identity", sensitive: true, sizeKb: f.sizeKb, file: (f as { file?: File }).file, expMatterId: matterId, by });
      upM(matterId, (x) => ({ ...x, intake: { ...x.intake, idDoc: "received", idDocId: docId } }));
    },
    submitIntake(matterId: string, by: "client" | "staff") {
      const m = M(matterId);
      upM(matterId, (x) => ({ ...x, intake: { ...x.intake, status: "submitted", submittedAt: nowIso() } }));
      logClient(m.clientId, `${m.number}: expungement intake submitted`, by === "client" ? "client" : "staff");
    },
    /** Staff review the intake: client-entered cases become working cases with their jurisdiction's records checklist. */
    /** Opens client-entered cases that have a workflow chosen; returns how many still need one. */
    reviewIntake(matterId: string, byId: string): number {
      const s = get();
      const waiting = s.cases.filter((c) => c.matterId === matterId && c.draft && !c.remedyId).length;
      upM(matterId, (x) => ({ ...x, intake: { ...x.intake, status: "reviewed", reviewedBy: byId, reviewedAt: nowIso() } }));
      set((st) => ({
        ...st,
        cases: st.cases.map((c) => {
          if (c.matterId !== matterId || !c.draft || !c.remedyId) return c;
          const j = s.jurisdictions.find((x) => x.id === c.jurisdictionId);
          const records = c.records.length ? c.records : checklistFor(j, c.remedyId, c.dockets).map((docType, i) => ({ id: `${c.id}-rec${i + 1}`, docType, kind: kindOf(docType), required: true, status: "not_requested" as const }));
          return { ...c, draft: false, records, history: [...c.history, { at: nowIso(), byId, status: "note", note: "intake reviewed — case opened" }] };
        }),
      }));
      return waiting;
    },
    assign(matterId: string, roleName: AssignmentRole, staffId: string) {
      upM(matterId, (m) => ({ ...m, assignments: { ...m.assignments, [roleName]: staffId } }));
    },
    addNote(matterId: string, body: string, authorId = meId()) {
      upM(matterId, (m) => ({ ...m, notes: [{ id: uid("n"), authorId, body, at: nowIso() }, ...m.notes] }));
    },

    /* ---------------- Cases ---------------- */
    addCase(matterId: string, input: NewCaseInput, by: "client" | "staff"): string {
      const m = M(matterId);
      const s = get();
      const n = s.cases.filter((c) => c.matterId === matterId).length + 1;
      let id = `${m.number}-C${n}`;
      while (s.cases.some((c) => c.id === id)) id = `${id}x`;
      const j = s.jurisdictions.find((x) => x.id === input.jurisdictionId);
      // Anything a client enters is a draft until staff review it.
      const draft = by === "client";
      const c: ExpCase = {
        id, number: id, matterId, clientId: m.clientId, sentenceCompleted: "unknown", obligations: "unknown", serviceType: "full", complexity: input.dockets.length > 1 || input.dockets.some((d) => d.charges.length > 1) ? "moderate" : "standard",
        ...input,
        assignedTo: m.assignments["Records collection"], status: "Not Started", createdAt: nowIso(), draft,
        records: draft ? [] : checklistFor(j, input.remedyId, input.dockets).map((docType, i) => ({ id: `${id}-rec${i + 1}`, docType, kind: kindOf(docType), required: true, status: "not_requested" as const })),
        screening: { ruleIds: [], offenseCategory: "", dispositionSummary: "", sentenceCompleted: input.sentenceCompleted ?? "unknown", waitingPeriod: "", waitingPeriodMet: "unknown", obligationsOutstanding: "unknown", pendingCharges: "unknown", onSupervision: "unknown", priorExpungements: "unknown", supportingDocsComplete: "unknown", missingInfo: "", disqualifyingIssues: "", legalReviewRequired: false, answers: {}, outcome: "Information Incomplete", reviews: [] },
        prep: { preparerId: m.assignments["Document preparation"], reviewerId: m.assignments["Quality review"], status: "not_started", forms: [], missing: [], clientApproval: "not_sent", delivery: "not_delivered" },
        filing: { court: input.dockets[0]?.court ?? "", clerkContact: "", feeStatus: "not_due" },
        history: [{ at: nowIso(), byId: by === "client" ? "client" : meId(), status: "Not Started", note: by === "client" ? "added by the client in the portal" : "case created" }],
        internalNotes: [],
      };
      set((x) => ({ ...x, cases: [...x.cases, c] }));
      logClient(m.clientId, `${m.number}: case ${id} added (${input.state})`, by === "client" ? "client" : "staff");
      return id;
    },
    /** Changing a case's workflow (e.g. expunction ↔ nondisclosure) resets its screening and adds that workflow's own checklist items. */
    updateCase(caseId: string, patch: Partial<ExpCase>, note = "case details updated") {
      const c = C(caseId);
      const remedyChanged = patch.remedyId !== undefined && patch.remedyId !== c.remedyId;
      const j = get().jurisdictions.find((x) => x.id === (patch.jurisdictionId ?? c.jurisdictionId));
      upC(caseId, (x) => {
        let next: ExpCase = { ...x, ...patch, history: [...x.history, { at: nowIso(), byId: meId(), status: "note", note }] };
        if (remedyChanged) {
          const name = j?.remedies.find((r) => r.id === patch.remedyId)?.name ?? "new workflow";
          const add = x.draft ? [] : checklistFor(j, patch.remedyId, next.dockets).filter((d) => !x.records.some((r) => r.docType === d)).map((docType) => ({ id: uid("rec"), docType, kind: kindOf(docType), required: true, status: "not_requested" as const }));
          next = { ...next, records: [...x.records, ...add], screening: { ...x.screening, ruleIds: [], answers: {}, outcome: "Information Incomplete", legalReviewRequired: x.screening.legalReviewRequired }, history: [...next.history, { at: nowIso(), byId: meId(), status: "note", note: `workflow set to ${name} — screening reset (requirements are separate)` }] };
        }
        return next;
      });
    },
    removeDraftCase(caseId: string) {
      if (BACKEND && !get().cases.find((c) => c.id === caseId)?.draft) return;
      set((s) => ({ ...s, cases: s.cases.filter((c) => !(c.id === caseId && c.draft)) }));
      if (BACKEND) void call("DELETE", `/api/exp/records/cases/${encodeURIComponent(caseId)}`).catch((e) => notify(e instanceof RemoteError ? e.message : "Couldn't remove the case."));
    },
    /** The client accepted the engagement letter (the server records the time and who recorded it). */
    acceptEngagement(matterId: string, e: { name: string; version: number; termsVersion: number; method: "in_office" | "paper" | "online" }) {
      upM(matterId, (x) => (x.engagement ? x : { ...x, engagement: { letterKey: "exp", version: e.version, termsVersion: e.termsVersion, acceptedName: e.name, acceptedAt: nowIso(), method: e.method, recordedBy: meId() } }));
      logClient(M(matterId).clientId, `${M(matterId).number}: engagement letter accepted (${e.name})`);
    },
    addCaseNote(caseId: string, body: string, authorId = meId()) {
      upC(caseId, (c) => ({ ...c, internalNotes: [{ id: uid("n"), authorId, body, at: nowIso() }, ...c.internalNotes] }));
    },

    /* ---------------- Records ---------------- */
    addRecord(caseId: string, docType: string, required = true) {
      upC(caseId, (c) => ({ ...c, records: [...c.records, { id: uid("rec"), docType, kind: kindOf(docType), required, status: "not_requested" }] }));
    },
    requestRecord(caseId: string, recId: string, r: Pick<RecordItem, "custodianId" | "custodianName" | "method" | "fee" | "requestedAt">) {
      upC(caseId, (c) => ({ ...c, records: c.records.map((x) => (x.id === recId ? { ...x, ...r, status: "requested", feePaid: r.fee ? false : undefined } : x)) }));
    },
    receiveRecord(caseId: string, recId: string, f: FileIn, by: "client" | "staff" = "staff") {
      const c = C(caseId);
      const rec = c.records.find((x) => x.id === recId)!;
      const docId = upload(c, f, "Court & agency records", `${rec.docType} — ${c.number}`, by);
      upC(caseId, (x) => ({ ...x, records: x.records.map((r) => (r.id === recId ? { ...r, docId, status: "received", receivedAt: nowIso().slice(0, 10), method: r.method ?? (by === "client" ? "Client provided" : r.method) } : r)) }));
    },
    verifyRecord(caseId: string, recId: string, ok: boolean, missingInfo?: string) {
      upC(caseId, (c) => ({ ...c, records: c.records.map((r) => (r.id === recId ? { ...r, status: ok ? "verified" : "incomplete", missingInfo: ok ? undefined : missingInfo } : r)) }));
    },
    payRecordFee(caseId: string, recId: string) {
      upC(caseId, (c) => ({ ...c, records: c.records.map((r) => (r.id === recId ? { ...r, feePaid: true } : r)) }));
    },
    removeRecord(caseId: string, recId: string) {
      upC(caseId, (c) => ({ ...c, records: c.records.filter((r) => r.id !== recId) }));
    },

    /* ---------------- Screening ---------------- */
    updateScreening(caseId: string, patch: Partial<Screening>) {
      upC(caseId, (c) => ({ ...c, screening: { ...c.screening, ...patch } }));
    },
    /** A person records the outcome, with sources and an explanation. Approval is blocked until records, rules and any legal review are verified. */
    recordReview(caseId: string, r: Omit<ScreeningReview, "id" | "at">): string[] {
      const c = C(caseId);
      const j = get().jurisdictions.find((x) => x.id === c.jurisdictionId);
      if (r.outcome === "Administrative Processing Approved") {
        const withThis = r.legal ? { ...c, screening: { ...c.screening, reviews: [...c.screening.reviews, { ...r, id: "tmp", at: "" }] } } : c;
        const blockers = approvalBlockers(withThis, j);
        if (blockers.length) return blockers;
      }
      const review: ScreeningReview = { ...r, id: uid("rv"), at: nowIso() };
      upC(caseId, (x) => ({ ...x, screening: { ...x.screening, outcome: r.outcome, legalReviewRequired: r.outcome === "Attorney / Qualified Legal Review Needed" ? true : x.screening.legalReviewRequired, reviews: [...x.screening.reviews, review] }, history: [...x.history, { at: review.at, byId: r.byId, status: "note", note: `screening: ${r.outcome}` }] }));
      return [];
    },

    /* ---------------- Document preparation ---------------- */
    startPrep(caseId: string) {
      const c = C(caseId);
      if (c.screening.outcome !== "Administrative Processing Approved") return false;
      if (BACKEND && !M(c.matterId).engagement) { notify("Record the client's engagement letter acceptance on the matter first."); return false; }
      const j = get().jurisdictions.find((x) => x.id === c.jurisdictionId);
      upC(caseId, (x) => ({ ...x, prep: { ...x.prep, status: "in_progress", forms: x.prep.forms.length ? x.prep.forms : (j?.forms ?? []).filter((f) => f.remedyId === x.remedyId).map((f) => ({ id: uid("f"), name: f.name, source: f.lastVerifiedAt ? f.source : `${f.source} (form not verified)`, status: "needed" as const })) } }));
      moveTo(caseId, "Preparing", "document preparation started", c.prep.preparerId);
      return true;
    },
    updatePrep(caseId: string, patch: Partial<Prep>) {
      upC(caseId, (c) => ({ ...c, prep: { ...c.prep, ...patch } }));
    },
    addForm(caseId: string, name: string, source: string) {
      upC(caseId, (c) => ({ ...c, prep: { ...c.prep, forms: [...c.prep.forms, { id: uid("f"), name, source, status: "needed" }] } }));
    },
    uploadForm(caseId: string, formId: string, f: FileIn) {
      const c = C(caseId);
      const form = c.prep.forms.find((x) => x.id === formId)!;
      const docId = upload(c, f, "Prepared documents (not filed)", `${form.name} — ${c.number} (prepared by MKB, not filed)`);
      upC(caseId, (x) => ({ ...x, prep: { ...x.prep, forms: x.prep.forms.map((y) => (y.id === formId ? { ...y, docId, status: "drafted" } : y)) } }));
    },
    submitForReview(caseId: string) {
      upC(caseId, (c) => ({ ...c, prep: { ...c.prep, status: "ready_for_review" }, history: [...c.history, { at: nowIso(), byId: c.prep.preparerId, status: "note", note: "documents sent for internal review" }] }));
    },
    internalReview(caseId: string, approve: boolean, byId: string, note?: string) {
      upC(caseId, (c) => ({ ...c, prep: { ...c.prep, status: approve ? "internally_approved" : "changes_requested", forms: approve ? c.prep.forms.map((f) => ({ ...f, status: f.docId ? "final" : f.status })) : c.prep.forms }, history: [...c.history, { at: nowIso(), byId, status: "note", note: approve ? "internal quality review approved" : `changes requested${note ? `: ${note}` : ""}` }] }));
    },
    sendForApproval(caseId: string) {
      const c = C(caseId);
      const m = M(c.matterId);
      const info: InfoRequest = { id: uid("i"), caseId, label: `Review and approve your prepared documents (${c.state} — ${c.locality})`, detail: "These documents were prepared by MKB from your information. They have not been filed. Approve them or tell us what to change.", file: false, status: "open", docIds: [], createdAt: nowIso() };
      upM(m.id, (x) => ({ ...x, info: [...x.info, info] }));
      moveTo(caseId, "Awaiting Client Approval", "documents sent to the client for approval", c.prep.preparerId, { prep: { ...c.prep, clientApproval: "sent" } });
      msg(m, `Your prepared documents for case ${c.number} are ready for your review in the portal.`);
    },
    clientDecision(caseId: string, approve: boolean, comment?: string) {
      const c = C(caseId);
      const m = M(c.matterId);
      upM(m.id, (x) => ({ ...x, info: x.info.map((i) => (i.caseId === caseId && i.status === "open" && i.label.startsWith("Review and approve") ? { ...i, status: "responded", response: approve ? "Approved" : `Changes requested: ${comment ?? ""}`, respondedAt: nowIso() } : i)) }));
      if (approve) moveTo(caseId, "Ready for Filing", "client approved the prepared documents", "client", { prep: { ...c.prep, clientApproval: "approved" } });
      else moveTo(caseId, "Preparing", `client requested changes: ${comment ?? ""}`, "client", { prep: { ...c.prep, clientApproval: "changes_requested", status: "changes_requested", clientComment: comment } });
      if (comment) msg(m, `Re: ${c.number} documents — ${comment}`, "client");
    },
    deliverDocs(caseId: string) {
      const c = C(caseId);
      c.prep.forms.forEach((f) => f.docId && clients().markDocDelivered(c.clientId, f.docId));
      upC(caseId, (x) => ({ ...x, prep: { ...x.prep, delivery: "delivered", deliveredAt: nowIso() } }));
    },

    /* ---------------- Filing + court ---------------- */
    updateFiling(caseId: string, patch: Partial<Filing>) {
      upC(caseId, (c) => ({ ...c, filing: { ...c.filing, ...patch } }));
    },
    /** Submitted only with a filing confirmation on file that staff verified. */
    recordFiling(caseId: string, f: { filedAt: string; method: string; confirmationNumber: string; file?: FileIn; docId?: string; verified: boolean; filingFee?: number; feeStatus: Filing["feeStatus"]; byId: string }) {
      if (!f.verified || !f.confirmationNumber || (!f.file && !f.docId)) return false;
      const c = C(caseId);
      const docId = f.docId ?? upload(c, f.file!, "Filing confirmation", `Filing confirmation ${f.confirmationNumber} — ${c.number}`);
      moveTo(caseId, "Submitted", `filed ${f.filedAt} via ${f.method} — confirmation ${f.confirmationNumber} verified`, f.byId, { filing: { ...c.filing, filedAt: f.filedAt, method: f.method, confirmationNumber: f.confirmationNumber, confirmationDocId: docId, confirmationVerified: true, filingFee: f.filingFee, feeStatus: f.feeStatus } });
      return true;
    },
    courtUpdate(caseId: string, u: { kind: "awaiting" | "hearing" | "info" | "granted" | "denied" | "withdrawn"; note: string; hearingAt?: string; orderFile?: FileIn; orderDocId?: string; verified?: boolean; byId: string }) {
      const c = C(caseId);
      if (u.kind === "granted" && (!u.verified || (!u.orderFile && !u.orderDocId))) return false;
      if (u.kind === "denied" && !u.note.trim()) return false;
      let orderDocId = u.orderDocId;
      if (u.orderFile) orderDocId = upload(c, u.orderFile, u.kind === "granted" ? "Court order" : "Court response", `${u.kind === "granted" ? "Signed order (court-issued)" : "Court response"} — ${c.number}`);
      const status: CaseStatus = { awaiting: "Awaiting Agency / Court Response", hearing: "Hearing Scheduled", info: "Additional Information Requested", granted: "Granted", denied: "Denied", withdrawn: "Withdrawn" }[u.kind] as CaseStatus;
      moveTo(caseId, status, u.note, u.byId, { filing: { ...c.filing, hearingAt: u.hearingAt ?? c.filing.hearingAt, courtResponse: u.note || c.filing.courtResponse, finalOrderDocId: u.kind === "granted" ? orderDocId : c.filing.finalOrderDocId, finalOrderVerified: u.kind === "granted" ? true : c.filing.finalOrderVerified } });
      const m = M(c.matterId);
      if (u.kind === "hearing" && u.hearingAt) msg(m, `A court date has been set for case ${c.number}: ${new Date(u.hearingAt).toLocaleString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}. We'll send details on what to bring.`);
      if (u.kind === "granted") msg(m, `The court issued an order on case ${c.number}. We're finishing up and will share the order in your portal.`);
      return true;
    },
    /** Completed requires a granted case with a verified court order on file. */
    complete(caseId: string, byId: string) {
      const c = C(caseId);
      if (c.status !== "Granted" || !c.filing.finalOrderDocId || !c.filing.finalOrderVerified) return false;
      clients().markDocDelivered(c.clientId, c.filing.finalOrderDocId);
      moveTo(caseId, "Completed", "order delivered to the client; case closed", byId, { filing: { ...c.filing, completedAt: nowIso() } });
      return true;
    },
    hold(caseId: string, reason: string) {
      const c = C(caseId);
      moveTo(caseId, "On Hold", reason, meId(), { holdFrom: c.status, holdReason: reason });
    },
    resume(caseId: string) {
      const c = C(caseId);
      moveTo(caseId, c.holdFrom ?? "Not Started", "resumed", meId(), { holdFrom: undefined, holdReason: undefined });
    },
    /** Manual status change — never to Granted or Completed (those need confirmation). */
    override(caseId: string, status: CaseStatus, reason: string) {
      if (status === "Granted" || status === "Completed" || status === "Submitted") return false;
      moveTo(caseId, status, `override — ${reason}`);
      return true;
    },
    assignCase(caseId: string, staffId: string) {
      upC(caseId, (c) => ({ ...c, assignedTo: staffId, history: [...c.history, { at: nowIso(), byId: meId(), status: "note", note: `assigned to ${staffById(staffId).name}` }] }));
    },

    /* ---------------- Client requests ---------------- */
    requestInfo(matterId: string, items: { label: string; detail?: string; file: boolean; caseId?: string }[]) {
      const m = M(matterId);
      const created: InfoRequest[] = items.map((i) => {
        const docId = i.file ? clients().requestDocument(m.clientId, { name: i.label, service: "expunge", category: "Requested from client", sensitive: true, expMatterId: matterId, expCaseId: i.caseId }) : undefined;
        return { id: uid("i"), caseId: i.caseId, label: i.label, detail: i.detail, file: i.file, status: "open", docIds: docId ? [docId] : [], createdAt: nowIso() };
      });
      upM(matterId, (x) => ({ ...x, info: [...x.info, ...created] }));
      msg(m, `We need ${items.length} item${items.length > 1 ? "s" : ""} from you for your expungement matter. See "What we need from you" in your portal.`);
    },
    respondInfo(matterId: string, infoId: string, o: { response?: string; files?: FileIn[]; by: "client" | "staff" }) {
      const m = M(matterId);
      const it = m.info.find((i) => i.id === infoId)!;
      const docIds: string[] = [];
      (o.files ?? []).forEach((f, i) => {
        const replaces = i === 0 ? it.docIds[0] : undefined;
        docIds.push(clients().uploadDocument(m.clientId, { name: replaces ? it.label : f.name, service: "expunge", category: "Requested from client", sensitive: true, sizeKb: f.sizeKb, file: (f as { file?: File }).file, replaces, expMatterId: matterId, expCaseId: it.caseId, by: o.by }));
      });
      upM(matterId, (x) => ({ ...x, info: x.info.map((i) => (i.id === infoId ? { ...i, status: "responded", response: o.response ?? i.response, docIds: [...new Set([...i.docIds, ...docIds])], respondedAt: nowIso() } : i)) }));
      if (o.response && o.by === "client") msg(m, `Re: ${it.label} — ${o.response}`, "client");
    },
    acceptInfo(matterId: string, infoId: string) {
      upM(matterId, (x) => ({ ...x, info: x.info.map((i) => (i.id === infoId ? { ...i, status: "accepted" } : i)) }));
    },

    /* ---------------- Billing ---------------- */
    invoice(matterId: string, lines: InvoiceLine[], description: string) {
      const m = M(matterId);
      return clients().createInvoice(m.clientId, { service: "expunge", description, amount: lines.reduce((s, l) => s + l.amount, 0), dueAt: new Date(SAMPLE_NOW.getTime() + 14 * 86400000).toISOString(), draft: false, expMatterId: matterId, lines });
    },

    /* ---------------- Admin ---------------- */
    saveJurisdiction(j: Jurisdiction) {
      // Only the release states can be active; others may be drafted for later but never activated.
      if (!(RELEASE_STATES as readonly string[]).includes(j.state)) j = { ...j, active: false };
      set((s) => ({ ...s, jurisdictions: s.jurisdictions.some((x) => x.id === j.id) ? s.jurisdictions.map((x) => (x.id === j.id ? j : x)) : [...s.jurisdictions, j] }));
    },
    saveService(svc: ServiceType) {
      set((s) => ({ ...s, services: s.services.some((x) => x.id === svc.id) ? s.services.map((x) => (x.id === svc.id ? svc : x)) : [...s.services, svc] }));
    },
    savePrice(p: PriceRule) {
      set((s) => ({ ...s, prices: s.prices.some((x) => x.id === p.id) ? s.prices.map((x) => (x.id === p.id ? p : x)) : [...s.prices, p] }));
    },
    deletePrice(id: string) {
      set((s) => ({ ...s, prices: s.prices.filter((x) => x.id !== id) }));
    },
  };
  return a;
}

type Can = { label: string; criminalHistory: boolean; edit: boolean; screening: boolean; billing: boolean; admin: boolean; revealSsn: boolean };
type Ctx = ReturnType<typeof makeActions> & State & { role: ExpRole; setRole: (r: ExpRole) => void; can: Can; ready: boolean };
const NO_ACCESS: Can = { label: "No access", criminalHistory: false, edit: false, screening: false, billing: false, admin: false, revealSsn: false };
const Ctx = createContext<Ctx | null>(null);

export function ExpProvider({ children }: { children: React.ReactNode }) {
  const clients = useClients();
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const [role, setRole] = useState<ExpRole>("owner");
  // Live CRM: what this person may do comes from their own role (the server enforces it again).
  const [live, setLive] = useState<Can | null>(null);
  const ref = useRef(state);
  ref.current = state;
  const cref = useRef(clients);
  cref.current = clients;
  const rref = useRef(role);
  rref.current = role;
  const actions = useMemo(() => makeActions(dispatch, () => ref.current, () => cref.current, () => rref.current), []);

  // Keep each client's expungement engagement in step with its matter.
  useEffect(() => {
    state.matters.forEach((m) => {
      if (!m.enrollmentId) return;
      const c = cref.current.clients.find((x) => x.id === m.clientId);
      const e = c?.enrollments.find((x) => x.id === m.enrollmentId);
      if (!c || !e) return;
      const next = matterEnrollment(m, matterCases(state, m.id));
      if (e.stage !== next.stage || e.status !== next.status || e.progress !== next.progress || e.title !== next.title) {
        cref.current.syncEnrollmentStage(c.id, e.id, next.stage, next.status, next.progress);
        if (e.title !== next.title) cref.current.updateClient(c.id, { enrollments: c.enrollments.map((x) => (x.id === e.id ? { ...x, ...next } : x)) }, "Expungement engagement updated");
      }
    });
  }, [state.matters, state.cases]); // eslint-disable-line react-hooks/exhaustive-deps

  const { ready } = useExpSync(state, dispatch, setLive);
  const value = useMemo(() => ({ ...actions, ...state, role, setRole, can: BACKEND ? live ?? NO_ACCESS : EXP_ROLES[role], ready }), [actions, state, role, live, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useExp must be used inside <ExpProvider>");
  return v;
}

/* ------------------------------------------------------------------ */
/* Backend sync (only when NEXT_PUBLIC_BACKEND=1)                      */
/* ------------------------------------------------------------------ */

type Coll = "matters" | "cases";
const ORDER: Coll[] = ["matters", "cases"]; // a case's matter must exist first
type ConfigSnap = Pick<State, "jurisdictions" | "services" | "prices">;
const configOf = (s: State): ConfigSnap => ({ jurisdictions: s.jurisdictions, services: s.services, prices: s.prices });
const sameConfig = (a: ConfigSnap, b: ConfigSnap) => a.jurisdictions === b.jurisdictions && a.services === b.services && a.prices === b.prices;

/**
 * Loads the matters and cases this person may open (decrypted on the server,
 * every load audited), then saves each changed record with the revision it
 * started from. A refused change reloads the latest version.
 */
function useExpSync(state: State, dispatch: React.Dispatch<Action>, setLive: (c: Can) => void) {
  const [ready, setReady] = useState(!BACKEND);
  const synced = useRef(new Map<string, unknown>());
  const revs = useRef(new Map<string, number>());
  const cfg = useRef<{ snap: ConfigSnap | null; updatedAt: string | null }>({ snap: null, updatedAt: null });
  const busy = useRef(false);
  const again = useRef(false);
  const later = useRef(debouncer(500)).current;
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(async () => {
    try {
      type R = { rev?: number; id: string };
      const r = await call<{ matters: (ExpMatter & R)[]; cases: (ExpCase & R)[]; config: (ConfigSnap & { updatedAt: string }) | null }>("GET", "/api/exp");
      const strip = <T extends R>(list: T[], c: Coll) => list.map((x) => { const { rev, ...rest } = x; revs.current.set(`${c}:${x.id}`, rev ?? 1); return rest as unknown as T; });
      const matters = strip(r.matters, "matters").map((m) => ({ ...m, enrollmentId: m.enrollmentId ?? expEnrollmentId(m) }));
      const cases = strip(r.cases, "cases");
      dispatch({ type: "fn", fn: (s) => {
        const next: State = { ...s, matters, cases, ...(r.config ? { jurisdictions: r.config.jurisdictions, services: r.config.services, prices: r.config.prices } : {}) };
        matters.forEach((x) => synced.current.set(`matters:${x.id}`, x));
        cases.forEach((x) => synced.current.set(`cases:${x.id}`, x));
        cfg.current = { snap: configOf(next), updatedAt: r.config?.updatedAt ?? null };
        return next;
      } });
    } catch (e) {
      if (!(e instanceof RemoteError && (e.status === 401 || e.status === 403))) notify("Couldn't load Record Expungement.");
    }
  }, []);
  useEffect(() => {
    if (!BACKEND) return;
    (async () => {
      try {
        const me = await call<{ perms?: Record<string, string[]>; sensitive?: string[] }>("GET", "/api/auth/session");
        const ex = me.perms?.exp ?? [];
        setLive({ label: "Your role", criminalHistory: ex.includes("view"), edit: ex.includes("edit"), screening: ex.includes("approve"), billing: (me.perms?.billing ?? []).includes("create"), admin: ex.includes("settings"), revealSsn: (me.sensitive ?? []).includes("exp.revealSsn") });
        if (ex.includes("view")) await reload();
      } catch { /* signed out */ }
      setReady(true);
    })();
  }, []);

  const flush = useCallback(async () => {
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    let failed = false;
    try {
      const s = stateRef.current;
      for (const c of ORDER) {
        for (const rec of s[c] as { id: string; clientId: string }[]) {
          const key = `${c}:${rec.id}`;
          if (synced.current.get(key) === rec) continue;
          try {
            if (!revs.current.has(key)) {
              await pendingClientCreates.get(rec.clientId); // a brand-new client must exist first
              const res = await call<{ record: { rev: number } }>("POST", `/api/exp/records/${c}`, { record: rec });
              revs.current.set(key, res.record.rev ?? 1);
            } else {
              const res = await call<{ record: { rev: number } }>("PUT", `/api/exp/records/${c}/${encodeURIComponent(rec.id)}`, { record: { ...rec, rev: revs.current.get(key) } });
              revs.current.set(key, res.record.rev ?? 1);
            }
            synced.current.set(key, rec);
          } catch (e) {
            if (e instanceof RemoteError && e.status === 401) return;
            notify(e instanceof RemoteError ? e.message : "Couldn't save — check your connection.");
            failed = true;
          }
        }
      }
      const snap = configOf(s);
      if (cfg.current.snap && !sameConfig(cfg.current.snap, snap)) {
        try {
          const res = await call<{ config: { updatedAt: string } }>("PUT", "/api/exp/config", { config: snap, updatedAt: cfg.current.updatedAt });
          cfg.current = { snap, updatedAt: res.config.updatedAt };
        } catch (e) {
          notify(e instanceof RemoteError ? e.message : "Couldn't save the settings.");
          failed = true;
        }
      }
      if (failed) await reload();
    } finally {
      busy.current = false;
    }
    if (again.current) { again.current = false; later("flush", () => void flush()); }
  }, []);

  useEffect(() => {
    if (!BACKEND || !ready) return;
    later("flush", () => void flush());
  }, [state, ready]);

  return { ready };
}
