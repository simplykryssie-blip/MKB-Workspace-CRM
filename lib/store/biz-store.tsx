"use client";

/**
 * Business Services Center store (Phase 2 — in-browser sample data only).
 *
 * Single source of truth:
 *  - Clients are the central CRM records; a request links to one (or holds a
 *    prospect's contact details until they become a client — never a duplicate).
 *  - Documents, invoices and client-visible messages live on the client record,
 *    tagged with the business entity and service request.
 *  - Each request mirrors its status onto the client's business-services engagement.
 * Nothing is filed with any agency from here: staff record what they did, and an
 * approval needs a confirmation the staff member verified with the agency.
 */
import { createContext, useContext, useMemo, useReducer, useRef } from "react";
import { BIZ_ENTITIES, BIZ_REQUESTS, COMPLIANCE_ITEMS, COMPLIANCE_RULES, STATE_CHECKLISTS, bizEnrollmentState } from "@/lib/sample/biz-seed";
import { SAMPLE_NOW, staffById, meId } from "@/lib/sample/clients";
import { nowIso, useClients } from "@/lib/store/clients-store";
import {
  DEFAULT_CATALOG,
  DEFAULT_REMINDERS,
  STATUS_META,
  FREQ_MONTHS,
  daysBetween,
  nextAnnual,
  quoteTotal,
  type AgencyEvent,
  type BizEntity,
  type CatalogService,
  type ComplianceItem,
  type ComplianceKind,
  type ComplianceRule,
  type Deliverable,
  type DocCategory,
  type EntityType,
  type FormationDetails,
  type InfoRequest,
  type Owner,
  type QuoteLine,
  type RequestStatus,
  type ServiceRequest,
  type Standing,
  type StateChecklist,
  type StateRegistration,
} from "@/lib/biz/config";
import type { Client, Invoice } from "@/lib/types";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
type ClientsApi = ReturnType<typeof useClients>;
type FileIn = { name: string; sizeKb: number };

type State = {
  catalog: CatalogService[];
  rules: ComplianceRule[];
  checklists: StateChecklist[];
  reminderDefaults: number[];
  entities: BizEntity[];
  requests: ServiceRequest[];
  compliance: ComplianceItem[];
  nextNumber: number;
};
const init = (): State => ({
  catalog: structuredClone(DEFAULT_CATALOG),
  rules: structuredClone(COMPLIANCE_RULES),
  checklists: structuredClone(STATE_CHECKLISTS),
  reminderDefaults: [...DEFAULT_REMINDERS],
  entities: structuredClone(BIZ_ENTITIES),
  requests: structuredClone(BIZ_REQUESTS),
  compliance: structuredClone(COMPLIANCE_ITEMS),
  nextNumber: 1045,
});
type Action = { type: "reset" } | { type: "fn"; fn: (s: State) => State };
const reducer = (s: State, a: Action): State => (a.type === "reset" ? init() : a.fn(s));

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export const requestInvoices = (r: ServiceRequest, c?: Client): Invoice[] => (c?.invoices ?? []).filter((i) => i.bizRequestId === r.id);
export const requestDocs = (r: ServiceRequest, c?: Client) => (c?.documents ?? []).filter((d) => d.bizRequestId === r.id);
export const requestMessages = (r: ServiceRequest, c?: Client) => (c?.messages ?? []).filter((m) => m.bizRequestId === r.id);
export const openInfo = (r: ServiceRequest) => r.info.filter((i) => i.status === "open");
export const isClosed = (r: ServiceRequest) => r.status === "Completed" || r.status === "Cancelled";

export type PayState = "not_quoted" | "quote_draft" | "quote_sent" | "awaiting_payment" | "partial" | "paid" | "waived" | "refunded";
export const PAY_META: Record<PayState, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  not_quoted: { label: "Not quoted", tone: "neutral" },
  quote_draft: { label: "Quote draft", tone: "neutral" },
  quote_sent: { label: "Quote sent", tone: "info" },
  awaiting_payment: { label: "Awaiting payment", tone: "warning" },
  partial: { label: "Partially paid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  waived: { label: "Proceeding before payment", tone: "info" },
  refunded: { label: "Refunded", tone: "neutral" },
};
export function payState(r: ServiceRequest, c?: Client): { state: PayState; billed: number; paid: number; due: number; overdue: boolean } {
  const inv = requestInvoices(r, c).filter((i) => i.status !== "draft");
  const billed = inv.reduce((s, i) => s + i.amount, 0);
  const paid = inv.reduce((s, i) => s + i.paid, 0);
  const due = billed - paid;
  const overdue = inv.some((i) => i.status === "overdue" || (i.status !== "paid" && i.dueAt < SAMPLE_NOW.toISOString()));
  let state: PayState;
  if (inv.length) state = inv.some((i) => i.adjustments?.some((a) => a.kind === "refund")) && due <= 0 && billed === 0 ? "refunded" : due <= 0 ? "paid" : r.paymentWaived ? "waived" : paid > 0 ? "partial" : "awaiting_payment";
  else state = r.quote.status === "sent" ? "quote_sent" : r.quote.lines.length ? (r.quote.status === "accepted" ? "awaiting_payment" : "quote_draft") : "not_quoted";
  return { state, billed, paid, due, overdue };
}
/** Work may start once paid (in full or in part) or an owner approved proceeding first. */
export const paymentCleared = (r: ServiceRequest, c?: Client) => {
  const p = payState(r, c);
  return p.state === "paid" || p.state === "partial" || p.state === "waived" || (p.billed === 0 && quoteTotal(r.quote) === 0 && r.quote.status === "accepted");
};

export function nextStep(r: ServiceRequest, c: Client | undefined, svc?: CatalogService): { text: string; owner: Owner } {
  const p = payState(r, c);
  const info = openInfo(r).length;
  switch (r.status) {
    case "Intake":
      if (!r.clientId) return { text: "Link to a client or create the client record", owner: "MKB" };
      if (r.consultation?.status === "scheduled") return { text: `Hold the consultation`, owner: "MKB" };
      if (p.state === "not_quoted" || p.state === "quote_draft") return { text: "Prepare and send the quote", owner: "MKB" };
      if (p.state === "quote_sent") return { text: "Client to accept the quote", owner: "Client" };
      if (p.state === "awaiting_payment") return { text: "Client to pay the invoice", owner: "Client" };
      return { text: info ? "Client to provide the requested information" : "Mark ready for processing", owner: info ? "Client" : "MKB" };
    case "Awaiting Client Information":
      return info ? { text: `Client to provide ${info} item${info > 1 ? "s" : ""}`, owner: "Client" } : { text: "Review the client's responses", owner: "MKB" };
    case "Ready for Processing":
      return paymentCleared(r, c) ? { text: "Start the work", owner: "MKB" } : { text: "Client to pay before work starts", owner: "Client" };
    case "In Progress": {
      const ready = r.deliverables.filter((x) => x.status === "ready_for_review").length;
      if (ready) return { text: `Review ${ready} deliverable${ready > 1 ? "s" : ""}`, owner: "MKB" };
      if (svc?.agency && !r.agency.some((a) => a.kind === "submitted")) return { text: "Prepare and submit to the agency, then record it", owner: "MKB" };
      return { text: "Prepare the deliverables", owner: "MKB" };
    }
    case "Submitted to Agency":
      return { text: "Follow up with the agency", owner: "Agency" };
    case "Awaiting Agency Response":
      return { text: "Waiting on the agency — record its response once verified", owner: "Agency" };
    case "Approved":
      return r.deliverables.some((x) => x.status === "approved") ? { text: "Deliver documents to the client", owner: "MKB" } : { text: "Upload and review the deliverables", owner: "MKB" };
    case "Documents Delivered":
      return { text: "Approve completion", owner: "MKB" };
    case "Completed":
      return r.followUpAt && r.followUpAt > SAMPLE_NOW.toISOString() ? { text: `Follow up on ${new Date(r.followUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, owner: "Done" } : { text: "Complete", owner: "Done" };
    case "On Hold":
      return { text: `On hold — ${r.holdReason ?? "see notes"}`, owner: "MKB" };
    case "Cancelled":
      return { text: "Cancelled", owner: "Done" };
  }
}

export type DueState = "overdue" | "due_soon" | "upcoming" | "filed" | "not_applicable" | "in_progress";
export function dueState(i: ComplianceItem): { state: DueState; days: number; label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" } {
  const days = daysBetween(SAMPLE_NOW.toISOString(), i.dueAt);
  if (i.status === "filed") return { state: "filed", days, label: "Filed", tone: "success" };
  if (i.status === "not_applicable") return { state: "not_applicable", days, label: "Not applicable", tone: "neutral" };
  if (days < 0) return { state: "overdue", days, label: `Overdue ${-days}d`, tone: "danger" };
  if (i.status === "in_progress") return { state: "in_progress", days, label: `In progress · ${days}d`, tone: "info" };
  if (days <= 30) return { state: "due_soon", days, label: `Due in ${days}d`, tone: "warning" };
  return { state: "upcoming", days, label: `Due in ${days}d`, tone: "neutral" };
}
/** Reminder thresholds reached but not yet sent. */
export const pendingReminders = (i: ComplianceItem) => {
  if (i.status === "filed" || i.status === "not_applicable") return [];
  const days = daysBetween(SAMPLE_NOW.toISOString(), i.dueAt);
  return i.reminderDays.filter((r) => days <= r && !i.remindersSent.includes(r));
};
export const nextReminder = (i: ComplianceItem) => {
  const days = daysBetween(SAMPLE_NOW.toISOString(), i.dueAt);
  const future = i.reminderDays.filter((r) => r < days).sort((a, b) => b - a)[0];
  return future == null ? undefined : { inDays: days - future, at: future };
};
/** Deadline summary from MKB's tracker. Never a compliance claim on its own. */
export const deadlineSummary = (items: ComplianceItem[]): { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" } => {
  const open = items.filter((i) => i.status !== "filed" && i.status !== "not_applicable");
  const s = open.map(dueState);
  if (s.some((x) => x.state === "overdue")) return { label: "Deadline overdue", tone: "danger" };
  if (s.some((x) => x.state === "due_soon" || x.state === "in_progress")) return { label: "Deadline due soon", tone: "warning" };
  if (!open.length) return { label: "No deadlines tracked", tone: "neutral" };
  return { label: "No deadlines due soon", tone: "info" };
};
/** Standing comes only from a staff check of the state's records — otherwise "Not verified". */
export const STANDING_META: Record<Standing["status"], { label: string; tone: "success" | "danger" | "neutral" }> = {
  not_verified: { label: "Standing not verified", tone: "neutral" },
  verified_active: { label: "Active — verified", tone: "success" },
  verified_issue: { label: "Issue found — verified", tone: "danger" },
};
/** Every state the business is registered in: formation first, then active/pending registrations. */
export const entityStates = (e: BizEntity) => [e.state, ...e.registrations.filter((r) => r.status !== "withdrawn").map((r) => r.state).filter((x) => x !== e.state)];
/** Document checklist for a request: the service's own list plus any for the request's state. */
export const checklistFor = (r: ServiceRequest, catalog: CatalogService[], lists: StateChecklist[]) => {
  const svc = catalog.find((x) => x.id === r.serviceId);
  const st = lists.filter((l) => l.state === r.state && (l.serviceId === "any" || l.serviceId === r.serviceId));
  return { service: svc?.needs ?? [], state: st.flatMap((l) => l.items.map((item) => ({ item, verified: !!l.lastVerifiedAt }))) };
};

const SERVICE_FOR_KIND: Record<ComplianceKind, string> = { annual_report: "annual", franchise_tax: "state-compliance", periodic_report: "annual", business_license: "license", registered_agent: "agent", foreign_qualification: "foreign", other: "state-compliance" };

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type NewRequestInput = {
  clientId?: string;
  prospect?: { name: string; email: string; phone: string };
  entityId?: string;
  businessName: string;
  structure: EntityType;
  state: string;
  serviceId: string;
  description: string;
  preferredDate?: string;
  dueAt?: string;
  assignedTo: string;
  files?: FileIn[];
  note?: string;
  quotedPrice?: number;
  source: ServiceRequest["source"];
};

function makeActions(dispatch: React.Dispatch<Action>, get: () => State, clients: () => ClientsApi) {
  const set = (fn: (s: State) => State) => dispatch({ type: "fn", fn });
  const R = (id: string) => get().requests.find((r) => r.id === id)!;
  const svcOf = (r: ServiceRequest) => get().catalog.find((s) => s.id === r.serviceId);
  const upReq = (id: string, fn: (r: ServiceRequest) => ServiceRequest) => set((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? fn(r) : r)) }));
  const upEntity = (id: string, fn: (e: BizEntity) => BizEntity) => set((s) => ({ ...s, entities: s.entities.map((e) => (e.id === id ? fn(e) : e)) }));
  const upItem = (id: string, fn: (i: ComplianceItem) => ComplianceItem) => set((s) => ({ ...s, compliance: s.compliance.map((i) => (i.id === id ? fn(i) : i)) }));
  const logClient = (r: ServiceRequest, text: string, actor: "staff" | "client" | "system" = "staff") => r.clientId && clients().logActivity(r.clientId, "status", `${r.number} ${r.serviceName}: ${text}`, actor);
  const msg = (r: ServiceRequest, body: string, from: "staff" | "client" = "staff") => r.clientId && clients().sendMessage(r.clientId, body, "biz", { bizRequestId: r.id, from, author: from === "staff" ? staffById(r.assignedTo).name : undefined });

  /** Every status change goes through here: history, client activity and the client's engagement stay in step. */
  const moveTo = (id: string, status: RequestStatus, note?: string, by = meId(), extra: Partial<ServiceRequest> = {}) => {
    const r = R(id);
    if (r.status === status && !Object.keys(extra).length) return;
    const at = nowIso();
    upReq(id, (x) => ({ ...x, ...extra, status, history: [...x.history, { status, at, byId: by, note }] }));
    logClient(r, `→ ${status}${note ? ` — ${note}` : ""}`, by === "client" ? "client" : "staff");
    if (r.clientId && r.enrollmentId) {
      const e = bizEnrollmentState(status, extra.holdFrom ?? r.holdFrom);
      clients().syncEnrollmentStage(r.clientId, r.enrollmentId, e.stage, e.status, e.progress);
    }
  };

  type NewEntity = Omit<BizEntity, "id" | "createdAt" | "einStatus" | "registrations" | "standing"> & Partial<Pick<BizEntity, "einStatus" | "registrations" | "standing">>;
  const createEntity = (e: NewEntity): string => {
    const id = uid("E");
    set((s) => ({ ...s, entities: [...s.entities, { einStatus: "not_started", registrations: [], standing: { status: "not_verified" }, ...e, id, createdAt: nowIso() }] }));
    return id;
  };

  const a = {
    reset: () => dispatch({ type: "reset" }),

    /* ---------------- Intake ---------------- */
    createRequest(input: NewRequestInput): string {
      const st = get();
      const svc = st.catalog.find((s) => s.id === input.serviceId)!;
      const id = `BSR-${st.nextNumber}`;
      const at = nowIso();
      let entityId = input.entityId;
      if (!entityId && input.clientId && input.businessName.trim())
        entityId = createEntity({ clientId: input.clientId, legalName: input.businessName.trim(), entityType: input.structure, state: input.state, status: svc.formation ? "forming" : "active", principalAddress: "", ownerId: input.assignedTo });
      const lines: QuoteLine[] = [{ id: uid("q"), kind: "service", label: svc.name, amount: input.quotedPrice ?? svc.price }];
      // State fees are never pre-filled from code; only an administrator-entered estimate is used, clearly labeled.
      if (svc.filingFeeEstimate) lines.push({ id: uid("q"), kind: "filing", label: `${input.state} filing fee (admin estimate — confirm with the ${input.state} agency)`, amount: svc.filingFeeEstimate });
      const formation: FormationDetails | undefined = svc.formation
        ? { proposedName: input.businessName.trim(), alternates: [], state: input.state, structure: input.structure, purpose: "", businessAddress: "", principalLocation: "", organizer: { name: "" }, owners: [], einStatus: "not_started", stateFiling: "not_submitted", docsDelivered: false }
        : undefined;
      const r: ServiceRequest = {
        id,
        number: id,
        clientId: input.clientId,
        prospect: input.clientId ? undefined : input.prospect,
        entityId,
        businessName: input.businessName.trim(),
        structure: input.structure,
        state: input.state,
        serviceId: svc.id,
        serviceName: svc.name,
        description: input.description.trim(),
        preferredDate: input.preferredDate,
        dueAt: input.dueAt ?? input.preferredDate,
        assignedTo: input.assignedTo,
        reviewerId: input.assignedTo === meId() ? "s-jp" : meId(),
        status: "Intake",
        source: input.source,
        createdAt: at,
        quote: { status: "draft", lines },
        info: [],
        tasks: [],
        notes: input.note?.trim() ? [{ id: uid("n"), authorId: input.assignedTo, body: input.note.trim(), at }] : [],
        agency: [],
        deliverables: svc.deliverables.map((name) => ({ id: uid("v"), name, category: guessCategory(name), status: "pending" as const })),
        formation,
        history: [{ status: "Intake", at, byId: input.source === "portal" ? "client" : input.assignedTo, note: input.source === "portal" ? "submitted from the client portal" : `created from ${input.source}` }],
      };
      if (input.clientId) {
        r.enrollmentId = clients().enroll(input.clientId, { service: "biz", title: `${svc.name} — ${r.businessName}`, staffId: input.assignedTo, fee: quoteTotal(r.quote), dueAt: r.dueAt });
        (input.files ?? []).forEach((f) => clients().uploadDocument(input.clientId!, { name: f.name, service: "biz", category: "Client-provided document", sensitive: false, sizeKb: f.sizeKb, entityId, bizRequestId: id, by: input.source === "portal" ? "client" : "staff" }));
      }
      set((s) => ({ ...s, requests: [r, ...s.requests], nextNumber: s.nextNumber + 1 }));
      return id;
    },
    /** Prospect → existing client (or a new client record). Never creates a duplicate. */
    linkClient(id: string, clientId: string) {
      const r = R(id);
      const svc = svcOf(r);
      const entityId = r.entityId ?? createEntity({ clientId, legalName: r.businessName, entityType: r.structure, state: r.state, status: svc?.formation ? "forming" : "active", principalAddress: "", ownerId: r.assignedTo });
      const enrollmentId = clients().enroll(clientId, { service: "biz", title: `${r.serviceName} — ${r.businessName}`, staffId: r.assignedTo, fee: quoteTotal(r.quote), dueAt: r.dueAt });
      upReq(id, (x) => ({ ...x, clientId, entityId, enrollmentId, history: [...x.history, { status: x.status, at: nowIso(), byId: meId(), note: x.prospect ? `prospect ${x.prospect.name} linked to the client record` : "linked to the client record" }] }));
      clients().logActivity(clientId, "intake", `Business service request ${r.number} linked (${r.serviceName})`);
    },
    createClientFromProspect(id: string): string {
      const r = R(id);
      const p = r.prospect!;
      const clientId = clients().addClient({
        type: "business",
        name: r.businessName,
        contactName: p.name,
        email: p.email,
        phone: p.phone,
        address: { line1: "", city: "", state: r.state, zip: "" },
        entityType: r.structure === "Corporation" ? "C-Corp" : r.structure,
        services: [],
        staffIds: [r.assignedTo],
        invite: false,
      });
      a.linkClient(id, clientId);
      return clientId;
    },
    updateRequest(id: string, patch: Partial<Pick<ServiceRequest, "description" | "dueAt" | "preferredDate" | "businessName" | "state" | "structure">>, summary = "Details updated") {
      upReq(id, (r) => ({ ...r, ...patch, history: [...r.history, { status: r.status, at: nowIso(), byId: meId(), note: summary }] }));
    },
    assign(id: string, role: "assignedTo" | "reviewerId", staffId: string) {
      const r = R(id);
      upReq(id, (x) => ({ ...x, [role]: staffId, history: [...x.history, { status: x.status, at: nowIso(), byId: meId(), note: `${role === "assignedTo" ? "Assigned to" : "Reviewer"}: ${staffById(staffId).name}` }] }));
      logClient(r, `${role === "assignedTo" ? "assigned to" : "reviewer set to"} ${staffById(staffId).name}`);
    },

    /* ---------------- Consultation + quote + payment ---------------- */
    scheduleConsult(id: string, at: string, mode: "In person" | "Video" | "Phone") {
      const r = R(id);
      upReq(id, (x) => ({ ...x, consultation: { status: "scheduled", at } }));
      if (r.clientId) clients().schedule(r.clientId, { title: `${r.serviceName} — consultation`, service: "biz", at, durationMin: 45, mode, staffId: r.assignedTo });
    },
    completeConsult(id: string, summary: string) {
      upReq(id, (x) => ({ ...x, consultation: { status: "completed", at: x.consultation?.at ?? nowIso() }, notes: summary ? [{ id: uid("n"), authorId: x.assignedTo, body: `Consultation notes: ${summary}`, at: nowIso() }, ...x.notes] : x.notes }));
    },
    saveQuote(id: string, lines: QuoteLine[], note?: string) {
      upReq(id, (r) => ({ ...r, quote: { ...r.quote, lines, note, status: r.quote.status === "accepted" ? "accepted" : r.quote.status === "sent" ? "sent" : "draft" } }));
    },
    /** Send the quote (optionally saving new lines in the same step). */
    sendQuote(id: string, lines?: QuoteLine[], note?: string) {
      const r = R(id);
      const q = { ...r.quote, lines: lines ?? r.quote.lines, note: lines ? note : r.quote.note };
      upReq(id, (x) => ({ ...x, quote: { ...x.quote, lines: q.lines, note: q.note, status: "sent", sentAt: nowIso() } }));
      msg(r, `Your quote for ${r.serviceName} is ready: $${quoteTotal(q).toFixed(2)}. You can review and accept it in your portal.`);
      logClient(r, "quote sent");
    },
    /** Accepting a quote issues the invoice on the client's record (MKB and pass-through fees itemized). */
    acceptQuote(id: string, by: "client" | "staff") {
      const r = R(id);
      if (r.quote.status === "accepted") return;
      if (!r.clientId) return;
      upReq(id, (x) => ({ ...x, quote: { ...x.quote, status: "accepted", acceptedAt: nowIso() } }));
      const total = quoteTotal(r.quote);
      if (total > 0)
        clients().createInvoice(r.clientId, {
          service: "biz",
          description: `${r.businessName} — ${r.serviceName}`,
          amount: total,
          dueAt: new Date(SAMPLE_NOW.getTime() + 14 * 86400000).toISOString(),
          draft: false,
          bizRequestId: r.id,
          lines: r.quote.lines.map((l) => ({ label: l.label, kind: l.kind, amount: l.kind === "discount" ? -Math.abs(l.amount) : l.amount })),
        });
      logClient(r, `quote accepted${by === "client" ? " by the client" : ""}`, by === "client" ? "client" : "staff");
    },
    declineQuote(id: string) {
      upReq(id, (x) => ({ ...x, quote: { ...x.quote, status: "declined" } }));
    },
    waivePayment(id: string, reason: string) {
      upReq(id, (x) => ({ ...x, paymentWaived: reason, history: [...x.history, { status: x.status, at: nowIso(), byId: meId(), note: `proceeding before payment — ${reason}` }] }));
    },
    /** Additional fee after the quote: issued as its own invoice so history stays clear. */
    addCharge(id: string, line: Omit<QuoteLine, "id">) {
      const r = R(id);
      if (!r.clientId) return;
      clients().createInvoice(r.clientId, { service: "biz", description: `${r.businessName} — ${line.label}`, amount: line.kind === "discount" ? -Math.abs(line.amount) : line.amount, dueAt: new Date(SAMPLE_NOW.getTime() + 14 * 86400000).toISOString(), draft: false, bizRequestId: r.id, lines: [{ ...line }] });
    },

    /* ---------------- Client information ---------------- */
    requestInfo(id: string, items: { label: string; detail?: string; file: boolean }[], moveToAwaiting: boolean) {
      const r = R(id);
      const at = nowIso();
      const created: InfoRequest[] = items.map((i) => {
        const docId = i.file && r.clientId ? clients().requestDocument(r.clientId, { name: i.label, service: "biz", category: "Client-provided document", sensitive: false, entityId: r.entityId, bizRequestId: r.id }) : undefined;
        return { id: uid("i"), label: i.label, detail: i.detail, file: i.file, status: "open", docIds: docId ? [docId] : [], createdAt: at };
      });
      upReq(id, (x) => ({ ...x, info: [...x.info, ...created] }));
      msg(r, `We need ${items.length} item${items.length > 1 ? "s" : ""} from you for ${r.serviceName}. You'll find ${items.length > 1 ? "them" : "it"} under "What we need from you" in your portal.`);
      if (moveToAwaiting && r.status !== "Awaiting Client Information") moveTo(id, "Awaiting Client Information", `${items.length} item(s) requested`, r.assignedTo);
    },
    respondInfo(id: string, infoId: string, o: { response?: string; files?: FileIn[]; by: "client" | "staff" }) {
      const r = R(id);
      const it = r.info.find((i) => i.id === infoId)!;
      const docIds: string[] = [];
      (o.files ?? []).forEach((f, i) => {
        const replaces = i === 0 ? it.docIds.find((d) => r.clientId && clients().clients.find((c) => c.id === r.clientId)?.documents.find((x) => x.id === d)?.status === "requested") : undefined;
        docIds.push(clients().uploadDocument(r.clientId!, { name: replaces ? it.label : f.name, service: "biz", category: "Client-provided document", sensitive: false, sizeKb: f.sizeKb, replaces, entityId: r.entityId, bizRequestId: r.id, by: o.by }));
      });
      upReq(id, (x) => ({ ...x, info: x.info.map((i) => (i.id === infoId ? { ...i, status: "responded", response: o.response ?? i.response, docIds: [...new Set([...i.docIds, ...docIds])], respondedAt: nowIso() } : i)) }));
      if (o.response && o.by === "client") msg(r, `Re: ${it.label} — ${o.response}`, "client");
      logClient(r, `${o.by === "client" ? "client responded" : "response recorded"}: ${it.label}`, o.by === "client" ? "client" : "staff");
    },
    acceptInfo(id: string, infoId: string) {
      upReq(id, (x) => ({ ...x, info: x.info.map((i) => (i.id === infoId ? { ...i, status: "accepted" } : i)) }));
    },
    askAgain(id: string, infoId: string, note: string) {
      const r = R(id);
      upReq(id, (x) => ({ ...x, info: x.info.map((i) => (i.id === infoId ? { ...i, status: "open", detail: note } : i)) }));
      msg(r, `We need a little more on "${r.info.find((i) => i.id === infoId)?.label}": ${note}`);
    },

    /* ---------------- Status transitions ---------------- */
    markReady: (id: string) => moveTo(id, "Ready for Processing", "intake complete", R(id).assignedTo),
    /** Non-agency work: approved once the reviewer approved every deliverable. Agency work needs a verified confirmation instead. */
    internalApprove(id: string) {
      const r = R(id);
      if (svcOf(r)?.agency || !r.deliverables.length || r.deliverables.some((d) => d.status === "pending" || d.status === "ready_for_review")) return false;
      moveTo(id, "Approved", `deliverables approved by ${staffById(r.reviewerId).name}`, r.reviewerId);
      return true;
    },
    remind(id: string) {
      const r = R(id);
      const n = openInfo(r).length;
      msg(r, `Reminder: we're still waiting on ${n} item${n === 1 ? "" : "s"} for ${r.serviceName}. You can respond or upload in your portal.`);
      return n;
    },
    startWork: (id: string) => moveTo(id, "In Progress", `work started by ${staffById(R(id).assignedTo).name}`, R(id).assignedTo),
    hold(id: string, reason: string) {
      const r = R(id);
      moveTo(id, "On Hold", reason, meId(), { holdFrom: r.status, holdReason: reason });
    },
    resume(id: string) {
      const r = R(id);
      moveTo(id, r.holdFrom ?? "In Progress", "resumed", meId(), { holdFrom: undefined, holdReason: undefined });
    },
    cancel(id: string, reason: string) {
      moveTo(id, "Cancelled", reason, meId(), { cancelReason: reason });
    },
    reopen(id: string, reason: string) {
      moveTo(id, "In Progress", `reopened — ${reason}`, meId(), { cancelReason: undefined, completedAt: undefined, approvedBy: undefined });
    },
    override(id: string, status: RequestStatus, reason: string) {
      moveTo(id, status, `override — ${reason}`);
    },

    /* ---------------- Agency log ---------------- */
    recordAgency(id: string, e: Omit<AgencyEvent, "id" | "confirmationDocId"> & { confirmationFile?: FileIn; confirmationDocId?: string }) {
      const r = R(id);
      let confirmationDocId = e.confirmationDocId;
      if (e.confirmationFile && r.clientId)
        confirmationDocId = clients().uploadDocument(r.clientId, { name: e.confirmationFile.name, service: "biz", category: "State filing confirmation", sensitive: false, sizeKb: e.confirmationFile.sizeKb, entityId: r.entityId, bizRequestId: r.id, by: "staff" });
      // An approval is only recorded with a reference, a verified confirmation and the confirmation on file.
      if (e.kind === "approved" && (!e.verified || !e.reference || !confirmationDocId)) throw new Error("Approval needs a verified confirmation");
      const ev: AgencyEvent = { id: uid("a"), agency: e.agency, kind: e.kind, at: e.at, byId: e.byId, reference: e.reference, note: e.note, verified: e.verified, confirmationDocId };
      upReq(id, (x) => {
        let next: ServiceRequest = { ...x, agency: [...x.agency, ev] };
        if (next.formation) {
          const f = next.formation;
          next = { ...next, formation: { ...f, stateFiling: e.kind === "submitted" ? "submitted" : e.kind === "approved" ? "approved" : e.kind === "rejected" ? "rejected" : f.stateFiling === "submitted" ? "awaiting" : f.stateFiling, confirmationNumber: e.kind === "approved" ? e.reference : f.confirmationNumber, confirmationVerified: e.kind === "approved" ? true : f.confirmationVerified, confirmationDocId: e.kind === "approved" ? confirmationDocId : f.confirmationDocId } };
        }
        if (e.kind === "approved" && confirmationDocId) {
          // The verified confirmation becomes the "filing confirmation" deliverable, ready for review.
          const slot = next.deliverables.find((d) => d.category === "State filing confirmation" && d.status === "pending");
          next = { ...next, deliverables: slot ? next.deliverables.map((d) => (d.id === slot.id ? { ...d, docId: confirmationDocId, status: "ready_for_review" } : d)) : [...next.deliverables, { id: uid("v"), name: "State filing confirmation", category: "State filing confirmation", docId: confirmationDocId, status: "ready_for_review" }] };
        }
        return next;
      });
      const label = { submitted: "submitted to", follow_up: "followed up with", info_requested: "information requested by", approved: "approval verified from", rejected: "returned by" }[e.kind];
      if (e.kind === "submitted") moveTo(id, "Submitted to Agency", `${label} ${e.agency}${e.reference ? ` (${e.reference})` : ""}`, e.byId);
      else if (e.kind === "follow_up" || e.kind === "info_requested") {
        if (r.status === "Submitted to Agency") moveTo(id, "Awaiting Agency Response", `${label} ${e.agency}`, e.byId);
        else logClient(r, `${label} ${e.agency}`);
      } else if (e.kind === "approved") {
        moveTo(id, "Approved", `${label} ${e.agency} — ${e.reference}`, e.byId);
        if (r.entityId && r.formation) upEntity(r.entityId, (en) => ({ ...en, status: "active", formationDate: e.at.slice(0, 10), legalName: r.formation!.proposedName || en.legalName }));
        msg(r, `Good news — the agency approved your ${r.serviceName.toLowerCase().replace(" assistance", "")}. We're preparing your documents now.`);
      } else if (e.kind === "rejected") moveTo(id, "In Progress", `${label} ${e.agency}: ${e.note ?? ""}`, e.byId);
      return confirmationDocId;
    },

    /* ---------------- Deliverables ---------------- */
    addDeliverable(id: string, name: string, category: DocCategory) {
      upReq(id, (x) => ({ ...x, deliverables: [...x.deliverables, { id: uid("v"), name, category, status: "pending" }] }));
    },
    uploadDeliverable(id: string, delId: string, file: FileIn, expiresAt?: string) {
      const r = R(id);
      const d = r.deliverables.find((x) => x.id === delId)!;
      const docId = clients().uploadDocument(r.clientId!, { name: d.name, service: "biz", category: d.category, sensitive: false, sizeKb: file.sizeKb, entityId: r.entityId, bizRequestId: r.id, by: "staff", expiresAt });
      upReq(id, (x) => ({ ...x, deliverables: x.deliverables.map((y) => (y.id === delId ? { ...y, docId, status: "ready_for_review" } : y)) }));
    },
    reviewDeliverable(id: string, delId: string, approve: boolean, by: string) {
      const r = R(id);
      const d = r.deliverables.find((x) => x.id === delId)!;
      upReq(id, (x) => ({ ...x, deliverables: x.deliverables.map((y) => (y.id === delId ? { ...y, status: approve ? "approved" : "pending", reviewedBy: approve ? by : undefined, docId: approve ? y.docId : undefined } : y)) }));
      logClient(r, `${d.name} ${approve ? `approved by ${staffById(by).name}` : "sent back for changes"}`);
    },
    /** Delivers every approved deliverable to the client portal. */
    deliver(id: string) {
      const r = R(id);
      const ready = r.deliverables.filter((d) => d.status === "approved");
      ready.forEach((d) => d.docId && r.clientId && clients().markDocDelivered(r.clientId, d.docId));
      const at = nowIso();
      upReq(id, (x) => ({ ...x, deliverables: x.deliverables.map((d) => (d.status === "approved" ? { ...d, status: "delivered", deliveredAt: at } : d)), formation: x.formation ? { ...x.formation, docsDelivered: true } : x.formation }));
      msg(r, `Your documents for ${r.serviceName} are ready to download in your portal.`);
      if (r.status !== "Documents Delivered" && r.deliverables.every((d) => d.status === "approved" || d.status === "delivered")) moveTo(id, "Documents Delivered", `${ready.length} document(s) delivered`, r.assignedTo);
      return ready.length;
    },
    approveCompletion(id: string, by: string, followUpDays: number) {
      const at = nowIso();
      const r = R(id);
      moveTo(id, "Completed", `completion approved by ${staffById(by).name}`, by, {
        completedAt: at,
        approvedBy: by,
        followUpAt: followUpDays > 0 ? new Date(SAMPLE_NOW.getTime() + followUpDays * 86400000).toISOString() : undefined,
        formation: r.formation ? { ...r.formation, completedAt: at } : undefined,
      });
      // Compliance items this request was handling are marked filed.
      get().compliance.filter((i) => i.requestId === id && i.status !== "filed").forEach((i) => a.markFiled(i.id));
    },

    /* ---------------- Tasks + notes ---------------- */
    addTask(id: string, t: { title: string; dueAt?: string; assigneeId: string }) {
      upReq(id, (x) => ({ ...x, tasks: [...x.tasks, { id: uid("t"), ...t, done: false, createdAt: nowIso() }] }));
    },
    toggleTask(id: string, taskId: string) {
      upReq(id, (x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done, doneAt: t.done ? undefined : nowIso() } : t)) }));
    },
    addNote(id: string, body: string, authorId = meId()) {
      upReq(id, (x) => ({ ...x, notes: [{ id: uid("n"), authorId, body, at: nowIso() }, ...x.notes] }));
    },

    /* ---------------- Formation ---------------- */
    updateFormation(id: string, patch: Partial<FormationDetails>) {
      const r = R(id);
      upReq(id, (x) => ({ ...x, formation: { ...x.formation!, ...patch } }));
      if (patch.einStatus && r.entityId) upEntity(r.entityId, (e) => ({ ...e, einStatus: patch.einStatus! }));
      if (patch.agent && r.entityId) upEntity(r.entityId, (e) => ({ ...e, agent: patch.agent }));
      if ((patch.businessAddress || patch.principalLocation) && r.entityId) upEntity(r.entityId, (e) => ({ ...e, principalAddress: patch.principalLocation || patch.businessAddress || e.principalAddress }));
    },

    /* ---------------- Entities + compliance ---------------- */
    addEntity: (e: NewEntity) => createEntity(e),
    addRegistration(entityId: string, r: Omit<StateRegistration, "id">) {
      upEntity(entityId, (e) => ({ ...e, registrations: [...e.registrations, { ...r, id: uid("reg") }] }));
    },
    updateRegistration(entityId: string, regId: string, patch: Partial<StateRegistration>) {
      upEntity(entityId, (e) => ({ ...e, registrations: e.registrations.map((r) => (r.id === regId ? { ...r, ...patch } : r)) }));
    },
    /** Record what staff found when they checked the state's own records. */
    recordStanding(entityId: string, st: Standing) {
      upEntity(entityId, (e) => ({ ...e, standing: st }));
    },
    updateEntity(id: string, patch: Partial<BizEntity>) {
      upEntity(id, (e) => ({ ...e, ...patch }));
    },
    markReviewed(id: string, nextInDays: number) {
      const at = nowIso();
      upEntity(id, (e) => ({ ...e, lastReviewedAt: at, nextReviewAt: new Date(SAMPLE_NOW.getTime() + nextInDays * 86400000).toISOString() }));
    },
    addItem(i: Omit<ComplianceItem, "id" | "remindersSent">): string {
      const id = uid("ci");
      set((s) => ({ ...s, compliance: [...s.compliance, { ...i, id, remindersSent: [] }] }));
      return id;
    },
    updateItem(id: string, patch: Partial<ComplianceItem>) {
      upItem(id, (i) => ({ ...i, ...patch }));
    },
    /** Create a deadline from a configured rule. Fees and dates come from the rule only when set; otherwise staff enter them. */
    applyRule(entityId: string, ruleId: string, state: string, dueAt?: string, ownerId = meId()): string {
      const rule = get().rules.find((r) => r.id === ruleId)!;
      const e = get().entities.find((x) => x.id === entityId)!;
      let due = dueAt;
      if (!due && typeof rule.due === "object") due = nextAnnual(rule.due.month, rule.due.day, SAMPLE_NOW);
      if (!due && rule.due === "anniversary") {
        const base = state === e.state ? e.formationDate : e.registrations.find((r) => r.state === state)?.effectiveAt;
        if (base) due = nextAnnual(Number(base.slice(5, 7)), Number(base.slice(8, 10)), SAMPLE_NOW);
      }
      return a.addItem({
        entityId, state, kind: rule.kind, title: `${state === "LOCAL" ? "" : `${state} `}${rule.label}`.trim(), description: rule.description, agency: rule.agency, agencyUrl: rule.agencyUrl,
        dueAt: due!, filingFee: rule.lastVerifiedAt ? rule.filingFee : undefined, ruleId, source: rule.source, frequency: rule.frequency, lastVerifiedAt: rule.lastVerifiedAt, verifiedBy: rule.verifiedBy,
        reminderDays: [...get().reminderDefaults], status: "upcoming", ownerId, notes: rule.lastVerifiedAt ? undefined : "From an unverified rule — confirm the requirement, date and fee.",
      });
    },
    verifyItem(id: string, by: string, source: string) {
      upItem(id, (i) => ({ ...i, lastVerifiedAt: nowIso(), verifiedBy: by, source }));
    },
    /** Filing an annual item rolls it forward a year (date and reminders reset). */
    markFiled(id: string) {
      const i = get().compliance.find((x) => x.id === id)!;
      const at = nowIso();
      set((s) => {
        const list = s.compliance.map((x) => (x.id === id ? { ...x, status: "filed" as const, filedAt: at } : x));
        const months = FREQ_MONTHS[i.frequency];
        if (months) {
          const d = new Date(i.dueAt);
          d.setMonth(d.getMonth() + months);
          // The next period still needs its own verification.
          list.push({ ...i, id: uid("ci"), dueAt: d.toISOString(), status: "upcoming", remindersSent: [], requestId: undefined, filedAt: undefined, lastVerifiedAt: undefined, verifiedBy: undefined, notes: "Rolled forward — confirm the next due date with the agency." });
        }
        return { ...s, compliance: list };
      });
    },
    sendReminder(id: string, days?: number[]) {
      const i = get().compliance.find((x) => x.id === id)!;
      const e = get().entities.find((x) => x.id === i.entityId)!;
      const due = new Date(i.dueAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      clients().sendMessage(e.clientId, `Reminder: ${i.title} for ${e.legalName} is due ${due}. Reply here if you'd like MKB to handle it.`, "biz", { author: staffById(i.ownerId).name });
      const marks = days ?? pendingReminders(i);
      upItem(id, (x) => ({ ...x, remindersSent: [...new Set([...x.remindersSent, ...marks])] }));
    },
    /** Start a service request to handle a compliance deadline. */
    startRequestFor(itemId: string): string {
      const i = get().compliance.find((x) => x.id === itemId)!;
      const e = get().entities.find((x) => x.id === i.entityId)!;
      const id = a.createRequest({ clientId: e.clientId, entityId: e.id, businessName: e.legalName, structure: e.entityType, state: i.state === "LOCAL" ? e.state : i.state, serviceId: SERVICE_FOR_KIND[i.kind], description: `${i.title} — due ${new Date(i.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`, dueAt: i.dueAt, assignedTo: i.ownerId, source: "staff" });
      upItem(itemId, (x) => ({ ...x, status: "in_progress", requestId: id }));
      return id;
    },

    /* ---------------- Admin: rules, reminders, catalog ---------------- */
    saveRule(rule: ComplianceRule) {
      set((s) => ({ ...s, rules: s.rules.some((r) => r.id === rule.id) ? s.rules.map((r) => (r.id === rule.id ? rule : r)) : [...s.rules, rule] }));
    },
    verifyRule(id: string, by: string) {
      set((s) => ({ ...s, rules: s.rules.map((r) => (r.id === id ? { ...r, lastVerifiedAt: nowIso(), verifiedBy: by } : r)) }));
    },
    saveChecklist(cl: StateChecklist) {
      set((s) => ({ ...s, checklists: s.checklists.some((x) => x.id === cl.id) ? s.checklists.map((x) => (x.id === cl.id ? cl : x)) : [...s.checklists, cl] }));
    },
    deleteChecklist(id: string) {
      set((s) => ({ ...s, checklists: s.checklists.filter((x) => x.id !== id) }));
    },
    deleteRule(id: string) {
      set((s) => ({ ...s, rules: s.rules.filter((r) => r.id !== id) }));
    },
    setReminderDefaults(days: number[], applyToOpen: boolean) {
      const sorted = [...new Set(days)].sort((x, y) => y - x);
      set((s) => ({ ...s, reminderDefaults: sorted, compliance: applyToOpen ? s.compliance.map((i) => (i.status === "filed" ? i : { ...i, reminderDays: sorted })) : s.compliance }));
    },
    saveService(svc: CatalogService) {
      set((s) => ({ ...s, catalog: s.catalog.some((x) => x.id === svc.id) ? s.catalog.map((x) => (x.id === svc.id ? svc : x)) : [...s.catalog, svc] }));
    },
    toggleService(id: string) {
      set((s) => ({ ...s, catalog: s.catalog.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }));
    },

    /* ---------------- Documents ---------------- */
    uploadDoc(o: { clientId: string; entityId?: string; requestId?: string; name: string; category: DocCategory; sizeKb: number; expiresAt?: string }) {
      return clients().uploadDocument(o.clientId, { name: o.name, service: "biz", category: o.category, sensitive: false, sizeKb: o.sizeKb, entityId: o.entityId, bizRequestId: o.requestId, expiresAt: o.expiresAt, by: "staff" });
    },
  };
  return a;
}

function guessCategory(name: string): DocCategory {
  const n = name.toLowerCase();
  if (n.includes("ein")) return "EIN confirmation letter";
  if (n.includes("operating agreement")) return "Operating agreement";
  if (n.includes("resolution")) return "Corporate resolution";
  if (n.includes("annual")) return "Annual report";
  if (n.includes("license") || n.includes("permit")) return "Business license";
  if (n.includes("confirmation")) return "State filing confirmation";
  if (n.includes("articles") || n.includes("amendment") || n.includes("dissolution") || n.includes("filed")) return "Formation documents";
  return "Completed deliverable";
}

type Ctx = ReturnType<typeof makeActions> & State;
const Ctx = createContext<Ctx | null>(null);

export function BizProvider({ children }: { children: React.ReactNode }) {
  const clients = useClients();
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const ref = useRef(state);
  ref.current = state;
  const cref = useRef(clients);
  cref.current = clients;
  const actions = useMemo(() => makeActions(dispatch, () => ref.current, () => cref.current), []);
  const value = useMemo(() => ({ ...actions, ...state }), [actions, state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBiz() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBiz must be used inside <BizProvider>");
  return v;
}

export { STATUS_META };
