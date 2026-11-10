/**
 * SAMPLE BOOKKEEPING WORKSPACES — DESIGN PREVIEW ONLY.
 * Built from books-seed.ts and linked to the fictional client records.
 * Statement ending balances below are fictional placeholders, flagged `sample`.
 */
import { CLIENTS } from "@/lib/sample/clients";
import { BOOKS_SEEDS, acctId, stageIndex, workspaceIdFor, type BooksSeed } from "@/lib/sample/books-seed";
import { SAMPLE_NOW } from "@/lib/sample/time";
import { periodEnd, periodLabel, type BooksMonth, type BooksReport, type BooksWorkspace, type ClientTask, type MonthStage, type Reconciliation, type ReviewItem } from "@/lib/books/config";
import type { ActivityItem } from "@/lib/types";

const addDays = (iso: string, n: number, h = 10) => {
  const t = new Date(iso);
  t.setDate(t.getDate() + n);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};
const clamp = (iso: string) => (iso > SAMPLE_NOW.toISOString() ? addDays(SAMPLE_NOW.toISOString(), -1, 9) : iso);
const ORDER = ["Waiting on Client Items", "Ready for MKB Review", "MKB Reviewing", "Reconciliation in Progress", "Client Follow-up Needed", "MKB Final Review", "Reports Ready", "Month Closed"] as MonthStage[];

function buildMonth(seed: BooksSeed, wsId: string, mo: BooksSeed["months"][number], mi: number): { month: BooksMonth; tasks: ClientTask[] } {
  const id = `${wsId}-${mo.period}`;
  const end = periodEnd(mo.period);
  const idx = stageIndex(mo.stage);
  const effective = mo.stage === "Client Follow-up Needed" ? stageIndex(mo.followupFrom ?? "MKB Reviewing") : idx;
  const reached = (s: MonthStage) => effective >= stageIndex(s) || mo.stage === "Month Closed";

  // Stage history up to the current stage.
  const path = ORDER.filter((s) => s !== "Client Follow-up Needed" && stageIndex(s) <= effective);
  if (mo.stage === "Client Follow-up Needed") path.push("Client Follow-up Needed");
  const history = path.map((s, i) => ({ stage: s, at: clamp(addDays(end, i === 0 ? -29 : 2 + i * 2, 9 + i)), by: s === "Ready for MKB Review" ? "client" : i === 0 ? "system" : seed.bookkeeperId }));

  // Reconciliations derive from the stage.
  const recons: Reconciliation[] = seed.accounts.map((a, i) => {
    const accountId = acctId(wsId, i);
    const statementDate = end;
    const bal = Math.round(((seed.monthlyFee * (i + 3) * 7.3 + mi * 911) % 48000) + 1200) + 0.37 * (i + 1);
    if (reached("MKB Final Review")) return { accountId, status: "reconciled", statementDate, endingBalance: bal, completedAt: clamp(addDays(end, 9 + i, 14)), by: seed.bookkeeperId, sample: true };
    if (mo.stage === "Reconciliation in Progress" || (mo.stage === "Client Follow-up Needed" && mo.followupFrom === "Reconciliation in Progress")) {
      if (i === 0) return { accountId, status: "reconciled", statementDate, endingBalance: bal, completedAt: clamp(addDays(end, 8, 14)), by: seed.bookkeeperId, sample: true };
      if (a.kind === "credit_card" && mo.stage === "Client Follow-up Needed") return { accountId, status: "discrepancy", statementDate, endingBalance: bal, discrepancy: { amount: 236.18, note: "Register short of statement — likely a missing charge" }, sample: true };
      if (i === 1) return { accountId, status: "in_progress", statementDate, endingBalance: bal, sample: true };
    }
    return { accountId, status: "not_started" };
  });

  const items: ReviewItem[] = (seed.items ?? [])
    .filter((x) => x.period === mo.period)
    .map((x, i) => ({
      id: `${id}-ri${i}`,
      kind: x.kind,
      txnRef: x.txnRef,
      amount: x.amount,
      description: x.description,
      status: x.status,
      assignedTo: seed.bookkeeperId,
      createdAt: clamp(addDays(end, 4 + i, 11)),
      resolvedAt: x.status === "resolved" ? clamp(addDays(end, 6 + i, 15)) : undefined,
      resolution: x.resolution,
      clientResponse: x.response,
    }));

  const reports: BooksReport[] = seed.reports.map((t, i) => {
    const rid = `${id}-rp${i}`;
    if (mo.stage === "Month Closed") return { id: rid, type: t, period: mo.period, review: "approved", delivery: "delivered", preparedAt: addDays(end, 11, 13), approvedBy: seed.reviewerId, deliveredAt: addDays(end, 13, 10) };
    if (mo.stage === "Reports Ready") return { id: rid, type: t, period: mo.period, review: "approved", delivery: i === 0 ? "available" : "not_delivered", preparedAt: clamp(addDays(end, 12, 13)), approvedBy: seed.reviewerId };
    if (mo.stage === "MKB Final Review") return { id: rid, type: t, period: mo.period, review: i === 0 ? "in_review" : "preparing", delivery: "not_delivered" };
    return { id: rid, type: t, period: mo.period, review: "not_started", delivery: "not_delivered" };
  });

  // Client tasks: standard entry tasks + any review items sent to the client.
  const label = periodLabel(mo.period);
  const entryDone = idx >= 1 && mo.stage !== "Waiting on Client Items";
  const created = addDays(end, -29, 8);
  const tasks: ClientTask[] = [
    { id: `${id}-t-entry`, period: mo.period, type: "entry", title: `Keep your ${label} bank and card feeds connected in QuickBooks`, detail: "Make sure every account in your plan is connected so transactions download. Tell us if a bank stops syncing.", standard: true, status: entryDone ? "done" : "open", createdAt: created, completedAt: entryDone ? history[1]?.at : undefined, completedBy: entryDone ? "client" : undefined, docIds: [] },
    { id: `${id}-t-cat`, period: mo.period, type: "receipts", title: `Upload your ${label} receipts`, detail: "Receipts and bills for the month's business purchases.", standard: true, status: entryDone ? "done" : "open", createdAt: created, completedAt: entryDone ? history[1]?.at : undefined, completedBy: entryDone ? "client" : undefined, docIds: [] },
    { id: `${id}-t-submit`, period: mo.period, type: "submit", title: `Let MKB know ${label} is ready`, detail: "Confirm your feeds, receipts and notes are in so we can start your review.", standard: true, status: entryDone ? "done" : "open", createdAt: created, completedAt: entryDone ? history[1]?.at : undefined, completedBy: entryDone ? "client" : undefined, docIds: [] },
  ];
  items.forEach((it) => {
    if (it.status === "open" || (it.status === "resolved" && !it.clientResponse && !it.resolution?.startsWith("Client"))) return;
    const type = it.kind === "missing_receipt" ? "receipts" : it.kind === "discrepancy" ? "question" : it.kind === "miscategorized" ? "confirm" : "question";
    const done = it.status !== "sent_to_client";
    const tid = `${it.id}-task`;
    it.taskId = tid;
    tasks.push({ id: tid, period: mo.period, type, title: type === "receipts" ? `Upload receipt: ${it.txnRef}` : type === "confirm" ? `Confirm correction: ${it.txnRef}` : `Question: ${it.txnRef}`, detail: it.description, status: done ? "done" : "open", createdAt: it.createdAt, completedAt: done ? addDays(it.createdAt, 1, 16) : undefined, completedBy: done ? "client" : undefined, response: it.clientResponse ?? (done ? "Confirmed (sample)." : undefined), docIds: [], reviewItemId: it.id });
  });

  const month: BooksMonth = {
    id,
    period: mo.period,
    stage: mo.stage,
    followupFrom: mo.followupFrom,
    assignedTo: seed.bookkeeperId,
    submittedAt: entryDone ? history[1]?.at : undefined,
    reviewStartedAt: reached("MKB Reviewing") ? history[2]?.at : undefined,
    finalApproval: reached("Reports Ready") ? { by: seed.reviewerId, at: clamp(addDays(end, 11, 12)), note: "Reconciliations tie; results reviewed." } : undefined,
    closedAt: mo.stage === "Month Closed" ? addDays(end, 13, 16) : undefined,
    reopenCount: 0,
    recons,
    reviewItems: items,
    reports,
    reviewNotes: reached("MKB Reviewing") && mo.stage !== "Month Closed" ? [{ id: `${id}-rn`, authorId: seed.bookkeeperId, body: "Categorization looks consistent with prior months. Checked owner transfers and recurring vendors.", at: clamp(addDays(end, 5, 14)) }] : [],
    history,
  };
  return { month, tasks };
}

function buildWorkspace(seed: BooksSeed): BooksWorkspace | null {
  const client = CLIENTS.find((c) => c.id === seed.clientId);
  const enrollment = client?.enrollments.find((e) => e.service === "books" && e.title === seed.title);
  if (!client || !enrollment) return null;
  const id = workspaceIdFor(enrollment.id);
  const built = seed.months.map((m, i) => buildMonth(seed, id, m, i));
  const months = built.map((b) => b.month);
  const tasks = built.flatMap((b) => b.tasks);
  // Outstanding document requests show as client tasks too.
  client.documents
    .filter((dd) => dd.workspaceId === id && dd.status === "requested")
    .forEach((dd) => tasks.push({ id: `${dd.id}-task`, period: dd.period ?? months[months.length - 1].period, type: "statement", title: `Provide: ${dd.name}`, status: "open", createdAt: dd.requestedAt, docIds: [], requestDocId: dd.id }));

  const activity: ActivityItem[] = months
    .flatMap((m) => m.history.map((h, i) => ({ id: `${m.id}-h${i}`, kind: (h.by === "client" ? "intake" : "status") as ActivityItem["kind"], text: `${periodLabel(m.period)} → ${h.stage}`, at: h.at, actor: (h.by === "client" ? "client" : h.by === "system" ? "system" : "staff") as ActivityItem["actor"] })))
    .concat(seed.qbo.lastSync ? [{ id: `${id}-sync`, kind: "status", text: `QuickBooks sync ${seed.qbo.status === "needs_reauth" ? "failed — authorization expired" : "completed"}`, at: seed.qbo.lastSync, actor: "system" }] : [])
    .sort((a, b) => b.at.localeCompare(a.at));

  return {
    id,
    clientId: client.id,
    enrollmentId: enrollment.id,
    businessName: seed.businessName,
    entityType: seed.entityType,
    bookkeeperId: seed.bookkeeperId,
    reviewerId: seed.reviewerId,
    service: { plan: seed.plan, monthlyFee: seed.monthlyFee, reports: seed.reports, includes: seed.includes },
    extras: (seed.extras ?? []).map((x, i) => ({ ...x, id: `${id}-x${i}` })),
    qbo: { status: seed.qbo.status, companyName: seed.qbo.company, access: seed.qbo.access, realmMasked: seed.qbo.realm, connectedAt: seed.qbo.connectedAt, lastSyncAt: seed.qbo.status === "needs_reauth" ? addDays(seed.qbo.lastSync!, -1, 4) : seed.qbo.lastSync, authorizedBy: seed.qbo.authorizedBy },
    accounts: seed.accounts.map((a, i) => ({ ...a, id: acctId(id, i) })),
    months,
    tasks,
    notes: [{ id: `${id}-n0`, authorId: seed.bookkeeperId, body: seed.clientId === "c-1007" ? "Payroll clearing account needs a look every month — client sometimes books net pay as an expense." : "Client is responsive; prefers email reminders before the 5th.", at: addDays(SAMPLE_NOW.toISOString(), -20, 11), pinned: true }],
    activity,
    startedAt: seed.startedAt,
  };
}

export const BOOKS_WORKSPACES: BooksWorkspace[] = BOOKS_SEEDS.map(buildWorkspace).filter((w): w is BooksWorkspace => !!w);
