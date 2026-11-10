"use client";

/**
 * Tax Preparation Center store (Phase 2 — in-browser sample data only).
 *
 * Single source of truth rules:
 *  - Documents live on the central client profile; checklist items link to them.
 *  - Invoices live on the client profile (tagged with taxReturnId).
 *  - The client's Tax Preparation engagement stage mirrors the return status.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BACKEND, RemoteError, call, debouncer, notify, pendingClientCreates } from "@/lib/sync/remote";
import { DEFAULT_FEE_SCHEDULE, ORGANIZERS, RETURN_STATUSES, STATUS_PATH, baseChecklist, defaultPricing, dueDates, priceTotal, type ChecklistItem, type FeeItem, type EngagementAcceptance, type FilingStatus, type PriceLine, type ReturnStatus, type TaxForm, type TaxReturn, type Extension, type DueDiligence } from "@/lib/tax/config";
import { TAX_RETURNS } from "@/lib/sample/tax";
import { docsFor, type Answers } from "@/lib/tax/interview/engine";
import { impliedFilingStatus, sectionsFor } from "@/lib/tax/interview/questions";
import { SAMPLE_NOW, staffById, meId } from "@/lib/sample/clients";
import { nowIso, useClients } from "@/lib/store/clients-store";
import type { ActivityItem, ActivityKind, Client, ClientDocument, Invoice } from "@/lib/types";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
type ClientsApi = ReturnType<typeof useClients>;

/* ------------------------------------------------------------------ */
/* Access preview (permissions are enforced server-side in Phase 3)    */
/* ------------------------------------------------------------------ */

export type AccessPreset = "full" | "no_sensitive" | "no_billing" | "read_only";
export type TaxAccess = { edit: boolean; review: boolean; efile: boolean; billing: boolean; sensitiveDocs: boolean; revealIds: boolean };
export const ACCESS_PRESETS: Record<AccessPreset, { label: string; access: TaxAccess }> = {
  full: { label: "All tax permissions", access: { edit: true, review: true, efile: true, billing: true, sensitiveDocs: true, revealIds: true } },
  no_sensitive: { label: "Without sensitive documents & IDs", access: { edit: true, review: false, efile: true, billing: true, sensitiveDocs: false, revealIds: false } },
  no_billing: { label: "Without billing", access: { edit: true, review: true, efile: true, billing: false, sensitiveDocs: true, revealIds: true } },
  read_only: { label: "View only", access: { edit: false, review: false, efile: false, billing: false, sensitiveDocs: false, revealIds: false } },
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

type State = { returns: TaxReturn[]; fees: FeeItem[]; preset: AccessPreset };
type Action =
  | { type: "reset" }
  | { type: "add"; r: TaxReturn }
  | { type: "update"; id: string; fn: (r: TaxReturn) => TaxReturn }
  | { type: "fees"; fees: FeeItem[] }
  | { type: "preset"; preset: AccessPreset }
  | { type: "hydrate"; returns: TaxReturn[]; fees: FeeItem[] }
  | { type: "replace"; r: TaxReturn }
  | { type: "remove"; id: string };

// With the backend on, returns load from the server after sign-in.
const init = (): State => ({ returns: BACKEND ? [] : structuredClone(TAX_RETURNS), fees: structuredClone(DEFAULT_FEE_SCHEDULE), preset: "full" });

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "reset":
      return init();
    case "add":
      return { ...s, returns: [a.r, ...s.returns] };
    case "update":
      return { ...s, returns: s.returns.map((r) => (r.id === a.id ? a.fn(r) : r)) };
    case "fees":
      return { ...s, fees: a.fees };
    case "hydrate": {
      const local = s.returns.filter((r) => !a.returns.some((x) => x.id === r.id));
      return { ...s, returns: [...local, ...a.returns], fees: a.fees.length ? a.fees : s.fees };
    }
    case "remove":
      return { ...s, returns: s.returns.filter((r) => r.id !== a.id) };
    case "replace":
      return { ...s, returns: s.returns.some((r) => r.id === a.r.id) ? s.returns.map((r) => (r.id === a.r.id ? a.r : r)) : [a.r, ...s.returns] };
    case "preset":
      return { ...s, preset: a.preset };
  }
}

const log = (r: TaxReturn, kind: ActivityKind, text: string, actor: ActivityItem["actor"] = "staff"): TaxReturn => ({
  ...r,
  activity: [{ id: uid("x"), kind, text, at: nowIso(), actor }, ...r.activity],
});

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export type ItemStatus = "needed" | "requested" | "received" | "reviewed" | "rejected" | "waived";

export function itemStatus(item: ChecklistItem, client?: Client): ItemStatus {
  if (item.waivedReason) return "waived";
  if (item.archived) return "reviewed";
  const doc = item.docId ? client?.documents.find((d) => d.id === item.docId) : undefined;
  return doc ? (doc.status as ItemStatus) : "needed";
}
export const outstandingItems = (r: TaxReturn, client?: Client) => r.checklist.filter((i) => i.required && ["needed", "requested", "rejected"].includes(itemStatus(i, client)));

export const returnInvoices = (r: TaxReturn, client?: Client): Invoice[] => (client?.invoices ?? []).filter((i) => i.taxReturnId === r.id);
export function billing(r: TaxReturn, client?: Client) {
  const inv = returnInvoices(r, client);
  const price = priceTotal(r);
  const billed = inv.filter((i) => i.status !== "draft").reduce((s, i) => s + i.amount, 0);
  const paid = inv.reduce((s, i) => s + i.paid, 0);
  return { price, billed, paid, balance: billed - paid, unbilled: Math.max(0, price - billed), invoices: inv };
}

export function isPastDue(r: TaxReturn, now = SAMPLE_NOW) {
  if (["Submitted", "Accepted", "Completed"].includes(r.status)) return false;
  const due = r.extension?.dueAt ?? r.dueAt;
  return !!due && new Date(due) < now;
}
export const effectiveDue = (r: TaxReturn) => r.extension?.dueAt ?? r.dueAt;

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function makeActions(dispatch: React.Dispatch<Action>, get: () => State, clients: () => ClientsApi) {
  const R = (id: string) => get().returns.find((r) => r.id === id)!;
  const C = (clientId: string) => clients().clients.find((c) => c.id === clientId);
  const up = (id: string, fn: (r: TaxReturn) => TaxReturn) => dispatch({ type: "update", id, fn });
  const label = (r: TaxReturn) => `TY ${r.taxYear} ${r.form}`;

  /** Status change: history + activity on the return, client activity, engagement sync. */
  const moveTo = (id: string, status: ReturnStatus, text?: string, by = meId()) => {
    const r = R(id);
    if (r.status === status) return;
    // Same rule the server enforces: no review until the engagement letter is accepted.
    const at = STATUS_PATH.indexOf("Ready for Review"), from = STATUS_PATH.indexOf(r.status), to = STATUS_PATH.indexOf(status);
    if (RULES.requireEngagement && to >= at && from >= 0 && from < at && !r.organizer.engagement) {
      notify("The client needs to accept the engagement letter first (Interview tab → Engagement letter).");
      return;
    }
    up(id, (x) =>
      log(
        { ...x, status, statusHistory: [...x.statusHistory, { status, at: nowIso(), by, note: text }], completedAt: status === "Completed" ? nowIso() : x.completedAt },
        "status",
        `Status → ${status}${text ? ` — ${text}` : ""}`,
      ),
    );
    clients().logActivity(r.clientId, "status", `${label(r)} return → ${status}`);
    if (r.enrollmentId) clients().syncTaxEnrollment(r.clientId, r.enrollmentId, status);
  };

  const docTitle = (r: TaxReturn, name: string) => name; // names stay clean; tax year is tagged on the document

  const a = {
    reset: () => dispatch({ type: "reset" }),
    setPreset: (preset: AccessPreset) => dispatch({ type: "preset", preset }),

    createReturn(input: { clientId: string; taxYear: number; form: TaxForm; filingStatus?: FilingStatus; preparerId: string; reviewerId: string; states: string[]; extension?: boolean; extensionOnly?: boolean; amendsReturnId?: string }): string {
      const c = C(input.clientId)!;
      const base = `TR-${input.clientId}-${input.taxYear}`;
      const taken = (x: string) => get().returns.some((r) => r.id === x);
      let id = input.amendsReturnId ? `${base}-AMD` : `${base}${taken(base) ? `-${input.form.replace(/\W/g, "")}` : ""}`;
      for (let n = 2; taken(id); n++) id = `${input.amendsReturnId ? `${base}-AMD` : base}-${n}`;
      const { due, extended } = dueDates(input.form, input.taxYear);
      // Link to an existing engagement for this year, or create one on the client profile.
      const title = `${input.taxYear} ${c.type === "business" ? "Business" : input.form === "1040-X" ? "Amended" : "Individual"} return (${input.form})`;
      const existing = c.enrollments.find((e) => e.service === "tax" && e.title.startsWith(String(input.taxYear)) && !get().returns.some((r) => r.enrollmentId === e.id));
      const enrollmentId = existing?.id ?? clients().enroll(c.id, { service: "tax", title, staffId: input.preparerId, fee: 0 });
      const fees = get().fees;
      const priced = (code: string, qty = 1, fallback?: { label: string; price: number }): PriceLine[] => { const f = fees.find((x) => x.code === code) ?? (fallback ? { code, ...fallback } : undefined); return f ? [{ id: uid("p"), code, description: f.label, qty, unit: f.price }] : []; };
      const lines: PriceLine[] = input.extensionOnly
        ? priced(c.type === "business" ? "EXT-B" : "EXT-I", 1, { label: c.type === "business" ? "Extension (Form 7004)" : "Extension (Form 4868)", price: c.type === "business" ? 75 : 50 })
        : input.amendsReturnId && c.type === "business"
          ? priced("PRIOR", 1, { label: "Prior-year / amended review", price: 125 }).map((l) => ({ ...l, description: `Amended ${input.form} return` }))
          : defaultPricing(input.form).flatMap((p) => priced(p.code, p.code === "STATE" || p.code === "STATE-B" ? Math.max(1, input.states.length) : p.qty));
      const checklist: ChecklistItem[] = baseChecklist(c.type, { hasEin: !!c.business?.einLast4, form: input.form }).map((s) => ({ id: uid("ci"), ...s, required: true, source: "standard" }));
      const at = nowIso();
      const r: TaxReturn = {
        id,
        clientId: c.id,
        enrollmentId,
        taxYear: input.taxYear,
        kind: c.type,
        form: input.form,
        filingStatus: c.type === "individual" ? input.filingStatus : undefined,
        states: input.states,
        status: "Intake",
        preparerId: input.preparerId,
        reviewerId: input.reviewerId,
        dueAt: due,
        extension: input.extension && extended ? { filedAt: at, dueAt: extended } : undefined,
        extensionOnly: input.extensionOnly || undefined,
        amendsReturnId: input.amendsReturnId,
        organizer: { status: "not_sent", answers: {} },
        checklist,
        efile: [],
        pricing: { lines, discount: 0 },
        statusHistory: [{ status: "Intake", at, by: meId() }],
        notes: [],
        activity: [{ id: uid("x"), kind: "intake", text: `Return created — TY ${input.taxYear} ${input.form}${input.amendsReturnId ? ` (amends ${input.amendsReturnId})` : ""}${input.extensionOnly ? " — extension only" : ""}`, at, actor: "staff" }],
        createdAt: at,
      };
      dispatch({ type: "add", r });
      clients().logActivity(c.id, "intake", `Tax return created — TY ${input.taxYear} ${input.form}`);
      if (existing) clients().syncTaxEnrollment(c.id, existing.id, "Intake");
      return id;
    },

    assign(id: string, role: "preparer" | "reviewer", staffId: string) {
      up(id, (r) => log({ ...r, [role === "preparer" ? "preparerId" : "reviewerId"]: staffId }, "status", `${role === "preparer" ? "Preparer" : "Reviewer"}: ${staffById(staffId).name}`));
    },
    updateDetails(id: string, patch: Partial<Pick<TaxReturn, "filingStatus" | "states" | "form">>) {
      up(id, (r) => log({ ...r, ...patch }, "status", "Updated return details"));
    },
    /** Extension filed in the tax software: jurisdictions, estimated tax and payment. Adds the extension fee if missing. */
    fileExtension(id: string, d: Omit<Extension, "filedAt" | "dueAt"> = {}) {
      const r = R(id);
      const { extended } = dueDates(r.form, r.taxYear);
      if (!extended) return;
      const code = r.kind === "business" ? "EXT-B" : "EXT-I";
      const fee = get().fees.find((f) => f.code === code);
      const due = new Date(extended).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const filings = d.filings ?? [{ jurisdiction: "Federal", result: "pending" as const }];
      up(id, (x) => log({
        ...x,
        extension: { filedAt: nowIso(), dueAt: extended, filings, estimatedTax: d.estimatedTax, paymentsMade: d.paymentsMade, payWithExtension: d.payWithExtension, payMethod: d.payMethod },
        pricing: fee && !x.pricing.lines.some((l) => l.code === code) ? { ...x.pricing, lines: [...x.pricing.lines, { id: uid("p"), code, description: fee.label, qty: 1, unit: fee.price }] } : x.pricing,
      }, "status", `Extension filed (${filings.map((f) => f.jurisdiction).join(" + ")}) — new due date ${due}${d.payWithExtension ? ` · $${d.payWithExtension.toLocaleString()} paid with the extension` : ""}`));
      clients().logActivity(r.clientId, "status", `${label(r)}: extension filed — due ${due}`);
    },
    recordExtensionResult(id: string, jurisdiction: string, result: "accepted" | "rejected", reason?: string, submissionId?: string) {
      up(id, (x) => (x.extension ? log({ ...x, extension: { ...x.extension, filings: (x.extension.filings ?? []).map((f) => (f.jurisdiction === jurisdiction ? { ...f, result, reason, submissionId: submissionId || f.submissionId, resultAt: nowIso() } : f)) } }, "status", `Extension ${result} — ${jurisdiction}${reason ? `: ${reason}` : ""}`) : x));
    },
    markExtensionNotified(id: string) {
      up(id, (x) => (x.extension ? { ...x, extension: { ...x.extension, clientNotifiedAt: nowIso() } } : x));
    },
    /** An extension-only return becomes a full return: adds the return's standard fees. */
    startFullReturn(id: string) {
      const r = R(id);
      const fees = get().fees;
      const add: PriceLine[] = defaultPricing(r.form).filter((p) => !r.pricing.lines.some((l) => l.code === p.code)).flatMap((p) => { const f = fees.find((x) => x.code === p.code); return f ? [{ id: uid("p"), code: p.code, description: f.label, qty: p.code === "STATE" || p.code === "STATE-B" ? Math.max(1, r.states.length) : p.qty, unit: f.price }] : []; });
      up(id, (x) => log({ ...x, extensionOnly: undefined, pricing: { ...x.pricing, lines: [...x.pricing.lines, ...add] } }, "status", "Full return started (was extension only)"));
    },
    saveDueDiligence(id: string, dd: DueDiligence) {
      up(id, (x) => log({ ...x, dueDiligence: dd }, "status", dd.completedAt ? (dd.applies ? `Due diligence completed (${dd.credits.join(", ")})` : "Due diligence: not applicable (no EITC, CTC/ODC, AOTC or HOH)") : "Due diligence updated"));
    },
    /** Owner's final approval: unlocks e-filing. */
    finalApprove(id: string, note?: string) {
      const r = R(id);
      up(id, (x) => log({ ...x, ownerApproval: { by: meId(), at: nowIso(), note: note || undefined } }, "status", `Final approval by ${staffById(meId()).name}${note ? ` — ${note}` : ""}`));
      if (r.status === "Awaiting Final Approval") moveTo(id, "Ready to E-file", "final approval given");
      clients().logActivity(r.clientId, "status", `${label(r)}: final approval`);
    },
    clearFinalApproval(id: string) {
      up(id, (x) => log({ ...x, ownerApproval: undefined }, "status", "Final approval withdrawn"));
    },
    /** Manual override (owner / reviewer) — any status, with a reason. */
    setStatus: (id: string, status: ReturnStatus, note?: string) => moveTo(id, status, note),

    /* ---------------- Organizer ---------------- */
    sendOrganizer(id: string) {
      const r = R(id);
      // Documents are requested only once the client submits the interview (its answers decide what's
      // needed, photo ID and prior-year return included) — nothing is asked for before then.
      up(id, (x) => log({ ...x, organizer: { ...x.organizer, status: "sent", sentAt: nowIso() } }, "message", "Organizer sent to client portal"));
      clients().logActivity(r.clientId, "message", `${ORGANIZERS[r.kind].title} sent for ${label(r)}`);
    },
    saveOrganizer(id: string, answers: Record<string, string>, submit: boolean) {
      up(id, (x) =>
        log(
          { ...x, organizer: { ...x.organizer, answers, status: submit ? "submitted" : x.organizer.status === "not_sent" || x.organizer.status === "sent" ? "in_progress" : x.organizer.status, submittedAt: submit ? nowIso() : x.organizer.submittedAt } },
          "intake",
          submit ? "Organizer submitted (entered by staff)" : "Organizer answers saved",
        ),
      );
      if (submit) a.applyOrganizerDocs(id);
    },
    reviewOrganizer(id: string) {
      up(id, (x) => log({ ...x, organizer: { ...x.organizer, status: "reviewed", reviewedAt: nowIso() } }, "intake", "Organizer reviewed"));
      a.applyOrganizerDocs(id);
    },
    /* ---------------- Guided interview ---------------- */
    /** Saves progress as the client (or staff) goes — nothing is lost if they stop partway. */
    saveInterview(id: string, answers: Answers, by: "client" | "staff", step?: number) {
      up(id, (x) => ({
        ...x,
        organizer: {
          ...x.organizer,
          status: x.organizer.status === "not_sent" || x.organizer.status === "sent" ? "in_progress" : x.organizer.status,
          interview: { ...x.organizer.interview, answers, updatedAt: nowIso(), enteredBy: by, step: step ?? x.organizer.interview?.step },
        },
      }));
    },
    /** Submits the interview: documents it calls for join the checklist, and the filing status is set. */
    /** Engagement letter accepted in the office or signed on paper (outside the interview). */
    recordEngagement(id: string, e: EngagementAcceptance) {
      up(id, (x) => log({ ...x, organizer: { ...x.organizer, engagement: e } }, "intake", `Engagement letter accepted by ${e.acceptedName} (${e.method === "paper" ? "signed on paper" : e.method === "in_office" ? "in the office" : "online"})`));
    },
    submitInterview(id: string, answers: Answers, by: "client" | "staff", consentName: string, opts: { brought?: string[]; request?: boolean; engagement?: EngagementAcceptance } = {}) {
      const r = R(id);
      const docs = docsFor(sectionsFor(r.form), { ...answers, __form: r.form, __year: String(r.taxYear) });
      const added: ChecklistItem[] = docs.filter((d) => !r.checklist.some((i) => i.name === d.name)).map((d) => ({ id: uid("ci"), ...d, required: true, source: "organizer" as const }));
      // In the office: papers the client brought are recorded as received; the rest can be requested right away.
      const brought = new Set(opts.brought ?? []);
      const requested: string[] = [];
      const settle = (i: ChecklistItem): ChecklistItem => {
        if (i.docId || i.waivedReason || i.archived) return i;
        if (brought.has(i.name)) return { ...i, docId: clients().uploadDocument(r.clientId, { name: i.name, service: "tax", category: i.category, sensitive: i.sensitive, sizeKb: 0, taxYear: r.taxYear, by: "staff" }) };
        if (opts.request && i.required) { requested.push(i.name); return { ...i, docId: clients().requestDocument(r.clientId, { name: docTitle(r, i.name), service: "tax", category: i.category, sensitive: i.sensitive, taxYear: r.taxYear }) }; }
        return i;
      };
      const toAdd = added.map(settle);
      const existing = r.checklist.map(settle);
      const fs = r.kind === "individual" ? (impliedFilingStatus(answers) as FilingStatus | undefined) : undefined;
      up(id, (x) =>
        log(
          {
            ...x,
            filingStatus: fs ?? x.filingStatus,
            checklist: [...x.checklist.map((i) => existing.find((e) => e.id === i.id) ?? i), ...toAdd],
            organizer: { ...x.organizer, status: "submitted", submittedAt: nowIso(), sentAt: x.organizer.sentAt ?? nowIso(), engagement: opts.engagement ?? x.organizer.engagement, interview: { ...x.organizer.interview, answers, updatedAt: nowIso(), enteredBy: by, consentName } },
          },
          "intake",
          `Tax interview submitted${by === "staff" ? " (entered by staff)" : " by client"} — ${toAdd.length} document${toAdd.length === 1 ? "" : "s"} added to the checklist`,
          by === "client" ? "client" : "staff",
        ),
      );
      clients().logActivity(r.clientId, "message", `Tax interview submitted for ${label(r)}`);
      if (brought.size) up(id, (x) => log(x, "upload", `Received in the office: ${[...brought].join(", ")}`));
      if (requested.length) up(id, (x) => log(x, "upload", `Requested ${requested.length} document${requested.length > 1 ? "s" : ""} from the client`));
      if (r.status === "Intake") moveTo(id, "Awaiting Documents", "interview submitted");
      return { added: toAdd.length, requested };
    },
    /** Preparer questions are collected as drafts, then sent to the client together in one request. */
    addFollowUp(id: string, question: string, ref?: string, qKey?: string) {
      up(id, (x) => ({ ...x, organizer: { ...x.organizer, followUps: [...(x.organizer.followUps ?? []), { id: uid("fu"), question, ref, qKey, status: "draft" }] } }));
    },
    /** Staff closes a follow-up (the reply was used, or no change is needed). */
    resolveFollowUp(id: string, fuId: string) {
      up(id, (x) => log({ ...x, organizer: { ...x.organizer, followUps: (x.organizer.followUps ?? []).map((f) => (f.id === fuId ? { ...f, resolvedAt: nowIso() } : f)) } }, "intake", "Follow-up reviewed and closed"));
    },
    /**
     * Staff updates one intake answer (e.g. from a follow-up reply). `key` is
     * "section.question" or "section.row.question" for repeating sections.
     */
    updateAnswer(id: string, key: string, value: string, label: string, fuId?: string) {
      up(id, (x) => {
        const answers = { ...(x.organizer.interview?.answers ?? {}) } as Answers;
        const parts = key.split(".");
        if (parts.length === 3) {
          const [sid, i, qid] = parts;
          const rows = [...((answers[sid] as Record<string, string>[] | undefined) ?? [])];
          rows[Number(i)] = { ...(rows[Number(i)] ?? {}), [qid]: value };
          answers[sid] = rows;
        } else answers[parts[parts.length - 1]] = value;
        const followUps = (x.organizer.followUps ?? []).map((f) => (f.id === fuId ? { ...f, resolvedAt: nowIso() } : f));
        return log({ ...x, organizer: { ...x.organizer, followUps, interview: { ...x.organizer.interview, answers, updatedAt: nowIso(), enteredBy: "staff" } } }, "intake", `Intake updated by staff — ${label}${fuId ? " (from the client's follow-up reply)" : ""}`);
      });
    },
    removeFollowUp(id: string, fuId: string) {
      up(id, (x) => ({ ...x, organizer: { ...x.organizer, followUps: (x.organizer.followUps ?? []).filter((f) => f.id !== fuId) } }));
    },
    sendFollowUps(id: string): number {
      const r = R(id);
      const drafts = (r.organizer.followUps ?? []).filter((f) => f.status === "draft");
      if (!drafts.length) return 0;
      const at = nowIso();
      up(id, (x) => log({ ...x, organizer: { ...x.organizer, followUps: (x.organizer.followUps ?? []).map((f) => (f.status === "draft" ? { ...f, status: "sent", askedAt: at } : f)) } }, "message", `Sent ${drafts.length} follow-up question${drafts.length > 1 ? "s" : ""} to the client in one request`));
      clients().logActivity(r.clientId, "message", `${drafts.length} follow-up question${drafts.length > 1 ? "s" : ""} sent for ${label(r)}`);
      return drafts.length;
    },
    answerFollowUps(id: string, replies: Record<string, string>, by: "client" | "staff") {
      const at = nowIso();
      const n = Object.values(replies).filter((v) => v.trim()).length;
      up(id, (x) => log({ ...x, organizer: { ...x.organizer, followUps: (x.organizer.followUps ?? []).map((f) => (f.status === "sent" && replies[f.id]?.trim() ? { ...f, status: "answered", answer: replies[f.id].trim(), answeredAt: at } : f)) } }, "message", `${n} follow-up answer${n === 1 ? "" : "s"} received`, by === "client" ? "client" : "staff"));
    },
    /** Adds price lines for schedules the interview indicates (skips codes already priced). */
    applyNeeds(id: string, needs: { label: string; code?: string; qty?: number }[]): number {
      const r = R(id);
      const fees = get().fees;
      const add = needs.filter((n) => n.code && !r.pricing.lines.some((l) => l.code === n.code) && fees.some((f) => f.code === n.code));
      add.forEach((n) => { const f = fees.find((x) => x.code === n.code)!; a.addLine(id, { code: f.code, description: f.label, qty: n.qty ?? 1, unit: f.price }); });
      return add.length;
    },

    /** Answers like "Rental property: Yes" add the matching documents to the checklist. */
    applyOrganizerDocs(id: string): number {
      const r = R(id);
      const toAdd: ChecklistItem[] = [];
      ORGANIZERS[r.kind].questions.forEach((q) => {
        const ans = r.organizer.answers[q.id];
        if (q.docs && (ans === "Yes" || (q.type === "number" && Number(ans) > 0)))
          q.docs.forEach((d) => {
            if (!r.checklist.some((i) => i.name === d.name) && !toAdd.some((i) => i.name === d.name)) toAdd.push({ id: uid("ci"), ...d, required: true, source: "organizer" });
          });
      });
      if (toAdd.length) up(id, (x) => log({ ...x, checklist: [...x.checklist, ...toAdd] }, "upload", `Organizer added ${toAdd.length} document${toAdd.length > 1 ? "s" : ""} to the checklist`));
      return toAdd.length;
    },

    /* ---------------- Checklist / documents ---------------- */
    addItem(id: string, item: { name: string; category: string; sensitive: boolean; required: boolean }) {
      up(id, (x) => log({ ...x, checklist: [...x.checklist, { id: uid("ci"), ...item, source: "custom" }] }, "upload", `Added "${item.name}" to checklist`));
    },
    requestItem(id: string, itemId: string) {
      const r = R(id);
      const it = r.checklist.find((i) => i.id === itemId)!;
      const docId = clients().requestDocument(r.clientId, { name: docTitle(r, it.name), service: "tax", category: it.category, sensitive: it.sensitive, taxYear: r.taxYear });
      up(id, (x) => ({ ...x, checklist: x.checklist.map((i) => (i.id === itemId ? { ...i, docId } : i)) }));
    },
    requestAllMissing(id: string): number {
      const r = R(id);
      const c = C(r.clientId);
      const needed = r.checklist.filter((i) => itemStatus(i, c) === "needed");
      needed.forEach((i) => a.requestItem(id, i.id));
      if (needed.length) up(id, (x) => log(x, "upload", `Requested ${needed.length} document${needed.length > 1 ? "s" : ""} from client`));
      return needed.length;
    },
    remindItem(id: string, itemId: string) {
      const r = R(id);
      const it = r.checklist.find((i) => i.id === itemId)!;
      if (it.docId) clients().remindDocument(r.clientId, it.docId);
      up(id, (x) => log(x, "message", `Reminder sent: ${it.name}`, "system"));
    },
    remindAll(id: string): number {
      const r = R(id);
      const c = C(r.clientId);
      const items = r.checklist.filter((i) => ["requested", "rejected"].includes(itemStatus(i, c)));
      items.forEach((i) => i.docId && clients().remindDocument(r.clientId, i.docId));
      if (items.length) up(id, (x) => log(x, "message", `Reminder sent for ${items.length} outstanding document${items.length > 1 ? "s" : ""}`, "system"));
      return items.length;
    },
    /** Staff records a document as received (uploaded or dropped off). */
    receiveItem(id: string, itemId: string, sizeKb = 240) {
      const r = R(id);
      const it = r.checklist.find((i) => i.id === itemId)!;
      const docId = clients().uploadDocument(r.clientId, { name: it.name, service: "tax", category: it.category, sensitive: it.sensitive, sizeKb, replaces: it.docId, taxYear: r.taxYear });
      up(id, (x) => log({ ...x, checklist: x.checklist.map((i) => (i.id === itemId ? { ...i, docId } : i)) }, "upload", `Received: ${it.name}`));
    },
    reviewItem(id: string, itemId: string, ok: boolean) {
      const r = R(id);
      const it = r.checklist.find((i) => i.id === itemId)!;
      if (it.docId) clients().setDocStatus(r.clientId, it.docId, ok ? "reviewed" : "rejected");
      up(id, (x) => log(x, "upload", ok ? `Reviewed: ${it.name}` : `Asked client to re-upload: ${it.name}`));
    },
    waiveItem(id: string, itemId: string, reason: string | undefined) {
      const it = R(id).checklist.find((i) => i.id === itemId)!;
      up(id, (x) => log({ ...x, checklist: x.checklist.map((i) => (i.id === itemId ? { ...i, waivedReason: reason } : i)) }, "upload", reason ? `Marked not needed: ${it.name} (${reason})` : `Restored to checklist: ${it.name}`));
    },
    removeItem(id: string, itemId: string) {
      const it = R(id).checklist.find((i) => i.id === itemId)!;
      up(id, (x) => log({ ...x, checklist: x.checklist.filter((i) => i.id !== itemId) }, "upload", `Removed "${it.name}" from checklist`));
    },

    /* ---------------- Workflow steps ---------------- */
    markReadyForReview: (id: string, note?: string) => moveTo(id, "Ready for Review", note ?? "all required documents received"),
    startPreparation: (id: string) => moveTo(id, "In Preparation"),
    signOff(id: string, by: string, note: string) {
      const r = R(id);
      up(id, (x) => log({ ...x, reviewSignoff: { by, at: nowIso(), note: note || undefined } }, "status", `Reviewer sign-off by ${staffById(by).name}${note ? ` — ${note}` : ""}`));
      clients().logActivity(r.clientId, "status", `${label(r)}: reviewer sign-off`);
    },
    clearSignOff(id: string) {
      up(id, (x) => log({ ...x, reviewSignoff: undefined }, "status", "Reviewer sign-off removed — changes needed"));
    },
    sendForApproval(id: string) {
      const r = R(id);
      const doc = r.kind === "business" ? `Form 8879-${r.form === "1065" ? "PE" : r.form === "1120-S" ? "S" : r.form === "990" ? "TE" : "C"} (e-file authorization) — TY ${r.taxYear}` : `Form 8879 (e-file authorization) — TY ${r.taxYear}`;
      const sigId = clients().requestSignature(r.clientId, { document: doc, service: "tax" });
      up(id, (x) => ({ ...x, approvalSignatureId: sigId }));
      moveTo(id, "Awaiting Client Approval", "return and e-file authorization sent to client");
    },
    recordApproval(id: string) {
      const r = R(id);
      if (r.approvalSignatureId) clients().markSigned(r.clientId, r.approvalSignatureId);
      up(id, (x) => ({ ...x, clientApprovedAt: nowIso() }));
      moveTo(id, RULES.requireOwnerApproval && !r.ownerApproval ? "Awaiting Final Approval" : "Ready to E-file", "client approved and signed");
    },
    submitEfile(id: string, jurisdictions: string[], ids: Record<string, string> = {}) {
      const at = nowIso();
      const attempts = jurisdictions.map((j) => ({ id: uid("ef"), jurisdiction: j, submittedAt: at, submissionId: ids[j]?.trim() || (BACKEND ? "Not recorded" : `SAMPLE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`), result: "pending" as const }));
      up(id, (x) => log({ ...x, efile: [...attempts, ...x.efile] }, "status", `E-filed: ${jurisdictions.join(" + ")} (${attempts.map((t) => t.submissionId).join(", ")})`));
      moveTo(id, "Submitted", `transmitted ${jurisdictions.join(" + ")}`);
    },
    recordAck(id: string, attemptId: string, result: "accepted" | "rejected", code?: string, reason?: string) {
      const r = R(id);
      const att = r.efile.find((e) => e.id === attemptId)!;
      up(id, (x) =>
        log(
          { ...x, efile: x.efile.map((e) => (e.id === attemptId ? { ...e, result, resultAt: nowIso(), code, reason } : e)) },
          "status",
          `${att.jurisdiction} ${result}${code ? ` — ${code}: ${reason}` : ""}`,
          "system",
        ),
      );
      // Apply the new result locally (store state updates after this action returns).
      const latest = r.efile.map((e) => (e.id === attemptId ? { ...e, result, resultAt: nowIso(), code, reason } : e));
      // Latest attempt per jurisdiction decides the overall result.
      const byJur = new Map<string, (typeof latest)[number]>();
      [...latest].sort((p, q) => p.submittedAt.localeCompare(q.submittedAt)).forEach((e) => byJur.set(e.jurisdiction, e));
      const finals = [...byJur.values()];
      if (finals.some((e) => e.result === "rejected")) moveTo(id, "Rejected", `${att.jurisdiction}: ${code ?? "rejected"}`, "system");
      else if (finals.every((e) => e.result === "accepted")) moveTo(id, "Accepted", "all jurisdictions accepted", "system");
    },
    /** After a rejection: fix and either resubmit or send back to preparation. */
    resolveRejection(id: string, next: "Ready to E-file" | "In Preparation", note: string) {
      moveTo(id, next, note ? `correction: ${note}` : "correction made");
    },
    completeReturn(id: string) {
      const r = R(id);
      moveTo(id, "Completed", "filed, paid and delivered");
      clients().logActivity(r.clientId, "upload", `${label(r)}: final return copy delivered to client portal`);
    },

    /* ---------------- Pricing & billing ---------------- */
    addLine(id: string, line: Omit<PriceLine, "id">) {
      up(id, (x) => log({ ...x, pricing: { ...x.pricing, lines: [...x.pricing.lines, { ...line, id: uid("p") }] } }, "invoice", `Added price line: ${line.description}`));
    },
    updateLine(id: string, lineId: string, patch: Partial<PriceLine>) {
      up(id, (x) => ({ ...x, pricing: { ...x.pricing, lines: x.pricing.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) } }));
    },
    removeLine(id: string, lineId: string) {
      up(id, (x) => log({ ...x, pricing: { ...x.pricing, lines: x.pricing.lines.filter((l) => l.id !== lineId) } }, "invoice", "Removed a price line"));
    },
    setDiscount(id: string, discount: number) {
      up(id, (x) => ({ ...x, pricing: { ...x.pricing, discount } }));
    },
    invoice(id: string, amount: number, description: string, dueAt: string, paymentMode: "upfront" | "bank_product" = "upfront", lines?: { label: string; amount: number; kind: "service" | "discount" }[]): string {
      const r = R(id);
      const number = clients().createInvoice(r.clientId, { service: "tax", description, amount, dueAt, draft: false, taxReturnId: r.id, paymentMode, lines });
      up(id, (x) => log(x, "invoice", `Invoice ${BACKEND ? "created" : number} — $${amount.toFixed(2)} preparation fees${paymentMode === "bank_product" ? " (paid from refund)" : ""}`));
      return number;
    },

    addNote(id: string, body: string) {
      up(id, (x) => log({ ...x, notes: [{ id: uid("n"), authorId: meId(), body, at: nowIso() }, ...x.notes] }, "note", "Added a note"));
    },

    /* ---------------- Fee schedule ---------------- */
    setFee(code: string, price: number) {
      dispatch({ type: "fees", fees: get().fees.map((f) => (f.code === code ? { ...f, price } : f)) });
    },
    addFee(item: FeeItem) {
      dispatch({ type: "fees", fees: [...get().fees, item] });
    },
    removeFee(code: string) {
      dispatch({ type: "fees", fees: get().fees.filter((f) => f.code !== code) });
    },
  };
  return a;
}

export type TaxStore = ReturnType<typeof makeActions> & State & { access: TaxAccess; ready: boolean };
const Ctx = createContext<TaxStore | null>(null);

export function TaxProvider({ children }: { children: React.ReactNode }) {
  const clients = useClients();
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const ref = useRef(state);
  ref.current = state;
  const cref = useRef(clients);
  cref.current = clients;
  const actions = useMemo(() => makeActions(dispatch, () => ref.current, () => cref.current), []);
  const sync = useTaxSync(state, dispatch);
  const value = useMemo(() => ({ ...actions, ...state, access: sync.access ?? ACCESS_PRESETS[state.preset].access, ready: sync.ready }), [actions, state, sync.access, sync.ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTax() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTax must be used inside <TaxProvider>");
  return v;
}

export { RETURN_STATUSES };
export type { ClientDocument };

/* ------------------------------------------------------------------ */
/* Backend sync (only when NEXT_PUBLIC_BACKEND=1)                      */
/* ------------------------------------------------------------------ */

type RevReturn = TaxReturn & { rev?: number };
/**
 * Loads returns the person may open, then saves each change with the revision it
 * started from (the server checks edit / assign / approve per change). What the
 * screens allow follows the signed-in person's real permissions.
 */
function useTaxSync(state: State, dispatch: React.Dispatch<Action>) {
  const [ready, setReady] = useState(!BACKEND);
  const [access, setAccess] = useState<TaxAccess | null>(null);
  const synced = useRef(new Map<string, TaxReturn>());
  const revs = useRef(new Map<string, number>());
  const inflight = useRef(new Set<string>());
  const feesSynced = useRef<FeeItem[] | null>(null);
  const later = useRef(debouncer(500)).current;
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(async () => {
    try {
      const r = await call<{ returns: RevReturn[]; fees: FeeItem[] }>("GET", "/api/tax");
      r.returns.forEach((x) => { revs.current.set(x.id, x.rev ?? 1); synced.current.set(x.id, x); });
      dispatch({ type: "hydrate", returns: r.returns, fees: r.fees });
      feesSynced.current = r.fees.length ? r.fees : stateRef.current.fees;
    } catch (e) {
      if (!(e instanceof RemoteError && (e.status === 401 || e.status === 403))) notify("Couldn't load tax returns.");
    }
  }, []);
  useEffect(() => {
    if (!BACKEND) return;
    (async () => {
      try {
        const me = await call<{ perms?: Record<string, string[]>; sensitive?: string[] }>("GET", "/api/auth/session");
        const t = me.perms?.tax ?? [];
        setAccess({ edit: t.includes("edit"), review: t.includes("approve"), efile: t.includes("approve"), billing: t.includes("edit"), sensitiveDocs: !!me.sensitive?.includes("tax.taxDocs"), revealIds: !!me.sensitive?.includes("tax.revealSsn") });
        if (t.includes("view")) await reload();
        RULES = (await call<{ rules: typeof RULES }>("GET", "/api/settings/tax-rules").catch(() => ({ rules: { requireOwnerApproval: true, requireEngagement: true } }))).rules;
      } catch { /* signed out */ }
      setReady(true);
    })();
  }, []);

  const save = useCallback(async (id: string) => {
    if (inflight.current.has(id)) return later(id, () => save(id));
    const r = stateRef.current.returns.find((x) => x.id === id);
    if (!r || synced.current.get(id) === r) return;
    inflight.current.add(id);
    try {
      if (!revs.current.has(id)) {
        await pendingClientCreates.get(r.clientId); // a brand-new client must exist first
        const res = await call<{ return: RevReturn }>("POST", "/api/tax", { return: r });
        revs.current.set(id, res.return.rev ?? 1);
      } else {
        const res = await call<{ return: RevReturn }>("PUT", `/api/tax/returns/${id}`, { return: { ...r, rev: revs.current.get(id) } });
        revs.current.set(id, res.return.rev ?? 1);
      }
      synced.current.set(id, r);
    } catch (e) {
      if (e instanceof RemoteError && e.status === 401) return;
      notify(e instanceof RemoteError ? e.message : "Couldn't save the return — check your connection.");
      // A refused create is undone here (otherwise it would be retried forever).
      if (!revs.current.has(id) && e instanceof RemoteError && e.status < 500) dispatch({ type: "remove", id });
      await reload();
    } finally {
      inflight.current.delete(id);
    }
    if (stateRef.current.returns.find((x) => x.id === id) !== synced.current.get(id)) later(id, () => save(id));
  }, []);

  useEffect(() => {
    if (!BACKEND || !ready) return;
    state.returns.forEach((r) => { if (synced.current.get(r.id) !== r) later(r.id, () => save(r.id)); });
    if (feesSynced.current && feesSynced.current !== state.fees) {
      const fees = state.fees;
      later("__fees", () => call("PUT", "/api/tax/fees", { fees }).then(() => { feesSynced.current = fees; }).catch((e) => { notify(e instanceof Error ? e.message : "Couldn't save the fee schedule."); reload(); }));
    }
  }, [state.returns, state.fees, ready]);

  // Lets screens wait until a return's latest changes have reached the server.
  useEffect(() => {
    saveWaiter = async (id: string) => {
      for (let i = 0; i < 60; i++) {
        const r = stateRef.current.returns.find((x) => x.id === id);
        if (r && synced.current.get(id) === r && !inflight.current.has(id)) return true;
        await new Promise((res) => setTimeout(res, 250));
      }
      return false;
    };
    return () => { saveWaiter = null; };
  }, []);

  return { ready, access };
}

let saveWaiter: ((id: string) => Promise<boolean>) | null = null;
/** Workflow rules from Settings (live CRM). The design preview skips the Owner approval step. */
let RULES = { requireOwnerApproval: false, requireEngagement: false };
export const taxRules = () => RULES;
/** Resolves once the return's latest changes are saved on the server (true), or after ~15 seconds (false). */
export const waitForReturnSave = (id: string) => (saveWaiter ? saveWaiter(id) : Promise.resolve(true));
