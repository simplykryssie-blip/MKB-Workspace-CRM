"use client";

import Link from "next/link";
import { Form8821Tab } from "./Form8821Tab";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CircleDollarSign,
  Columns3,
  CreditCard,
  FileWarning,
  FolderClock,
  Hourglass,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Tags,
  Trash2,
  User,
  Users,
  X,
  XCircle,
  type LucideIcon,
  FileSignature,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { PaymentDialog } from "@/components/crm/dialogs";
import { STAFF, staffById, staffList } from "@/lib/sample/clients";
import { TAX_YEARS } from "@/lib/sample/tax";
import { useClients } from "@/lib/store/clients-store";
import { billing, effectiveDue, isPastDue, itemStatus, outstandingItems, useTax } from "@/lib/store/tax-store";
import { BUSINESS_FORMS, INDIVIDUAL_FORMS, RETURN_STATUSES, STATUS_META, priceTotal, type ReturnStatus, type TaxReturn } from "@/lib/tax/config";
import { fmtDate, relTime, usd } from "@/lib/format";
import type { Client } from "@/lib/types";
import { AccessPreviewBar, DueChip, NoAccess, ReturnStatusBadge, TaxYearSelect } from "./TaxBits";
import { AckDialog, NewReturnDialog } from "./TaxDialogs";

const TABS = [
  { key: "overview", label: "Dashboard", icon: LayoutGrid },
  { key: "returns", label: "Returns", icon: List },
  { key: "documents", label: "Missing documents", icon: FileWarning },
  { key: "efile", label: "E-file", icon: Send },
  { key: "f8821", label: "Form 8821", icon: FileSignature },
  { key: "billing", label: "Billing", icon: CircleDollarSign },
  { key: "fees", label: "Fee schedule", icon: Tags },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Filters = { q: string; status: ReturnStatus | "all" | "attention"; kind: "all" | "individual" | "business"; form: string; preparer: string; reviewer: string };
const EMPTY: Filters = { q: "", status: "all", kind: "all", form: "all", preparer: "all", reviewer: "all" };

export function TaxCenter() {
  const tax = useTax();
  const clientStore = useClients();
  const { clients } = clientStore;
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [year, setYear] = useState<number | "all">(2025);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [newOpen, setNewOpen] = useState<{ clientId?: string } | null>(null);

  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === h)) setTab(h);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const inYear = useMemo(() => tax.returns.filter((r) => year === "all" || r.taxYear === year), [tax.returns, year]);
  const openFiltered = (f: Partial<Filters>) => {
    setFilters({ ...EMPTY, ...f });
    go("returns");
  };

  // Clients enrolled in Tax Preparation for this year without a return yet.
  const unlinked = useMemo(
    () =>
      clients.flatMap((c) =>
        c.enrollments
          .filter((e) => e.service === "tax" && e.status !== "complete" && !tax.returns.some((r) => r.enrollmentId === e.id) && (year === "all" || e.title.startsWith(String(year)) || !/^20\d\d/.test(e.title)))
          .map((e) => ({ c, e })),
      ),
    [clients, tax.returns, year],
  );

  return (
    <>
      <PageHeader
        title="Tax Preparation Center"
        subtitle="Individual and business returns — linked to each client's central profile."
        crumbs={[{ label: "Services" }, { label: "Tax Preparation" }]}
        actions={
          <>
            <TaxYearSelect value={year} onChange={setYear} years={TAX_YEARS} allowAll />
            <Button variant="ghost" icon={RotateCcw} aria-label="Reset sample data" title="Reset sample data" className="px-2.5" onClick={() => { if (confirm("Reset tax and client sample data?")) { tax.reset(); clientStore.reset(); toast("Sample data reset"); } }} />
            <Button variant="primary" icon={Plus} disabled={!tax.access.edit} onClick={() => setNewOpen({})}>New return</Button>
          </>
        }
      />
      <AccessPreviewBar />

      <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Tax Center" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <Overview returns={inYear} byId={byId} openFiltered={openFiltered} unlinked={unlinked} onCreateFor={(cid) => setNewOpen({ clientId: cid })} year={year} />}
      {tab === "returns" && <ReturnsTab returns={inYear} byId={byId} filters={filters} setFilters={setFilters} />}
      {tab === "documents" && <MissingDocs returns={inYear} byId={byId} />}
      {tab === "efile" && <EfileTab returns={inYear} byId={byId} />}
      {tab === "billing" && (tax.access.billing ? <BillingTab returns={inYear} byId={byId} /> : <NoAccess what="Tax billing" />)}
      {tab === "fees" && <FeeSchedule />}
      {tab === "f8821" && <Form8821Tab />}

      <NewReturnDialog open={!!newOpen} onClose={() => setNewOpen(null)} defaultYear={year === "all" ? 2026 : year} clientId={newOpen?.clientId} onCreated={(id) => { setNewOpen(null); router.push(`/services/tax-preparation/returns/${id}`); }} />
    </>
  );
}

/* ================================================================== */
/* Dashboard                                                           */
/* ================================================================== */

function Overview({ returns, byId, openFiltered, unlinked, onCreateFor, year }: { returns: TaxReturn[]; byId: Map<string, Client>; openFiltered: (f: Partial<Filters>) => void; unlinked: { c: Client; e: Client["enrollments"][number] }[]; onCreateFor: (cid: string) => void; year: number | "all" }) {
  const tax = useTax();
  const count = (st: ReturnStatus[]) => returns.filter((r) => st.includes(r.status)).length;
  const pastDue = returns.filter((r) => isPastDue(r));
  const balance = returns.reduce((s, r) => s + billing(r, byId.get(r.clientId)).balance, 0);
  const reviewQueue = returns.filter((r) => r.status === "In Preparation" && !r.reviewSignoff);

  const kpis: { label: string; value: string; icon: LucideIcon; tone?: string; onClick: () => void }[] = [
    { label: "Returns", value: String(returns.length), icon: BarChart3, onClick: () => openFiltered({}) },
    { label: "Waiting on client", value: String(count(["Awaiting Documents", "Awaiting Client Approval"])), icon: Hourglass, onClick: () => openFiltered({ status: "Awaiting Documents" }) },
    { label: "Ready to e-file", value: String(count(["Ready to E-file"])), icon: Send, onClick: () => openFiltered({ status: "Ready to E-file" }) },
    { label: "Rejected", value: String(count(["Rejected"])), icon: XCircle, tone: count(["Rejected"]) ? "text-danger-ink" : "", onClick: () => openFiltered({ status: "Rejected" }) },
    { label: "Past due", value: String(pastDue.length), icon: AlertTriangle, tone: pastDue.length ? "text-danger-ink" : "", onClick: () => openFiltered({ status: "attention" }) },
    { label: "Filed & accepted", value: String(count(["Accepted", "Completed"])), icon: ShieldAlert, onClick: () => openFiltered({ status: "Completed" }) },
    { label: "Outstanding balance", value: tax.access.billing ? usd(balance) : "—", icon: CircleDollarSign, onClick: () => openFiltered({}) },
  ];
  const max = Math.max(1, ...RETURN_STATUSES.map((s) => count([s])));

  const attention = [
    ...returns.filter((r) => r.status === "Rejected").map((r) => ({ r, why: `Rejected — ${r.efile.find((e) => e.result === "rejected")?.code ?? "see e-file"}`, tone: "danger" as const })),
    ...pastDue.filter((r) => r.status !== "Rejected").map((r) => ({ r, why: `Past due since ${fmtDate(effectiveDue(r)!, { month: "short", day: "numeric" })}`, tone: "danger" as const })),
    ...reviewQueue.map((r) => ({ r, why: `Needs reviewer sign-off (${staffById(r.reviewerId).name})`, tone: "warning" as const })),
    ...returns.filter((r) => r.status === "Awaiting Documents" && outstandingItems(r, byId.get(r.clientId)).length > 0).map((r) => ({ r, why: `${outstandingItems(r, byId.get(r.clientId)).length} documents outstanding`, tone: "warning" as const })),
  ];

  const upcoming = returns
    .filter((r) => !["Submitted", "Accepted", "Completed"].includes(r.status) && effectiveDue(r))
    .sort((a, b) => effectiveDue(a)!.localeCompare(effectiveDue(b)!))
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {kpis.map((k) => (
          <button key={k.label} onClick={k.onClick} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><k.icon size={17} /></span>
            <span className="min-w-0">
              <span className={`block text-[19px] font-bold leading-tight tabular-nums ${k.tone || "text-ink"}`}>{k.value}</span>
              <span className="block text-[12px] leading-tight text-muted">{k.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={BarChart3} title="Returns by status" subtitle={year === "all" ? "All tax years" : `Tax year ${year}`} />
          <ul className="space-y-1.5 px-5 pb-5 sm:px-6" aria-label="Returns by status">
            {RETURN_STATUSES.map((s) => {
              const n = count([s]);
              return (
                <li key={s}>
                  <button onClick={() => openFiltered({ status: s })} className="group grid w-full grid-cols-[150px_minmax(0,1fr)_28px] items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-surface-hover sm:grid-cols-[190px_minmax(0,1fr)_28px]" title={STATUS_META[s].hint}>
                    <span className="truncate text-[13px] text-ink-2">{s}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
                      <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: s === "Rejected" ? "var(--danger)" : "var(--accent)", minWidth: n ? 6 : 0 }} />
                    </span>
                    <span className="text-right text-[13px] font-semibold text-ink tabular-nums">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={AlertTriangle} title="Needs attention" subtitle={`${attention.length} item${attention.length === 1 ? "" : "s"}`} />
          <ul className="px-3 pb-3 sm:px-4">
            {attention.length === 0 && <li className="px-2 pb-3 text-[13.5px] text-muted">Nothing needs attention.</li>}
            {attention.slice(0, 8).map(({ r, why, tone }, i) => (
              <li key={`${r.id}-${i}`}>
                <Link href={`/services/tax-preparation/returns/${r.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                  <Avatar name={byId.get(r.clientId)?.name ?? "?"} size={32} square={r.kind === "business"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{byId.get(r.clientId)?.name} · TY {r.taxYear} {r.form}</span>
                    <span className={`block text-[12px] ${tone === "danger" ? "text-danger-ink" : "text-warning-ink"}`}>{why}</span>
                  </span>
                  <ReturnStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader icon={Users} title="Workload" subtitle="Open returns by preparer and review queue" />
          <table className="w-full text-[13px]">
            <thead className="border-y border-line bg-surface-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-2 text-left">Staff</th><th className="px-2 py-2 text-right">Preparing</th><th className="px-5 py-2 text-right">To review</th></tr>
            </thead>
            <tbody>
              {staffList().map((s) => {
                const prep = returns.filter((r) => r.preparerId === s.id && !["Accepted", "Completed"].includes(r.status)).length;
                const rev = returns.filter((r) => r.reviewerId === s.id && r.status === "In Preparation" && !r.reviewSignoff).length;
                return (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5"><span className="inline-flex items-center gap-2"><Avatar name={s.name} size={24} /> {s.name}</span></td>
                    <td className="px-2 py-2.5 text-right"><button onClick={() => openFiltered({ preparer: s.id })} className="font-semibold text-ink tabular-nums hover:text-accent">{prep}</button></td>
                    <td className="px-5 py-2.5 text-right"><button onClick={() => openFiltered({ reviewer: s.id, status: "In Preparation" })} className={`font-semibold tabular-nums hover:text-accent ${rev ? "text-warning-ink" : "text-faint"}`}>{rev}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader icon={FolderClock} title="Deadlines" subtitle="Open returns by due date" />
          <ul className="px-3 pb-3 sm:px-4">
            {upcoming.length === 0 && <li className="px-2 pb-3 text-[13.5px] text-muted">No open deadlines.</li>}
            {upcoming.map((r) => (
              <li key={r.id}>
                <Link href={`/services/tax-preparation/returns/${r.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-hover">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{byId.get(r.clientId)?.name}</span>
                    <span className="block text-[12px] text-muted">TY {r.taxYear} {r.form} · {r.status}</span>
                  </span>
                  <DueChip r={r} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={Plus} title="Needs a return" subtitle="Enrolled in Tax Preparation, no return set up" />
          <ul className="px-3 pb-3 sm:px-4">
            {unlinked.length === 0 && <li className="px-2 pb-3 text-[13.5px] text-muted">Every tax engagement has a return.</li>}
            {unlinked.map(({ c, e }) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar name={c.name} size={30} square={c.type === "business"} />
                <span className="min-w-0 flex-1">
                  <Link href={`/clients/${c.id}`} className="block truncate text-[13.5px] font-medium text-ink hover:text-accent">{c.name}</Link>
                  <span className="block truncate text-[12px] text-muted">{e.title}</span>
                </span>
                <Button size="sm" disabled={!tax.access.edit} onClick={() => onCreateFor(c.id)}>Create</Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Returns list / board                                                */
/* ================================================================== */

function ReturnsTab({ returns, byId, filters, setFilters }: { returns: TaxReturn[]; byId: Map<string, Client>; filters: Filters; setFilters: (f: Filters) => void }) {
  const tax = useTax();
  const router = useRouter();
  const [view, setView] = useState<"list" | "board">("list");
  const [sort, setSort] = useState<"due" | "name" | "updated" | "status">("due");
  const set = (p: Partial<Filters>) => setFilters({ ...filters, ...p });
  const on = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  const rows = useMemo(() => {
    const n = filters.q.trim().toLowerCase();
    return returns
      .filter((r) => {
        const c = byId.get(r.clientId);
        if (n && ![c?.name ?? "", r.form, String(r.taxYear), r.id, staffById(r.preparerId).name].some((f) => f.toLowerCase().includes(n))) return false;
        if (filters.status === "attention" ? !(r.status === "Rejected" || isPastDue(r)) : filters.status !== "all" && r.status !== filters.status) return false;
        if (filters.kind !== "all" && r.kind !== filters.kind) return false;
        if (filters.form !== "all" && r.form !== filters.form) return false;
        if (filters.preparer !== "all" && r.preparerId !== filters.preparer) return false;
        if (filters.reviewer !== "all" && r.reviewerId !== filters.reviewer) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return (byId.get(a.clientId)?.name ?? "").localeCompare(byId.get(b.clientId)?.name ?? "");
        if (sort === "status") return RETURN_STATUSES.indexOf(a.status) - RETURN_STATUSES.indexOf(b.status);
        if (sort === "updated") return (b.activity[0]?.at ?? "").localeCompare(a.activity[0]?.at ?? "");
        return (effectiveDue(a) ?? "9").localeCompare(effectiveDue(b) ?? "9");
      });
  }, [returns, byId, filters, sort]);

  const docs = (r: TaxReturn) => {
    const c = byId.get(r.clientId);
    const req = r.checklist.filter((i) => i.required && itemStatus(i, c) !== "waived");
    const got = req.filter((i) => ["received", "reviewed"].includes(itemStatus(i, c))).length;
    return { got, total: req.length };
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="View" className="flex rounded-xl border border-line bg-surface-2 p-0.5">
            {(
              [
                ["list", "List", List],
                ["board", "Board", Columns3],
              ] as const
            ).map(([v, l, I]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium ${view === v ? "bg-surface text-accent shadow-soft" : "text-muted hover:text-ink"}`}>
                <I size={16} /> {l}
              </button>
            ))}
          </div>
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Search returns</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search client, form, year, preparer…" className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15" />
          </label>
          <Sel label="Sort returns" value={sort} onChange={(v) => setSort(v as typeof sort)} options={[["due", "Due date"], ["status", "Status"], ["updated", "Recently updated"], ["name", "Client A–Z"]]} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Sel label="Return status" value={filters.status} onChange={(v) => set({ status: v as Filters["status"] })} options={[["all", "All statuses"], ["attention", "Needs attention"], ...RETURN_STATUSES.map((s) => [s, s] as [string, string])]} />
          <Sel label="Return type" value={filters.kind} onChange={(v) => set({ kind: v as Filters["kind"], form: "all" })} options={[["all", "Individual & business"], ["individual", "Individual"], ["business", "Business"]]} />
          <Sel label="Form" value={filters.form} onChange={(v) => set({ form: v })} options={[["all", "All forms"], ...[...(filters.kind !== "business" ? INDIVIDUAL_FORMS : []), ...(filters.kind !== "individual" ? BUSINESS_FORMS : [])].map((f) => [f, f] as [string, string])]} />
          <Sel label="Preparer" value={filters.preparer} onChange={(v) => set({ preparer: v })} options={[["all", "Any preparer"], ...staffList().map((s) => [s.id, s.name] as [string, string])]} />
          <Sel label="Reviewer" value={filters.reviewer} onChange={(v) => set({ reviewer: v })} options={[["all", "Any reviewer"], ...staffList().map((s) => [s.id, s.name] as [string, string])]} />
          {on && <button onClick={() => setFilters(EMPTY)} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-accent hover:bg-accent-soft"><X size={13} /> Clear filters</button>}
        </div>
        <p className="text-[12.5px] text-muted">
          Showing <strong className="text-ink-2">{rows.length}</strong> of {returns.length} returns
        </p>
      </section>

      {view === "list" ? (
        <section className="rounded-2xl border border-line bg-surface shadow-soft">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-[14px] text-muted">No returns match these filters.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-[13.5px]">
                  <thead className="border-b border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-5 py-2.5">Client</th>
                      <th className="px-3 py-2.5">Return</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Documents</th>
                      <th className="px-3 py-2.5">Preparer · Reviewer</th>
                      <th className="px-3 py-2.5">Due</th>
                      <th className="px-5 py-2.5 text-right">{tax.access.billing ? "Balance" : ""}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const c = byId.get(r.clientId);
                      const d = docs(r);
                      const b = billing(r, c);
                      return (
                        <tr key={r.id} onClick={() => router.push(`/services/tax-preparation/returns/${r.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={c?.name ?? "?"} size={32} square={r.kind === "business"} />
                              <div className="min-w-0">
                                <Link href={`/services/tax-preparation/returns/${r.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-ink hover:text-accent">{c?.name}</Link>
                                <span className="flex items-center gap-1 text-[12px] text-muted">{r.kind === "business" ? <Building2 size={12} /> : <User size={12} />}{r.kind === "business" ? c?.business?.entityType : r.filingStatus}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3"><span className="font-semibold text-ink tabular-nums">TY {r.taxYear}</span> <span className="text-ink-2">· {r.form}</span></td>
                          <td className="px-3 py-3"><ReturnStatusBadge status={r.status} /></td>
                          <td className="px-3 py-3"><DocMeter got={d.got} total={d.total} /></td>
                          <td className="px-3 py-3"><span className="inline-flex items-center gap-1"><Avatar name={staffById(r.preparerId).name} size={24} /><Avatar name={staffById(r.reviewerId).name} size={24} /></span></td>
                          <td className="px-3 py-3"><DueChip r={r} /></td>
                          <td className="px-5 py-3 text-right font-semibold tabular-nums">{tax.access.billing ? (b.balance > 0 ? usd(b.balance) : <span className="font-normal text-faint">$0</span>) : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-line lg:hidden">
                {rows.map((r) => {
                  const c = byId.get(r.clientId);
                  const d = docs(r);
                  return (
                    <li key={r.id}>
                      <Link href={`/services/tax-preparation/returns/${r.id}`} className="block px-4 py-3.5 hover:bg-surface-hover">
                        <div className="flex items-start gap-3">
                          <Avatar name={c?.name ?? "?"} size={38} square={r.kind === "business"} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14.5px] font-semibold text-ink">{c?.name}</div>
                            <div className="text-[12.5px] text-muted">TY {r.taxYear} · {r.form} · {staffById(r.preparerId).name}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <ReturnStatusBadge status={r.status} />
                              <DueChip r={r} />
                            </div>
                            <div className="mt-2"><DocMeter got={d.got} total={d.total} /></div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : (
        <div className="scrollbar-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-label="Returns by status board">
          {RETURN_STATUSES.map((s) => {
            const col = rows.filter((r) => r.status === s);
            return (
              <section key={s} aria-label={`${s} — ${col.length}`} className="flex w-[80vw] max-w-[270px] shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface-2 sm:w-[260px]">
                <header className="flex items-center gap-2 px-3.5 pb-2 pt-3">
                  <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{s}</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-ink-2 ring-1 ring-line">{col.length}</span>
                </header>
                <ul className="flex min-h-[100px] flex-col gap-2 px-2.5 pb-3">
                  {col.map((r) => (
                    <li key={r.id}>
                      <Link href={`/services/tax-preparation/returns/${r.id}`} className="block rounded-xl border border-line bg-surface p-3 shadow-soft hover:border-accent/50">
                        <div className="truncate text-[13.5px] font-semibold text-ink">{byId.get(r.clientId)?.name}</div>
                        <div className="text-[12px] text-muted">TY {r.taxYear} · {r.form}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5"><DueChip r={r} /></div>
                        <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[11.5px] text-muted">
                          <span className="inline-flex items-center gap-1"><Avatar name={staffById(r.preparerId).name} size={18} /> {relTime(r.activity[0]?.at ?? r.createdAt)}</span>
                          <DocMeter got={docs(r).got} total={docs(r).total} compact />
                        </div>
                      </Link>
                    </li>
                  ))}
                  {col.length === 0 && <li className="rounded-xl border-2 border-dashed border-line px-3 py-5 text-center text-[12px] text-faint">None</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DocMeter({ got, total, compact }: { got: number; total: number; compact?: boolean }) {
  const pct = total ? Math.round((got / total) * 100) : 100;
  return (
    <span className="inline-flex items-center gap-2" title={`${got} of ${total} required documents received`}>
      {!compact && (
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--accent)" }} />
        </span>
      )}
      <span className="text-[12px] font-medium text-ink-2 tabular-nums">{got}/{total}</span>
    </span>
  );
}

/* ================================================================== */
/* Missing documents                                                   */
/* ================================================================== */

function MissingDocs({ returns, byId }: { returns: TaxReturn[]; byId: Map<string, Client> }) {
  const tax = useTax();
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const rows = returns
    .filter((r) => !["Completed", "Accepted", "Submitted"].includes(r.status))
    .map((r) => ({ r, c: byId.get(r.clientId), items: outstandingItems(r, byId.get(r.clientId)) }))
    .filter((x) => showAll || x.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length);
  const total = rows.reduce((s, x) => s + x.items.length, 0);
  const statusLabel = { needed: "Not requested", requested: "Requested", rejected: "Re-upload needed" } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-soft">
        <FileWarning size={18} className="text-warning" />
        <span className="text-[14px] text-ink"><strong>{total}</strong> required document{total === 1 ? "" : "s"} outstanding across {rows.filter((x) => x.items.length).length} return(s)</span>
        <label className="ml-auto inline-flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" checked={showAll} onChange={() => setShowAll((v) => !v)} className="accent-[var(--accent)]" /> Show complete returns</label>
      </div>
      {rows.length === 0 && <p className="rounded-2xl border border-line bg-surface px-5 py-10 text-center text-[14px] text-muted shadow-soft">All documents are in.</p>}
      {rows.map(({ r, c, items }) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center gap-3 px-5 pt-4 sm:px-6">
            <Avatar name={c?.name ?? "?"} size={34} square={r.kind === "business"} />
            <div className="min-w-0 flex-1">
              <Link href={`/services/tax-preparation/returns/${r.id}#documents`} className="block truncate text-[14.5px] font-semibold text-ink hover:text-accent">{c?.name} · TY {r.taxYear} {r.form}</Link>
              <span className="text-[12px] text-muted">{items.length ? `${items.length} outstanding` : "All required documents received"} · {r.status}</span>
            </div>
            {items.some((i) => itemStatus(i, c) === "needed") && <Button size="sm" disabled={!tax.access.edit} onClick={() => { const n = tax.requestAllMissing(r.id); toast(`Requested ${n} document(s) from ${c?.name}`); }}>Request all</Button>}
            {items.some((i) => ["requested", "rejected"].includes(itemStatus(i, c))) && <Button size="sm" icon={Send} disabled={!tax.access.edit} onClick={() => { const n = tax.remindAll(r.id); toast(`Reminder sent for ${n} document(s)`); }}>Remind</Button>}
          </div>
          <ul className="px-3 pb-3 pt-2 sm:px-4">
            {items.map((i) => {
              const st = itemStatus(i, c) as keyof typeof statusLabel;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-hover">
                  <span className="min-w-0 flex-1 text-[13.5px] text-ink">{i.sensitive && !tax.access.sensitiveDocs ? <span className="inline-flex items-center gap-1 text-muted"><Lock size={12} /> Restricted document</span> : i.name}</span>
                  {i.sensitive && <Badge tone="danger" icon={ShieldAlert}>Restricted</Badge>}
                  <Badge tone={st === "needed" ? "neutral" : st === "rejected" ? "danger" : "warning"}>{statusLabel[st]}</Badge>
                  <Button size="sm" variant="ghost" disabled={!tax.access.edit} onClick={() => { tax.receiveItem(r.id, i.id); toast(`Marked received: ${i.name}`); }}>Mark received</Button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/* ================================================================== */
/* E-file                                                              */
/* ================================================================== */

function EfileTab({ returns, byId }: { returns: TaxReturn[]; byId: Map<string, Client> }) {
  const tax = useTax();
  const [result, setResult] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [ack, setAck] = useState<{ r: TaxReturn; id: string } | null>(null);
  const rows = returns
    .flatMap((r) => r.efile.map((e) => ({ r, e })))
    .filter((x) => result === "all" || x.e.result === result)
    .sort((a, b) => b.e.submittedAt.localeCompare(a.e.submittedAt));
  const ready = returns.filter((r) => r.status === "Ready to E-file");
  const ackReturn = ack ? tax.returns.find((x) => x.id === ack.r.id) : undefined;

  return (
    <div className="space-y-4">
      {ready.length > 0 && (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-4">
          <p className="mb-2 text-[13.5px] font-semibold text-accent-ink">{ready.length} return{ready.length > 1 ? "s" : ""} ready to transmit</p>
          <div className="flex flex-wrap gap-2">
            {ready.map((r) => <Button key={r.id} size="sm" href={`/services/tax-preparation/returns/${r.id}#efile`} icon={Send}>{byId.get(r.clientId)?.name} · {r.form}</Button>)}
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-line bg-surface shadow-soft">
        <div className="flex flex-wrap items-center gap-2 p-4 sm:px-5">
          {(["all", "pending", "accepted", "rejected"] as const).map((k) => (
            <button key={k} aria-pressed={result === k} onClick={() => setResult(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium capitalize ${result === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
              {k === "all" ? "All submissions" : k}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="border-t border-line px-5 py-10 text-center text-[14px] text-muted">No e-file submissions for this view.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {rows.map(({ r, e }) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
                  <Link href={`/services/tax-preparation/returns/${r.id}#efile`} className="block truncate text-[14px] font-semibold text-ink hover:text-accent">{byId.get(r.clientId)?.name} · TY {r.taxYear} {r.form}</Link>
                  <div className="text-[12px] text-muted">{e.jurisdiction} · {e.submissionId} · submitted {fmtDate(e.submittedAt)}{e.resultAt ? ` · ack ${fmtDate(e.resultAt, { month: "short", day: "numeric" })}` : ""}</div>
                  {e.result === "rejected" && <div className="mt-0.5 text-[12.5px] text-danger-ink">{e.code} — {e.reason}</div>}
                </div>
                <Badge tone={e.result === "accepted" ? "success" : e.result === "rejected" ? "danger" : "info"}>{e.result === "pending" ? "Awaiting ack" : e.result[0].toUpperCase() + e.result.slice(1)}</Badge>
                {e.result === "pending" && <Button size="sm" disabled={!tax.access.efile} onClick={() => setAck({ r, id: e.id })}>Record ack</Button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {ackReturn && <AckDialog r={ackReturn} attempt={ackReturn.efile.find((x) => x.id === ack!.id) ?? null} onClose={() => setAck(null)} />}
    </div>
  );
}

/* ================================================================== */
/* Billing                                                             */
/* ================================================================== */

function BillingTab({ returns, byId }: { returns: TaxReturn[]; byId: Map<string, Client> }) {
  const [filter, setFilter] = useState<"all" | "balance" | "unbilled" | "paid">("all");
  const [pay, setPay] = useState<{ client: Client; invoiceId?: string } | null>(null);
  const rows = returns.map((r) => ({ r, c: byId.get(r.clientId), b: billing(r, byId.get(r.clientId)) }));
  const shown = rows.filter((x) => filter === "all" || (filter === "balance" ? x.b.balance > 0 : filter === "unbilled" ? x.b.unbilled > 0 : x.b.balance <= 0 && x.b.unbilled <= 0));
  const sum = (k: "price" | "billed" | "paid" | "balance" | "unbilled") => rows.reduce((s, x) => s + x.b[k], 0);
  const payClient = pay ? byId.get(pay.client.id) : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["Fees (price)", sum("price"), "text-ink"],
            ["Billed", sum("billed"), "text-ink"],
            ["Collected", sum("paid"), "text-success-ink"],
            ["Outstanding", sum("balance"), sum("balance") > 0 ? "text-danger-ink" : "text-faint"],
            ["Not yet billed", sum("unbilled"), "text-warning-ink"],
          ] as const
        ).map(([l, v, cls], i) => (
          <div key={l} className={`rounded-2xl border border-line bg-surface p-4 shadow-soft ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
            <div className="text-[12px] text-muted">{l}</div>
            <div className={`mt-0.5 text-[19px] font-bold tabular-nums ${cls}`}>{usd(v)}</div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-line bg-surface shadow-soft">
        <div className="flex flex-wrap gap-2 p-4 sm:px-5">
          {(
            [
              ["all", "All returns"],
              ["balance", "Balance due"],
              ["unbilled", "Not fully billed"],
              ["paid", "Paid in full"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${filter === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>{l}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-2.5">Return</th><th className="px-3 py-2.5 text-right">Price</th><th className="px-3 py-2.5 text-right">Billed</th><th className="px-3 py-2.5 text-right">Paid</th><th className="px-3 py-2.5 text-right">Balance</th><th className="px-5 py-2.5 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {shown.map(({ r, c, b }) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3"><Link href={`/services/tax-preparation/returns/${r.id}#billing`} className="font-semibold text-ink hover:text-accent">{c?.name}</Link><div className="text-[12px] text-muted">TY {r.taxYear} · {r.form} · {r.status}</div></td>
                  <td className="px-3 py-3 text-right tabular-nums">{usd(b.price)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{usd(b.billed)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-success-ink">{usd(b.paid)}</td>
                  <td className={`px-3 py-3 text-right font-semibold tabular-nums ${b.balance > 0 ? "text-danger-ink" : "text-faint"}`}>{usd(b.balance)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex gap-1">
                      {b.unbilled > 0 && <Button size="sm" icon={Receipt} href={`/services/tax-preparation/returns/${r.id}#billing`}>Invoice {usd(b.unbilled)}</Button>}
                      {b.balance > 0 && c && <Button size="sm" icon={CreditCard} onClick={() => setPay({ client: c, invoiceId: b.invoices.find((i) => i.amount > i.paid && i.status !== "draft")?.id })}>Payment</Button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {payClient && <PaymentDialog client={payClient} open={!!pay} onClose={() => setPay(null)} invoiceId={pay?.invoiceId} />}
    </div>
  );
}

/* ================================================================== */
/* Fee schedule                                                        */
/* ================================================================== */

function FeeSchedule() {
  const tax = useTax();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<"individual" | "business" | "both">("both");
  const can = tax.access.billing;
  return (
    <Card>
      <CardHeader icon={Tags} title="Tax preparation fee schedule" subtitle="Used to build each return's price. Changing a price doesn't alter returns already priced." />
      {!can && <div className="mx-5 mb-3 sm:mx-6"><NoAccess what="Editing prices" /></div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13.5px]">
          <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <tr><th className="px-5 py-2.5">Item</th><th className="px-3 py-2.5">Applies to</th><th className="px-3 py-2.5 text-right">Price</th><th className="w-12 px-5 py-2.5" /></tr>
          </thead>
          <tbody>
            {tax.fees.map((f) => (
              <tr key={f.code} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5"><span className="font-medium text-ink">{f.label}</span>{f.unit && <span className="ml-1 text-[12px] text-muted">({f.unit})</span>}</td>
                <td className="px-3 py-2.5 capitalize text-ink-2">{f.kind === "both" ? "All" : f.kind}</td>
                <td className="px-3 py-2.5 text-right">
                  <label className="inline-flex items-center gap-1">
                    <span className="text-muted">$</span>
                    <input aria-label={`Price for ${f.label}`} type="number" min={0} disabled={!can} defaultValue={f.price} onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== f.price) { tax.setFee(f.code, v); toast(`${f.label}: ${usd(v)}`); } }} className="h-8 w-24 rounded-lg border border-line bg-surface px-2 text-right tabular-nums text-ink disabled:opacity-60" />
                  </label>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button aria-label={`Remove ${f.label}`} disabled={!can} onClick={() => { tax.removeFee(f.code); toast(`Removed ${f.label}`); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-danger disabled:opacity-30"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim() || !(Number(price) >= 0) || price === "") return;
          tax.addFee({ code: `C-${Date.now().toString(36)}`, label: label.trim(), kind, price: Number(price) });
          toast(`Added "${label.trim()}"`);
          setLabel("");
          setPrice("");
        }}
        className="flex flex-wrap items-end gap-2 border-t border-line p-4 sm:px-6"
      >
        <input aria-label="New fee item" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New item, e.g. Schedule F — farm income" disabled={!can} className="h-10 min-w-[220px] flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink disabled:opacity-60" />
        <select aria-label="Applies to" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} disabled={!can} className="h-10 rounded-xl border border-line bg-surface px-2 text-[13.5px] text-ink-2"><option value="both">All</option><option value="individual">Individual</option><option value="business">Business</option></select>
        <input aria-label="New fee price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" disabled={!can} className="h-10 w-28 rounded-xl border border-line bg-surface px-3 text-right text-[14px] text-ink disabled:opacity-60" />
        <Button type="submit" icon={Plus} disabled={!can || !label.trim() || price === ""}>Add</Button>
      </form>
    </Card>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface pl-3 pr-8 text-[13.5px] font-medium text-ink-2 focus:border-accent focus:outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

