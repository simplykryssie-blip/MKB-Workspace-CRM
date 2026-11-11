"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { progress, type MonarchData, type Stage } from "@/lib/monarch/types";
import { Empty, MonarchGate, shortDate, StageBadge, TABLE_HEAD } from "./MonarchBits";
import { itemsOf } from "./MonarchHome";
import { OfficeDialog } from "./OfficeDialog";

const TABS: { key: "all" | "onboarding" | Stage; label: string }[] = [
  { key: "all", label: "All" },
  { key: "onboarding", label: "Onboarding" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

export function OfficesList() {
  return <MonarchGate>{(d) => <List d={d} />}</MonarchGate>;
}

function List({ d }: { d: MonarchData }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [adding, setAdding] = useState(false);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.offices
      .filter((o) => tab === "all" || (tab === "onboarding" ? !["active", "inactive"].includes(o.stage) : o.stage === tab))
      .filter((o) => !t || [o.name, o.contactName, o.email, o.city, ...o.locations.map((l) => l.efin)].some((x) => x.toLowerCase().includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [d.offices, q, tab]);
  const count = (k: (typeof TABS)[number]["key"]) => d.offices.filter((o) => k === "all" || (k === "onboarding" ? !["active", "inactive"].includes(o.stage) : o.stage === k)).length;
  return (
    <div>
      <PageHeader title="Offices" subtitle="The tax offices (EROs) you sell to and support." actions={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>New office</Button>} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 sm:px-6">
          <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`h-8 rounded-lg px-3 text-[13px] font-semibold ${tab === t.key ? "bg-accent text-white" : "border border-line bg-surface text-ink-2 hover:bg-surface-hover"}`}>{t.label} ({count(t.key)})</button>
            ))}
          </div>
          <label className="relative ml-auto w-full sm:w-[260px]">
            <span className="sr-only">Search offices</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, contact, city or EFIN" className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13.5px] text-ink placeholder:text-faint" />
          </label>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13.5px]">
              <thead className={TABLE_HEAD}><tr><th className="px-5 py-2.5 sm:px-6">Office</th><th className="px-3 py-2.5">Stage</th><th className="px-3 py-2.5">Package</th><th className="px-3 py-2.5">Software · Bank</th><th className="px-3 py-2.5">Checklist</th><th className="px-3 py-2.5">Locations</th><th className="px-5 py-2.5 sm:px-6">Renews</th></tr></thead>
              <tbody>
                {rows.map((o) => {
                  const p = progress(o, itemsOf(d, o));
                  return (
                    <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                      <td className="px-5 py-3 sm:px-6"><Link href={`/monarch/offices/${o.id}`} className="font-semibold text-ink hover:text-accent">{o.name}</Link><span className="block text-[12px] text-muted">{[o.contactName, o.city && `${o.city}${o.state ? `, ${o.state}` : ""}`].filter(Boolean).join(" · ") || "—"}</span></td>
                      <td className="px-3 py-3"><StageBadge stage={o.stage} /></td>
                      <td className="px-3 py-3 text-ink-2">{d.packages.find((x) => x.id === o.packageId)?.name ?? "—"}</td>
                      <td className="px-3 py-3 text-ink-2">{[d.software.find((x) => x.id === o.softwareId)?.name, d.banks.find((x) => x.id === o.bankId)?.name].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-3 text-ink-2">{p.done} of {p.total}</td>
                      <td className="px-3 py-3 text-ink-2">{o.locations.length}</td>
                      <td className="px-5 py-3 text-ink-2 sm:px-6">{shortDate(o.renewsOn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title={d.offices.length ? "No offices match" : "No offices yet"}>{d.offices.length ? "Try another filter or search." : "Add the first office you're selling to or onboarding."}</Empty>}
      </Card>
      <OfficeDialog open={adding} onClose={() => setAdding(false)} data={d} />
    </div>
  );
}
