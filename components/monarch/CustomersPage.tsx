"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { usd, type MonarchData } from "@/lib/monarch/types";
import { Empty, MonarchGate, shortDate, TABLE_HEAD } from "./MonarchBits";

/** Monarch product customers: people who buy store products (calculator, WISP build, downloads) — not service bureau firms. */
export function CustomersPage() {
  return <MonarchGate>{(d) => <List d={d} />}</MonarchGate>;
}

function List({ d }: { d: MonarchData }) {
  const [q, setQ] = useState("");
  const customers = useMemo(() => d.offices.filter((o) => o.stage === "customer"), [d.offices]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return customers
      .map((o) => {
        const sales = d.sales.filter((s) => s.officeId === o.id && s.status === "paid");
        const last = sales.map((s) => s.paidAt ?? s.createdAt).sort().pop();
        return { o, bought: [...new Set(sales.map((s) => s.description))], spent: sales.reduce((n, s) => n + s.amountCents, 0), last };
      })
      .filter(({ o, bought }) => !t || [o.name, o.contactName, o.email, o.phone, ...bought].some((x) => x.toLowerCase().includes(t)))
      .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? "") || a.o.name.localeCompare(b.o.name));
  }, [customers, d.sales, q]);
  return (
    <div>
      <PageHeader title="Customers" subtitle={`People who buy your store products — the tax calculator, WISP build and downloads. Not service bureau firms, so no onboarding. ${customers.length} customer${customers.length === 1 ? "" : "s"}.`} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 sm:px-6">
          <label className="relative w-full sm:w-[320px]">
            <span className="sr-only">Search customers</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or product" className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13.5px] text-ink placeholder:text-faint" />
          </label>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13.5px]">
              <thead className={TABLE_HEAD}><tr><th className="px-5 py-2.5 sm:px-6">Customer</th><th className="px-3 py-2.5">Contact</th><th className="px-3 py-2.5">Bought</th><th className="px-3 py-2.5">Total</th><th className="px-5 py-2.5 sm:px-6">Last purchase</th></tr></thead>
              <tbody>
                {rows.map(({ o, bought, spent, last }) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                    <td className="px-5 py-3 sm:px-6"><Link href={`/monarch/offices/${o.id}`} className="font-semibold text-ink hover:text-accent">{o.name}</Link><span className="block text-[12px] text-muted">{[o.contactName !== o.name && o.contactName, o.city && `${o.city}${o.state ? `, ${o.state}` : ""}`].filter(Boolean).join(" · ") || "—"}</span></td>
                    <td className="px-3 py-3 text-ink-2"><span className="block">{o.email || "—"}</span><span className="block text-[12px] text-muted">{o.phone}</span></td>
                    <td className="px-3 py-3 text-ink-2">{bought.join(", ") || "—"}</td>
                    <td className="px-3 py-3 text-ink-2">{usd(spent)}</td>
                    <td className="px-5 py-3 text-ink-2 sm:px-6">{shortDate(last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title={customers.length ? "No customers match" : "No product customers yet"}>{customers.length ? "Try another search." : "Store buyers who aren't service bureau firms show up here automatically."}</Empty>}
      </Card>
    </div>
  );
}
