"use client";

import { BACKEND } from "@/lib/sync/remote";
import Link from "next/link";
import { useClientGate } from "@/components/team/AccessGuard";
import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  AtSign,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileBarChart2,
  FilePlus2,
  FileText,
  FolderOpen,
  KeyRound,
  LayoutGrid,
  Link2,
  Lock,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  Phone,
  Pin,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  Upload,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Menu } from "@/components/ui/Menu";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { Timeline } from "@/components/crm/ProfileTabs";
import { PaymentDialog, downloadDoc } from "@/components/crm/dialogs";
import { staffList, staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { balanceDue, currentMonth, nextAction, openTasks, unresolved, useBooks, workspaceDocs, workspaceInvoices, workspaceMessages } from "@/lib/store/books-store";
import { QBO_ACCESS, QBO_STATUS, REPORT_TYPES, REVIEW_KIND, STAGE_META, TASK_TYPE, closeTarget, periodLabel, type BooksMonth, type BooksWorkspace, type ClientTaskType, type ReportType } from "@/lib/books/config";
import { fileSize, fmtDate, fmtDateTime, relTime, usd } from "@/lib/format";
import { formatPhone } from "@/lib/validation";
import type { Client } from "@/lib/types";
import { DELIVERY_META, MonthStepper, OwnerBadge, QboBadge, RECON_META, REVIEW_META, StageBadge, TurnLegend, money } from "./BooksBits";
import { AddReviewItemDialog, CompleteTaskDialog, DiscrepancyDialog, ExtraChargeDialog, FinalApprovalDialog, ReopenDialog, RequestDocDialog, ResolveItemDialog, StageOverrideDialog, StatementDialog } from "./BooksDialogs";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "close", label: "Monthly close", icon: ClipboardList },
  { key: "tasks", label: "Client tasks", icon: UserRound },
  { key: "review", label: "Review & reconciliation", icon: Scale },
  { key: "quickbooks", label: "QuickBooks", icon: Link2 },
  { key: "reports", label: "Reports", icon: FileBarChart2 },
  { key: "documents", label: "Documents & messages", icon: FolderOpen },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "activity", label: "Activity", icon: ActivityIcon },
] as const;
type Tab = (typeof TABS)[number]["key"];
type Dlg = "item" | "approve" | "reopen" | "request" | "extra" | "override" | "payment" | null;

const QBO_URL = "https://qbo.intuit.com/";

export function Workspace({ id }: { id: string }) {
  const books = useBooks();
  const { clients, ready: clientsReady } = useClients();
  const toast = useToast();
  const w = books.workspaces.find((x) => x.id === id);
  const client = clients.find((c) => c.id === w?.clientId);
  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);

  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === h)) setTab(h);
    const p = new URLSearchParams(window.location.search).get("month");
    if (p) setPeriod(p);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${t}`);
  };

  const gate = useClientGate(w?.clientId, "this bookkeeping workspace");
  if (gate) return gate;
  if (!books.ready || !clientsReady) return <div className="grid min-h-[50vh] place-items-center text-[14px] text-muted" role="status">Loading…</div>;
  if (!w || !client)
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <h1 className="text-[20px] font-bold text-ink">Workspace not found</h1>
          <Link href="/services/bookkeeping" className="mt-4 inline-block text-[14px] font-semibold text-accent">Back to Bookkeeping</Link>
        </div>
      </div>
    );

  const months = [...w.months].sort((a, b) => b.period.localeCompare(a.period));
  const cur = currentMonth(w);
  const m = months.find((x) => x.period === period) ?? cur;
  const siblings = books.workspaces.filter((x) => x.clientId === w.clientId && x.id !== w.id);

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Bookkeeping", href: "/services/bookkeeping" }, ...(client.name !== w.businessName ? [{ label: client.name, href: `/clients/${client.id}` }] : []), { label: w.businessName }]} />

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 gap-4">
            <Avatar name={w.businessName} size={56} square />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{w.businessName}</h1>
                <QboBadge status={w.qbo.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5"><Building2 size={14} /> {w.entityType}</span>
                <span>Client: <Link href={`/clients/${client.id}`} className="font-medium text-accent hover:underline">{client.name}</Link></span>
                <span>{w.service.plan}</span>
                <span className="font-mono text-[11.5px] text-faint">{w.id}</span>
              </div>
              {siblings.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
                  Also for this client:
                  {siblings.map((s) => <Link key={s.id} href={`/services/bookkeeping/${s.id}`} className="rounded-full border border-line px-2.5 py-0.5 font-medium text-ink-2 hover:border-accent">{s.businessName}</Link>)}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            <Button size="sm" icon={Eye} href={`/services/bookkeeping/${w.id}/client`}>Client view</Button>
            <a href={QBO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-hover">
              <ExternalLink size={15} /> Open QuickBooks
            </a>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <label className="block">
            <span className="text-[12px] text-muted">Month</span>
            <select aria-label="Bookkeeping month" value={m.period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] font-semibold text-ink">
              {months.map((x) => <option key={x.id} value={x.period}>{periodLabel(x.period)}{x.id === cur.id ? " (current)" : ""} — {x.stage}</option>)}
            </select>
          </label>
          {(["bookkeeper", "reviewer"] as const).map((role) => (
            <label key={role} className="block">
              <span className="text-[12px] text-muted">{role === "bookkeeper" ? "Assigned bookkeeper" : "Final reviewer"}</span>
              <select aria-label={role === "bookkeeper" ? "Assigned bookkeeper" : "Final reviewer"} value={role === "bookkeeper" ? w.bookkeeperId : w.reviewerId} onChange={(e) => { books.assign(w.id, role, e.target.value); toast(`${role === "bookkeeper" ? "Bookkeeper" : "Reviewer"}: ${staffById(e.target.value).name}`); }} className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] font-medium text-ink">
                {staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          ))}
          <div>
            <span className="text-[12px] text-muted">Balance due</span>
            <button onClick={() => go("billing")} className={`mt-1 block text-[17px] font-bold tabular-nums ${balanceDue(w, client) > 0 ? "text-danger-ink" : "text-faint"}`}>{usd(balanceDue(w, client))}</button>
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-20 -mx-4 mt-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Workspace" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              <t.icon size={16} /> {t.label}
              {t.key === "tasks" && openTasks(w).length > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink">{openTasks(w).length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-5">
        {tab === "overview" && <OverviewTab w={w} c={client} m={cur} go={go} />}
        {tab === "close" && <CloseTab w={w} m={m} go={go} open={setDlg} />}
        {tab === "tasks" && <TasksTab w={w} m={m} />}
        {tab === "review" && <ReviewTab w={w} m={m} open={setDlg} />}
        {tab === "quickbooks" && <QuickBooksTab w={w} />}
        {tab === "reports" && <ReportsTab w={w} m={m} c={client} />}
        {tab === "documents" && <DocsTab w={w} c={client} m={m} open={setDlg} />}
        {tab === "billing" && <BillingTab w={w} c={client} open={setDlg} />}
        {tab === "activity" && <Card><CardHeader title="Workspace activity" subtitle="Status changes, reviews, reconciliations, documents and QuickBooks events" /><Timeline items={w.activity} /></Card>}
      </div>

      <AddReviewItemDialog w={w} m={m} open={dlg === "item"} onClose={() => setDlg(null)} />
      <FinalApprovalDialog w={w} m={m} open={dlg === "approve"} onClose={() => setDlg(null)} />
      <ReopenDialog w={w} m={m} open={dlg === "reopen"} onClose={() => setDlg(null)} />
      <RequestDocDialog w={w} period={m.period} open={dlg === "request"} onClose={() => setDlg(null)} />
      <ExtraChargeDialog w={w} period={cur.period} open={dlg === "extra"} onClose={() => setDlg(null)} />
      <StageOverrideDialog w={w} m={m} open={dlg === "override"} onClose={() => setDlg(null)} />
      <PaymentDialog client={client} open={dlg === "payment"} onClose={() => setDlg(null)} invoiceId={workspaceInvoices(w, client).find((i) => i.amount > i.paid && i.status !== "draft")?.id} />
    </>
  );
}

/* ================================================================== */

function OverviewTab({ w, c, m, go }: { w: BooksWorkspace; c: Client; m: BooksMonth; go: (t: Tab) => void }) {
  const next = nextAction(w, m);
  const tasks = openTasks(w);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader icon={ClipboardList} title={`Current month · ${periodLabel(m.period)}`} subtitle={`Close target ${fmtDate(closeTarget(m.period), { month: "short", day: "numeric" })}`} action={<Button size="sm" variant="ghost" onClick={() => go("close")}>Monthly close</Button>} />
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2"><StageBadge stage={m.stage} /><OwnerBadge owner={next.owner} /><TurnLegend className="ml-auto" /></div>
          <p className="text-[14px] text-ink">{next.text}</p>
          <MonthStepper m={m} />
          <dl className="grid grid-cols-3 gap-3 border-t border-line pt-3 text-center">
            <div><dt className="text-[11.5px] text-muted">Review items open</dt><dd className="text-[18px] font-bold text-ink tabular-nums">{unresolved(m).length}</dd></div>
            <div><dt className="text-[11.5px] text-muted">Reconciled</dt><dd className="text-[18px] font-bold text-ink tabular-nums">{m.recons.filter((r) => r.status === "reconciled").length}/{m.recons.length}</dd></div>
            <div><dt className="text-[11.5px] text-muted">Reports approved</dt><dd className="text-[18px] font-bold text-ink tabular-nums">{m.reports.filter((r) => r.review === "approved").length}/{m.reports.length}</dd></div>
          </dl>
        </div>
      </Card>
      <Card>
        <CardHeader icon={Building2} title="Business & contact" subtitle="From the central client record" action={<Button size="sm" variant="ghost" href={`/clients/${c.id}`}>Client profile</Button>} />
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 px-5 pb-5 text-[13.5px] sm:px-6">
          <dt className="text-muted">Business</dt><dd className="font-medium text-ink">{w.businessName} · {w.entityType}</dd>
          <dt className="text-muted">Client</dt><dd className="font-medium text-ink">{c.name}{c.contactName ? ` · ${c.contactName}` : ""}</dd>
          <dt className="text-muted">Email</dt><dd className="font-medium text-ink"><a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-accent"><AtSign size={13} className="text-muted" />{c.email}</a></dd>
          <dt className="text-muted">Phone</dt><dd className="font-medium text-ink"><span className="inline-flex items-center gap-1"><Phone size={13} className="text-muted" />{c.phone && c.phone !== "—" ? formatPhone(c.phone) : "—"}</span></dd>
          <dt className="text-muted">Bookkeeper</dt><dd className="font-medium text-ink">{staffById(w.bookkeeperId).name}</dd>
          <dt className="text-muted">Service</dt><dd className="font-medium text-ink">{w.service.plan} · {usd(w.service.monthlyFee)}/month</dd>
          <dt className="text-muted">QuickBooks</dt><dd className="font-medium text-ink">{w.qbo.companyName}<br /><span className="text-[12.5px] font-normal text-muted">{QBO_ACCESS[w.qbo.access].label} · {QBO_STATUS[w.qbo.status].label}</span></dd>
          <dt className="text-muted">Client since</dt><dd className="font-medium text-ink">{fmtDate(w.startedAt)}</dd>
        </dl>
      </Card>
      <Card>
        <CardHeader icon={UserRound} title="Outstanding client tasks & requests" subtitle={`${tasks.length} open`} action={<Button size="sm" variant="ghost" onClick={() => go("tasks")}>All tasks</Button>} />
        <ul className="px-3 pb-3 sm:px-4">
          {tasks.length === 0 && <li className="px-2 pb-3 text-[13.5px] text-muted">Nothing outstanding from the client.</li>}
          {tasks.slice(0, 6).map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning"><UserRound size={15} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium text-ink">{t.title}</span><span className="block text-[12px] text-muted">{periodLabel(t.period, true)} · {TASK_TYPE[t.type]} · {relTime(t.createdAt)}</span></span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={ActivityIcon} title="Recent activity" action={<Button size="sm" variant="ghost" onClick={() => go("activity")}>View all</Button>} />
        <Timeline items={w.activity.slice(0, 5)} />
      </Card>
    </div>
  );
}

/* ================================================================== */

function CloseTab({ w, m, go, open }: { w: BooksWorkspace; m: BooksMonth; go: (t: Tab) => void; open: (d: Dlg) => void }) {
  const books = useBooks();
  const toast = useToast();
  const tasks = openTasks(w, m.period);
  const openItems = m.reviewItems.filter((r) => r.status === "open");
  const unreconciled = m.recons.filter((r) => r.status !== "reconciled");
  const unapproved = m.reports.filter((r) => r.review !== "approved");
  const followupOpen = tasks.filter((t) => t.reviewItemId || t.requestDocId);
  const label = periodLabel(m.period);

  type Act = { label: string; run: () => void; icon?: typeof Send } | null;
  let text = STAGE_META[m.stage].hint;
  let primary: Act = null;
  let secondary: Act = null;
  switch (m.stage) {
    case "Waiting on Client Items":
      text = `Waiting on the client's items for ${label} (bank feeds, receipts, notes on cash or unusual activity). ${tasks.length} task(s) open.`;
      primary = { label: "Remind client", icon: Send, run: () => { const n = books.remindClient(w.id, m.id); toast(`Reminder sent (${n} open task${n === 1 ? "" : "s"})`); } };
      secondary = { label: "Submit on client's behalf", run: () => { if (confirm(`Mark ${label} as submitted on the client's behalf?`)) { books.submitMonth(w.id, m.id, "staff"); toast("Ready for MKB Review"); } } };
      break;
    case "Ready for MKB Review":
      text = `Client submitted ${label}${m.submittedAt ? ` ${relTime(m.submittedAt)}` : ""}. Start the categorization review.`;
      primary = { label: "Start review", icon: ArrowRight, run: () => { books.startReview(w.id, m.id); toast("MKB Reviewing"); } };
      break;
    case "MKB Reviewing":
      text = openItems.length ? `${openItems.length} review item(s) open. Resolve them or send them to the client.` : "Review items are handled. Move on to reconciliations.";
      primary = openItems.length
        ? { label: `Send ${openItems.length} to client`, icon: Send, run: () => { const n = books.sendToClient(w.id, m.id, openItems.map((r) => r.id)); toast(`${n} request(s) sent — Client Follow-up Needed`); } }
        : { label: "Start reconciliations", icon: ArrowRight, run: () => { books.finishReview(w.id, m.id); toast("Reconciliation in Progress"); } };
      secondary = openItems.length ? { label: "Continue to reconciliations", run: () => { if (confirm(`${openItems.length} item(s) still open — continue anyway?`)) { books.finishReview(w.id, m.id); toast("Reconciliation in Progress"); } } } : { label: "Flag a transaction", run: () => open("item") };
      break;
    case "Reconciliation in Progress":
      text = unreconciled.length ? `${unreconciled.length} of ${m.recons.length} account(s) still to reconcile.` : "Every account is reconciled.";
      primary = unreconciled.length ? { label: "Go to reconciliations", icon: Scale, run: () => go("review") } : { label: "Move to final review", icon: ArrowRight, run: () => { books.toFinalReview(w.id, m.id); toast("MKB Final Review"); } };
      break;
    case "Client Follow-up Needed":
      text = followupOpen.length ? `Waiting on ${followupOpen.length} client response(s).` : `The client responded. Resume ${m.followupFrom ?? "review"}.`;
      primary = followupOpen.length
        ? { label: "Remind client", icon: Send, run: () => { books.remindClient(w.id, m.id); toast("Reminder sent"); } }
        : { label: `Resume: ${m.followupFrom ?? "MKB Reviewing"}`, icon: ArrowRight, run: () => { books.resumeAfterFollowup(w.id, m.id); toast(`Back to ${m.followupFrom ?? "MKB Reviewing"}`); } };
      secondary = followupOpen.length ? { label: "Resume anyway", run: () => { books.resumeAfterFollowup(w.id, m.id); toast("Resumed"); } } : null;
      break;
    case "MKB Final Review": {
      const blockers = [unreconciled.length && `${unreconciled.length} account(s) not reconciled`, unresolved(m).length && `${unresolved(m).length} review item(s) unresolved`, unapproved.length && `${unapproved.length} report(s) not approved`].filter(Boolean);
      text = blockers.length ? `Before approval: ${blockers.join(" · ")}.` : `Reconciliations tie and reports are approved. Record ${staffById(w.reviewerId).name}'s final approval.`;
      primary = blockers.length ? { label: unapproved.length && !unreconciled.length && !unresolved(m).length ? "Go to reports" : "Go to review & reconciliation", icon: ArrowRight, run: () => go(unreconciled.length || unresolved(m).length ? "review" : "reports") } : { label: "Record final approval", icon: ShieldCheck, run: () => open("approve") };
      break;
    }
    case "Reports Ready":
      text = `Reports approved. Deliver them to the client and close ${label}.`;
      primary = { label: "Deliver reports & close month", icon: CheckCircle2, run: () => { books.closeMonth(w.id, m.id); toast(`${label} closed`); } };
      secondary = { label: "Review reports", run: () => go("reports") };
      break;
    case "Month Closed":
      text = `Closed ${m.closedAt ? fmtDate(m.closedAt) : ""}${m.reopenCount ? ` · reopened ${m.reopenCount}×` : ""}.`;
      primary = { label: "Reopen month", icon: RotateCcw, run: () => open("reopen") };
      break;
  }
  const owner = nextAction(w, m).owner;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          icon={ClipboardList}
          title={`${label} close`}
          subtitle={`Close target ${fmtDate(closeTarget(m.period), { month: "short", day: "numeric", year: "numeric" })}`}
          action={
            <Menu
              label="Month actions"
              trigger={({ toggle }) => <Button size="sm" icon={MoreHorizontal} onClick={toggle} aria-label="Month actions"><span className="sr-only">More</span></Button>}
              items={[
                { label: "Change stage (override)…", icon: RotateCcw, onSelect: () => open("override") },
                { label: "Flag a transaction…", icon: Plus, onSelect: () => open("item") },
                { label: "Request a document…", icon: FilePlus2, onSelect: () => open("request") },
              ]}
            />
          }
        />
        <div className="space-y-4 px-5 pb-5 sm:px-6">
          <MonthStepper m={m} />
          <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${owner === "Client" ? "border-warning/30 bg-warning-soft/60" : "border-accent/25 bg-accent-soft/50"}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">Next step <OwnerBadge owner={owner} /></div>
              <p className="mt-0.5 text-[14px] text-ink">{text}</p>
            </div>
            {secondary && <Button size="sm" onClick={secondary.run}>{secondary.label}</Button>}
            {primary && <Button size="sm" variant="primary" icon={primary.icon} onClick={primary.run}>{primary.label}</Button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-[12px] text-muted">Assigned to</span>
              <select aria-label="Month assigned to" value={m.assignedTo} onChange={(e) => { books.assignMonth(w.id, m.id, e.target.value); toast(`Assigned to ${staffById(e.target.value).name}`); }} className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] font-medium text-ink">
                {staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <Mini label="Client tasks open" value={String(tasks.length)} onClick={() => go("tasks")} />
            <Mini label="Accounts reconciled" value={`${m.recons.length - unreconciled.length}/${m.recons.length}`} onClick={() => go("review")} />
            <Mini label="Final approval" value={m.finalApproval ? `${staffById(m.finalApproval.by).name.split(" ")[0]} · ${fmtDate(m.finalApproval.at, { month: "short", day: "numeric" })}` : "Not yet"} onClick={() => go("reports")} />
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Stage history" subtitle="Every status change for this month" />
        <ol className="space-y-1.5 px-5 pb-5 sm:px-6">
          {[...m.history].reverse().map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
              <StageBadge stage={h.stage} />
              <span className="text-muted">{fmtDateTime(h.at)} · {h.by === "client" ? "client" : h.by === "system" ? "system" : staffById(h.by)?.name ?? h.by}</span>
              {h.note && <span className="text-ink-2">— {h.note}</span>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Mini({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl px-1 text-left hover:bg-surface-hover">
      <span className="block text-[12px] text-muted">{label}</span>
      <span className="mt-1 block text-[15px] font-bold text-ink tabular-nums">{value}</span>
    </button>
  );
}

/* ================================================================== */

function TasksTab({ w, m }: { w: BooksWorkspace; m: BooksMonth }) {
  const books = useBooks();
  const toast = useToast();
  const [filter, setFilter] = useState<"open" | "month" | "done">("open");
  const [completing, setCompleting] = useState<string | null>(null);
  const [type, setType] = useState<ClientTaskType>("receipts");
  const [title, setTitle] = useState("");
  const list = w.tasks.filter((t) => (filter === "open" ? t.status === "open" : filter === "month" ? t.period === m.period : t.status === "done")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const task = w.tasks.find((t) => t.id === completing) ?? null;
  return (
    <Card>
      <CardHeader icon={UserRound} title="Client task center" subtitle="What MKB needs from the client — they see and complete these in the portal" action={<Button size="sm" icon={Eye} href={`/services/bookkeeping/${w.id}/client`}>Open client view</Button>} />
      <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6">
        {(
          [
            ["open", "All open"],
            ["month", periodLabel(m.period)],
            ["done", "Completed"],
          ] as const
        ).map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${filter === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>{l}</button>)}
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {list.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No tasks in this view.</li>}
        {list.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap sm:px-6">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.status === "done" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{t.status === "done" ? <CheckCircle2 size={17} /> : <UserRound size={17} />}</span>
            <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
              <div className={`text-[14px] font-medium ${t.status === "done" ? "text-muted" : "text-ink"}`}>{t.title}</div>
              <div className="text-[12px] text-muted">{TASK_TYPE[t.type]} · {periodLabel(t.period, true)} · {t.status === "done" ? `done ${t.completedAt ? relTime(t.completedAt) : ""} by ${t.completedBy ?? "client"}` : `requested ${relTime(t.createdAt)}`}{t.docIds.length ? ` · ${t.docIds.length} file(s)` : ""}</div>
              {t.response && <div className="mt-0.5 text-[12.5px] text-accent-ink">Client: {t.response}</div>}
            </div>
            {t.status === "open" ? <Button size="sm" onClick={() => setCompleting(t.id)}>Mark complete</Button> : <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => { books.reopenTask(w.id, t.id); toast("Task reopened"); }}>Reopen</Button>}
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; books.addTask(w.id, m.period, type, title.trim()); toast("Task added for client"); setTitle(""); }} className="flex flex-wrap items-center gap-2 border-t border-line p-4 sm:px-6">
        <select aria-label="Task type" value={type} onChange={(e) => setType(e.target.value as ClientTaskType)} className="h-10 rounded-xl border border-line bg-surface px-2 text-[13.5px] text-ink-2">
          {(Object.keys(TASK_TYPE) as ClientTaskType[]).map((k) => <option key={k} value={k}>{TASK_TYPE[k]}</option>)}
        </select>
        <input aria-label="New client task" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`New task for ${periodLabel(m.period)}…`} className="h-10 min-w-[200px] flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
        <Button type="submit" icon={Plus} disabled={!title.trim()}>Add task</Button>
      </form>
      <CompleteTaskDialog w={w} task={task} by="staff" onClose={() => setCompleting(null)} />
    </Card>
  );
}

/* ================================================================== */

function ReviewTab({ w, m, open }: { w: BooksWorkspace; m: BooksMonth; open: (d: Dlg) => void }) {
  const books = useBooks();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [stmt, setStmt] = useState<string | null>(null);
  const [disc, setDisc] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const closed = m.stage === "Month Closed";
  const statusLabel = { open: "Open", sent_to_client: "Sent to client", client_responded: "Client responded", resolved: "Resolved" } as const;
  const statusTone = { open: "warning", sent_to_client: "info", client_responded: "info", resolved: "success" } as const;
  useEffect(() => setSelected([]), [m.id]);

  return (
    <div className="space-y-5">
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3.5 py-2 text-[12.5px] text-muted"><Lock size={13} /> MKB only — clients never see review notes or this workspace. Corrections are made in QuickBooks.</p>
      <Card>
        <CardHeader
          icon={ClipboardList}
          title={`Transaction review · ${periodLabel(m.period)}`}
          subtitle={`${unresolved(m).length} unresolved of ${m.reviewItems.length}`}
          action={
            <div className="flex flex-wrap gap-2">
              {selected.length > 0 && <Button size="sm" icon={Send} onClick={() => { const n = books.sendToClient(w.id, m.id, selected); toast(`${n} sent to client`); setSelected([]); }}>Send {selected.length} to client</Button>}
              <Button size="sm" variant="primary" icon={Plus} disabled={closed} onClick={() => open("item")}>Flag transaction</Button>
            </div>
          }
        />
        <ul className="divide-y divide-line border-t border-line">
          {m.reviewItems.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No transactions flagged for this month.</li>}
          {m.reviewItems.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3 sm:px-6">
              <input type="checkbox" aria-label={`Select ${r.txnRef}`} disabled={r.status !== "open"} checked={selected.includes(r.id)} onChange={() => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} className="mt-1 h-4 w-4 accent-[var(--accent)] disabled:opacity-30" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-semibold text-ink">{r.txnRef}</span>{r.amount != null && <span className="text-[13px] tabular-nums text-ink-2">{money(r.amount)}</span>}<Badge tone="neutral">{REVIEW_KIND[r.kind]}</Badge></div>
                <p className="text-[13px] text-ink-2">{r.description}</p>
                {r.clientResponse && <p className="text-[12.5px] text-accent-ink">Client: {r.clientResponse}</p>}
                {r.resolution && <p className="text-[12.5px] text-success-ink">Resolved: {r.resolution}</p>}
                <p className="text-[11.5px] text-muted">{staffById(r.assignedTo).name} · flagged {relTime(r.createdAt)}</p>
              </div>
              <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
              {r.status !== "resolved" ? <Button size="sm" onClick={() => setResolving(r.id)}>Resolve</Button> : <Button size="sm" variant="ghost" disabled={closed} onClick={() => books.reopenItem(w.id, m.id, r.id)}>Reopen</Button>}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader icon={Scale} title={`Reconciliations · ${periodLabel(m.period)}`} subtitle="Record the statement, reconcile in QuickBooks, then mark complete here" />
        <ul className="divide-y divide-line border-t border-line">
          {m.recons.map((r) => {
            const a = w.accounts.find((x) => x.id === r.accountId)!;
            return (
              <li key={r.accountId} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${a.kind === "bank" ? "bg-svc-books-soft text-svc-books" : "bg-svc-tax-soft text-svc-tax"}`}>{a.kind === "bank" ? <Building2 size={17} /> : <CreditCard size={17} />}</span>
                <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                  <div className="text-[14px] font-semibold text-ink">{a.name} ••{a.mask}</div>
                  <div className="text-[12px] text-muted">{a.institution} · statement {r.statementDate ? fmtDate(r.statementDate) : "—"} · ending balance {money(r.endingBalance)}{r.sample ? " (sample)" : ""}</div>
                  {r.discrepancy && <div className="text-[12.5px] font-medium text-danger-ink">Discrepancy {money(r.discrepancy.amount)} — {r.discrepancy.note}</div>}
                  {r.completedAt && <div className="text-[12px] text-success-ink">Reconciled {fmtDate(r.completedAt)} by {staffById(r.by ?? m.assignedTo).name}</div>}
                </div>
                <Badge tone={RECON_META[r.status].tone}>{RECON_META[r.status].label}</Badge>
                {r.status !== "reconciled" && !closed && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" onClick={() => setStmt(r.accountId)}>{r.endingBalance != null && !r.sample ? "Edit statement" : "Record statement"}</Button>
                    <Button size="sm" variant="primary" disabled={r.endingBalance == null || !r.statementDate} title={r.endingBalance == null ? "Record the statement first" : undefined} onClick={() => { books.markReconciled(w.id, m.id, r.accountId); toast(`${a.name} reconciled`); }}>Mark reconciled</Button>
                    <Button size="sm" variant="ghost" icon={AlertTriangle} aria-label={`Record discrepancy for ${a.name}`} onClick={() => setDisc(r.accountId)}><span className="hidden sm:inline">Discrepancy</span></Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader icon={NotebookPen} title="Review notes" subtitle="Internal — MKB only" />
        <div className="mx-5 mb-3 flex gap-2 sm:mx-6">
          <input aria-label="Review note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you check this month?" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
          <Button disabled={!note.trim()} onClick={() => { books.addReviewNote(w.id, m.id, note.trim()); setNote(""); toast("Review note added"); }}>Add</Button>
        </div>
        <ul className="space-y-2 px-5 pb-5 sm:px-6">
          {m.reviewNotes.length === 0 && <li className="text-[13px] text-muted">No review notes yet.</li>}
          {m.reviewNotes.map((n) => <li key={n.id} className="rounded-xl border border-line p-3 text-[13.5px] text-ink-2">{n.body}<div className="mt-1 text-[12px] text-muted">{staffById(n.authorId).name} · {relTime(n.at)}</div></li>)}
        </ul>
      </Card>

      <ResolveItemDialog w={w} m={m} itemId={resolving} onClose={() => setResolving(null)} />
      <StatementDialog key={stmt ?? "none"} w={w} m={m} accountId={stmt} onClose={() => setStmt(null)} />
      <DiscrepancyDialog w={w} m={m} accountId={disc} onClose={() => setDisc(null)} />
    </div>
  );
}

/* ================================================================== */

function QuickBooksTab({ w }: { w: BooksWorkspace }) {
  const books = useBooks();
  const toast = useToast();
  const q = w.qbo;
  const lastRecon = (accountId: string) => [...w.months].filter((m) => m.recons.some((r) => r.accountId === accountId && r.status === "reconciled")).sort((a, b) => b.period.localeCompare(a.period))[0];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader icon={Link2} title="QuickBooks Online connection" subtitle="The client keeps their own QuickBooks company and login" />
        <div className="space-y-4 px-5 pb-5 sm:px-6">
          <div className={`rounded-xl border p-3.5 ${q.status === "connected" ? "border-success/30 bg-success-soft/50" : q.status === "needs_reauth" ? "border-danger/30 bg-danger-soft/60" : "border-warning/30 bg-warning-soft/60"}`}>
            <QboBadge status={q.status} />
            <p className="mt-1.5 text-[13px] text-ink-2">{QBO_STATUS[q.status].hint}</p>
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13.5px]">
            <dt className="text-muted">Company</dt><dd className="font-medium text-ink">{q.companyName}</dd>
            <dt className="text-muted">Company ID</dt><dd className="font-mono text-[13px] text-ink">{q.realmMasked ?? "—"}</dd>
            <dt className="text-muted">Access method</dt><dd className="font-medium text-ink">{QBO_ACCESS[q.access].label}<p className="text-[12px] font-normal text-muted">{QBO_ACCESS[q.access].detail}</p></dd>
            <dt className="text-muted">Authorized by</dt><dd className="font-medium text-ink">{q.authorizedBy ?? "—"}</dd>
            <dt className="text-muted">Connected since</dt><dd className="font-medium text-ink">{q.connectedAt ? fmtDate(q.connectedAt) : "—"}</dd>
            <dt className="text-muted">Last successful sync</dt><dd className="font-medium text-ink">{q.lastSyncAt ? `${fmtDateTime(q.lastSyncAt)} (${relTime(q.lastSyncAt)})` : "Never"}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <a href={QBO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover"><ExternalLink size={16} /> Open QuickBooks</a>
            {q.status === "connected" && <Button icon={RefreshCw} onClick={() => { books.syncNow(w.id); toast("Status refreshed (sample — no data pulled)"); }}>Refresh status</Button>}
            {q.status === "needs_reauth" && (
              <>
                <Button icon={KeyRound} onClick={() => toast("Phase 3: sends the client a secure link to approve access with their own Intuit sign-in. No credentials are collected by MKB.", "info")}>Request reauthorization</Button>
                <Button variant="ghost" onClick={() => { books.setQboStatus(w.id, "connected", "QuickBooks reauthorized (sample)"); toast("Marked reauthorized (sample)"); }}>Mark reauthorized (sample)</Button>
              </>
            )}
            {q.status === "invite_pending" && <Button variant="ghost" onClick={() => { books.setQboStatus(w.id, "connected", "Accountant invite accepted (sample)"); toast("Invite accepted (sample)"); }}>Mark invite accepted (sample)</Button>}
            {q.status === "connected" && <Button variant="ghost" onClick={() => { if (confirm("Record that MKB's access was disconnected?")) { books.setQboStatus(w.id, "not_connected", "QuickBooks access disconnected"); toast("Disconnected (sample)"); } }}>Disconnect</Button>}
            {q.status === "not_connected" && <Button onClick={() => { books.setQboStatus(w.id, "invite_pending", "Accountant invite requested"); toast("Invite requested (sample)"); }}>Request access</Button>}
          </div>
          <p className="text-[12px] text-muted">&ldquo;Open QuickBooks&rdquo; goes to Intuit&rsquo;s sign-in page. Each person signs in with their own Intuit account; MKB never asks for the client&rsquo;s password.</p>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Building2} title="Connected accounts" subtitle="Bank and card accounts MKB reconciles" />
        <ul className="divide-y divide-line border-t border-line">
          {w.accounts.map((a) => {
            const lr = lastRecon(a.id);
            return (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2 ring-1 ring-line">{a.kind === "bank" ? <Building2 size={16} /> : <CreditCard size={16} />}</span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{a.name} ••{a.mask}</span><span className="block text-[12px] text-muted">{a.institution} · {a.kind === "bank" ? "Bank" : "Credit card"}</span></span>
                <span className="text-right text-[12px] text-muted">Reconciled through<br /><span className="font-semibold text-ink-2">{lr ? periodLabel(lr.period, true) : "—"}</span></span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader icon={FileBarChart2} title="Authorized financial information" subtitle="Appears here once the QuickBooks integration is implemented (Phase 3)" />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3 sm:px-6">
          {["Account balances", "Uncategorized & 'For review' counts", "Report snapshots"].map((x) => (
            <div key={x} className="grid min-h-[110px] place-items-center rounded-xl border-2 border-dashed border-line px-4 text-center">
              <div><Lock size={18} className="mx-auto text-faint" /><p className="mt-1 text-[13px] font-medium text-ink-2">{x}</p><p className="text-[12px] text-muted">Not connected in the design preview</p></div>
            </div>
          ))}
        </div>
        <div className="mx-5 mb-5 rounded-xl bg-surface-2 p-4 text-[12.5px] text-ink-2 ring-1 ring-line sm:mx-6">
          <p className="mb-1.5 font-semibold text-ink">Integration design (for Phase 3)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Intuit OAuth 2.0 authorization-code flow; access is granted per QuickBooks company (realm ID).</li>
            <li>Access and refresh tokens are stored encrypted on the server only — never in this page, browser storage or client-side code.</li>
            <li>Request only the accounting scope needed for read-only review; confirm each report and endpoint is available for the client&rsquo;s QuickBooks plan before relying on it.</li>
            <li>Refresh tokens before they expire, show &ldquo;Reauthorization needed&rdquo; when Intuit revokes access, and log every connection change.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== */

function ReportsTab({ w, m, c }: { w: BooksWorkspace; m: BooksMonth; c: Client }) {
  const books = useBooks();
  const toast = useToast();
  const [add, setAdd] = useState<ReportType | "">("");
  const canPrepare = ["MKB Final Review", "Reports Ready"].includes(m.stage);
  const canDeliver = ["Reports Ready", "Month Closed"].includes(m.stage);
  const available = REPORT_TYPES.filter((t) => !m.reports.some((r) => r.type === t));
  return (
    <Card>
      <CardHeader icon={FileBarChart2} title={`Financial reports · ${periodLabel(m.period)}`} subtitle={`Agreed reports: ${w.service.reports.join(", ")}`} />
      <p className="mx-5 mb-3 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-muted ring-1 ring-line sm:mx-6">Run each report in the client&rsquo;s QuickBooks company, save it as a PDF and upload it here. The client can&rsquo;t see it until it&rsquo;s approved and you click <b>Make available</b> or <b>Deliver</b> — Deliver also emails them that their reports are ready.</p>
      {!canPrepare && !canDeliver && <p className="mx-5 mb-3 text-[12.5px] text-muted sm:mx-6">Reports are prepared during MKB Final Review.</p>}
      <ul className="divide-y divide-line border-t border-line">
        {m.reports.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-svc-books-soft text-svc-books"><FileText size={17} /></span>
            <div className="min-w-0 flex-1 basis-[50%] sm:basis-auto">
              <div className="text-[14px] font-semibold text-ink">{r.type}</div>
              <div className="text-[12px] text-muted">{periodLabel(r.period)} · {r.preparedAt ? `prepared ${fmtDate(r.preparedAt)}` : "not prepared"}{r.approvedBy && r.review === "approved" ? ` · approved by ${staffById(r.approvedBy).name}` : ""}{r.deliveredAt ? ` · delivered ${fmtDate(r.deliveredAt)}` : ""}</div>
            </div>
            <Badge tone={REVIEW_META[r.review].tone}>{REVIEW_META[r.review].label}</Badge>
            <Badge tone={DELIVERY_META[r.delivery].tone}>{DELIVERY_META[r.delivery].label}</Badge>
            <div className="flex flex-wrap gap-1.5">
              {(r.review === "not_started" || r.review === "preparing" || (r.delivery === "not_delivered" && r.docId)) && (
                <label className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ${canPrepare ? "cursor-pointer border border-line bg-surface text-ink-2 hover:bg-surface-hover" : "pointer-events-none border border-line text-faint opacity-50"}`} title={canPrepare ? "Upload the report PDF" : "Reports are uploaded during MKB Final Review"}>
                  <Upload size={14} />{r.docId ? "Replace file" : "Upload report"}
                  <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="sr-only" disabled={!canPrepare} aria-label={`Upload ${r.type}`} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; books.prepareReport(w.id, m.id, r.id, f); toast(r.docId ? `${r.type} replaced` : `${r.type} uploaded — ready for review`); e.target.value = ""; }} />
                </label>
              )}
              {r.review === "in_review" && <Button size="sm" variant="primary" icon={ShieldCheck} disabled={BACKEND && !r.docId} title={BACKEND && !r.docId ? "Upload the report file first" : undefined} onClick={() => { books.approveReport(w.id, m.id, r.id); toast(`${r.type} approved`); }}>Approve</Button>}
              {r.review === "approved" && r.delivery === "not_delivered" && <Button size="sm" disabled={!canDeliver} onClick={() => { books.publishReport(w.id, m.id, r.id, "available"); toast("Available in client portal"); }}>Make available</Button>}
              {r.review === "approved" && r.delivery !== "delivered" && <Button size="sm" variant="primary" icon={Send} disabled={!canDeliver} onClick={() => { books.publishReport(w.id, m.id, r.id, "delivered"); toast(`${r.type} delivered`); }}>Deliver</Button>}
              {r.docId && <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${r.type}`} onClick={() => { const d = c.documents.find((x) => x.id === r.docId); if (d) downloadDoc(c.id, d, `${w.businessName} ${r.type} ${r.period}`); }} />}
            </div>
          </li>
        ))}
      </ul>
      {available.length > 0 && m.stage !== "Month Closed" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-4 sm:px-6">
          <select aria-label="Add report" value={add} onChange={(e) => setAdd(e.target.value as ReportType)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2">
            <option value="">Add another agreed report…</option>
            {available.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button icon={Plus} disabled={!add} onClick={() => { books.addReport(w.id, m.id, add as ReportType); toast(`Added ${add}`); setAdd(""); }}>Add</Button>
          <span className="text-[12px] text-muted">{c.name} sees reports once they&rsquo;re made available or delivered.</span>
        </div>
      )}
    </Card>
  );
}

/* ================================================================== */

function DocsTab({ w, c, m, open }: { w: BooksWorkspace; c: Client; m: BooksMonth; open: (d: Dlg) => void }) {
  const books = useBooks();
  const clientStore = useClients();
  const toast = useToast();
  const [scope, setScope] = useState<"month" | "all">("month");
  const [cat, setCat] = useState("all");
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const docs = workspaceDocs(w, c).filter((d) => (scope === "all" || d.period === m.period) && (cat === "all" || d.category === cat)).sort((a, b) => (b.uploadedAt ?? b.requestedAt).localeCompare(a.uploadedAt ?? a.requestedAt));
  const cats = useMemo(() => [...new Set(workspaceDocs(w, c).map((d) => d.category))], [w, c]);
  const msgs = workspaceMessages(w, c);
  const statusTone = { requested: "warning", received: "info", reviewed: "success", rejected: "danger" } as const;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          icon={FolderOpen}
          title="Documents"
          subtitle="Statements, receipts and supporting files — stored on the client profile, tagged to this business"
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={FilePlus2} onClick={() => open("request")}>Request</Button>
              <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl bg-accent px-3 text-[13px] font-semibold text-white hover:bg-accent-hover">
                <UploadCloud size={15} /> Upload
                <input type="file" className="sr-only" aria-label="Upload document" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; clientStore.uploadDocument(c.id, { name: f.name.replace(/\.[^.]+$/, ""), service: "books", category: "Supporting document", sensitive: false, sizeKb: Math.max(1, Math.round(f.size / 1024)), workspaceId: w.id, period: m.period, file: f }); toast(`Uploaded "${f.name}"`); e.target.value = ""; }} />
              </label>
            </div>
          }
        />
        <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6">
          {(
            [
              ["month", periodLabel(m.period)],
              ["all", "All months"],
            ] as const
          ).map(([k, l]) => <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${scope === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>{l}</button>)}
          <select aria-label="Document category" value={cat} onChange={(e) => setCat(e.target.value)} className="h-8 rounded-full border border-line bg-surface px-2.5 text-[12.5px] text-ink-2">
            <option value="all">All categories</option>
            {cats.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {docs.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No documents in this view.</li>}
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${d.status === "requested" ? "border-2 border-dashed border-line-strong text-faint" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}><FileText size={16} /></span>
              <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                <div className="text-[13.5px] font-medium text-ink">{d.name}</div>
                <div className="text-[12px] text-muted">{d.category} · {d.period ? periodLabel(d.period, true) : ""} · {d.uploadedAt ? `${d.uploadedBy === "staff" ? "MKB" : "client"} · ${relTime(d.uploadedAt)}${d.sizeKb ? ` · ${fileSize(d.sizeKb)}` : ""}` : `requested ${relTime(d.requestedAt)}`}</div>
              </div>
              <Badge tone={statusTone[d.status]}>{d.status === "requested" ? "Requested" : d.status === "reviewed" ? "Reviewed" : d.status === "rejected" ? "Re-upload" : "Received"}</Badge>
              {d.status === "requested" ? <Button size="sm" variant="ghost" icon={Send} onClick={() => { clientStore.remindDocument(c.id, d.id); toast("Reminder sent"); }}>Remind</Button> : <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${d.name}`} onClick={() => { if (!BACKEND) clientStore.logDocumentAccess(c.id, d.id, "Downloaded"); downloadDoc(c.id, d); }} />}
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader icon={MessageSquare} title="Messages" subtitle="Visible to the client in their portal" action={<Badge tone="info" icon={Eye}>Client can see</Badge>} />
          <div className="scrollbar-thin max-h-[360px] space-y-2.5 overflow-y-auto border-y border-line bg-surface-2 px-4 py-3 sm:px-5">
            {msgs.length === 0 && <p className="py-4 text-center text-[13px] text-muted">No messages for this business yet.</p>}
            {msgs.map((x) => (
              <div key={x.id} className={`flex ${x.from === "staff" ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13.5px] ${x.from === "staff" ? "rounded-tr-md bg-accent text-white" : "rounded-tl-md border border-line bg-surface text-ink"}`}>
                  {x.body}
                  <div className={`mt-0.5 text-[11px] ${x.from === "staff" ? "text-white/80" : "text-muted"}`}>{x.author} · {fmtDateTime(x.at)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 p-4 sm:px-5">
            <input aria-label="Message to client" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={`Message ${c.contactName ?? c.name}…`} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
            <Button variant="primary" icon={Send} disabled={!msg.trim()} onClick={() => { clientStore.sendMessage(c.id, msg.trim(), "books", { workspaceId: w.id, author: staffById(w.bookkeeperId).name }); setMsg(""); toast("Message sent to client"); }}>Send</Button>
          </div>
        </Card>
        <Card>
          <CardHeader icon={Lock} title="Internal notes" subtitle="MKB only — never shown to the client" action={<Badge tone="neutral" icon={Lock}>Internal</Badge>} />
          <div className="mx-5 mb-3 flex gap-2 sm:mx-6">
            <input aria-label="Internal note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-line-strong bg-surface-2 px-3 text-[14px] text-ink" />
            <Button disabled={!note.trim()} onClick={() => { books.addNote(w.id, note.trim()); setNote(""); toast("Internal note added"); }}>Add</Button>
          </div>
          <ul className="space-y-2 px-5 pb-5 sm:px-6">
            {w.notes.map((n) => (
              <li key={n.id} className={`rounded-xl border border-dashed p-3 text-[13.5px] ${n.pinned ? "border-warning/40 bg-warning-soft/50" : "border-line-strong bg-surface-2"}`}>
                <div className="flex items-start gap-2"><p className="flex-1 text-ink-2">{n.body}</p><button aria-label={n.pinned ? "Unpin note" : "Pin note"} onClick={() => books.togglePin(w.id, n.id)} className="text-muted hover:text-ink"><Pin size={14} /></button></div>
                <p className="mt-1 text-[12px] text-muted">{staffById(n.authorId).name} · {relTime(n.at)}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Communication history" subtitle="Requests, reminders, responses and uploads" />
          <Timeline items={w.activity.filter((a) => a.kind === "message" || a.kind === "upload" || a.actor === "client").slice(0, 8)} />
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== */

function BillingTab({ w, c, open }: { w: BooksWorkspace; c: Client; open: (d: Dlg) => void }) {
  const books = useBooks();
  const toast = useToast();
  const invoices = workspaceInvoices(w, c).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const billed = invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + i.amount, 0);
  const paid = invoices.reduce((s, i) => s + i.paid, 0);
  const pending = w.extras.filter((x) => !x.invoiced);
  const latest = [...w.months].sort((a, b) => b.period.localeCompare(a.period))[0];
  const nextToBill = invoices.some((i) => i.description.includes(periodLabel(latest.period))) ? undefined : latest.period;
  const statusTone = { paid: "success", open: "info", overdue: "danger", partial: "warning", draft: "neutral", void: "neutral" } as const;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Monthly fee", usd(w.service.monthlyFee), "text-ink"],
            ["Billed to date", usd(billed), "text-ink"],
            ["Paid", usd(paid), "text-success-ink"],
            ["Balance due", usd(billed - paid), billed - paid > 0 ? "text-danger-ink" : "text-faint"],
          ] as const
        ).map(([l, v, cls]) => (
          <div key={l} className="rounded-2xl border border-line bg-surface p-4 shadow-soft"><div className="text-[12px] text-muted">{l}</div><div className={`mt-0.5 text-[19px] font-bold tabular-nums ${cls}`}>{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader icon={Receipt} title="Bookkeeping service" />
            <div className="space-y-2 px-5 pb-5 text-[13.5px] sm:px-6">
              <p className="font-semibold text-ink">{w.service.plan} — {usd(w.service.monthlyFee)}/month</p>
              <ul className="space-y-1 text-ink-2">{w.service.includes.map((x) => <li key={x} className="flex items-start gap-1.5"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" /> {x}</li>)}</ul>
            </div>
          </Card>
          <Card>
            <CardHeader title="Additional service charges" action={<Button size="sm" icon={Plus} onClick={() => open("extra")}>Add charge</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {w.extras.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No additional charges.</li>}
              {w.extras.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
                  <span className="min-w-0 flex-1 text-[13.5px] text-ink">{x.label}<span className="block text-[12px] text-muted">{periodLabel(x.period, true)}</span></span>
                  <Badge tone={x.invoiced ? "success" : "warning"}>{x.invoiced ? "Invoiced" : "Not invoiced"}</Badge>
                  <span className="w-20 text-right font-semibold tabular-nums">{usd(x.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card>
          <CardHeader
            icon={CreditCard}
            title="Billing history"
            subtitle="Invoices live on the client record"
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={CreditCard} disabled={billed - paid <= 0} onClick={() => open("payment")}>Record payment</Button>
                <Button size="sm" variant="primary" icon={Receipt} disabled={!nextToBill && pending.length === 0} onClick={() => { const n = books.invoiceMonth(w.id, nextToBill ?? null, true); toast(`${n} sent`); }}>{nextToBill ? `Invoice ${periodLabel(nextToBill, true)}` : `Invoice charges`}</Button>
              </div>
            }
          />
          {pending.length > 0 && <p className="mx-5 mb-3 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink sm:mx-6">{pending.length} additional charge(s) will be added to the next invoice.</p>}
          <ul className="divide-y divide-line border-t border-line">
            {invoices.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-ink tabular-nums">{i.number}</span><span className="block truncate text-[12px] text-muted">{i.description} · due {fmtDate(i.dueAt)}</span></span>
                <Badge tone={statusTone[i.status]}>{i.status === "paid" ? "Paid" : i.status === "overdue" ? "Overdue" : i.status === "partial" ? "Partially paid" : i.status === "draft" ? "Draft" : "Open"}</Badge>
                <span className="w-24 text-right tabular-nums"><span className="block text-[13.5px] font-semibold text-ink">{usd(i.amount)}</span><span className="block text-[11px] text-muted">{i.amount - i.paid > 0 ? `${usd(i.amount - i.paid)} due` : "paid"}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
