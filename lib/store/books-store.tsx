"use client";

/**
 * Bookkeeping Workspace store: in the live CRM it syncs with the server; in the demo it uses sample data.
 *
 * Single source of truth:
 *  - Statements, receipts and requests are documents on the central client profile
 *    (tagged workspaceId + period).
 *  - Client-visible messages and invoices live on the client profile too.
 *  - The client's bookkeeping engagement mirrors the current month's stage.
 * This store only tracks MKB's review / reconciliation / close process.
 * QuickBooks remains the system of record; nothing here stores transactions.
 * No access tokens or credentials are ever held in the browser.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BACKEND, RemoteError, call, debouncer, notify, pendingClientCreates } from "@/lib/sync/remote";
import { BOOKS_WORKSPACES } from "@/lib/sample/books";
import { SAMPLE_NOW, staffById, meId } from "@/lib/sample/clients";
import { nowIso, useClients } from "@/lib/store/clients-store";
import {
  MONTH_STAGES,
  STAGE_META,
  TASK_TYPE,
  nextPeriod,
  periodLabel,
  type BooksMonth,
  type BooksWorkspace,
  type ClientTask,
  type ClientTaskType,
  type MonthStage,
  type QboStatus,
  type ReportType,
  type ReviewItem,
  type ReviewKind,
  type WorkspaceBilling,
} from "@/lib/books/config";
import type { ActivityItem, ActivityKind, Client, Enrollment, Invoice } from "@/lib/types";
import { QBO_INVITE_EMAIL } from "@/lib/books/intake";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
type ClientsApi = ReturnType<typeof useClients>;

type State = { workspaces: BooksWorkspace[] };
type Action = { type: "reset" } | { type: "add"; w: BooksWorkspace } | { type: "update"; id: string; fn: (w: BooksWorkspace) => BooksWorkspace } | { type: "hydrate"; workspaces: BooksWorkspace[] } | { type: "remove"; id: string };
// With the backend on, workspaces load from the server after sign-in.
const init = (): State => ({ workspaces: BACKEND ? [] : structuredClone(BOOKS_WORKSPACES) });
function reducer(s: State, a: Action): State {
  if (a.type === "reset") return init();
  if (a.type === "hydrate") return { workspaces: a.workspaces };
  if (a.type === "remove") return { workspaces: s.workspaces.filter((w) => w.id !== a.id) };
  if (a.type === "add") return { workspaces: [...s.workspaces, a.w] };
  return { workspaces: s.workspaces.map((w) => (w.id === a.id ? a.fn(w) : w)) };
}

const log = (w: BooksWorkspace, kind: ActivityKind, text: string, actor: ActivityItem["actor"] = "staff"): BooksWorkspace => ({
  ...w,
  activity: [{ id: uid("x"), kind, text, at: nowIso(), actor }, ...w.activity],
});
const mapMonth = (w: BooksWorkspace, monthId: string, fn: (m: BooksMonth) => BooksMonth): BooksWorkspace => ({ ...w, months: w.months.map((m) => (m.id === monthId ? fn(m) : m)) });

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

/** The month MKB is working on: earliest month not yet closed. */
export const currentMonth = (w: BooksWorkspace) => [...w.months].sort((a, b) => a.period.localeCompare(b.period)).find((m) => m.stage !== "Month Closed") ?? w.months[w.months.length - 1];
export const openTasks = (w: BooksWorkspace, period?: string) => w.tasks.filter((t) => t.status === "open" && (!period || t.period === period));
export const unresolved = (m: BooksMonth) => m.reviewItems.filter((i) => i.status !== "resolved");
export const workspaceInvoices = (w: BooksWorkspace, c?: Client): Invoice[] => (c?.invoices ?? []).filter((i) => i.workspaceId === w.id);
export const workspaceDocs = (w: BooksWorkspace, c?: Client) => (c?.documents ?? []).filter((d) => d.workspaceId === w.id);
export const workspaceMessages = (w: BooksWorkspace, c?: Client) => (c?.messages ?? []).filter((m) => m.workspaceId === w.id);
export const balanceDue = (w: BooksWorkspace, c?: Client) => workspaceInvoices(w, c).filter((i) => i.status !== "draft").reduce((s, i) => s + i.amount - i.paid, 0);

/** Next action + who owns it, for the work queue. */
export function nextAction(w: BooksWorkspace, m: BooksMonth): { text: string; owner: "Client" | "MKB" | "Done" } {
  const tasks = openTasks(w, m.period);
  switch (m.stage) {
    case "Waiting on Client Items":
      return { text: tasks.length ? `Client items: ${tasks.length} task${tasks.length > 1 ? "s" : ""} open (feeds, receipts, notes)` : "Client confirms the month is ready", owner: "Client" };
    case "Ready for MKB Review":
      return { text: `Start review (${staffById(m.assignedTo).name})`, owner: "MKB" };
    case "MKB Reviewing": {
      const open = m.reviewItems.filter((i) => i.status === "open").length;
      return { text: open ? `Resolve or send ${open} review item${open > 1 ? "s" : ""} to client` : "Finish review and start reconciliations", owner: "MKB" };
    }
    case "Reconciliation in Progress": {
      const left = m.recons.filter((r) => r.status !== "reconciled").length;
      return { text: left ? `Reconcile ${left} account${left > 1 ? "s" : ""}` : "Move to final review", owner: "MKB" };
    }
    case "Client Follow-up Needed": {
      const q = tasks.filter((t) => t.reviewItemId || t.requestDocId).length;
      return q ? { text: `Answer ${q} MKB request${q > 1 ? "s" : ""}`, owner: "Client" } : { text: "Client responded — resume work", owner: "MKB" };
    }
    case "MKB Final Review":
      return { text: m.reports.every((r) => r.review === "approved") ? "Record final approval" : "Prepare and approve reports, then approve the month", owner: "MKB" };
    case "Reports Ready":
      return { text: "Deliver reports and close the month", owner: "MKB" };
    case "Month Closed":
      return { text: `Closed ${m.closedAt ? new Date(m.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}`, owner: "Done" };
  }
}

function standardTasks(period: string): ClientTask[] {
  const label = periodLabel(period);
  const at = nowIso();
  return [
    // What the client owes MKB each month — MKB does the categorizing and bookkeeping itself.
    { id: uid("t"), period, type: "entry", title: `Keep your ${label} bank and card feeds connected in QuickBooks`, detail: "Make sure every account in your plan is connected so transactions download. Tell us if a bank stops syncing.", status: "open", createdAt: at, docIds: [], standard: true },
    { id: uid("t"), period, type: "receipts", title: `Upload your ${label} receipts`, detail: "Receipts and bills for the month's business purchases.", status: "open", createdAt: at, docIds: [], standard: true },
    { id: uid("t"), period, type: "confirm", title: `Tell us about anything that didn't go through the bank in ${label}`, detail: "Cash sales or expenses, new loans, owner money in or out, large or unusual purchases — or say there was nothing.", status: "open", createdAt: at, docIds: [], standard: true },
    { id: uid("t"), period, type: "submit", title: `Let MKB know ${label} is ready`, detail: "Confirm your feeds, receipts and notes are in so we can start your review.", status: "open", createdAt: at, docIds: [], standard: true },
  ];
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function makeActions(dispatch: React.Dispatch<Action>, get: () => State, clients: () => ClientsApi) {
  const W = (id: string) => get().workspaces.find((w) => w.id === id)!;
  const M = (wsId: string, monthId: string) => W(wsId).months.find((m) => m.id === monthId)!;
  const up = (id: string, fn: (w: BooksWorkspace) => BooksWorkspace) => dispatch({ type: "update", id, fn });

  /**
   * Live CRM: emails the client about their month (items needed, a reminder, reports ready).
   * Calls made close together are combined into one email per workspace, kind and month.
   */
  const outbox = new Map<string, { items: Set<string>; timer?: ReturnType<typeof setTimeout> }>();
  const emailClient = (wsId: string, kind: "items" | "reminder" | "reports", period: string, items: string[]) => {
    if (!BACKEND || !items.length) return;
    const key = `${wsId}|${kind}|${period}`;
    const cur = outbox.get(key) ?? { items: new Set<string>() };
    items.forEach((i) => cur.items.add(i));
    if (cur.timer) clearTimeout(cur.timer);
    cur.timer = setTimeout(async () => {
      outbox.delete(key);
      try {
        await waitForWorkspaceSave(wsId); // a brand-new workspace must exist on the server first
        const r = await call<{ emailed: boolean; reason?: string }>("POST", `/api/books/workspaces/${wsId}/notify`, { kind, period, items: [...cur.items] });
        if (!r.emailed && r.reason === "no_portal") notify(`${get().workspaces.find((w) => w.id === wsId)?.businessName ?? "Client"}: no email sent — they aren't on the client portal yet. Invite them from their client profile.`);
        if (!r.emailed && r.reason === "no_email") notify("No email sent — the client has no email address on file.");
      } catch (e) {
        notify(e instanceof RemoteError ? e.message : "Couldn't email the client — check your connection.");
      }
    }, 1500);
    outbox.set(key, cur);
  };

  /** Mirror the current month on the client's bookkeeping engagement. */
  const syncEnrollment = (w: BooksWorkspace) => {
    if (!w.enrollmentId) return;
    const m = currentMonth(w);
    const owner = STAGE_META[m.stage].owner;
    const status: Enrollment["status"] = m.stage === "Month Closed" ? "active" : owner === "Client" ? "waiting_on_client" : m.stage === "MKB Final Review" ? "in_review" : "active";
    clients().syncEnrollmentStage(w.clientId, w.enrollmentId, m.stage, status, Math.round((MONTH_STAGES.indexOf(m.stage) / (MONTH_STAGES.length - 1)) * 100));
  };

  const moveTo = (wsId: string, monthId: string, stage: MonthStage, note?: string, by = meId(), extra: Partial<BooksMonth> = {}) => {
    const w = W(wsId);
    const m = M(wsId, monthId);
    if (m.stage === stage) return;
    const label = periodLabel(m.period);
    const np = nextPeriod(m.period);
    const opening = stage === "Month Closed" && !w.months.some((x) => x.period === np);
    const newMonth: BooksMonth | null = opening
      ? { id: `${wsId}-${np}`, period: np, stage: "Waiting on Client Items", assignedTo: w.bookkeeperId, reopenCount: 0, recons: w.accounts.map((a) => ({ accountId: a.id, status: "not_started" as const })), reviewItems: [], reports: w.service.reports.map((t) => ({ id: uid("rp"), type: t, period: np, review: "not_started" as const, delivery: "not_delivered" as const })), reviewNotes: [], history: [{ stage: "Waiting on Client Items", at: nowIso(), by: "system" }] }
      : null;
    const newTasks = opening ? standardTasks(np) : [];
    const entryId = uid("x");
    const at = nowIso();
    // Applied to the latest state so updates dispatched earlier in the same action are kept.
    const apply = (cur: BooksWorkspace): BooksWorkspace => {
      let next = mapMonth(cur, monthId, (x) => ({ ...x, ...extra, stage, history: [...x.history, { stage, at, by, note }] }));
      next = { ...next, activity: [{ id: entryId, kind: by === "client" ? "intake" : "status", text: `${label} → ${stage}${note ? ` — ${note}` : ""}`, at, actor: by === "client" ? "client" : by === "system" ? "system" : "staff" }, ...next.activity] };
      // Closing a month opens the next one if it doesn't exist yet.
      if (newMonth && !next.months.some((x) => x.period === np)) next = { ...next, months: [...next.months, newMonth], tasks: [...next.tasks, ...newTasks] };
      return next;
    };
    dispatch({ type: "update", id: wsId, fn: apply });
    clients().logActivity(w.clientId, "status", `${w.businessName}: ${label} → ${stage}`, by === "client" ? "client" : "staff");
    if (newMonth && newTasks.length) emailClient(wsId, "items", np, newTasks.map((t) => t.title));
    syncEnrollment(apply(w));
  };

  const a = {
    reset: () => dispatch({ type: "reset" }),
    /** Starts a bookkeeping workspace for a client business; its first month opens for client entry. */
    createWorkspace(input: { clientId: string; enrollmentId?: string; businessName: string; entityType: string; plan: string; monthlyFee: number; reports: ReportType[]; includes: string[]; bookkeeperId: string; reviewerId: string; accounts: { name: string; kind: "bank" | "credit_card"; mask: string; institution: string }[]; firstPeriod: string; qboCompany: string }): string {
      const id = uid("bw");
      const at = nowIso();
      const accounts = input.accounts.map((x) => ({ ...x, id: uid("acct"), mask: x.mask.replace(/\D/g, "").slice(-4) }));
      const p = input.firstPeriod;
      const month: BooksMonth = { id: `${id}-${p}`, period: p, stage: "Waiting on Client Items", assignedTo: input.bookkeeperId, reopenCount: 0, recons: accounts.map((x) => ({ accountId: x.id, status: "not_started" as const })), reviewItems: [], reports: input.reports.map((t) => ({ id: uid("rp"), type: t, period: p, review: "not_started" as const, delivery: "not_delivered" as const })), reviewNotes: [], history: [{ stage: "Waiting on Client Items", at, by: "system" }] };
      const w: BooksWorkspace = {
        id, clientId: input.clientId, enrollmentId: input.enrollmentId, businessName: input.businessName.trim(), entityType: input.entityType, bookkeeperId: input.bookkeeperId, reviewerId: input.reviewerId,
        service: { plan: input.plan, monthlyFee: input.monthlyFee, reports: input.reports, includes: input.includes }, extras: [],
        qbo: { status: "not_connected", companyName: input.qboCompany.trim() || input.businessName.trim(), access: "qboa" },
        accounts, months: [month], tasks: standardTasks(p), notes: [],
        activity: [{ id: uid("x"), kind: "status", text: `Bookkeeping started — ${input.plan} plan, first month ${periodLabel(p)}`, at, actor: "staff" }],
        startedAt: at,
      };
      dispatch({ type: "add", w });
      return id;
    },

    /* ---------------- Assignment ---------------- */
    assign(wsId: string, role: "bookkeeper" | "reviewer", staffId: string) {
      up(wsId, (w) => log({ ...w, [role === "bookkeeper" ? "bookkeeperId" : "reviewerId"]: staffId }, "status", `${role === "bookkeeper" ? "Bookkeeper" : "Final reviewer"}: ${staffById(staffId).name}`));
    },
    assignMonth(wsId: string, monthId: string, staffId: string) {
      up(wsId, (w) => log(mapMonth(w, monthId, (m) => ({ ...m, assignedTo: staffId })), "status", `${periodLabel(M(wsId, monthId).period)} assigned to ${staffById(staffId).name}`));
    },

    /* ---------------- Client side ---------------- */
    /** Client (or staff on their behalf) submits the month. */
    submitMonth(wsId: string, monthId: string, by: "client" | "staff") {
      const m = M(wsId, monthId);
      up(wsId, (w) => ({ ...w, tasks: w.tasks.map((t) => (t.period === m.period && (t.standard || ["entry", "categorize", "submit"].includes(t.type)) && t.status === "open" ? { ...t, status: "done", completedAt: nowIso(), completedBy: by } : t)) }));
      moveTo(wsId, monthId, "Ready for MKB Review", by === "staff" ? "submitted by MKB on the client's behalf" : "client confirmed entries are complete", by === "client" ? "client" : meId(), { submittedAt: nowIso() });
    },
    remindClient(wsId: string, monthId: string): number {
      const w = W(wsId);
      const m = M(wsId, monthId);
      const n = openTasks(w, m.period).length;
      clients().sendMessage(w.clientId, `Reminder: ${n} item${n === 1 ? "" : "s"} for ${periodLabel(m.period)} need your attention in the client portal.`, "books", { workspaceId: wsId, author: staffById(w.bookkeeperId).name, quiet: true });
      emailClient(wsId, "reminder", m.period, openTasks(w, m.period).map((t) => t.title));
      up(wsId, (x) => log(x, "message", `Reminder sent for ${periodLabel(m.period)} (${n} open task${n === 1 ? "" : "s"})`, "system"));
      return n;
    },
    /** Complete a client task, optionally with a response and uploaded files. */
    completeTask(wsId: string, taskId: string, opts: { response?: string; files?: { name: string; sizeKb: number }[]; by: "client" | "staff" }) {
      const w = W(wsId);
      const t = w.tasks.find((x) => x.id === taskId)!;
      const docIds: string[] = [];
      (opts.files ?? []).forEach((f, i) => {
        const replaces = i === 0 && t.requestDocId ? t.requestDocId : undefined;
        const category = t.type === "receipts" ? "Receipts" : t.type === "statement" ? "Statement" : "Supporting document";
        docIds.push(clients().uploadDocument(w.clientId, { name: replaces ? clients().clients.find((c) => c.id === w.clientId)?.documents.find((d) => d.id === replaces)?.name ?? f.name : f.name, service: "books", category, sensitive: false, sizeKb: f.sizeKb, file: (f as { file?: File }).file, replaces, workspaceId: wsId, period: t.period, by: opts.by }));
      });
      up(wsId, (x) => {
        let next: BooksWorkspace = { ...x, tasks: x.tasks.map((y) => (y.id === taskId ? { ...y, status: "done", completedAt: nowIso(), completedBy: opts.by, response: opts.response ?? y.response, docIds: [...y.docIds, ...docIds] } : y)) };
        if (t.reviewItemId)
          next = { ...next, months: next.months.map((m) => ({ ...m, reviewItems: m.reviewItems.map((r) => (r.id === t.reviewItemId ? { ...r, status: "client_responded", clientResponse: opts.response ?? (docIds.length ? `Uploaded ${docIds.length} file(s)` : "Marked complete") } : r)) })) };
        return log(next, opts.by === "client" ? "intake" : "status", `${opts.by === "client" ? "Client completed" : "Completed on client's behalf"}: ${t.title}${docIds.length ? ` (+${docIds.length} file${docIds.length > 1 ? "s" : ""})` : ""}`, opts.by === "client" ? "client" : "staff");
      });
      if (opts.response && opts.by === "client") clients().sendMessage(w.clientId, `Re: ${t.title} — ${opts.response}`, "books", { from: "client", workspaceId: wsId });
      if (t.type === "submit") {
        const m = w.months.find((mm) => mm.period === t.period);
        if (m && m.stage === "Waiting on Client Items") a.submitMonth(wsId, m.id, opts.by);
      }
    },
    reopenTask(wsId: string, taskId: string) {
      up(wsId, (w) => log({ ...w, tasks: w.tasks.map((t) => (t.id === taskId ? { ...t, status: "open", completedAt: undefined } : t)) }, "status", `Reopened task: ${w.tasks.find((t) => t.id === taskId)?.title}`));
    },
    addTask(wsId: string, period: string, type: ClientTaskType, title: string, detail?: string) {
      up(wsId, (w) => log({ ...w, tasks: [...w.tasks, { id: uid("t"), period, type, title, detail, status: "open", createdAt: nowIso(), docIds: [] }] }, "message", `Task for client: ${title}`));
      emailClient(wsId, "items", period, [title]);
    },

    /* ---------------- Review ---------------- */
    startReview(wsId: string, monthId: string) {
      moveTo(wsId, monthId, "MKB Reviewing", `review started by ${staffById(M(wsId, monthId).assignedTo).name}`, M(wsId, monthId).assignedTo, { reviewStartedAt: nowIso() });
    },
    addReviewItem(wsId: string, monthId: string, item: { kind: ReviewKind; txnRef: string; amount?: number; description: string; assignedTo: string }) {
      const ri: ReviewItem = { id: uid("ri"), ...item, status: "open", createdAt: nowIso() };
      up(wsId, (w) => log(mapMonth(w, monthId, (m) => ({ ...m, reviewItems: [...m.reviewItems, ri] })), "status", `Review item: ${item.txnRef}`));
    },
    assignItem(wsId: string, monthId: string, itemId: string, staffId: string) {
      up(wsId, (w) => mapMonth(w, monthId, (m) => ({ ...m, reviewItems: m.reviewItems.map((r) => (r.id === itemId ? { ...r, assignedTo: staffId } : r)) })));
    },
    resolveItem(wsId: string, monthId: string, itemId: string, resolution: string) {
      up(wsId, (w) => log(mapMonth(w, monthId, (m) => ({ ...m, reviewItems: m.reviewItems.map((r) => (r.id === itemId ? { ...r, status: "resolved", resolution, resolvedAt: nowIso() } : r)) })), "status", `Resolved: ${resolution}`));
    },
    reopenItem(wsId: string, monthId: string, itemId: string) {
      up(wsId, (w) => mapMonth(w, monthId, (m) => ({ ...m, reviewItems: m.reviewItems.map((r) => (r.id === itemId ? { ...r, status: "open", resolvedAt: undefined } : r)) })));
    },
    addReviewNote(wsId: string, monthId: string, body: string) {
      up(wsId, (w) => log(mapMonth(w, monthId, (m) => ({ ...m, reviewNotes: [{ id: uid("rn"), authorId: meId(), body, at: nowIso() }, ...m.reviewNotes] })), "note", "Added a review note"));
    },
    /** Turn open review items into client tasks and move the month to follow-up. */
    /** `pending` = items dispatched in the same action that are not in the state snapshot yet. */
    sendToClient(wsId: string, monthId: string, itemIds: string[], pending: ReviewItem[] = []): number {
      const w = W(wsId);
      const m = M(wsId, monthId);
      const items = [...m.reviewItems, ...pending].filter((r) => itemIds.includes(r.id) && r.status === "open");
      if (!items.length) return 0;
      const tasks: ClientTask[] = items.map((r) => {
        const type: ClientTaskType = r.kind === "missing_receipt" ? "receipts" : r.kind === "miscategorized" ? "confirm" : "question";
        return { id: uid("t"), period: m.period, type, title: `${TASK_TYPE[type]}: ${r.txnRef}`, detail: r.description, status: "open", createdAt: nowIso(), docIds: [], reviewItemId: r.id };
      });
      up(wsId, (x) => {
        const next = mapMonth(x, monthId, (mm) => ({ ...mm, reviewItems: mm.reviewItems.map((r) => { const t = tasks.find((tt) => tt.reviewItemId === r.id); return t ? { ...r, status: "sent_to_client", taskId: t.id } : r; }) }));
        return log({ ...next, tasks: [...next.tasks, ...tasks] }, "message", `Sent ${tasks.length} follow-up request${tasks.length > 1 ? "s" : ""} to client`);
      });
      clients().sendMessage(w.clientId, `We have ${tasks.length} question${tasks.length > 1 ? "s" : ""} about ${periodLabel(m.period)}. Please check your task list in the portal.`, "books", { workspaceId: wsId, author: staffById(m.assignedTo).name, quiet: true });
      emailClient(wsId, "items", m.period, tasks.map((t) => t.title));
      if (m.stage !== "Client Follow-up Needed") moveTo(wsId, monthId, "Client Follow-up Needed", `${tasks.length} request(s) sent`, m.assignedTo, { followupFrom: m.stage });
      return tasks.length;
    },
    resumeAfterFollowup(wsId: string, monthId: string) {
      const m = M(wsId, monthId);
      moveTo(wsId, monthId, m.followupFrom ?? "MKB Reviewing", "client follow-up received", m.assignedTo);
    },
    finishReview: (wsId: string, monthId: string) => moveTo(wsId, monthId, "Reconciliation in Progress", "categorization review complete", M(wsId, monthId).assignedTo),

    /* ---------------- Reconciliations ---------------- */
    recordStatement(wsId: string, monthId: string, accountId: string, statementDate: string, endingBalance: number) {
      const acct = W(wsId).accounts.find((x) => x.id === accountId)!;
      up(wsId, (w) =>
        log(
          mapMonth(w, monthId, (m) => ({ ...m, recons: m.recons.map((r) => (r.accountId === accountId ? { ...r, statementDate, endingBalance, sample: false, status: r.status === "not_started" ? "in_progress" : r.status } : r)) })),
          "status",
          `${acct.name} ••${acct.mask}: statement ending balance recorded`,
        ),
      );
    },
    markReconciled(wsId: string, monthId: string, accountId: string) {
      const acct = W(wsId).accounts.find((x) => x.id === accountId)!;
      up(wsId, (w) =>
        log(
          mapMonth(w, monthId, (m) => ({ ...m, recons: m.recons.map((r) => (r.accountId === accountId ? { ...r, status: "reconciled", discrepancy: undefined, completedAt: nowIso(), by: m.assignedTo } : r)) })),
          "status",
          `${acct.name} ••${acct.mask} reconciled`,
        ),
      );
    },
    recordDiscrepancy(wsId: string, monthId: string, accountId: string, amount: number, note: string, send: boolean) {
      const acct = W(wsId).accounts.find((x) => x.id === accountId)!;
      const m = M(wsId, monthId);
      const ri: ReviewItem = { id: uid("ri"), kind: "discrepancy", txnRef: `${acct.name} ••${acct.mask} · ${periodLabel(m.period, true)} statement`, amount, description: note, status: "open", assignedTo: m.assignedTo, createdAt: nowIso() };
      up(wsId, (w) => log(mapMonth(w, monthId, (mm) => ({ ...mm, recons: mm.recons.map((r) => (r.accountId === accountId ? { ...r, status: "discrepancy", discrepancy: { amount, note } } : r)), reviewItems: [...mm.reviewItems, ri] })), "status", `Discrepancy on ${acct.name} ••${acct.mask}: ${note}`));
      if (send) a.sendToClient(wsId, monthId, [ri.id], [ri]);
    },
    toFinalReview: (wsId: string, monthId: string) => moveTo(wsId, monthId, "MKB Final Review", "all accounts reconciled", M(wsId, monthId).assignedTo),

    /* ---------------- Reports + close ---------------- */
    /** Attach the report file (from QuickBooks). It stays hidden from the client until it's made available or delivered. */
    prepareReport(wsId: string, monthId: string, reportId: string, file?: File) {
      const w = W(wsId);
      const r = M(wsId, monthId).reports.find((x) => x.id === reportId)!;
      const docId = clients().uploadDocument(w.clientId, { name: `${r.type} — ${periodLabel(r.period)}`, service: "books", category: "Financial report", sensitive: false, sizeKb: file ? Math.max(1, Math.round(file.size / 1024)) : 96, workspaceId: wsId, period: r.period, replaces: r.docId, file, internal: r.delivery === "not_delivered" });
      up(wsId, (x) => log(mapMonth(x, monthId, (m) => ({ ...m, reports: m.reports.map((y) => (y.id === reportId ? { ...y, review: "in_review", preparedAt: nowIso(), docId } : y)) })), "status", `${r.type} prepared for ${periodLabel(r.period)}`));
    },
    approveReport(wsId: string, monthId: string, reportId: string) {
      const r = M(wsId, monthId).reports.find((x) => x.id === reportId)!;
      up(wsId, (x) => log(mapMonth(x, monthId, (m) => ({ ...m, reports: m.reports.map((y) => (y.id === reportId ? { ...y, review: "approved", approvedBy: x.reviewerId } : y)) })), "status", `${r.type} approved`));
    },
    addReport(wsId: string, monthId: string, type: ReportType) {
      const m = M(wsId, monthId);
      up(wsId, (x) => log(mapMonth(x, monthId, (mm) => ({ ...mm, reports: [...mm.reports, { id: uid("rp"), type, period: m.period, review: "not_started", delivery: "not_delivered" }] })), "status", `Added ${type} for ${periodLabel(m.period)}`));
    },
    finalApprove(wsId: string, monthId: string, by: string, note: string) {
      moveTo(wsId, monthId, "Reports Ready", `final review approved by ${staffById(by).name}`, by, { finalApproval: { by, at: nowIso(), note: note || undefined } });
    },
    publishReport(wsId: string, monthId: string, reportId: string, delivery: "available" | "delivered") {
      const w = W(wsId);
      const r = M(wsId, monthId).reports.find((x) => x.id === reportId)!;
      up(wsId, (x) => log(mapMonth(x, monthId, (m) => ({ ...m, reports: m.reports.map((y) => (y.id === reportId ? { ...y, delivery, deliveredAt: delivery === "delivered" ? nowIso() : y.deliveredAt } : y)) })), "upload", `${r.type} ${delivery === "delivered" ? "delivered to client" : "made available in client portal"}`));
      if (r.docId) clients().setDocInternal(w.clientId, r.docId, false); // the client can see it now
      if (delivery === "delivered") {
        clients().logActivity(w.clientId, "upload", `${w.businessName}: ${r.type} for ${periodLabel(r.period)} delivered`);
        if (r.docId) emailClient(wsId, "reports", r.period, [r.type]); // only reports that have a file
      }
    },
    closeMonth(wsId: string, monthId: string) {
      const m = M(wsId, monthId);
      m.reports.filter((r) => r.delivery !== "delivered").forEach((r) => a.publishReport(wsId, monthId, r.id, "delivered"));
      moveTo(wsId, monthId, "Month Closed", "reports delivered; month closed", m.assignedTo, { closedAt: nowIso() });
    },
    reopenMonth(wsId: string, monthId: string, reason: string, to: MonthStage) {
      const m = M(wsId, monthId);
      moveTo(wsId, monthId, to, `reopened — ${reason}`, meId(), {
        closedAt: undefined,
        finalApproval: undefined,
        reopenCount: m.reopenCount + 1,
        reports: m.reports.map((r) => ({ ...r, review: r.review === "approved" ? "in_review" : r.review })),
      });
    },
    /** Manual override (owner) — any stage, with reason. */
    setStage: (wsId: string, monthId: string, stage: MonthStage, note: string) => moveTo(wsId, monthId, stage, `override — ${note}`),

    /* ---------------- Documents + communication ---------------- */
    requestDocument(wsId: string, period: string, name: string, category: string) {
      const w = W(wsId);
      const docId = clients().requestDocument(w.clientId, { name, service: "books", category, sensitive: false, workspaceId: wsId, period });
      up(wsId, (x) => log({ ...x, tasks: [...x.tasks, { id: uid("t"), period, type: "statement", title: `Provide: ${name}`, status: "open", createdAt: nowIso(), docIds: [], requestDocId: docId }] }, "upload", `Requested "${name}" from client`));
    },
    addNote(wsId: string, body: string) {
      up(wsId, (w) => log({ ...w, notes: [{ id: uid("n"), authorId: meId(), body, at: nowIso() }, ...w.notes] }, "note", "Added an internal note"));
    },
    togglePin(wsId: string, noteId: string) {
      up(wsId, (w) => ({ ...w, notes: w.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)) }));
    },

    /* ---------------- Billing ---------------- */
    addExtra(wsId: string, label: string, amount: number, period: string) {
      up(wsId, (w) => log({ ...w, extras: [...w.extras, { id: uid("x"), label, amount, period, invoiced: false }] }, "invoice", `Additional charge: ${label}`));
    },
    /** Live CRM: the server creates the month's invoice (fee + uninvoiced charges) and emails it. */
    async billMonth(wsId: string, period: string, send = true): Promise<{ number?: string; sent?: boolean }> {
      const w = W(wsId);
      await waitForWorkspaceSave(wsId); // charges added just now must be on the server first
      const r = await call<{ number?: string; sent?: boolean }>("POST", `/api/books/workspaces/${wsId}/bill`, { period, send });
      window.dispatchEvent(new CustomEvent("mkb:client-changed", { detail: w.clientId }));
      window.dispatchEvent(new CustomEvent("mkb:books-reload"));
      return r;
    },
    /** Set the workspace's automatic monthly invoice. */
    setBilling(wsId: string, billing: WorkspaceBilling) {
      up(wsId, (w) => log({ ...w, billing }, "invoice", billing.auto ? `Automatic monthly invoice on: day ${billing.day}, due in ${billing.dueDays} days${billing.email ? ", emailed" : ""}` : "Automatic monthly invoice turned off"));
    },
    /** Invoice a month's fee (plus uninvoiced charges), or — with period null — just the uninvoiced charges. */
    invoiceMonth(wsId: string, period: string | null, includeExtras: boolean): string {
      const w = W(wsId);
      const extras = includeExtras || !period ? w.extras.filter((x) => !x.invoiced) : [];
      const amount = (period ? w.service.monthlyFee : 0) + extras.reduce((s, x) => s + x.amount, 0);
      const [y, mo] = (period ?? SAMPLE_NOW.toISOString().slice(0, 7)).split("-").map(Number);
      const number = clients().createInvoice(w.clientId, {
        service: "books",
        description: period ? `${w.businessName} — bookkeeping, ${periodLabel(period)}${extras.length ? ` + ${extras.map((x) => x.label).join(", ")}` : ""}` : `${w.businessName} — ${extras.map((x) => x.label).join(", ")}`,
        amount,
        dueAt: new Date(Math.max(new Date(y, mo - 1, 15, 17).getTime(), SAMPLE_NOW.getTime() + 14 * 86400000)).toISOString(),
        draft: false,
        workspaceId: wsId,
      });
      up(wsId, (x) => log({ ...x, extras: x.extras.map((e) => (extras.some((ee) => ee.id === e.id) ? { ...e, invoiced: true } : e)) }, "invoice", `Invoice ${number} sent`));
      return number;
    },

    /* ---------------- QuickBooks access (tracked by MKB — no direct connection to Intuit) ---------------- */
    setQboStatus(wsId: string, status: QboStatus, text: string) {
      up(wsId, (w) => log({ ...w, qbo: { ...w.qbo, status, lastSyncAt: status === "connected" ? nowIso() : w.qbo.lastSyncAt, connectedAt: status === "connected" && w.qbo.status !== "connected" ? nowIso() : w.qbo.connectedAt } }, "status", text));
    },
    /** Company name, access method, and who invited MKB. */
    updateQbo(wsId: string, patch: Partial<Pick<BooksWorkspace["qbo"], "companyName" | "access" | "authorizedBy">>) {
      up(wsId, (w) => log({ ...w, qbo: { ...w.qbo, ...patch } }, "status", "QuickBooks details updated"));
    },
    /** Asks the client (task + email) to invite MKB as their accountant in QuickBooks. */
    requestQboInvite(wsId: string, again: boolean) {
      const w = W(wsId);
      const period = currentMonth(w)?.period ?? nowIso().slice(0, 7);
      a.addTask(wsId, period, "confirm", again ? "Invite MKB as your accountant in QuickBooks again" : "Invite MKB as your accountant in QuickBooks", `In QuickBooks Online: gear icon (Settings) → Manage users → Accountants tab → Invite → enter ${QBO_INVITE_EMAIL} → Send. You stay the owner and can remove our access anytime. Reply "done" here when it's sent.`);
      a.setQboStatus(wsId, "invite_pending", again ? "Asked the client to invite MKB again" : "Asked the client to invite MKB as their accountant");
    },
    syncNow(wsId: string) {
      up(wsId, (w) => log({ ...w, qbo: { ...w.qbo, lastSyncAt: nowIso() } }, "status", "Checked: MKB's QuickBooks access works"));
    },
  };
  return a;
}

export type BooksStore = ReturnType<typeof makeActions> & State & { ready: boolean };
const Ctx = createContext<BooksStore | null>(null);

export function BooksProvider({ children }: { children: React.ReactNode }) {
  const clients = useClients();
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const ref = useRef(state);
  ref.current = state;
  const cref = useRef(clients);
  cref.current = clients;
  const actions = useMemo(() => makeActions(dispatch, () => ref.current, () => cref.current), []);
  const sync = useBooksSync(state, dispatch);
  const value = useMemo(() => ({ ...actions, ...state, ready: sync.ready }), [actions, state, sync.ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooks() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooks must be used inside <BooksProvider>");
  return v;
}

/* ------------------------------------------------------------------ */
/* Backend sync (only when NEXT_PUBLIC_BACKEND=1)                      */
/* ------------------------------------------------------------------ */

type RevWorkspace = BooksWorkspace & { rev?: number };
/**
 * Loads the workspaces the person may open, then saves each change with the
 * revision it started from (the server checks edit / assign / approve /
 * settings per change). A refused change reloads the latest version.
 */
function useBooksSync(state: State, dispatch: React.Dispatch<Action>) {
  const [ready, setReady] = useState(!BACKEND);
  const synced = useRef(new Map<string, BooksWorkspace>());
  const revs = useRef(new Map<string, number>());
  const inflight = useRef(new Set<string>());
  const later = useRef(debouncer(500)).current;
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(async () => {
    try {
      const r = await call<{ workspaces: RevWorkspace[] }>("GET", "/api/books");
      r.workspaces.forEach((x) => { revs.current.set(x.id, x.rev ?? 1); synced.current.set(x.id, x); });
      dispatch({ type: "hydrate", workspaces: r.workspaces });
    } catch (e) {
      if (!(e instanceof RemoteError && (e.status === 401 || e.status === 403))) notify("Couldn't load bookkeeping workspaces.");
    }
  }, []);
  // The server changed workspaces (e.g. a monthly invoice marked charges invoiced): reload them.
  useEffect(() => {
    if (!BACKEND) return;
    const on = () => void reload();
    window.addEventListener("mkb:books-reload", on);
    return () => window.removeEventListener("mkb:books-reload", on);
  }, [reload]);
  useEffect(() => {
    if (!BACKEND) return;
    (async () => {
      try {
        const me = await call<{ perms?: Record<string, string[]> }>("GET", "/api/auth/session");
        if ((me.perms?.books ?? []).includes("view")) await reload();
      } catch { /* signed out */ }
      setReady(true);
    })();
  }, []);

  const save = useCallback(async (id: string) => {
    if (inflight.current.has(id)) return later(id, () => save(id));
    const w = stateRef.current.workspaces.find((x) => x.id === id);
    if (!w || synced.current.get(id) === w) return;
    inflight.current.add(id);
    try {
      if (!revs.current.has(id)) {
        await pendingClientCreates.get(w.clientId); // a brand-new client must exist first
        const res = await call<{ workspace: RevWorkspace }>("POST", "/api/books", { workspace: w });
        revs.current.set(id, res.workspace.rev ?? 1);
      } else {
        const res = await call<{ workspace: RevWorkspace }>("PUT", `/api/books/workspaces/${id}`, { workspace: { ...w, rev: revs.current.get(id) } });
        revs.current.set(id, res.workspace.rev ?? 1);
      }
      synced.current.set(id, w);
    } catch (e) {
      if (e instanceof RemoteError && e.status === 401) return;
      notify(e instanceof RemoteError ? e.message : "Couldn't save the workspace — check your connection.");
      if (!revs.current.has(id) && e instanceof RemoteError && e.status < 500) dispatch({ type: "remove", id });
      await reload();
    } finally {
      inflight.current.delete(id);
    }
    if (stateRef.current.workspaces.find((x) => x.id === id) !== synced.current.get(id)) later(id, () => save(id));
  }, []);

  useEffect(() => {
    if (!BACKEND || !ready) return;
    state.workspaces.forEach((w) => { if (synced.current.get(w.id) !== w) later(w.id, () => save(w.id)); });
  }, [state.workspaces, ready]);

  // Lets screens wait until a workspace has reached the server (e.g. before leaving the page).
  useEffect(() => {
    saveWaiter = async (id: string) => {
      for (let i = 0; i < 80; i++) {
        const w = stateRef.current.workspaces.find((x) => x.id === id);
        // Not in the list yet (just created) — or removed because the server refused it.
        if (!w) { if (i > 8) return false; await new Promise((res) => setTimeout(res, 250)); continue; }
        if (revs.current.has(id) && synced.current.get(id) === w && !inflight.current.has(id)) return true;
        await new Promise((res) => setTimeout(res, 250));
      }
      return false;
    };
    return () => { saveWaiter = null; };
  }, []);

  return { ready };
}

let saveWaiter: ((id: string) => Promise<boolean>) | null = null;
/** Resolves true once the workspace is saved on the server; false if it was refused or it took over ~20 seconds. */
export const waitForWorkspaceSave = (id: string) => (BACKEND && saveWaiter ? saveWaiter(id) : Promise.resolve(true));
