import { ArrowDownRight, ArrowUpRight, Briefcase, FileClock, Receipt, UserPlus, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { kpis, usd } from "@/lib/sample-data";

type Stat = {
  label: string;
  value: string;
  delta: number;
  /** true when a decrease is the good direction (e.g. pending docs, unpaid invoices) */
  lowerIsBetter?: boolean;
  sub: string;
  icon: LucideIcon;
  chip: string;
  href: string;
};

const stats: Stat[] = [
  { label: "Total clients", value: kpis.totalClients.value.toLocaleString(), delta: kpis.totalClients.delta, sub: kpis.totalClients.period, icon: Users, chip: "bg-accent-soft text-accent", href: "/clients" },
  { label: "Active engagements", value: kpis.activeEngagements.value.toLocaleString(), delta: kpis.activeEngagements.delta, sub: kpis.activeEngagements.period, icon: Briefcase, chip: "bg-svc-books-soft text-svc-books", href: "/services" },
  { label: "New leads", value: kpis.newLeads.value.toLocaleString(), delta: kpis.newLeads.delta, sub: kpis.newLeads.period, icon: UserPlus, chip: "bg-svc-biz-soft text-svc-biz", href: "/leads" },
  { label: "Pending documents", value: kpis.pendingDocuments.value.toLocaleString(), delta: kpis.pendingDocuments.delta, lowerIsBetter: true, sub: kpis.pendingDocuments.period, icon: FileClock, chip: "bg-svc-expunge-soft text-svc-expunge", href: "/documents" },
  { label: "Outstanding invoices", value: usd(kpis.outstandingInvoices.value), delta: kpis.outstandingInvoices.delta, lowerIsBetter: true, sub: `${kpis.outstandingInvoices.count} open invoices`, icon: Receipt, chip: "bg-danger-soft text-danger", href: "/invoices" },
];

export function StatCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {stats.map((s, i) => {
        const up = s.delta >= 0;
        const good = s.lowerIsBetter ? !up : up;
        const Arrow = up ? ArrowUpRight : ArrowDownRight;
        return (
          <Link
            key={s.label}
            href={s.href}
            className={`group rounded-2xl border border-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop sm:p-5 ${
              i === stats.length - 1 ? "col-span-2 lg:col-span-1" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 pt-0.5 text-[12.5px] font-medium leading-snug text-muted sm:text-[13px]">{s.label}</div>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 ${s.chip}`}>
                <s.icon size={19} strokeWidth={2} />
              </span>
            </div>
            <div className="-mt-1 text-[24px] font-bold leading-tight tracking-tight text-ink tabular-nums sm:text-[28px]">{s.value}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px]">
              <span
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold ${
                  good ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger-ink"
                }`}
                aria-label={`${up ? "Up" : "Down"} ${Math.abs(s.delta)} percent`}
              >
                <Arrow size={13} strokeWidth={2.5} />
                {Math.abs(s.delta)}%
              </span>
              <span className="text-muted">{s.sub}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
