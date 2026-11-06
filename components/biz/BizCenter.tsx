"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Hourglass,
  Inbox,
  Landmark,
  LayoutGrid,
  Loader,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { downloadPlaceholder } from "@/components/crm/dialogs";
import { STAFF, SAMPLE_NOW, staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { PAY_META, STANDING_META, deadlineSummary, dueState, entityStates, isClosed, nextReminder, nextStep, openInfo, payState, pendingReminders, useBiz, type PayState } from "@/lib/store/biz-store";
import { CATEGORIES, COMPLIANCE_KIND, DOC_CATEGORIES, ENTITY_TYPES, FREQ_MONTHS, FREQUENCY, NATURE, REQUEST_STATUSES, STATES, daysBetween, dueLabel, ruleVerified, stateName, type CatalogService, type ComplianceRule, type RequestStatus, type ServiceRequest, type StateChecklist } from "@/lib/biz/config";
import { fmtDate, relTime } from "@/lib/format";
import type { Client } from "@/lib/types";
import { Kpi, NotLegalAdvice, OwnerBadge, PayBadge, StatusBadge, entityHref, money, portalHref, reqHref } from "./BizBits";
import { ChecklistDialog, EntityDialog, NewRequestDialog, ReminderChips, RuleDialog, ServiceDialog, VerifyDialog } from "./BizDialogs";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "requests", label: "Service requests", icon: ClipboardList },
  { key: "businesses", label: "Businesses", icon: Building2 },
  { key: "calendar", label: "Compliance calendar", icon: CalendarDays },
  { key: "compliance", label: "Compliance & renewals", icon: CalendarClock },
  { key: "states", label: "State requirements", icon: Landmark },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "catalog", label: "Service catalog", icon: BookOpen },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Bucket = "all" | "new" | "info" | "payment" | "progress" | "agency" | "delivery" | "completed";
const BUCKETS: Record<Bucket, { label: string; test: (r: ServiceRequest, c?: Client) => boolean }> = {
  all: { label: "All open", test: (r) => !isClosed(r) },
  new: { label: "New requests", test: (r) => r.status === "Intake" },
  info: { label: "Awaiting client information", test: (r) => r.status === "Awaiting Client Information" },
  payment: { label: "Awaiting payment", test: (r, c) => !isClosed(r) && ["awaiting_payment", "partial", "quote_sent"].includes(payState(r, c).state) },
  progress: { label: "In progress", test: (r) => r.status === "Ready for Processing" || r.status === "In Progress" },
  agency: { label: "Awaiting agency", test: (r) => r.status === "Submitted to Agency" || r.status === "Awaiting Agency Response" },
  delivery: { label: "Ready for delivery", test: (r) => !isClosed(r) && (r.status === "Approved" || r.deliverables.some((d) => d.status === "approved")) },
  completed: { label: "Completed", test: (r) => r.status === "Completed" },
};

const byDue = (a: ServiceRequest, b: ServiceRequest) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");

export function BizCenter() {
  const [tab, setTab] = useState<Tab>("overview");
  const biz = useBiz();
  const clientStore = useClients();
  const toast = useToast();
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === h)) setTab(h);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };
  const byId = useMemo(() => new Map(clientStore.clients.map((c) => [c.id, c])), [clientStore.clients]);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [newOpen, setNewOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Business Services"
        subtitle="Formation, compliance, documentation and consulting — from request to delivery and follow-up."
        actions={
          <>
            <Button variant="ghost" icon={RotateCcw} aria-label="Reset sample data" title="Reset sample data" className="px-2.5" onClick={() => { if (confirm("Reset business services and client sample data?")) { biz.reset(); clientStore.reset(); toast("Sample data reset"); } }} />
            <Button variant="primary" icon={Plus} onClick={() => setNewOpen(true)}>New request</Button>
          </>
        }
      />
      <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Business Services" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "overview" && <Overview byId={byId} bucket={bucket} setBucket={setBucket} go={go} />}
      {tab === "requests" && <RequestsTab byId={byId} onNew={() => setNewOpen(true)} />}
      {tab === "businesses" && <BusinessesTab byId={byId} />}
      {tab === "calendar" && <CalendarTab byId={byId} />}
      {tab === "compliance" && <ComplianceTab byId={byId} />}
      {tab === "states" && <StatesTab />}
      {tab === "documents" && <DocumentsTab byId={byId} />}
      {tab === "catalog" && <CatalogTab />}
      <NewRequestDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => router.push(reqHref({ id }))} />
    </>
  );
}

/* ================================================================== */

function Overview({ byId, bucket, setBucket, go }: { byId: Map<string, Client>; bucket: Bucket; setBucket: (b: Bucket) => void; go: (t: Tab) => void }) {
  const biz = useBiz();
  const router = useRouter();
  const [staff, setStaff] = useState("all");
  const reqs = biz.requests;
  const c = (r: ServiceRequest) => (r.clientId ? byId.get(r.clientId) : undefined);
  const count = (b: Bucket) => reqs.filter((r) => BUCKETS[b].test(r, c(r))).length;
  const openClients = new Set(reqs.filter((r) => !isClosed(r) && r.clientId).map((r) => r.clientId));
  biz.entities.filter((e) => e.status !== "dissolved" && biz.compliance.some((i) => i.entityId === e.id && i.status !== "filed")).forEach((e) => openClients.add(e.clientId));
  const deadlines = biz.compliance.filter((i) => i.status !== "filed" && i.status !== "not_applicable" && daysBetween(SAMPLE_NOW.toISOString(), i.dueAt) <= 60).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const rows = reqs.filter((r) => BUCKETS[bucket].test(r, c(r)) && (staff === "all" || r.assignedTo === staff)).sort(byDue);
  const cards: { b?: Bucket; label: string; value: number; icon: typeof Users; tone?: "accent" | "warning" | "success" | "danger"; sub?: string; onClick: () => void }[] = [
    { label: "Active business service clients", value: openClients.size, icon: Users, sub: `${biz.entities.filter((e) => e.status !== "dissolved").length} businesses on file`, onClick: () => go("businesses") },
    { b: "new", label: "New service requests", value: count("new"), icon: Inbox, onClick: () => setBucket("new") },
    { b: "info", label: "Awaiting client information", value: count("info"), icon: Hourglass, tone: "warning", onClick: () => setBucket("info") },
    { b: "payment", label: "Awaiting payment", value: count("payment"), icon: CreditCard, tone: "warning", onClick: () => setBucket("payment") },
    { b: "progress", label: "In progress", value: count("progress"), icon: Loader, onClick: () => setBucket("progress") },
    { b: "agency", label: "Awaiting agency response", value: count("agency"), icon: Landmark, onClick: () => setBucket("agency") },
    { b: "delivery", label: "Ready for delivery", value: count("delivery"), icon: Send, tone: "success", onClick: () => setBucket("delivery") },
    { b: "completed", label: "Completed services", value: count("completed"), icon: CheckCircle2, tone: "success", onClick: () => setBucket("completed") },
    { label: "Renewals & deadlines (60 days)", value: deadlines.length, icon: CalendarClock, tone: deadlines.some((i) => dueState(i).state === "overdue") ? "danger" : "accent", sub: `${deadlines.filter((i) => dueState(i).state === "overdue").length} overdue · ${new Set(deadlines.map((i) => i.state)).size} states`, onClick: () => go("calendar") },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {cards.map((k) => <Kpi key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone} sub={k.sub} onClick={k.onClick} />)}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            icon={ClipboardList}
            title="Work queue"
            subtitle={`${BUCKETS[bucket].label} · ${rows.length} request${rows.length === 1 ? "" : "s"} · soonest due first`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                {bucket !== "all" && <button onClick={() => setBucket("all")} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-accent hover:bg-accent-soft"><X size={13} /> {BUCKETS[bucket].label}</button>}
                <select aria-label="Assigned staff" value={staff} onChange={(e) => setStaff(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2">
                  <option value="all">All staff</option>
                  {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            }
          />
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[860px] text-left text-[13.5px]">
              <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                <tr><th className="px-5 py-2.5">Service</th><th className="px-3 py-2.5">Client</th><th className="px-3 py-2.5">Assigned</th><th className="px-3 py-2.5">Due</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 pr-5">Next required action</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-muted">Nothing here right now.</td></tr>}
                {rows.map((r) => {
                  const n = nextStep(r, c(r), biz.catalog.find((s) => s.id === r.serviceId));
                  const late = r.dueAt && !isClosed(r) && r.dueAt < SAMPLE_NOW.toISOString();
                  return (
                    <tr key={r.id} onClick={() => router.push(reqHref(r))} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover">
                      <td className="px-5 py-3"><Link href={reqHref(r)} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-accent">{r.serviceName}</Link><div className="text-[12px] text-muted">{r.number} · {r.businessName}</div></td>
                      <td className="px-3 py-3">{c(r)?.name ?? <span className="inline-flex items-center gap-1.5">{r.prospect?.name} <Badge tone="warning">Prospect</Badge></span>}</td>
                      <td className="px-3 py-3 text-ink-2">{staffById(r.assignedTo).name}</td>
                      <td className={`px-3 py-3 tabular-nums ${late ? "font-semibold text-danger-ink" : "text-ink-2"}`}>{r.dueAt ? fmtDate(r.dueAt, { month: "short", day: "numeric" }) : "—"}</td>
                      <td className="px-3 py-3"><StatusBadge s={r.status} /></td>
                      <td className="px-3 py-3 pr-5"><div className="flex items-center gap-2"><OwnerBadge o={n.owner} /><span className="text-ink-2">{n.text}</span></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader icon={CalendarClock} title="Upcoming renewals & deadlines" subtitle="Next 60 days, all states" action={<Button size="sm" variant="ghost" onClick={() => go("calendar")}>Calendar</Button>} />
          <ul className="divide-y divide-line border-t border-line">
            {deadlines.length === 0 && <li className="px-6 py-8 text-center text-[13px] text-muted">No deadlines in the next 60 days.</li>}
            {deadlines.slice(0, 7).map((i) => {
              const e = biz.entities.find((x) => x.id === i.entityId)!;
              const s = dueState(i);
              return (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <Link href={entityHref(e)} className="block truncate text-[13.5px] font-semibold text-ink hover:text-accent">{e.legalName}</Link>
                    <div className="truncate text-[12px] text-muted">{i.state === "LOCAL" ? "" : `${i.state} · `}{i.title} · {fmtDate(i.dueAt)}</div>
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== */

function RequestsTab({ byId, onNew }: { byId: Map<string, Client>; onNew: () => void }) {
  const biz = useBiz();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"open" | "all" | RequestStatus>("open");
  const [cat, setCat] = useState("all");
  const [staff, setStaff] = useState("all");
  const [pay, setPay] = useState<"all" | PayState>("all");
  const catOf = (r: ServiceRequest) => biz.catalog.find((s) => s.id === r.serviceId)?.category;
  const c = (r: ServiceRequest) => (r.clientId ? byId.get(r.clientId) : undefined);
  const rows = biz.requests
    .filter((r) => (status === "open" ? !isClosed(r) : status === "all" || r.status === status))
    .filter((r) => cat === "all" || catOf(r) === cat)
    .filter((r) => staff === "all" || r.assignedTo === staff)
    .filter((r) => pay === "all" || payState(r, c(r)).state === pay)
    .filter((r) => !q.trim() || `${r.number} ${r.serviceName} ${r.businessName} ${c(r)?.name ?? r.prospect?.name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = q || status !== "open" || cat !== "all" || staff !== "all" || pay !== "all";
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 p-4 sm:px-6">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, service, business or client…" aria-label="Search requests" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink" />
        </div>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2">
          <option value="open">All open</option><option value="all">All statuses</option>
          {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2">
          <option value="all">All categories</option>
          {[...new Set(biz.catalog.map((s) => s.category))].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select aria-label="Staff" value={staff} onChange={(e) => setStaff(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2">
          <option value="all">All staff</option>
          {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select aria-label="Payment status" value={pay} onChange={(e) => setPay(e.target.value as typeof pay)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2">
          <option value="all">Any payment status</option>
          {Object.entries(PAY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {filtered && <button onClick={() => { setQ(""); setStatus("open"); setCat("all"); setStaff("all"); setPay("all"); }} className="inline-flex h-10 items-center gap-1 px-2 text-[12.5px] font-semibold text-accent"><X size={13} /> Clear</button>}
        <Button variant="primary" icon={Plus} onClick={onNew} className="ml-auto">New request</Button>
      </div>
      <p className="px-4 pb-2 text-[12.5px] text-muted sm:px-6">Showing {rows.length} of {biz.requests.length}</p>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[900px] text-left text-[13.5px]">
          <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <tr><th className="px-5 py-2.5">Request</th><th className="px-3 py-2.5">Client / business</th><th className="px-3 py-2.5">Assigned</th><th className="px-3 py-2.5">Requested</th><th className="px-3 py-2.5">Due</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 pr-5 text-right">Quote · payment</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-muted">No requests match these filters.</td></tr>}
            {rows.map((r) => {
              const p = payState(r, c(r));
              return (
                <tr key={r.id} onClick={() => router.push(reqHref(r))} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-5 py-3"><Link href={reqHref(r)} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-accent">{r.serviceName}</Link><div className="text-[12px] text-muted">{r.number} · {catOf(r)}</div></td>
                  <td className="px-3 py-3"><div className="font-medium text-ink">{c(r)?.name ?? r.prospect?.name}{!r.clientId && <span className="ml-1.5"><Badge tone="warning">Prospect</Badge></span>}</div><div className="text-[12px] text-muted">{r.businessName}</div></td>
                  <td className="px-3 py-3 text-ink-2">{staffById(r.assignedTo).name}</td>
                  <td className="px-3 py-3 text-ink-2">{relTime(r.createdAt)}<div className="text-[12px] capitalize text-muted">{r.source}</div></td>
                  <td className="px-3 py-3 tabular-nums text-ink-2">{r.dueAt ? fmtDate(r.dueAt, { month: "short", day: "numeric" }) : "—"}</td>
                  <td className="px-3 py-3"><StatusBadge s={r.status} /></td>
                  <td className="px-3 py-3 pr-5 text-right"><div className="font-semibold tabular-nums text-ink">{r.quote.lines.length ? money(r.quote.lines.reduce((s, l) => s + (l.kind === "discount" ? -Math.abs(l.amount) : l.amount), 0)) : "—"}</div><PayBadge s={p.state} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ================================================================== */

function BusinessesTab({ byId }: { byId: Map<string, Client> }) {
  const biz = useBiz();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "attention" | "forming" | "multi" | "unverified">("all");
  const [st, setSt] = useState("all");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const list = biz.entities
    .map((e) => ({ e, items: biz.compliance.filter((i) => i.entityId === e.id && i.status !== "filed"), reqs: biz.requests.filter((r) => r.entityId === e.id && !isClosed(r)) }))
    .filter(({ e, items }) => (f === "all" ? true : f === "forming" ? e.status === "forming" : f === "multi" ? entityStates(e).length > 1 : f === "unverified" ? e.standing.status === "not_verified" : ["danger", "warning"].includes(deadlineSummary(items).tone)))
    .filter(({ e }) => st === "all" || entityStates(e).includes(st))
    .filter(({ e }) => !q.trim() || `${e.legalName} ${e.dba ?? ""} ${byId.get(e.clientId)?.name}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.e.legalName.localeCompare(b.e.legalName));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business or client…" aria-label="Search businesses" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink" />
        </div>
        <select aria-label="Business filter" value={f} onChange={(e) => setF(e.target.value as typeof f)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2">
          <option value="all">All businesses</option><option value="attention">Deadlines due soon / overdue</option><option value="forming">Being formed</option><option value="multi">Registered in more than one state</option><option value="unverified">Standing not verified</option>
        </select>
        <select aria-label="Registered in state" value={st} onChange={(e) => setSt(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2"><option value="all">Any state</option>{STATES.map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}</select>
        <Button icon={Plus} onClick={() => setOpen(true)}>Add business</Button>
      </div>
      <p className="text-[12.5px] text-muted">Showing {list.length} of {biz.entities.length} · each business is linked to an existing client record</p>
      {list.length === 0 && <Card className="p-10 text-center text-[14px] text-muted">No businesses match.</Card>}
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {list.map(({ e, items, reqs }) => {
          const ds = deadlineSummary(items);
          const sm = STANDING_META[e.standing.status];
          const states = entityStates(e);
          const next = items.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
          return (
            <Link key={e.id} href={entityHref(e)} className="block rounded-2xl border border-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-svc-biz-soft text-svc-biz"><Briefcase size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-ink">{e.legalName}</div>
                  <div className="truncate text-[12.5px] text-muted">{byId.get(e.clientId)?.name} · {e.entityType} · formed in {stateName(e.state)}{e.dba ? ` · dba ${e.dba}` : ""}</div>
                </div>
                {e.status === "forming" ? <Badge tone="info">Forming</Badge> : <Badge tone={ds.tone}>{ds.label}</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {states.map((x) => <span key={x} className={`rounded px-1.5 text-[11px] font-semibold ${x === e.state ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`} title={x === e.state ? "Formation state" : "Registered"}>{x}</span>)}
                <span className="ml-auto"><Badge tone={sm.tone}>{sm.label}</Badge></span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[12px] text-muted">
                <div><div className="font-semibold text-ink">{reqs.length}</div>open request{reqs.length === 1 ? "" : "s"}</div>
                <div className="col-span-2 min-w-0"><div className="truncate font-semibold text-ink">{next ? next.title : "No deadlines tracked"}</div>{next ? `${fmtDate(next.dueAt)} · ${dueState(next).label}` : "Add one from the business page"}</div>
              </div>
            </Link>
          );
        })}
      </div>
      <EntityDialog open={open} onClose={() => setOpen(false)} onSaved={(id) => router.push(`/services/business-services/businesses/${id}`)} />
    </div>
  );
}

/* ================================================================== */

const winTest = (win: string, days: number) => (win === "overdue" ? days < 0 : win === "all" ? true : days <= Number(win));

function CalendarTab({ byId }: { byId: Map<string, Client> }) {
  const biz = useBiz();
  const [state, setState] = useState("all");
  const [etype, setEtype] = useState("all");
  const [win, setWin] = useState("90");
  const [staff, setStaff] = useState("all");
  const [kind, setKind] = useState("all");
  const [view, setView] = useState<"agenda" | "month">("agenda");
  const [month, setMonth] = useState(() => new Date(SAMPLE_NOW.getFullYear(), SAMPLE_NOW.getMonth(), 1));
  const ent = (id: string) => biz.entities.find((e) => e.id === id)!;
  const open = biz.compliance.filter((i) => i.status !== "filed" && i.status !== "not_applicable");
  const base = open
    .filter((i) => etype === "all" || ent(i.entityId).entityType === etype)
    .filter((i) => staff === "all" || i.ownerId === staff)
    .filter((i) => kind === "all" || i.kind === kind)
    .filter((i) => view === "month" || winTest(win, daysBetween(SAMPLE_NOW.toISOString(), i.dueAt)));
  const items = base.filter((i) => state === "all" || i.state === state).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const perState = new Map<string, number>();
  base.forEach((i) => perState.set(i.state, (perState.get(i.state) ?? 0) + 1));
  const months = [...new Set(items.map((i) => i.dueAt.slice(0, 7)))];
  const filtered = state !== "all" || etype !== "all" || win !== "90" || staff !== "all" || kind !== "all";
  const sel = "h-9 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2";
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={CalendarClock} title="Nationwide business compliance calendar" subtitle={`${items.length} deadline${items.length === 1 ? "" : "s"} across ${new Set(items.map((i) => i.state)).size} state${new Set(items.map((i) => i.state)).size === 1 ? "" : "s"} · all clients and businesses`} action={
          <div role="radiogroup" aria-label="Calendar view" className="inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-line">
            {(["agenda", "month"] as const).map((k) => <button key={k} role="radio" aria-checked={view === k} onClick={() => setView(k)} className={`h-8 rounded-lg px-3 text-[13px] font-medium ${view === k ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>{k === "agenda" ? "Agenda" : "Month"}</button>)}
          </div>
        } />
        <div className="flex flex-wrap items-center gap-2 px-5 pb-4 sm:px-6">
          <select aria-label="State" value={state} onChange={(e) => setState(e.target.value)} className={sel}>
            <option value="all">All 50 states</option>
            {STATES.map(([c, n]) => <option key={c} value={c}>{c} — {n}{perState.get(c) ? ` (${perState.get(c)})` : ""}</option>)}
            <option value="LOCAL">Local / provider</option>
          </select>
          <select aria-label="Entity type" value={etype} onChange={(e) => setEtype(e.target.value)} className={sel}><option value="all">All entity types</option>{ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          {view === "agenda" && <select aria-label="Deadline" value={win} onChange={(e) => setWin(e.target.value)} className={sel}><option value="overdue">Overdue</option><option value="30">Next 30 days</option><option value="60">Next 60 days</option><option value="90">Next 90 days</option><option value="180">Next 6 months</option><option value="365">Next 12 months</option><option value="all">All upcoming</option></select>}
          <select aria-label="Assigned staff" value={staff} onChange={(e) => setStaff(e.target.value)} className={sel}><option value="all">All staff</option>{STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select aria-label="Requirement type" value={kind} onChange={(e) => setKind(e.target.value)} className={sel}><option value="all">All requirement types</option>{Object.entries(COMPLIANCE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {filtered && <button onClick={() => { setState("all"); setEtype("all"); setWin("90"); setStaff("all"); setKind("all"); }} className="inline-flex h-9 items-center gap-1 px-2 text-[12.5px] font-semibold text-accent"><X size={13} /> Clear</button>}
        </div>
        {perState.size > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-line px-5 py-3 sm:px-6" aria-label="Deadlines by state">
            {[...perState.entries()].sort((a, b) => b[1] - a[1]).map(([st, n]) => <button key={st} aria-pressed={state === st} onClick={() => setState(state === st ? "all" : st)} className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${state === st ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>{st === "LOCAL" ? "Local" : st} · {n}</button>)}
          </div>
        )}
      </Card>
      {view === "agenda" ? (
        items.length === 0 ? <Card className="p-10 text-center text-[14px] text-muted">No deadlines match these filters.</Card> : months.map((m) => (
          <Card key={m}>
            <CardHeader title={new Date(`${m}-15T12:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} subtitle={`${items.filter((i) => i.dueAt.startsWith(m)).length} deadline(s)`} />
            <ul className="divide-y divide-line border-t border-line">
              {items.filter((i) => i.dueAt.startsWith(m)).map((i) => {
                const e = ent(i.entityId);
                const s = dueState(i);
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                    <div className="w-12 shrink-0 text-center"><div className="text-[11px] font-semibold uppercase text-muted">{new Date(i.dueAt).toLocaleDateString("en-US", { weekday: "short" })}</div><div className="text-[20px] font-bold leading-none tabular-nums text-ink">{new Date(i.dueAt).getDate()}</div></div>
                    <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-[12.5px] font-bold text-ink ring-1 ring-line" title={stateName(i.state)}>{i.state === "LOCAL" ? "LOC" : i.state}</span>
                    <div className="min-w-0 flex-1 basis-[50%] sm:basis-auto">
                      <div className="text-[14px] font-semibold text-ink">{i.title}</div>
                      <div className="text-[12.5px] text-muted"><Link href={entityHref(e)} className="font-medium text-accent hover:underline">{e.legalName}</Link> · {e.entityType}{byId.get(e.clientId) && !e.legalName.startsWith(byId.get(e.clientId)!.name) ? ` · ${byId.get(e.clientId)!.name}` : ""} · {i.agency ?? "Agency not set"}{i.filingFee != null ? ` · fee ${money(i.filingFee)}` : " · fee not confirmed"}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-[104px] sm:pl-0">
                      {i.lastVerifiedAt ? <Badge tone="success" icon={BadgeCheck}>Verified {fmtDate(i.lastVerifiedAt, { month: "short", day: "numeric" })}</Badge> : <Badge tone="warning" icon={ShieldAlert}>Not verified</Badge>}
                      <Badge tone={s.tone}>{s.label}</Badge>
                      <span className="w-[84px] text-[12.5px] text-ink-2">{staffById(i.ownerId).name}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      ) : (
        <MonthGrid month={month} setMonth={setMonth} items={items} ent={ent} />
      )}
      <p className="text-[12px] text-muted">Dates come from each business's tracked deadlines. Unverified items still need to be confirmed with the state agency — the calendar doesn't assume any state's rules.</p>
    </div>
  );
}

function MonthGrid({ month, setMonth, items, ent }: { month: Date; setMonth: (d: Date) => void; items: ReturnType<typeof useBiz>["compliance"]; ent: (id: string) => ReturnType<typeof useBiz>["entities"][number] }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const key = (d: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const today = SAMPLE_NOW.toISOString().slice(0, 10);
  return (
    <Card>
      <div className="flex items-center gap-2 px-5 py-4 sm:px-6">
        <Button size="sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</Button>
        <h2 className="min-w-[160px] text-center text-[16px] font-bold text-ink">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        <Button size="sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</Button>
        <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(SAMPLE_NOW.getFullYear(), SAMPLE_NOW.getMonth(), 1))}>Today</Button>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <div className="grid min-w-[720px] grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="border-b border-line bg-surface-2 px-2 py-1.5 text-[11.5px] font-semibold uppercase text-muted">{d}</div>)}
          {cells.map((d, i) => {
            const list = d ? items.filter((x) => x.dueAt.slice(0, 10) === key(d)) : [];
            return (
              <div key={i} className={`min-h-[96px] border-b border-r border-line p-1.5 ${d ? "" : "bg-surface-2/50"}`}>
                {d && <div className={`mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold ${key(d) === today ? "bg-accent text-white" : "text-ink-2"}`}>{d}</div>}
                <div className="space-y-1">
                  {list.slice(0, 3).map((x) => { const s = dueState(x); return <Link key={x.id} href={entityHref(ent(x.entityId))} title={`${ent(x.entityId).legalName} — ${x.title}`} className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${s.tone === "danger" ? "bg-danger-soft text-danger-ink" : s.tone === "warning" ? "bg-warning-soft text-warning-ink" : "bg-accent-soft text-accent-ink"}`}>{x.state === "LOCAL" ? "" : `${x.state} · `}{ent(x.entityId).legalName}</Link>; })}
                  {list.length > 3 && <div className="px-1 text-[11px] text-muted">+{list.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ================================================================== */

function ComplianceTab({ byId }: { byId: Map<string, Client> }) {
  const biz = useBiz();
  const toast = useToast();
  const router = useRouter();
  const [win, setWin] = useState("90");
  const [state, setState] = useState("all");
  const [kind, setKind] = useState("all");
  const [staff, setStaff] = useState("all");
  const [verifying, setVerifying] = useState<string | null>(null);
  const ent = (id: string) => biz.entities.find((e) => e.id === id)!;
  const items = biz.compliance
    .filter((i) => i.status !== "filed" && i.status !== "not_applicable")
    .filter((i) => winTest(win, daysBetween(SAMPLE_NOW.toISOString(), i.dueAt)))
    .filter((i) => state === "all" || i.state === state)
    .filter((i) => kind === "all" || i.kind === kind)
    .filter((i) => staff === "all" || i.ownerId === staff)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const due = biz.compliance.filter((i) => pendingReminders(i).length > 0);
  const vItem = biz.compliance.find((i) => i.id === verifying);
  const sel = "h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2";
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={Bell} title="Reminders due" subtitle={due.length ? `${due.length} deadline${due.length > 1 ? "s" : ""} reached a reminder threshold (${biz.reminderDefaults.join(", ")} days by default)` : "All reminders are up to date"} action={due.length > 1 ? <Button size="sm" icon={Send} onClick={() => { due.forEach((i) => biz.sendReminder(i.id)); toast(`${due.length} reminders sent`); }}>Send all</Button> : undefined} />
        {due.length > 0 && (
          <ul className="divide-y divide-line border-t border-line">
            {due.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-ink">{ent(i.entityId).legalName} — {i.title}</div><div className="text-[12px] text-muted">Due {fmtDate(i.dueAt)} · {pendingReminders(i).map((d) => `${d}-day`).join(", ")} reminder not sent</div></div>
                <Badge tone={dueState(i).tone}>{dueState(i).label}</Badge>
                <Button size="sm" icon={Send} onClick={() => { biz.sendReminder(i.id); toast("Reminder sent to the client"); }}>Send reminder</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader icon={CalendarClock} title="Deadline tracker" subtitle="Annual reports, franchise taxes, periodic reports, licenses and renewals — every state each business is registered in" action={
          <div className="flex flex-wrap gap-2">
            <select aria-label="Window" value={win} onChange={(e) => setWin(e.target.value)} className={sel}><option value="overdue">Overdue</option><option value="30">Next 30 days</option><option value="60">Next 60 days</option><option value="90">Next 90 days</option><option value="all">All upcoming</option></select>
            <select aria-label="State filter" value={state} onChange={(e) => setState(e.target.value)} className={sel}><option value="all">All states</option>{STATES.map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}<option value="LOCAL">Local / provider</option></select>
            <select aria-label="Requirement type" value={kind} onChange={(e) => setKind(e.target.value)} className={sel}><option value="all">All types</option>{Object.entries(COMPLIANCE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select aria-label="Responsible staff" value={staff} onChange={(e) => setStaff(e.target.value)} className={sel}><option value="all">All staff</option>{STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
        } />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[1080px] text-left text-[13.5px]">
            <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-2.5">Business</th><th className="px-3 py-2.5">State</th><th className="px-3 py-2.5">Requirement</th><th className="px-3 py-2.5">Due · fee</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Verified</th><th className="px-3 py-2.5">Reminders</th><th className="px-3 py-2.5 pr-5 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={8} className="px-6 py-10 text-center text-muted">No open deadlines match.</td></tr>}
              {items.map((i) => {
                const e = ent(i.entityId);
                const s = dueState(i);
                const nr = nextReminder(i);
                return (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3"><Link href={entityHref(e)} className="font-semibold text-ink hover:text-accent">{e.legalName}</Link><div className="text-[12px] text-muted">{byId.get(e.clientId)?.name} · {e.entityType} · {staffById(i.ownerId).name}</div></td>
                    <td className="px-3 py-3"><span className="font-semibold text-ink">{i.state === "LOCAL" ? "Local" : i.state}</span><div className="text-[11.5px] text-muted">{i.state === e.state ? "formation state" : i.state === "LOCAL" ? "" : "foreign"}</div></td>
                    <td className="px-3 py-3"><div className="text-ink">{i.title}</div><div className="text-[12px] text-muted">{i.agency ?? "Agency not set"}{i.agencyUrl ? <> · <a href={i.agencyUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">website</a></> : ""}</div></td>
                    <td className="px-3 py-3 tabular-nums text-ink-2">{fmtDate(i.dueAt)}<div className="text-[12px] text-muted">{i.filingFee != null ? money(i.filingFee) : "fee not confirmed"} · {FREQUENCY[i.frequency].toLowerCase()}</div></td>
                    <td className="px-3 py-3"><Badge tone={s.tone}>{s.label}</Badge></td>
                    <td className="px-3 py-3">{i.lastVerifiedAt ? <Badge tone="success" icon={BadgeCheck}>{fmtDate(i.lastVerifiedAt, { month: "short", day: "numeric" })}</Badge> : <button onClick={() => setVerifying(i.id)} className="text-left"><Badge tone="warning" icon={ShieldAlert}>Not verified</Badge></button>}<div className="max-w-[180px] truncate text-[11.5px] text-muted" title={i.source}>{i.source}</div></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{i.reminderDays.map((d) => <span key={d} className={`rounded px-1.5 text-[11px] font-semibold ${i.remindersSent.includes(d) ? "bg-success-soft text-success-ink" : "bg-surface-2 text-muted ring-1 ring-line"}`} title={i.remindersSent.includes(d) ? "Sent" : "Not sent"}>{d}d</span>)}</div><div className="text-[11.5px] text-faint">{nr ? `next in ${nr.inDays}d` : "none scheduled"}</div></td>
                    <td className="px-3 py-3 pr-5">
                      <div className="flex justify-end gap-1.5">
                        {!i.lastVerifiedAt && <Button size="sm" variant="ghost" onClick={() => setVerifying(i.id)}>Verify</Button>}
                        {i.requestId ? <Button size="sm" variant="ghost" href={reqHref({ id: i.requestId })}>{i.requestId}</Button> : <Button size="sm" variant="ghost" onClick={() => { const id = biz.startRequestFor(i.id); toast(`${id} created`); router.push(reqHref({ id })); }}>Start request</Button>}
                        <Button size="sm" onClick={() => { biz.markFiled(i.id); toast(FREQ_MONTHS[i.frequency] ? "Filed — next period added (needs verification)" : "Marked filed"); }}>Mark filed</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-[12px] text-muted sm:px-6">This tracker reflects MKB's records. It is not an official good-standing determination — record a verified standing check on the business page.</p>
      </Card>
      <VerifyDialog title={vItem ? `${ent(vItem.entityId).legalName} — ${vItem.title}` : ""} current={vItem?.source.startsWith("Sample data") ? "" : vItem?.source} open={!!vItem} onClose={() => setVerifying(null)} onVerify={(by, src) => vItem && biz.verifyItem(vItem.id, by, src)} />
    </div>
  );
}

/* ================================================================== */

function StatesTab() {
  const biz = useBiz();
  const toast = useToast();
  const [state, setState] = useState("GA");
  const [q, setQ] = useState("");
  const [rule, setRule] = useState<ComplianceRule | null | undefined>(undefined);
  const [cl, setCl] = useState<StateChecklist | null | undefined>(undefined);
  const [verifyRule, setVerifyRule] = useState<ComplianceRule | null>(null);
  const [days, setDays] = useState<number[]>(biz.reminderDefaults);
  const [applyOpen, setApplyOpen] = useState(true);
  useEffect(() => setDays(biz.reminderDefaults), [biz.reminderDefaults]);
  const businessesIn = (st: string) => biz.entities.filter((e) => entityStates(e).includes(st)).length;
  const rows = [...STATES.map(([c, n]) => ({ c, n })), { c: "LOCAL", n: "Local / provider requirements" }].filter((x) => !q.trim() || `${x.c} ${x.n}`.toLowerCase().includes(q.trim().toLowerCase()));
  const rules = biz.rules.filter((r) => r.state === state);
  const lists = biz.checklists.filter((l) => l.state === state);
  const total = { rules: biz.rules.filter((r) => r.state !== "LOCAL").length, verified: biz.rules.filter((r) => r.state !== "LOCAL" && ruleVerified(r)).length, states: new Set(biz.rules.filter((r) => r.state !== "LOCAL").map((r) => r.state)).size };
  const changed = days.join() !== biz.reminderDefaults.join();
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-soft/50 px-4 py-3 text-[13px] text-warning-ink">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>State requirements are maintained here by administrators. Nothing is pre-loaded as fact: the sample rules are placeholders with no deadlines or fees until someone researches the official source and records the verification date. {total.verified} of {total.rules} state rules verified · {total.states} of 50 states have at least one rule.</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={Landmark} title="All 50 states" subtitle="Rules, checklists and clients per state" />
          <div className="px-4 pb-3 sm:px-5"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a state…" aria-label="Find a state" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] text-ink" /></div>
          <ul className="scrollbar-thin max-h-[560px] divide-y divide-line overflow-y-auto border-t border-line" aria-label="States">
            {rows.map(({ c, n }) => {
              const rs = biz.rules.filter((r) => r.state === c);
              const v = rs.filter(ruleVerified).length;
              const b = c === "LOCAL" ? 0 : businessesIn(c);
              return (
                <li key={c}>
                  <button aria-current={state === c ? "true" : undefined} onClick={() => setState(c)} className={`flex w-full items-center gap-2 px-4 py-2 text-left sm:px-5 ${state === c ? "bg-accent-soft" : "hover:bg-surface-hover"}`}>
                    <span className="w-10 shrink-0 text-[12.5px] font-bold text-ink">{c === "LOCAL" ? "—" : c}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{n}</span>
                    {b > 0 && <span className="text-[11px] text-muted">{b} biz</span>}
                    <span className={`rounded px-1.5 text-[11px] font-semibold ${!rs.length ? "bg-surface-2 text-faint ring-1 ring-line" : v === rs.length ? "bg-success-soft text-success-ink" : "bg-warning-soft text-warning-ink"}`}>{rs.length ? `${v}/${rs.length}` : "none"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={ShieldCheck} title={`${stateName(state)} — requirements`} subtitle={state === "LOCAL" ? "City, county and provider requirements that aren't state rules" : `${businessesIn(state)} client business(es) registered here`} action={<Button size="sm" icon={Plus} onClick={() => setRule(null)}>Add requirement</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {rules.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No requirements configured for {stateName(state)} yet. Research the state's official sources, then add each requirement with its agency, frequency, due date, fee and source.</li>}
              {rules.map((r) => (
                <li key={r.id} className="space-y-1 px-5 py-3.5 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{r.label}</span>
                    <Badge tone="neutral">{COMPLIANCE_KIND[r.kind]}</Badge>
                    {ruleVerified(r) ? <Badge tone="success" icon={BadgeCheck}>Verified {fmtDate(r.lastVerifiedAt!)}</Badge> : <Badge tone="warning" icon={ShieldAlert}>Not verified</Badge>}
                    <span className="ml-auto flex gap-1.5">
                      {!ruleVerified(r) && <Button size="sm" variant="ghost" onClick={() => setVerifyRule(r)}>Verify</Button>}
                      <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${r.label}`} onClick={() => setRule(r)} />
                    </span>
                  </div>
                  {r.description && <p className="text-[13px] text-ink-2">{r.description}</p>}
                  <dl className="grid gap-x-4 gap-y-0.5 text-[12.5px] sm:grid-cols-2">
                    <div><dt className="inline text-muted">Agency: </dt><dd className="inline text-ink-2">{r.agency}{r.agencyUrl ? <> · <a href={r.agencyUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">official website</a></> : " · website not recorded"}</dd></div>
                    <div><dt className="inline text-muted">Applies to: </dt><dd className="inline text-ink-2">{r.entityTypes === "any" ? "all entity types" : r.entityTypes.join(", ")} · {r.appliesTo === "both" ? "domestic & foreign" : r.appliesTo}</dd></div>
                    <div><dt className="inline text-muted">Due: </dt><dd className="inline text-ink-2">{dueLabel(r.due)} · {FREQUENCY[r.frequency].toLowerCase()}</dd></div>
                    <div><dt className="inline text-muted">Filing fee: </dt><dd className="inline text-ink-2">{r.filingFee != null ? money(r.filingFee) : "not set"}</dd></div>
                    <div className="sm:col-span-2"><dt className="inline text-muted">Source: </dt><dd className="inline text-ink-2">{r.source}{r.verifiedBy ? ` · verified by ${staffById(r.verifiedBy).name}` : ""}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </Card>
          {state !== "LOCAL" && (
            <Card>
              <CardHeader icon={ClipboardList} title={`${stateName(state)} document checklists`} subtitle="Added to the client checklist for service requests in this state" action={<Button size="sm" icon={Plus} onClick={() => setCl(null)}>Add checklist</Button>} />
              <ul className="divide-y divide-line border-t border-line">
                {lists.length === 0 && <li className="px-6 py-6 text-center text-[13.5px] text-muted">No state-specific checklist — requests use the service's standard checklist.</li>}
                {lists.map((l) => (
                  <li key={l.id} className="px-5 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-semibold text-ink">{l.serviceId === "any" ? "Any service" : biz.catalog.find((s) => s.id === l.serviceId)?.name}</span>{l.lastVerifiedAt ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}<Button size="sm" variant="ghost" icon={Pencil} className="ml-auto" aria-label="Edit checklist" onClick={() => setCl(l)} /></div>
                    <ul className="mt-1 list-disc pl-5 text-[13px] text-ink-2">{l.items.map((x) => <li key={x}>{x}</li>)}</ul>
                    <p className="text-[12px] text-muted">Source: {l.source}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader icon={Bell} title="Reminder settings" subtitle="Default reminders for new deadlines" />
            <div className="space-y-3 px-5 pb-5 sm:px-6">
              <ReminderChips days={days} setDays={setDays} />
              <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={applyOpen} onChange={() => setApplyOpen((v) => !v)} className="h-4 w-4 accent-[var(--accent)]" /> Also apply to open deadlines</label>
              <Button variant="primary" disabled={!changed || !days.length} onClick={() => { biz.setReminderDefaults(days, applyOpen); toast("Reminder settings saved"); }}>Save reminder settings</Button>
              <p className="text-[12px] text-muted">In the preview, reminders are sent from the Compliance tab. In Phase 3 they go out automatically.</p>
            </div>
          </Card>
        </div>
      </div>
      {rule !== undefined && <RuleDialog key={rule?.id ?? "new"} rule={rule ?? undefined} defaultState={state === "LOCAL" ? "LOCAL" : state} open onClose={() => setRule(undefined)} />}
      <ChecklistDialog list={cl ?? undefined} state={state} open={cl !== undefined} onClose={() => setCl(undefined)} />
      <VerifyDialog title={verifyRule ? `${stateName(verifyRule.state)} — ${verifyRule.label}` : ""} current={verifyRule?.source.startsWith("Sample placeholder") ? "" : verifyRule?.source} open={!!verifyRule} onClose={() => setVerifyRule(null)} onVerify={(by, src) => { if (verifyRule) { biz.saveRule({ ...verifyRule, source: src, lastVerifiedAt: SAMPLE_NOW.toISOString(), verifiedBy: by }); } }} />
    </div>
  );
}

/* ================================================================== */

function DocumentsTab({ byId }: { byId: Map<string, Client> }) {
  const biz = useBiz();
  const clientStore = useClients();
  const [cat, setCat] = useState("all");
  const [ent, setEnt] = useState("all");
  const [delivery, setDelivery] = useState("all");
  const [q, setQ] = useState("");
  const docs = clientStore.clients
    .flatMap((c) => c.documents.filter((d) => d.service === "biz").map((d) => ({ d, c })))
    .filter(({ d }) => cat === "all" || d.category === cat)
    .filter(({ d }) => ent === "all" || d.entityId === ent)
    .filter(({ d }) => delivery === "all" || (delivery === "delivered" ? !!d.deliveredAt : delivery === "requested" ? d.status === "requested" : delivery === "expiring" ? d.expiresAt && daysBetween(SAMPLE_NOW.toISOString(), d.expiresAt) <= 60 : !d.deliveredAt && d.status !== "requested"))
    .filter(({ d, c }) => !q.trim() || `${d.name} ${c.name}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.d.uploadedAt ?? b.d.requestedAt).localeCompare(a.d.uploadedAt ?? a.d.requestedAt));
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 p-4 sm:px-6">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" aria-label="Search documents" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink" />
        </div>
        <select aria-label="Document category" value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2"><option value="all">All categories</option>{DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select aria-label="Business" value={ent} onChange={(e) => setEnt(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2"><option value="all">All businesses</option>{biz.entities.map((e) => <option key={e.id} value={e.id}>{e.legalName}</option>)}</select>
        <select aria-label="Delivery status" value={delivery} onChange={(e) => setDelivery(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2"><option value="all">Any status</option><option value="requested">Requested from client</option><option value="on_file">On file, not delivered</option><option value="delivered">Delivered to client</option><option value="expiring">Expiring within 60 days</option></select>
      </div>
      <p className="px-4 pb-2 text-[12.5px] text-muted sm:px-6">{docs.length} document{docs.length === 1 ? "" : "s"} · stored on each client's record, tagged to the business and request · upload from a request or business page</p>
      <ul className="divide-y divide-line border-t border-line">
        {docs.length === 0 && <li className="px-6 py-10 text-center text-[13.5px] text-muted">No documents match.</li>}
        {docs.map(({ d, c }) => {
          const e = biz.entities.find((x) => x.id === d.entityId);
          const exp = d.expiresAt ? daysBetween(SAMPLE_NOW.toISOString(), d.expiresAt) : undefined;
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${d.status === "requested" ? "border-2 border-dashed border-line-strong text-faint" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}><FileText size={16} /></span>
              <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                <div className="text-[13.5px] font-medium text-ink">{d.name}</div>
                <div className="text-[12px] text-muted">{d.category} · {e?.legalName ?? c.name}{d.bizRequestId ? <> · <Link href={reqHref({ id: d.bizRequestId })} className="text-accent hover:underline">{d.bizRequestId}</Link></> : ""} · {d.uploadedAt ? `uploaded ${fmtDate(d.uploadedAt)}` : `requested ${relTime(d.requestedAt)}`}{exp != null ? ` · expires ${fmtDate(d.expiresAt!)}` : ""}</div>
              </div>
              {exp != null && exp <= 60 && <Badge tone={exp < 0 ? "danger" : "warning"}>{exp < 0 ? "Expired" : `Expires in ${exp}d`}</Badge>}
              {d.status === "requested" ? <Badge tone="warning">Requested</Badge> : d.deliveredAt ? <Badge tone="success">Delivered {fmtDate(d.deliveredAt, { month: "short", day: "numeric" })}</Badge> : <Badge tone="neutral">On file</Badge>}
              {d.status !== "requested" && <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${d.name}`} onClick={() => { clientStore.logDocumentAccess(c.id, d.id, "Downloaded"); downloadPlaceholder(d.name); }} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ================================================================== */

function CatalogTab() {
  const biz = useBiz();
  const toast = useToast();
  const [role, setRole] = useState<"admin" | "staff">("admin");
  const [edit, setEdit] = useState<CatalogService | null | undefined>(undefined);
  const [showInactive, setShowInactive] = useState(true);
  const cats = [...new Set([...CATEGORIES, ...biz.catalog.map((s) => s.category)])];
  const admin = role === "admin";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] text-ink-2">Viewing as
          <select aria-label="Viewing as" value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink">
            <option value="admin">Administrator (can edit)</option><option value="staff">Staff (read-only)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={showInactive} onChange={() => setShowInactive((v) => !v)} className="h-4 w-4 accent-[var(--accent)]" /> Show unavailable services</label>
        <Button variant="primary" icon={Plus} className="ml-auto" disabled={!admin} title={admin ? undefined : "Administrators only"} onClick={() => setEdit(null)}>Add custom service</Button>
      </div>
      <NotLegalAdvice />
      {cats.map((cat) => {
        const list = biz.catalog.filter((s) => s.category === cat && (showInactive || s.active));
        if (!list.length) return null;
        return (
          <Card key={cat}>
            <CardHeader icon={Briefcase} title={cat} subtitle={`${list.filter((s) => s.active).length} available`} />
            <ul className="divide-y divide-line border-t border-line">
              {list.map((s) => (
                <li key={s.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6 ${s.active ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1 basis-[60%] sm:basis-0">
                    <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">{s.name}{s.custom && <Badge tone="info">Custom</Badge>}{!s.active && <Badge tone="neutral">Unavailable</Badge>}</div>
                    <div className="text-[12.5px] text-muted">{NATURE[s.nature].label}{s.agency ? " · agency filing" : ""}{s.formation ? " · formation workspace" : ""} · ~{s.turnaroundDays} days{s.description ? ` · ${s.description}` : ""}</div>
                  </div>
                  <div className="text-right"><div className="text-[14px] font-bold tabular-nums text-ink">{money(s.price)}</div>{s.filingFeeEstimate ? <div className="text-[11.5px] text-muted">+ ~{money(s.filingFeeEstimate)} filing</div> : null}</div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" disabled={!admin} onClick={() => { biz.toggleService(s.id); toast(s.active ? `${s.name} unavailable for new requests` : `${s.name} available`); }}>{s.active ? "Make unavailable" : "Make available"}</Button>
                    <Button size="sm" icon={Pencil} disabled={!admin} aria-label={`Edit ${s.name}`} onClick={() => setEdit(s)}>Edit</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      <ServiceDialog svc={edit ?? undefined} open={edit !== undefined} onClose={() => setEdit(undefined)} />
    </div>
  );
}

export { portalHref };
