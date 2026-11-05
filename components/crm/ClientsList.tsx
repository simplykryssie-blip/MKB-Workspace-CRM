"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownUp, Building2, ChevronRight, Download, Filter, Layers, RotateCcw, Search, User, UserCheck, Users, X } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { STAFF, balanceDue, openRequirements, staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { UserPlus } from "lucide-react";
import { clientStatus } from "@/lib/status";
import { relTime, usd } from "@/lib/format";
import type { ClientStatus, ServiceKey } from "@/lib/types";

type SortKey = "recent" | "name" | "balance";

export function ClientsList() {
  const router = useRouter();
  const { clients: CLIENTS, reset: resetStore } = useClients();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [services, setServices] = useState<ServiceKey[]>([]);
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [staff, setStaff] = useState<string>("all");
  const [type, setType] = useState<"all" | "individual" | "business">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CLIENTS.filter((c) => {
      if (needle && ![c.name, c.email, c.phone, c.contactName ?? "", c.business?.legalName ?? "", ...c.tags].some((f) => f.toLowerCase().includes(needle))) return false;
      if (services.length && !services.every((s) => c.enrollments.some((e) => e.service === s))) return false;
      if (status !== "all" && c.status !== status) return false;
      if (staff !== "all" && !c.staffIds.includes(staff)) return false;
      if (type !== "all" && c.type !== type) return false;
      return true;
    }).sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "balance" ? balanceDue(b) - balanceDue(a) : b.lastActivityAt.localeCompare(a.lastActivityAt),
    );
  }, [CLIENTS, q, services, status, staff, type, sort]);

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["Client ID", "Name", "Type", "Contact", "Email", "Phone", "City", "State", "Status", "Services", "Assigned staff", "Open items", "Balance due", "Last activity"];
    const lines = rows.map((c) =>
      [c.id, c.name, c.type, c.contactName ?? "", c.email, c.phone, c.address.city, c.address.state, c.status, [...new Set(c.enrollments.map((e) => SERVICES[e.service].label))].join("; "), c.staffIds.map((id) => staffById(id).name).join("; "), openRequirements(c), balanceDue(c), c.lastActivityAt.slice(0, 10)].map(esc).join(","),
    );
    const url = URL.createObjectURL(new Blob([[header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mkb-clients-sample.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${rows.length} client${rows.length === 1 ? "" : "s"} to CSV (sample data) — logged`);
  };

  const filtersOn = services.length > 0 || status !== "all" || staff !== "all" || type !== "all" || q !== "";
  const reset = () => {
    setQ("");
    setServices([]);
    setStatus("all");
    setStaff("all");
    setType("all");
  };
  const toggleService = (s: ServiceKey) => setServices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const multi = CLIENTS.filter((c) => new Set(c.enrollments.map((e) => e.service)).size > 1).length;
  const summary = [
    { label: "Total clients", value: CLIENTS.length, icon: Users },
    { label: "Active", value: CLIENTS.filter((c) => c.status === "active").length, icon: UserCheck },
    { label: "Onboarding", value: CLIENTS.filter((c) => c.status === "onboarding").length, icon: User },
    { label: "Using 2+ services", value: multi, icon: Layers },
  ];

  return (
    <>
    <PageHeader
      title="Clients"
      subtitle="One record per client, shared across every MKB service."
      actions={
        <>
          <Button icon={RotateCcw} variant="ghost" aria-label="Reset sample data" title="Reset sample data" className="px-2.5 sm:px-4" onClick={() => { if (confirm("Reset all sample data to its original state? Changes made in this session will be lost.")) { resetStore(); toast("Sample data reset"); } }}>
            <span className="hidden sm:inline">Reset sample data</span>
          </Button>
          <Button icon={Download} onClick={exportCsv} disabled={rows.length === 0}>
            Export<span className="hidden sm:inline">{filtersOn ? " filtered" : ""}</span>
          </Button>
          <Button variant="primary" icon={UserPlus} href="/clients/new">
            New client
          </Button>
        </>
      }
    />
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-soft">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
              <s.icon size={18} />
            </span>
            <div>
              <div className="text-[20px] font-bold leading-tight text-ink tabular-nums">{s.value}</div>
              <div className="text-[12.5px] text-muted">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-surface shadow-soft">
        {/* Filters — one row above the list */}
        <div className="space-y-3 border-b border-line p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative w-full min-w-[200px] flex-1 sm:w-auto">
              <span className="sr-only">Search clients</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, phone, tag…"
                className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15"
              />
            </label>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Select label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={[["all", "All statuses"], ["active", "Active"], ["onboarding", "Onboarding"], ["inactive", "Inactive"]]} />
            <Select label="Assigned staff" value={staff} onChange={setStaff} options={[["all", "All staff"], ...STAFF.map((s) => [s.id, s.name] as [string, string])]} />
            <Select label="Client type" value={type} onChange={(v) => setType(v as typeof type)} options={[["all", "All types"], ["individual", "Individuals"], ["business", "Businesses"]]} />
            <Select label="Sort" icon value={sort} onChange={(v) => setSort(v as SortKey)} options={[["recent", "Recent"], ["name", "Name A–Z"], ["balance", "Balance due"]]} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[12.5px] font-medium text-muted">
              <Filter size={13} /> Services:
            </span>
            {SERVICE_ORDER.map((s) => {
              const on = services.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleService(s)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
                    on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-hover"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: `var(--svc-${s})` }} />
                  {SERVICES[s].label}
                </button>
              );
            })}
            {filtersOn && (
              <button onClick={reset} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-accent hover:bg-accent-soft">
                <X size={13} /> Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 text-[12.5px] text-muted sm:px-5">
          <span>
            Showing <strong className="text-ink-2">{rows.length}</strong> of {CLIENTS.length} clients
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 pb-10 pt-6 text-center">
            <p className="text-[14px] font-medium text-ink">No clients match these filters.</p>
            <button onClick={reset} className="mt-2 text-[13px] font-semibold text-accent">
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-[13.5px]">
                <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-2.5">Client</th>
                    <th className="px-3 py-2.5">Services</th>
                    <th className="px-3 py-2.5">Assigned</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Open items</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-5 py-2.5 text-right">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const bal = balanceDue(c);
                    const open = openRequirements(c);
                    const st = clientStatus[c.status];
                    return (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/clients/${c.id}`)}
                        className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} square={c.type === "business"} />
                            <div className="min-w-0">
                              <Link href={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-ink hover:text-accent">
                                {c.name}
                              </Link>
                              <div className="flex items-center gap-1 truncate text-[12px] text-muted">
                                {c.type === "business" ? <Building2 size={12} /> : <User size={12} />}
                                {c.type === "business" ? c.contactName : c.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex max-w-[260px] flex-wrap gap-1">
                            {[...new Set(c.enrollments.map((e) => e.service))].map((s) => (
                              <ServiceTag key={s} service={s} short />
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <AvatarStack names={c.staffIds.map((id) => staffById(id).name)} />
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{open > 0 ? <span className="font-semibold text-warning-ink">{open}</span> : <span className="text-faint">—</span>}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{bal > 0 ? <span className="text-ink">{usd(bal)}</span> : <span className="font-normal text-faint">$0</span>}</td>
                        <td className="px-5 py-3 text-right text-[12.5px] text-muted">{relTime(c.lastActivityAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <ul className="divide-y divide-line border-t border-line lg:hidden">
              {rows.map((c) => {
                const bal = balanceDue(c);
                const st = clientStatus[c.status];
                return (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-hover sm:px-5">
                      <Avatar name={c.name} size={40} square={c.type === "business"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[14.5px] font-semibold text-ink">{c.name}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <div className="mt-0.5 truncate text-[12.5px] text-muted">{c.type === "business" ? c.contactName : c.email}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {[...new Set(c.enrollments.map((e) => e.service))].map((s) => (
                            <ServiceTag key={s} service={s} short />
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-[13.5px] font-semibold tabular-nums ${bal > 0 ? "text-ink" : "text-faint"}`}>{usd(bal)}</div>
                        <div className="text-[11.5px] text-muted">{relTime(c.lastActivityAt)}</div>
                        <ChevronRight size={16} className="ml-auto mt-1 text-faint" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  icon?: boolean;
}) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      {icon && <ArrowDownUp size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full rounded-xl border border-line bg-surface pr-8 text-[13.5px] font-medium text-ink-2 focus:border-accent focus:outline-none ${icon ? "pl-8" : "pl-3"}`}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
