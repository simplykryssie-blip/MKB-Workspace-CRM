import { AlertCircle, Clock, Receipt, Send } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { invoiceAging, invoices, kpis, usd } from "@/lib/sample-data";

const status = {
  overdue: { label: "Overdue", icon: AlertCircle, cls: "bg-danger-soft text-danger-ink" },
  "due-soon": { label: "Due soon", icon: Clock, cls: "bg-warning-soft text-warning-ink" },
  sent: { label: "Sent", icon: Send, cls: "bg-accent-soft text-accent-ink" },
} as const;

// Sequential blue ramp for aging buckets (magnitude of lateness), light → dark.
const agingShade = ["var(--aging-1)", "var(--aging-2)", "var(--aging-3)", "var(--aging-4)"];

export function Invoices() {
  const total = invoiceAging.reduce((s, b) => s + b.amount, 0);
  return (
    <Card>
      <CardHeader icon={Receipt} title="Outstanding invoices" subtitle={`${kpis.outstandingInvoices.count} open · ${usd(total)} total`} href="/invoices" hrefLabel="All invoices" />
      <div className="px-5 sm:px-6">
        <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Aging: ${invoiceAging.map((b) => `${b.label} ${usd(b.amount)}`).join(", ")}`}>
          {invoiceAging.map((b, i) => (
            <span key={b.label} style={{ width: `${(b.amount / total) * 100}%`, background: agingShade[i] }} title={`${b.label}: ${usd(b.amount)}`} />
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {invoiceAging.map((b, i) => (
            <div key={b.label} className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: agingShade[i] }} />
              <div>
                <dt className="text-[11.5px] text-muted">{b.label}</dt>
                <dd className="text-[13.5px] font-semibold text-ink tabular-nums">{usd(b.amount)}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
      <ul className="mt-3 border-t border-line px-3 py-2 sm:px-4">
        {invoices.map((inv) => {
          const s = status[inv.status];
          return (
            <li key={inv.number} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">{inv.client}</div>
                <div className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="tabular-nums">{inv.number}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{inv.due}</span>
                </div>
              </div>
              <div className="hidden lg:block">
                <ServiceTag service={inv.service} short />
              </div>
              <span className={`hidden items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold sm:inline-flex ${s.cls}`}>
                <s.icon size={12} strokeWidth={2.5} /> {s.label}
              </span>
              <span className="w-[72px] text-right text-[14px] font-semibold text-ink tabular-nums">{usd(inv.amount)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
