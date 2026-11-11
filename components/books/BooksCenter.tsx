"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus, AlertTriangle, BarChart3, Building2, CalendarCheck2, ClipboardCheck, FileBarChart2, Hourglass, Inbox, LayoutGrid, ListChecks, MessageCircleQuestion, RotateCcw, Scale, Search, Users, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { staffList, SAMPLE_NOW, staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { balanceDue, currentMonth, nextAction, openTasks, useBooks } from "@/lib/store/books-store";
import { MONTH_STAGES, REVIEW_KIND, closeTarget, periodEnd, periodLabel, type BooksMonth, type BooksWorkspace } from "@/lib/books/config";
import { fmtDate, usd } from "@/lib/format";
import type { Client } from "@/lib/types";
import { STAGE_META } from "@/lib/books/config";
import { DELIVERY_META, OwnerBadge, QboBadge, RECON_META, REVIEW_META, StageBadge, TURN, TurnLegend, money } from "./BooksBits";
import { StartWorkspace } from "./StartWorkspace";
import { IntakesCard } from "./IntakesCard";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND } from "@/lib/sync/remote";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "clients", label: "Clients", icon: Users },
  { key: "review", label: "Review & reconciliation", icon: Scale },
  { key: "reports", label: "Reports", icon: FileBarChart2 },
] as const;
type Tab = (typeof TABS)[number]["key"];
export const wsHref = (w: BooksWorkspace, m?: BooksMonth, tab = "close") => `/services/bookkeeping/${w.id}${m ? `?month=${m.period}` : ""}#${tab}`;

export function BooksCenter() {
  const books = useBooks();
  const clientStore = useClients();
  const toast = useToast();
  const team = useTeam();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const canCreate = team.can("books", "create");
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === h)) setTab(h);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };
  const byId = useMemo(() => new Map(clientStore.clients.map((c) => [c.id, c])), [clientStore.clients]);

  return (
    <>
      <PageHeader
        title="Bookkeeping"
        subtitle="Clients keep their own QuickBooks. MKB reviews, reconciles, reports and closes each month."
        crumbs={[{ label: "Services" }, { label: "Bookkeeping" }]}
        actions={
          <div className="flex gap-2">
            {canCreate && <Button variant="primary" icon={Plus} onClick={() => setStarting(true)}>Start bookkeeping</Button>}
            {!BACKEND && <Button variant="ghost" icon={RotateCcw} aria-label="Reset sample data" title="Reset sample data" className="px-2.5" onClick={() => { if (confirm("Reset bookkeeping and client sample data?")) { books.reset(); clientStore.reset(); toast("Sample data reset"); } }} />}
          </div>
        }
      />
      <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Bookkeeping" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <IntakesCard />
      {starting && <StartWorkspace open onClose={() => setStarting(false)} onCreated={(id) => { setStarting(false); router.push(`/services/bookkeeping/${id}`); }} />}
      {!books.ready ? (
        <div className="grid min-h-[30vh] place-items-center text-[14px] text-muted" role="status">Loading…</div>
      ) : !books.workspaces.length ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
          <BarChart3 size={32} className="mx-auto text-accent" />
          <h2 className="mt-3 text-[18px] font-bold text-ink">No bookkeeping clients yet</h2>
          <p className="mt-2 text-[14px] text-muted">Start a workspace for a client business to track each month&rsquo;s review, reconciliations, reports and close.</p>
          {canCreate && <Button variant="primary" className="mt-5" icon={Plus} onClick={() => setStarting(true)}>Start bookkeeping</Button>}
        </div>
      ) : (<>
      {tab === "overview" && <Overview byId={byId} go={go} />}
      {tab === "clients" && <ClientsTab byId={byId} />}
      {tab === "review" && <ReviewCenter byId={byId} />}
      {tab === "reports" && <ReportCenter byId={byId} />}
      </>)}
    </>
  );
}

/* ================================================================== */

const ended = (m: BooksMonth) => new Date(periodEnd(m.period)) < SAMPLE_NOW;

function Overview({ byId, go }: { byId: Map<string, Client>; go: (t: Tab) => void }) {
  const { workspaces } = useBooks();
  const router = useRouter();
  const [owner, setOwner] = useState<"all" | "Client" | "MKB">("all");
  const [staff, setStaff] = useState("all");
  const [includeCurrent, setIncludeCurrent] = useState(false);

  const all = workspaces.flatMap((w) => w.months.map((m) => ({ w, m })));
  const open = all.filter(({ m }) => m.stage !== "Month Closed");
  const kpi = {
    clients: new Set(workspaces.map((w) => w.clientId)).size,
    businesses: workspaces.length,
    awaitingClient: open.filter(({ m }) => m.stage === "Waiting on Client Items" && ended(m)).length,
    awaitingReview: open.filter(({ m }) => m.stage === "Ready for MKB Review").length,
    recons: open.reduce((s, { m }) => s + m.recons.filter((r) => r.status === "in_progress" || r.status === "discrepancy").length, 0),
    questions: workspaces.reduce((s, w) => s + w.tasks.filter((t) => t.status === "open" && (t.reviewItemId || t.requestDocId)).length, 0),
    reportsReady: all.reduce((s, { m }) => s + m.reports.filter((r) => r.review === "approved" && r.delivery !== "delivered").length, 0),
    closed: all.filter(({ m }) => m.stage === "Month Closed" && m.period.startsWith("2026")).length,
  };
  const cards: { label: string; value: number | string; icon: LucideIcon; onClick: () => void; sub?: string }[] = [
    { label: "Active bookkeeping clients", value: kpi.clients, sub: `${kpi.businesses} businesses`, icon: Building2, onClick: () => go("clients") },
    { label: "Awaiting client submission", value: kpi.awaitingClient, icon: Hourglass, onClick: () => setOwner("Client") },
    { label: "Awaiting MKB review", value: kpi.awaitingReview, icon: Inbox, onClick: () => setOwner("MKB") },
    { label: "Reconciliations in progress", value: kpi.recons, icon: Scale, onClick: () => go("review") },
    { label: "Open client questions", value: kpi.questions, icon: MessageCircleQuestion, onClick: () => setOwner("Client") },
    { label: "Reports ready to deliver", value: kpi.reportsReady, icon: FileBarChart2, onClick: () => go("reports") },
    { label: "Months closed (2026)", value: kpi.closed, icon: CalendarCheck2, onClick: () => go("clients") },
  ];

  const queue = open
    .filter(({ m }) => includeCurrent || ended(m) || m.stage !== "Waiting on Client Items")
    .map((x) => ({ ...x, next: nextAction(x.w, x.m) }))
    .filter((x) => owner === "all" || x.next.owner === owner)
    .filter((x) => staff === "all" || x.m.assignedTo === staff)
    .sort((a, b) => a.m.period.localeCompare(b.m.period) || (a.next.owner === "MKB" ? -1 : 1));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {cards.map((k) => (
          <button key={k.label} onClick={k.onClick} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-svc-books-soft text-svc-books"><k.icon size={17} /></span>
            <span className="min-w-0">
              <span className="block text-[19px] font-bold leading-tight text-ink tabular-nums">{k.value}</span>
              <span className="block text-[12px] leading-tight text-muted">{k.label}</span>
              {k.sub && <span className="block text-[11px] text-faint">{k.sub}</span>}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader icon={ListChecks} title="Work queue" subtitle="Every open month, its next action, and who is responsible" />
        <TurnLegend className="px-5 pb-3 sm:px-6" />
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3 sm:px-6">
          <div role="radiogroup" aria-label="Responsible" className="flex rounded-xl border border-line bg-surface-2 p-0.5">
            {(["all", "MKB", "Client"] as const).map((o) => (
              <button key={o} role="radio" aria-checked={owner === o} onClick={() => setOwner(o)} className={`h-8 rounded-lg px-3 text-[13px] font-medium ${owner === o ? "bg-surface text-accent shadow-soft" : "text-muted hover:text-ink"}`}>{o === "all" ? "Everyone" : o === "MKB" ? "MKB's turn" : "Client's turn"}</button>
            ))}
          </div>
          <select aria-label="Bookkeeper" value={staff} onChange={(e) => setStaff(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-2.5 text-[13px] font-medium text-ink-2">
            <option value="all">All bookkeepers</option>
            {staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" checked={includeCurrent} onChange={() => setIncludeCurrent((v) => !v)} className="accent-[var(--accent)]" /> Include current month in progress</label>
          <span className="ml-auto text-[12.5px] text-muted">{queue.length} item{queue.length === 1 ? "" : "s"}</span>
        </div>
        {queue.length === 0 ? (
          <p className="border-t border-line px-6 py-8 text-center text-[13.5px] text-muted">Nothing in this view.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-[13.5px]">
                <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                  <tr><th className="px-5 py-2.5">Business</th><th className="px-3 py-2.5">Month</th><th className="px-3 py-2.5">Stage</th><th className="px-3 py-2.5">Next action</th><th className="px-3 py-2.5">Responsible</th><th className="px-3 py-2.5">Assigned</th><th className="px-5 py-2.5">Close target</th></tr>
                </thead>
                <tbody>
                  {queue.map(({ w, m, next }) => {
                    const late = new Date(closeTarget(m.period)) < SAMPLE_NOW;
                    return (
                      <tr key={m.id} onClick={() => router.push(wsHref(w, m))} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover">
                        <td className="px-5 py-3"><Link href={wsHref(w, m)} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-accent">{w.businessName}</Link><div className="text-[12px] text-muted">{byId.get(w.clientId)?.name}</div></td>
                        <td className="px-3 py-3 font-medium text-ink tabular-nums">{periodLabel(m.period, true)}</td>
                        <td className="px-3 py-3"><StageBadge stage={m.stage} /></td>
                        <td className="px-3 py-3 text-ink-2">{next.text}</td>
                        <td className="px-3 py-3"><OwnerBadge owner={next.owner} /></td>
                        <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><Avatar name={staffById(m.assignedTo).name} size={22} /> <span className="text-[12.5px]">{staffById(m.assignedTo).name.split(" ")[0]}</span></span></td>
                        <td className="px-5 py-3">{late ? <Badge tone="danger" icon={AlertTriangle}>{fmtDate(closeTarget(m.period), { month: "short", day: "numeric" })}</Badge> : <span className="text-[12.5px] text-ink-2">{fmtDate(closeTarget(m.period), { month: "short", day: "numeric" })}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line border-t border-line lg:hidden">
              {queue.map(({ w, m, next }) => (
                <li key={m.id}>
                  <Link href={wsHref(w, m)} className="block px-4 py-3.5 hover:bg-surface-hover">
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-ink">{w.businessName}</span>
                        <span className="block text-[12.5px] text-muted">{periodLabel(m.period)} · {staffById(m.assignedTo).name}</span>
                      </span>
                      <OwnerBadge owner={next.owner} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5"><StageBadge stage={m.stage} /></div>
                    <p className="mt-1.5 text-[13px] text-ink-2">{next.text}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <CardHeader icon={BarChart3} title="Months by stage" subtitle="All open and closed months on file" />
        <ul className="space-y-1.5 px-5 pb-5 sm:px-6">
          {MONTH_STAGES.map((s) => {
            const n = all.filter(({ m }) => m.stage === s).length;
            const max = Math.max(1, ...MONTH_STAGES.map((x) => all.filter(({ m }) => m.stage === x).length));
            return (
              <li key={s} className="grid grid-cols-[150px_minmax(0,1fr)_28px] items-center gap-3 sm:grid-cols-[210px_minmax(0,1fr)_28px]">
                <span className="truncate text-[13px] text-ink-2">{s}</span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line"><span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, minWidth: n ? 6 : 0, background: TURN[STAGE_META[s].owner].bar }} /></span>
                <span className="text-right text-[13px] font-semibold text-ink tabular-nums">{n}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ================================================================== */

function ClientsTab({ byId }: { byId: Map<string, Client> }) {
  const { workspaces } = useBooks();
  const [q, setQ] = useState("");
  const [qbo, setQbo] = useState("all");
  const rows = workspaces.filter((w) => (!q.trim() || [w.businessName, byId.get(w.clientId)?.name ?? "", w.qbo.companyName].some((f) => f.toLowerCase().includes(q.trim().toLowerCase()))) && (qbo === "all" || w.qbo.status === qbo));
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-soft">
      <div className="flex flex-wrap items-center gap-2 p-4 sm:px-5">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search businesses</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business, client or QuickBooks company…" className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
        </label>
        <select aria-label="QuickBooks status" value={qbo} onChange={(e) => setQbo(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] font-medium text-ink-2">
          <option value="all">Any QuickBooks status</option><option value="connected">Connected</option><option value="needs_reauth">Reauthorization needed</option><option value="invite_pending">Invite pending</option><option value="not_connected">Not connected</option>
        </select>
        {(q || qbo !== "all") && <button onClick={() => { setQ(""); setQbo("all"); }} className="inline-flex h-10 items-center gap-1 px-2 text-[12.5px] font-semibold text-accent"><X size={13} /> Clear</button>}
      </div>
      <ul className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
        {rows.map((w) => {
          const c = byId.get(w.clientId);
          const m = currentMonth(w);
          const next = nextAction(w, m);
          const bal = balanceDue(w, c);
          const others = workspaces.filter((x) => x.clientId === w.clientId).length;
          return (
            <li key={w.id}>
              <Link href={wsHref(w)} className="block h-full rounded-2xl border border-line p-4 transition hover:border-accent/50 hover:shadow-pop">
                <div className="flex items-start gap-3">
                  <Avatar name={w.businessName} size={40} square />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{w.businessName}</span>
                    <span className="block truncate text-[12.5px] text-muted">{c?.name}{others > 1 ? ` · ${others} businesses` : ""} · {staffById(w.bookkeeperId).name}</span>
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5"><QboBadge status={w.qbo.status} /></div>
                <div className="mt-3 rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                  <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-semibold text-ink">{periodLabel(m.period)}</span><OwnerBadge owner={next.owner} /></div>
                  <div className="mt-1.5"><StageBadge stage={m.stage} /></div>
                  <p className="mt-1.5 text-[12.5px] text-ink-2">{next.text}</p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
                  <span>{openTasks(w).length} open client task{openTasks(w).length === 1 ? "" : "s"}</span>
                  <span className={bal > 0 ? "font-semibold text-danger-ink" : ""}>{bal > 0 ? `${usd(bal)} due` : `${usd(w.service.monthlyFee)}/mo`}</span>
                </div>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-8 text-center text-[13.5px] text-muted sm:col-span-2 xl:col-span-3">No businesses match.</li>}
      </ul>
    </section>
  );
}

/* ================================================================== */

function ReviewCenter({ byId }: { byId: Map<string, Client> }) {
  const books = useBooks();
  const toast = useToast();
  const [status, setStatus] = useState<"active" | "open" | "sent_to_client" | "client_responded" | "resolved">("active");
  const [assignee, setAssignee] = useState("all");
  const [reconFilter, setReconFilter] = useState<"open" | "all">("open");
  const items = books.workspaces
    .flatMap((w) => w.months.flatMap((m) => m.reviewItems.map((r) => ({ w, m, r }))))
    .filter(({ r }) => (status === "active" ? r.status !== "resolved" : r.status === status))
    .filter(({ r }) => assignee === "all" || r.assignedTo === assignee);
  const recons = books.workspaces
    .flatMap((w) => w.months.filter((m) => m.stage !== "Month Closed" && ended(m)).flatMap((m) => m.recons.map((r) => ({ w, m, r, a: w.accounts.find((x) => x.id === r.accountId)! }))))
    .filter(({ r }) => reconFilter === "all" || r.status !== "reconciled");
  const statusLabel = { open: "Open", sent_to_client: "Sent to client", client_responded: "Client responded", resolved: "Resolved" } as const;
  const statusTone = { open: "warning", sent_to_client: "info", client_responded: "info", resolved: "success" } as const;

  return (
    <div className="space-y-5">
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3.5 py-2 text-[12.5px] text-muted"><ClipboardCheck size={14} /> MKB-only workspace. Tracks review and reconciliation progress — transactions are corrected in QuickBooks, not here.</p>
      <Card>
        <CardHeader icon={MessageCircleQuestion} title="Review items" subtitle="Uncategorized, unusual and questionable transactions across all clients" />
        <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6">
          <select aria-label="Review item status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 rounded-xl border border-line bg-surface px-2.5 text-[13px] font-medium text-ink-2">
            <option value="active">All unresolved</option><option value="open">Open (MKB)</option><option value="sent_to_client">Sent to client</option><option value="client_responded">Client responded</option><option value="resolved">Resolved</option>
          </select>
          <select aria-label="Assigned to" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-2.5 text-[13px] font-medium text-ink-2">
            <option value="all">Anyone</option>{staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {items.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No review items in this view.</li>}
          {items.map(({ w, m, r }) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
                <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-semibold text-ink">{r.txnRef}</span>{r.amount != null && <span className="text-[13px] text-ink-2 tabular-nums">{money(r.amount)}</span>}</div>
                <div className="text-[12.5px] text-muted"><Link href={wsHref(w, m, "review")} className="font-medium text-accent hover:underline">{w.businessName}</Link> · {periodLabel(m.period, true)} · {REVIEW_KIND[r.kind]}</div>
                <div className="text-[12.5px] text-ink-2">{r.description}</div>
                {r.clientResponse && <div className="mt-0.5 text-[12.5px] text-accent-ink">Client: {r.clientResponse}</div>}
              </div>
              <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
              <select aria-label={`Assign ${r.txnRef}`} value={r.assignedTo} onChange={(e) => { books.assignItem(w.id, m.id, r.id, e.target.value); toast(`Assigned to ${staffById(e.target.value).name}`); }} className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink-2">
                {staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button size="sm" href={wsHref(w, m, "review")}>Open</Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader icon={Scale} title="Bank & credit card reconciliations" subtitle="Months that have ended and aren't closed" action={<select aria-label="Reconciliation filter" value={reconFilter} onChange={(e) => setReconFilter(e.target.value as typeof reconFilter)} className="h-9 rounded-xl border border-line bg-surface px-2.5 text-[13px] font-medium text-ink-2"><option value="open">Not yet reconciled</option><option value="all">All</option></select>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13.5px]">
            <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-2.5">Account</th><th className="px-3 py-2.5">Month</th><th className="px-3 py-2.5">Statement date</th><th className="px-3 py-2.5 text-right">Ending balance</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Completed</th><th className="px-5 py-2.5" /></tr>
            </thead>
            <tbody>
              {recons.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-muted">Everything is reconciled.</td></tr>}
              {recons.map(({ w, m, r, a }) => (
                <tr key={`${m.id}-${r.accountId}`} className="border-b border-line last:border-0">
                  <td className="px-5 py-3"><div className="font-semibold text-ink">{a.name} ••{a.mask}</div><div className="text-[12px] text-muted">{w.businessName} · {a.kind === "bank" ? "Bank" : "Credit card"}</div></td>
                  <td className="px-3 py-3 tabular-nums">{periodLabel(m.period, true)}</td>
                  <td className="px-3 py-3">{r.statementDate ? fmtDate(r.statementDate) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(r.endingBalance)}{r.sample && !BACKEND && <span className="ml-1 text-[10.5px] text-faint">sample</span>}</td>
                  <td className="px-3 py-3"><Badge tone={RECON_META[r.status].tone}>{RECON_META[r.status].label}</Badge>{r.discrepancy && <div className="mt-0.5 text-[12px] text-danger-ink">{money(r.discrepancy.amount)} — {r.discrepancy.note}</div>}</td>
                  <td className="px-3 py-3 text-[12.5px]">{r.completedAt ? `${fmtDate(r.completedAt, { month: "short", day: "numeric" })} · ${staffById(r.by ?? m.assignedTo).name.split(" ")[0]}` : "—"}</td>
                  <td className="px-5 py-3 text-right"><Button size="sm" href={wsHref(w, m, "review")}>Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== */

function ReportCenter({ byId }: { byId: Map<string, Client> }) {
  const { workspaces } = useBooks();
  const [view, setView] = useState<"ready" | "progress" | "delivered" | "all">("ready");
  const rows = workspaces
    .flatMap((w) => w.months.flatMap((m) => m.reports.map((r) => ({ w, m, r }))))
    .filter(({ r }) => (view === "all" ? true : view === "ready" ? r.review === "approved" && r.delivery !== "delivered" : view === "delivered" ? r.delivery === "delivered" : r.review === "preparing" || r.review === "in_review"))
    .sort((a, b) => b.m.period.localeCompare(a.m.period));
  return (
    <Card>
      <CardHeader icon={FileBarChart2} title="Report center" subtitle="Reports are prepared from each client's QuickBooks company. Status tracking only — no figures are shown here." />
      <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6">
        {(
          [
            ["ready", "Ready to deliver"],
            ["progress", "In preparation / review"],
            ["delivered", "Delivered"],
            ["all", "All"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} aria-pressed={view === k} onClick={() => setView(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${view === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>{l}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13.5px]">
          <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <tr><th className="px-5 py-2.5">Report</th><th className="px-3 py-2.5">Business</th><th className="px-3 py-2.5">Period</th><th className="px-3 py-2.5">Prepared</th><th className="px-3 py-2.5">Review</th><th className="px-3 py-2.5">Delivery</th><th className="px-5 py-2.5" /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-muted">No reports in this view.</td></tr>}
            {rows.map(({ w, m, r }) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-semibold text-ink">{r.type}</td>
                <td className="px-3 py-3"><div className="text-ink">{w.businessName}</div><div className="text-[12px] text-muted">{byId.get(w.clientId)?.name}</div></td>
                <td className="px-3 py-3 tabular-nums">{periodLabel(r.period, true)}</td>
                <td className="px-3 py-3 text-[12.5px]">{r.preparedAt ? fmtDate(r.preparedAt) : "—"}</td>
                <td className="px-3 py-3"><Badge tone={REVIEW_META[r.review].tone}>{REVIEW_META[r.review].label}</Badge></td>
                <td className="px-3 py-3"><Badge tone={DELIVERY_META[r.delivery].tone}>{DELIVERY_META[r.delivery].label}</Badge></td>
                <td className="px-5 py-3 text-right"><Button size="sm" href={wsHref(w, m, "reports")}>Open</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
