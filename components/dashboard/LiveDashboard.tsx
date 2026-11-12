"use client";

import { TodayCard } from "@/components/calendar/TodayCard";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarDays, FileText, Globe, UserPlus, Users } from "lucide-react";
import { useClients } from "@/lib/store/clients-store";
import { useLeads } from "@/lib/store/leads-store";
import { useTax } from "@/lib/store/tax-store";
import { useTeam } from "@/lib/store/team-store";
import { followUpBucket } from "@/lib/sample/leads";

/**
 * Dashboard with the backend on: only real numbers from the connected modules.
 * (Revenue, invoices, appointments and tasks return when those modules are built.)
 */
export function LiveDashboard() {
  const team = useTeam();
  const { clients } = useClients();
  const { leads } = useLeads();
  const tax = useTax();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const h = now?.getHours() ?? 9;
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  const first = team.me?.name?.split(" ")[0] ?? "";

  const stats = useMemo(() => {
    const t = now ?? new Date();
    const open = leads.filter((l) => l.status === "open");
    const due = open.filter((l) => ["overdue", "today"].includes(followUpBucket(l, t))).length;
    const active = clients.filter((c) => c.status !== "inactive").length;
    const returns = tax.returns.filter((r) => !["Completed", "Accepted"].includes(r.status)).length;
    const recent = [...open].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    return { open: open.length, due, active, returns, recent };
  }, [leads, clients, tax.returns, now]);

  const cards = [
    { label: "Active clients", value: stats.active, icon: Users, href: "/clients" },
    { label: "Open leads", value: stats.open, icon: UserPlus, href: "/leads" },
    { label: "Follow-ups due today", value: stats.due, icon: BellRing, href: "/leads", warn: stats.due > 0 },
    { label: "Tax returns in progress", value: stats.returns, icon: FileText, href: "/services/tax-preparation" },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[30px]">Good {part}{first ? `, ${first}` : ""}</h1>
          <p className="mt-1 text-[14px] text-muted sm:text-[15px]">Here&rsquo;s what&rsquo;s happening at MKB Financial Group today.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px] font-medium text-ink-2 shadow-soft">
          <CalendarDays size={16} className="text-accent" />
          <span suppressHydrationWarning>{now ? now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : " "}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-2xl border border-line bg-surface p-4 shadow-soft hover:border-accent/40 sm:p-5">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${c.warn ? "bg-warning-soft text-warning-ink" : "bg-accent-soft text-accent"}`}><c.icon size={19} /></span>
            <span className="mt-3 block text-[26px] font-bold tracking-tight text-ink">{c.value}</span>
            <span className="block text-[13px] text-muted">{c.label}</span>
          </Link>
        ))}
      </div>

      <TodayCard />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Newest open leads</h2>
            <Link href="/leads" className="text-[13px] font-semibold text-accent">All leads</Link>
          </div>
          {stats.recent.length ? (
            <ul className="divide-y divide-line">
              {stats.recent.map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-accent">
                    <span className="min-w-0 truncate text-[14px] font-medium text-ink">{l.name}</span>
                    <span className="shrink-0 text-[12px] text-muted">{l.source}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">No open leads yet. Website contact-form submissions show up here.</p>
          )}
        </section>
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Quick links</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Add a client", href: "/clients/new", icon: Users },
              { label: "Add a lead", href: "/leads/new", icon: UserPlus },
              { label: "Tax preparation", href: "/services/tax-preparation", icon: FileText },
              { label: "Edit the website", href: "/website", icon: Globe },
            ].map((q) => (
              <Link key={q.label} href={q.href} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-[14px] font-medium text-ink-2 hover:bg-surface-hover">
                <q.icon size={17} className="text-accent" />{q.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
