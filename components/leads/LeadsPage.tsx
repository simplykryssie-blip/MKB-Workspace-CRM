"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  BellRing,
  Building2,
  CircleDollarSign,
  Columns3,
  Download,
  Filter,
  List,
  MoreHorizontal,
  Percent,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { useToast } from "@/components/ui/Toast";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { SAMPLE_NOW, STAFF, staffById, staffList } from "@/lib/sample/clients";
import { PRIORITY_ORDER, followUpBucket, nextFollowUp, type FollowUpBucket } from "@/lib/sample/leads";
import { useClients } from "@/lib/store/clients-store";
import { useLeads } from "@/lib/store/leads-store";
import { relTime, usd } from "@/lib/format";
import type { Lead, LeadPriority, LeadStatus, ServiceKey } from "@/lib/types";
import { FollowUpChip, PriorityBadge, StatusBadge } from "./LeadBits";
import { LostDialog, PipelineSettingsDialog } from "./LeadDialogs";

type SortKey = "follow" | "newest" | "priority" | "value" | "name";
type View = "board" | "list";

export function LeadsPage() {
  const store = useLeads();
  const clientStore = useClients();
  const router = useRouter();
  const toast = useToast();
  const { leads, stages, sources } = store;

  const [view, setView] = useState<View>("board");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("open");
  const [stage, setStage] = useState("all");
  const [source, setSource] = useState("all");
  const [owner, setOwner] = useState("all");
  const [priority, setPriority] = useState<LeadPriority | "all">("all");
  const [type, setType] = useState<"all" | "individual" | "business">("all");
  const [follow, setFollow] = useState<"all" | "due" | FollowUpBucket>("all");
  const [interest, setInterest] = useState<ServiceKey | "all">("all");
  const [sort, setSort] = useState<SortKey>("follow");
  const [selected, setSelected] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lostIds, setLostIds] = useState<string[] | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Remember the preferred view per browser (convenience only).
  useEffect(() => {
    try {
      const v = localStorage.getItem("mkb-leads-view");
      if (v === "list" || v === "board") setView(v);
    } catch {}
  }, []);
  const chooseView = (v: View) => {
    setView(v);
    setSelected([]);
    try {
      localStorage.setItem("mkb-leads-view", v);
    } catch {}
  };

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const digitsQ = n.replace(/\D/g, "");
    return leads
      .filter((l) => {
        if (n && ![l.name, l.email, l.contactName ?? "", l.source, l.sourceDetail ?? "", l.id, ...l.tags].some((f) => f.toLowerCase().includes(n)) && !(digitsQ.length >= 3 && l.phone.replace(/\D/g, "").includes(digitsQ))) return false;
        if (status !== "all" && l.status !== status) return false;
        if (stage !== "all" && l.stageId !== stage) return false;
        if (source !== "all" && l.source !== source) return false;
        if (owner !== "all" && l.ownerId !== owner) return false;
        if (priority !== "all" && l.priority !== priority) return false;
        if (type !== "all" && l.type !== type) return false;
        if (interest !== "all" && !l.interests.includes(interest)) return false;
        if (follow !== "all") {
          const b = followUpBucket(l);
          if (follow === "due" ? b !== "overdue" && b !== "today" : b !== follow) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
        if (sort === "value") return b.estValue - a.estValue;
        if (sort === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (nextFollowUp(a)?.at ?? "z").localeCompare(nextFollowUp(b)?.at ?? "z");
        return (nextFollowUp(a)?.at ?? "z").localeCompare(nextFollowUp(b)?.at ?? "z") || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      });
  }, [leads, q, status, stage, source, owner, priority, type, follow, interest, sort]);

  const filtersOn = q !== "" || status !== "open" || stage !== "all" || source !== "all" || owner !== "all" || priority !== "all" || type !== "all" || follow !== "all" || interest !== "all";
  const reset = () => {
    setQ("");
    setStatus("open");
    setStage("all");
    setSource("all");
    setOwner("all");
    setPriority("all");
    setType("all");
    setFollow("all");
    setInterest("all");
  };

  // KPIs
  const open = leads.filter((l) => l.status === "open");
  const due = open.filter((l) => ["overdue", "today"].includes(followUpBucket(l)));
  const weekAgo = new Date(SAMPLE_NOW);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const newThisWeek = leads.filter((l) => l.createdAt >= weekAgo.toISOString()).length;
  const closed = leads.filter((l) => l.status !== "open");
  const convRate = closed.length ? Math.round((leads.filter((l) => l.status === "converted").length / closed.length) * 100) : 0;
  const pipeline = open.reduce((s, l) => s + l.estValue, 0);

  const exportCsv = (rows: Lead[]) => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["Lead ID", "Name", "Type", "Contact", "Email", "Phone", "Source", "Source detail", "Interested in", "Stage", "Status", "Priority", "Owner", "Next follow-up", "Est. value", "Created"];
    const lines = rows.map((l) =>
      [l.id, l.name, l.type, l.contactName ?? "", l.email, l.phone, l.source, l.sourceDetail ?? "", l.interests.map((s) => SERVICES[s].label).join("; "), stages.find((s) => s.id === l.stageId)?.name ?? "", l.status, l.priority, staffById(l.ownerId).name, nextFollowUp(l)?.at.slice(0, 16).replace("T", " ") ?? "", l.estValue, l.createdAt.slice(0, 10)].map(esc).join(","),
    );
    const url = URL.createObjectURL(new Blob([[header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mkb-leads-sample.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${rows.length} lead${rows.length === 1 ? "" : "s"} (sample data)`);
  };

  const moveTo = (ids: string[], stageId: string) => {
    store.setStage(ids, stageId);
    toast(`${ids.length > 1 ? `${ids.length} leads` : leads.find((l) => l.id === ids[0])?.name} → ${stages.find((s) => s.id === stageId)?.name}`);
  };

  const kpis = [
    { label: "Open leads", value: String(open.length), icon: UserPlus, onClick: () => { reset(); } },
    { label: "Follow-ups due", value: String(due.length), icon: BellRing, tone: due.length ? "text-warning-ink" : "", onClick: () => { reset(); setFollow("due"); } },
    { label: "New this week", value: String(newThisWeek), icon: Sparkles, onClick: () => { reset(); setSort("newest"); } },
    { label: "Conversion rate", value: `${convRate}%`, icon: Percent, onClick: () => { reset(); setStatus("converted"); } },
    { label: "Pipeline value", value: usd(pipeline), icon: CircleDollarSign, onClick: () => { reset(); setSort("value"); } },
  ];

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Track prospects from first contact to client — across every MKB service."
        actions={
          <>
            <Button variant="ghost" icon={RotateCcw} aria-label="Reset sample data" title="Reset sample data" className="px-2.5 sm:px-4" onClick={() => { if (confirm("Reset leads and clients to the original sample data?")) { store.reset(); clientStore.reset(); toast("Sample data reset"); } }}>
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button icon={Settings2} onClick={() => setSettingsOpen(true)}>
              <span className="hidden sm:inline">Pipeline settings</span>
              <span className="sm:hidden">Stages</span>
            </Button>
            <Button icon={Download} aria-label="Export" title="Export to CSV" className="px-2.5 sm:px-4" onClick={() => exportCsv(filtered)} disabled={!filtered.length}><span className="hidden sm:inline">Export</span></Button>
            <Button variant="primary" icon={Plus} href="/leads/new">New lead</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k, i) => (
          <button key={k.label} onClick={k.onClick} className={`flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop ${i === kpis.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><k.icon size={18} /></span>
            <span className="min-w-0">
              <span className={`block text-[19px] font-bold leading-tight tabular-nums ${k.tone || "text-ink"}`}>{k.value}</span>
              <span className="block text-[12.5px] leading-tight text-muted">{k.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <section className="mt-4 rounded-2xl border border-line bg-surface shadow-soft">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="View" className="flex rounded-xl border border-line bg-surface-2 p-0.5">
              {(
                [
                  ["board", "Board", Columns3],
                  ["list", "List", List],
                ] as const
              ).map(([v, l, Icon]) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => chooseView(v)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium ${view === v ? "bg-surface text-accent shadow-soft" : "text-muted hover:text-ink"}`}>
                  <Icon size={16} /> {l}
                </button>
              ))}
            </div>
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search leads</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, source, tag…" className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15" />
            </label>
            <Sel label="Sort" icon value={sort} onChange={(v) => setSort(v as SortKey)} options={[["follow", "Follow-up"], ["priority", "Priority"], ["newest", "Newest"], ["value", "Value"], ["name", "Name A–Z"]]} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Sel label="Status" value={status} onChange={(v) => setStatus(v as LeadStatus | "all")} options={[["open", "Open"], ["converted", "Converted"], ["lost", "Lost"], ["all", "All statuses"]]} />
            {view === "list" && <Sel label="Stage" value={stage} onChange={setStage} options={[["all", "All stages"], ...stages.map((s) => [s.id, s.name] as [string, string])]} />}
            <Sel label="Source" value={source} onChange={setSource} options={[["all", "All sources"], ...[...new Set([...sources, ...leads.map((l) => l.source)])].map((s) => [s, s] as [string, string])]} />
            <Sel label="Assigned to" value={owner} onChange={setOwner} options={[["all", "All staff"], ...staffList().map((s) => [s.id, s.name] as [string, string])]} />
            <Sel label="Priority" value={priority} onChange={(v) => setPriority(v as LeadPriority | "all")} options={[["all", "Any priority"], ["urgent", "Urgent"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
            <Sel label="Follow-up" value={follow} onChange={(v) => setFollow(v as typeof follow)} options={[["all", "Any follow-up"], ["due", "Due (overdue + today)"], ["overdue", "Overdue"], ["today", "Today"], ["week", "Next 7 days"], ["none", "None scheduled"]]} />
            <Sel label="Type" value={type} onChange={(v) => setType(v as typeof type)} options={[["all", "All types"], ["individual", "Individuals"], ["business", "Businesses"]]} />
            <Sel label="Interested in" value={interest} onChange={(v) => setInterest(v as ServiceKey | "all")} options={[["all", "Any service"], ...SERVICE_ORDER.map((s) => [s, SERVICES[s].label] as [string, string])]} />
            {filtersOn && (
              <button onClick={reset} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-accent hover:bg-accent-soft">
                <X size={13} /> Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12.5px] text-muted sm:px-5">
          <span className="inline-flex items-center gap-1.5">
            <Filter size={13} /> Showing <strong className="text-ink-2">{filtered.length}</strong> of {leads.length} leads
          </span>
          {view === "board" && <span className="hidden sm:inline">Drag cards between stages, or use a card&rsquo;s ⋯ menu</span>}
        </div>
      </section>

      {/* Board */}
      {view === "board" && (
        <div className="scrollbar-thin -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-label="Lead pipeline board">
          {stages.map((st) => {
            const col = filtered.filter((l) => l.stageId === st.id);
            return (
              <section
                key={st.id}
                aria-label={`${st.name} — ${col.length} leads`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(st.id);
                }}
                onDragLeave={() => setDragOver((d) => (d === st.id ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData("text/lead");
                  if (id && leads.find((l) => l.id === id)?.stageId !== st.id) moveTo([id], st.id);
                }}
                className={`flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl border bg-surface-2 sm:w-[290px] ${dragOver === st.id ? "border-accent ring-4 ring-accent/15" : "border-line"}`}
              >
                <header className="flex items-center gap-2 px-3.5 pb-2 pt-3">
                  <h2 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{st.name}</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-ink-2 ring-1 ring-line">{col.length}</span>
                </header>
                <div className="px-3.5 pb-2 text-[11.5px] text-muted tabular-nums">{usd(col.reduce((s, l) => s + l.estValue, 0))} est.</div>
                <ul className="flex min-h-[120px] flex-1 flex-col gap-2 px-2.5 pb-3">
                  {col.map((l) => (
                    <LeadCard key={l.id} l={l} onOpen={() => router.push(`/leads/${l.id}`)} stages={stages} onMove={(sid) => moveTo([l.id], sid)} />
                  ))}
                  {col.length === 0 && <li className="grid flex-1 place-items-center rounded-xl border-2 border-dashed border-line px-3 py-6 text-center text-[12.5px] text-faint">Drop leads here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* List */}
      {view === "list" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface shadow-soft">
          {selected.length > 0 && (
            <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-line bg-accent-soft px-4 py-2.5 lg:top-[72px]">
              <span className="text-[13px] font-semibold text-accent-ink">{selected.length} selected</span>
              <BulkSelect label="Assign to…" options={staffList().map((s) => [s.id, s.name])} onPick={(v) => { store.setOwner(selected, v); toast(`Assigned ${selected.length} lead(s) to ${staffById(v).name}`); }} />
              <BulkSelect label="Move to stage…" options={stages.map((s) => [s.id, s.name])} onPick={(v) => moveTo(selected, v)} />
              <BulkSelect label="Set priority…" options={[["urgent", "Urgent"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]} onPick={(v) => { store.setPriority(selected, v as LeadPriority); toast(`Priority updated on ${selected.length} lead(s)`); }} />
              <Button size="sm" onClick={() => setLostIds(selected.filter((id) => leads.find((l) => l.id === id)?.status === "open"))}>Mark lost</Button>
              <Button size="sm" icon={Download} onClick={() => exportCsv(leads.filter((l) => selected.includes(l.id)))}>Export</Button>
              <button onClick={() => setSelected([])} className="ml-auto text-[12.5px] font-semibold text-accent">Clear</button>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[14px] font-medium text-ink">No leads match these filters.</p>
              <button onClick={reset} className="mt-2 text-[13px] font-semibold text-accent">Clear filters</button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-[13.5px]">
                  <thead className="border-b border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="w-10 px-4 py-2.5">
                        <input type="checkbox" aria-label="Select all" checked={selected.length === filtered.length} onChange={(e) => setSelected(e.target.checked ? filtered.map((l) => l.id) : [])} className="h-4 w-4 accent-[var(--accent)]" />
                      </th>
                      <th className="px-2 py-2.5">Lead</th>
                      <th className="px-3 py-2.5">Interested in</th>
                      <th className="px-3 py-2.5">Stage</th>
                      <th className="px-3 py-2.5">Priority</th>
                      <th className="px-3 py-2.5">Follow-up</th>
                      <th className="px-3 py-2.5">Source</th>
                      <th className="px-3 py-2.5">Owner</th>
                      <th className="px-5 py-2.5 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr key={l.id} onClick={() => router.push(`/leads/${l.id}`)} className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover ${selected.includes(l.id) ? "bg-accent-soft/40" : ""}`}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Select ${l.name}`} checked={selected.includes(l.id)} onChange={() => setSelected((s) => (s.includes(l.id) ? s.filter((x) => x !== l.id) : [...s, l.id]))} className="h-4 w-4 accent-[var(--accent)]" />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={l.name} size={34} square={l.type === "business"} />
                            <div className="min-w-0">
                              <Link href={`/leads/${l.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-ink hover:text-accent">{l.name}</Link>
                              <div className="flex items-center gap-1 truncate text-[12px] text-muted">
                                {l.type === "business" ? <Building2 size={12} /> : <User size={12} />}
                                {l.type === "business" ? l.contactName : l.email || l.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><div className="flex max-w-[220px] flex-wrap gap-1">{l.interests.map((s) => <ServiceTag key={s} service={s} short />)}</div></td>
                        <td className="px-3 py-3 text-ink-2">{l.status === "open" ? stages.find((s) => s.id === l.stageId)?.name : <StatusBadge s={l.status} />}</td>
                        <td className="px-3 py-3"><PriorityBadge p={l.priority} /></td>
                        <td className="px-3 py-3"><FollowUpChip lead={l} /></td>
                        <td className="px-3 py-3 text-[12.5px] text-ink-2">{l.source}</td>
                        <td className="px-3 py-3"><Avatar name={staffById(l.ownerId).name} size={26} /></td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink">{usd(l.estValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-line lg:hidden">
                {filtered.map((l) => (
                  <li key={l.id} className={`flex items-start gap-3 px-4 py-3.5 ${selected.includes(l.id) ? "bg-accent-soft/40" : ""}`}>
                    <input type="checkbox" aria-label={`Select ${l.name}`} checked={selected.includes(l.id)} onChange={() => setSelected((s) => (s.includes(l.id) ? s.filter((x) => x !== l.id) : [...s, l.id]))} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                    <Link href={`/leads/${l.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-ink">{l.name}</span>
                        <PriorityBadge p={l.priority} />
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-muted">
                        {l.status === "open" ? stages.find((s) => s.id === l.stageId)?.name : <StatusBadge s={l.status} />} · {l.source} · {staffById(l.ownerId).name}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {l.interests.map((s) => <ServiceTag key={s} service={s} short />)}
                        <FollowUpChip lead={l} compact />
                      </div>
                    </Link>
                    <span className="shrink-0 text-[13.5px] font-semibold text-ink tabular-nums">{usd(l.estValue)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <PipelineSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LostDialog leadIds={lostIds ?? []} open={!!lostIds} onClose={() => { setLostIds(null); setSelected([]); }} label={`${lostIds?.length ?? 0} lead(s)`} />
    </>
  );
}

function LeadCard({ l, onOpen, stages, onMove }: { l: Lead; onOpen: () => void; stages: { id: string; name: string }[]; onMove: (stageId: string) => void }) {
  return (
    <li
      draggable={l.status === "open"}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/lead", l.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group relative rounded-xl border border-line bg-surface p-3 shadow-soft transition hover:border-accent/50 hover:shadow-pop"
    >
      <button onClick={onOpen} className="block w-full text-left" aria-label={`Open ${l.name}`}>
        <div className="flex items-start gap-2 pr-7">
          <span className="mt-0.5 text-muted">{l.type === "business" ? <Building2 size={14} /> : <User size={14} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{l.name}</span>
            <span className="block truncate text-[12px] text-muted">{l.type === "business" ? l.contactName : l.source}{l.type === "business" ? ` · ${l.source}` : ""}</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">{l.interests.map((s) => <ServiceTag key={s} service={s} short />)}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {l.priority !== "medium" && l.priority !== "low" && <PriorityBadge p={l.priority} />}
          {l.status !== "open" ? <StatusBadge s={l.status} /> : <FollowUpChip lead={l} compact />}
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={staffById(l.ownerId).name} size={20} />
            {relTime(l.lastActivityAt)}
          </span>
          <span className="font-semibold text-ink-2 tabular-nums">{usd(l.estValue)}</span>
        </div>
      </button>
      {l.status === "open" && (
        <div className="absolute right-1.5 top-1.5">
          <Menu
            label={`Move ${l.name}`}
            trigger={({ toggle }) => (
              <button onClick={toggle} aria-label={`Move ${l.name} to another stage`} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink">
                <MoreHorizontal size={16} />
              </button>
            )}
            items={stages.map((s) => ({ label: s.id === l.stageId ? `✓ ${s.name}` : `Move to ${s.name}`, disabled: s.id === l.stageId, onSelect: () => onMove(s.id) }))}
          />
        </div>
      )}
    </li>
  );
}

function Sel({ label, value, onChange, options, icon }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; icon?: boolean }) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      {icon && <ArrowDownUp size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`h-10 w-full rounded-xl border border-line bg-surface pr-8 text-[13.5px] font-medium text-ink-2 focus:border-accent focus:outline-none ${icon ? "pl-8" : "pl-3"}`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function BulkSelect({ label, options, onPick }: { label: string; options: [string, string][] | string[][]; onPick: (v: string) => void }) {
  return (
    <select aria-label={label} value="" onChange={(e) => { if (e.target.value) onPick(e.target.value); }} className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] font-medium text-ink-2">
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

