"use client";

import { Building2, Check, CircleCheck, Landmark, Scale, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { FLOW, LINE_KIND, NOT_LEGAL_ADVICE, STATUS_META, quoteTotal, type Owner, type Quote, type RequestStatus, type ServiceRequest } from "@/lib/biz/config";
import { PAY_META, type PayState } from "@/lib/store/biz-store";
import { usd } from "@/lib/format";

export const money = (n: number) => usd(n, n % 1 ? 2 : 0);
export const reqHref = (r: { id: string }, tab?: string) => `/services/business-services/requests/${r.id}${tab ? `#${tab}` : ""}`;
export const entityHref = (e: { id: string }) => `/services/business-services/businesses/${e.id}`;
export const portalHref = (clientId: string) => `/services/business-services/portal/${clientId}`;

export function StatusBadge({ s }: { s: RequestStatus }) {
  return <Badge tone={STATUS_META[s].tone}>{s}</Badge>;
}
export function PayBadge({ s }: { s: PayState }) {
  return <Badge tone={PAY_META[s].tone}>{PAY_META[s].label}</Badge>;
}
const OWNER_ICON = { Client: UserRound, MKB: Building2, Agency: Landmark, Done: CircleCheck } as const;
export function OwnerBadge({ o }: { o: Owner }) {
  const tone = o === "Client" ? "warning" : o === "Agency" ? "neutral" : o === "Done" ? "success" : "info";
  return (
    <Badge tone={tone} icon={OWNER_ICON[o]}>
      {o}
    </Badge>
  );
}

/** Forward path. Agency steps only show for services that go to an agency. */
export function RequestStepper({ r, agency }: { r: ServiceRequest; agency: boolean }) {
  const steps = FLOW.filter((s) => agency || (s !== "Submitted to Agency" && s !== "Awaiting Agency Response"));
  const cur = r.status === "On Hold" ? r.holdFrom ?? "In Progress" : r.status;
  const idx = steps.indexOf(cur as RequestStatus);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Request progress">
      {steps.map((s, i) => {
        const done = r.status === "Completed" || i < idx;
        const now = i === idx && r.status !== "Completed";
        return (
          <li key={s} aria-current={now ? "step" : undefined} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium ${now ? (r.status === "On Hold" || r.status === "Cancelled" ? "border-line-strong bg-surface-2 text-ink-2" : "border-accent bg-accent text-white") : done ? "border-success/30 bg-success-soft text-success-ink" : "border-line text-muted"}`}>
            {done && <Check size={12} strokeWidth={3} />}
            {s}
          </li>
        );
      })}
      {(r.status === "On Hold" || r.status === "Cancelled") && <li className="inline-flex items-center rounded-full border border-warning/40 bg-warning-soft px-2.5 py-1 text-[12px] font-semibold text-warning-ink">{r.status}</li>}
    </ol>
  );
}

/** Quote / invoice lines grouped so MKB fees are never confused with government or third-party fees. */
export function FeeBreakdown({ lines }: { lines: { kind: keyof typeof LINE_KIND; label: string; amount: number }[] }) {
  const sign = (l: { kind: string; amount: number }) => (l.kind === "discount" ? -Math.abs(l.amount) : l.amount);
  const groups = [
    { key: "mkb", title: "MKB service fees", items: lines.filter((l) => LINE_KIND[l.kind].group === "mkb") },
    { key: "passthrough", title: "Government & third-party fees (passed through at cost)", items: lines.filter((l) => LINE_KIND[l.kind].group === "passthrough") },
  ];
  const total = lines.reduce((s, l) => s + sign(l), 0);
  return (
    <div className="space-y-3 text-[13.5px]">
      {groups.map((g) =>
        g.items.length ? (
          <div key={g.key}>
            <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{g.title}</div>
            {g.items.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 py-0.5">
                <span className="min-w-0 text-ink-2">{l.label} <span className="text-[11.5px] text-faint">· {LINE_KIND[l.kind].label}</span></span>
                <span className={`shrink-0 tabular-nums ${l.kind === "discount" ? "text-success-ink" : "text-ink"}`}>{l.kind === "discount" ? "−" : ""}{money(Math.abs(sign(l)))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-dashed border-line pt-1 text-[12.5px] text-muted"><span>Subtotal</span><span className="tabular-nums">{money(g.items.reduce((s, l) => s + sign(l), 0))}</span></div>
          </div>
        ) : null,
      )}
      <div className="flex justify-between border-t border-line pt-2 text-[14.5px] font-bold text-ink"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
    </div>
  );
}
export const quoteLines = (q: Quote) => q.lines;
export { quoteTotal };

export function NotLegalAdvice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`flex items-start gap-2 rounded-xl border border-line bg-surface-2 text-ink-2 ${compact ? "px-3 py-2 text-[12px]" : "px-4 py-3 text-[12.5px]"}`}>
      <Scale size={compact ? 14 : 16} className="mt-0.5 shrink-0 text-muted" />
      <span>{NOT_LEGAL_ADVICE}</span>
    </p>
  );
}

export function Kpi({ label, value, icon: Icon, onClick, sub, tone = "accent" }: { label: string; value: number | string; icon: React.ComponentType<{ size?: number }>; onClick?: () => void; sub?: string; tone?: "accent" | "warning" | "success" | "danger" }) {
  const t = { accent: "bg-accent-soft text-accent", warning: "bg-warning-soft text-warning-ink", success: "bg-success-soft text-success-ink", danger: "bg-danger-soft text-danger-ink" }[tone];
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t}`}><Icon size={19} /></span>
      <span className="min-w-0">
        <span className="block text-[22px] font-bold leading-tight tabular-nums text-ink">{value}</span>
        <span className="block text-[12.5px] leading-tight text-muted">{label}</span>
        {sub && <span className="block text-[11.5px] text-faint">{sub}</span>}
      </span>
    </button>
  );
}

export const totalOf = quoteTotal;
