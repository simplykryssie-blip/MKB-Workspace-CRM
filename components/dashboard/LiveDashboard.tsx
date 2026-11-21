"use client";

import { TodayCard } from "@/components/calendar/TodayCard";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarDays, FileText, Globe, Receipt, UserPlus, Users } from "lucide-react";
import { useClients } from "@/lib/store/clients-store";
import { useLeads } from "@/lib/store/leads-store";
import { useTax } from "@/lib/store/tax-store";
import { useTeam } from "@/lib/store/team-store";
import { followUpBucket } from "@/lib/sample/leads";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { call } from "@/lib/sync/remote";
import type { Invoice, ServiceKey } from "@/lib/types";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const SVC_NAME: Record<ServiceKey, string> = { tax: "Tax preparation", books: "Bookkeeping & payroll", biz: "Business Solutions", expunge: "Expungement Relief" };
const MODULE: Record<ServiceKey, "tax" | "books" | "biz" | "exp"> = { tax: "tax", books: "books", biz: "biz", expunge: "exp" };

/** Dashboard with the backend on: real numbers across every service (tax, bookkeeping & payroll, business, expungement). */
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
  const canBilling = team.can("billing", "view");
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [sigs, setSigs] = useState<{ service: ServiceKey }[]>([]);
  useEffect(() => { call<{ requests: { service: ServiceKey }[] }>("GET", "/api/signatures/pending").then((r) => setSigs(r.requests)).catch(() => setSigs([])); }, []);
  useEffect(() => { if (canBilling) call<{ invoices: Invoice[] }>("GET", "/api/billing/invoices").then((r) => setInvoices(r.invoices)).catch(() => setInvoices(null)); }, [canBilling]);

  const stats = useMemo(() => {
    const t = now ?? new Date();
    const open = leads.filter((l) => l.status === "open");
    const due = open.filter((l) => ["overdue", "today"].includes(followUpBucket(l, t))).length;
    const active = clients.filter((c) => c.status !== "inactive").length;
    // A return only counts as in progress once the client has submitted the interview (or it moved past Intake).
    const openReturns = tax.returns.filter((r) => !["Completed", "Accepted"].includes(r.status));
    const notStarted = (r: (typeof openReturns)[number]) => r.status === "Intake" && !["submitted", "reviewed"].includes(r.organizer?.status ?? "not_sent");
    const returns = openReturns.filter((r) => !notStarted(r)).length;
    const interviewsOut = openReturns.filter((r) => notStarted(r) && r.organizer?.status !== "not_sent").length;
    const recent = [...open].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const live = (invoices ?? []).filter((i) => i.status !== "void" && i.status !== "draft" && i.paymentMode !== "bank_product");
    const owedOf = (i: Invoice) => Math.max(0, i.amount - i.paid);
    const month = t.toISOString().slice(0, 7);
    const services = SERVICE_ORDER.map((k) => {
      const enr = clients.flatMap((c) => c.enrollments.filter((e) => e.service === k && !["complete", "cancelled"].includes(e.status)));
      const inv = (invoices ?? []).filter((i) => i.service === k && i.status !== "void");
      return {
        k,
        active: k === "tax" ? returns : enr.length,
        waiting: enr.filter((e) => e.status === "waiting_on_client").length,
        review: enr.filter((e) => e.status === "in_review").length,
        clients: new Set(clients.filter((c) => c.enrollments.some((e) => e.service === k && !["complete", "cancelled"].includes(e.status))).map((c) => c.id)).size,
        owed: inv.filter((i) => i.status !== "draft" && i.paymentMode !== "bank_product").reduce((s, i) => s + owedOf(i), 0),
        collected: inv.filter((i) => i.paidAt?.startsWith(month)).reduce((s, i) => s + i.paid, 0),
      };
    });
    return { open: open.length, due, active, returns, interviewsOut, recent, services, owed: live.reduce((s, i) => s + owedOf(i), 0), overdue: live.filter((i) => i.status === "overdue").length, drafts: (invoices ?? []).filter((i) => i.status === "draft").length };
  }, [leads, clients, tax.returns, now, invoices]);

  const cards = [
    { label: "Active clients", value: stats.active, icon: Users, href: "/clients" },
    { label: "Open leads", value: stats.open, icon: UserPlus, href: "/leads" },
    { label: "Follow-ups due today", value: stats.due, icon: BellRing, href: "/leads", warn: stats.due > 0 },
    canBilling && invoices
      ? { label: stats.overdue ? `Owed to MKB · ${stats.overdue} overdue` : "Owed to MKB (all services)", value: usd(stats.owed), icon: Receipt, href: "/billing", warn: stats.overdue > 0 }
      : { label: "Services in progress", value: stats.services.reduce((s, x) => s + x.active, 0), icon: FileText, href: "/clients" },
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

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Work by service</h2>
          {canBilling && stats.drafts > 0 && <Link href="/billing" className="text-[13px] font-semibold text-warning-ink">{stats.drafts} draft invoice{stats.drafts === 1 ? "" : "s"} not sent yet</Link>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.services.filter((x) => team.can(MODULE[x.k])).map((x) => (
            <Link key={x.k} href={SERVICES[x.k].href} className="rounded-xl border border-line p-3.5 hover:border-accent/40 hover:bg-surface-hover">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--svc-${x.k})` }} />{SVC_NAME[x.k]}</span>
              <span className="mt-2 block text-[24px] font-bold leading-none tracking-tight text-ink">{x.active}</span>
              <span className="block text-[12.5px] text-muted">{x.k === "tax" ? "returns in progress" : `in progress · ${x.clients} client${x.clients === 1 ? "" : "s"}`}</span>
              <span className="mt-2 block text-[12px] text-muted">{x.k === "tax" ? `${stats.interviewsOut} interview${stats.interviewsOut === 1 ? "" : "s"} sent, not completed yet` : `${x.waiting} waiting on client · ${x.review} in review`}</span>
              {sigs.some((g) => g.service === x.k) && <span className="block text-[12px] font-medium text-warning-ink">{sigs.filter((g) => g.service === x.k).length} waiting for signature</span>}
              {canBilling && invoices && <span className="block text-[12px] text-muted">{usd(x.owed)} owed · {usd(x.collected)} collected this month</span>}
            </Link>
          ))}
        </div>
      </section>

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
              { label: "Billing", href: "/billing", icon: Receipt, show: canBilling },
              { label: "Edit the website", href: "/website", icon: Globe },
              ...SERVICE_ORDER.map((k) => ({ label: SVC_NAME[k], href: SERVICES[k].href, icon: FileText, show: team.can(MODULE[k]) })),
            ].filter((q) => (q as { show?: boolean }).show !== false).map((q) => (
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
