"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMonarch } from "@/lib/store/monarch-store";
import type { MonarchData, Office } from "@/lib/monarch/types";
import { Empty, MonarchGate, shortDate, TABLE_HEAD, useAct } from "./MonarchBits";
import { OfficeDialog } from "./OfficeDialog";

/** Monarch leads: tax offices you might sell to (imports, website forms, texts, bookings). Not part of onboarding. */
export function LeadsPage() {
  return <MonarchGate>{(d) => <List d={d} />}</MonarchGate>;
}

/** Where the lead came from, from the first line of its notes. */
const sourceOf = (o: Office) => {
  const n = o.notes ?? "";
  if (/^Imported from the old CRM/i.test(n)) { const tags = n.match(/Tags in the old CRM: ([^.\n]+)/i)?.[1]; return tags ? `Old CRM · ${tags}` : "Old CRM"; }
  if (/WISP Generator/i.test(n)) return "WISP Generator";
  if (/contact form/i.test(n)) return "Website form";
  if (/texting/i.test(n)) return "Text message";
  if (/booked|booking/i.test(n)) return "Booking";
  return "Added by staff";
};

function List({ d }: { d: MonarchData }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const leads = useMemo(() => d.offices.filter((o) => o.stage === "lead"), [d.offices]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads
      .filter((o) => !t || [o.name, o.contactName, o.email, o.phone, o.city, o.state, o.notes ?? ""].some((x) => x.toLowerCase().includes(t)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name));
  }, [leads, q]);
  const start = (o: Office) => run(`start:${o.id}`, () => m.applyOffice("PUT", `/api/monarch/offices/${o.id}`, { rev: o.rev, patch: { stage: "interested" } }), `${o.name} moved to onboarding`);
  return (
    <div>
      <PageHeader title="Leads" subtitle={`Tax offices you might sell to — imports, website forms, texts and bookings. ${leads.length} lead${leads.length === 1 ? "" : "s"}. Start onboarding when one is ready to buy.`} actions={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>New lead</Button>} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 sm:px-6">
          <label className="relative w-full sm:w-[320px]">
            <span className="sr-only">Search leads</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, contact, email, phone or tag" className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13.5px] text-ink placeholder:text-faint" />
          </label>
          {q && <span className="text-[13px] text-muted">{rows.length} match{rows.length === 1 ? "" : "es"}</span>}
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead className={TABLE_HEAD}><tr><th className="px-5 py-2.5 sm:px-6">Lead</th><th className="px-3 py-2.5">Contact</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5">Added</th><th className="px-5 py-2.5 sm:px-6"><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                    <td className="px-5 py-3 sm:px-6"><Link href={`/monarch/offices/${o.id}`} className="font-semibold text-ink hover:text-accent">{o.name}</Link><span className="block text-[12px] text-muted">{[o.contactName !== o.name && o.contactName, o.city && `${o.city}${o.state ? `, ${o.state}` : ""}`].filter(Boolean).join(" · ") || "—"}</span></td>
                    <td className="px-3 py-3 text-ink-2"><span className="block">{o.email || "—"}</span><span className="block text-[12px] text-muted">{o.phone}</span></td>
                    <td className="px-3 py-3 text-ink-2">{sourceOf(o)}</td>
                    <td className="px-3 py-3 text-ink-2">{shortDate(o.createdAt)}</td>
                    <td className="px-5 py-3 text-right sm:px-6"><Button size="sm" icon={ArrowRight} disabled={!!busy} onClick={() => void start(o)}>Start onboarding</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title={leads.length ? "No leads match" : "No leads yet"}>{leads.length ? "Try another search." : "Website forms, texts and bookings from new offices land here."}</Empty>}
      </Card>
      <OfficeDialog open={adding} onClose={() => setAdding(false)} data={d} asLead />
    </div>
  );
}
