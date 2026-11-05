"use client";

import { AlertCircle, CalendarClock, CheckCircle2, CircleDashed, Clock, Eye, FileCheck2, FileSearch, Hourglass, Inbox, PenLine, Send, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { STATUS_META, type ReturnStatus, type TaxReturn } from "@/lib/tax/config";
import { ACCESS_PRESETS, effectiveDue, isPastDue, useTax, type AccessPreset } from "@/lib/store/tax-store";
import { fmtDate } from "@/lib/format";

const STATUS_ICON: Record<ReturnStatus, typeof Clock> = {
  Intake: Inbox,
  "Awaiting Documents": Hourglass,
  "Ready for Review": FileSearch,
  "In Preparation": PenLine,
  "Awaiting Client Approval": Clock,
  "Ready to E-file": FileCheck2,
  Submitted: Send,
  Accepted: CheckCircle2,
  Rejected: XCircle,
  Completed: ShieldCheck,
};

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <Badge tone={STATUS_META[status].tone} icon={STATUS_ICON[status]}>
      {status}
    </Badge>
  );
}

export function DueChip({ r }: { r: TaxReturn }) {
  const due = effectiveDue(r);
  if (!due) return <span className="text-[12px] text-faint">No deadline</span>;
  const label = fmtDate(due, { month: "short", day: "numeric", year: "numeric" });
  if (isPastDue(r)) return <Badge tone="danger" icon={AlertCircle}>Past due · {label}</Badge>;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] text-ink-2">
      <CalendarClock size={13} className="text-muted" />
      {label}
      {r.extension && <span className="rounded bg-surface-2 px-1 text-[10.5px] font-semibold text-muted ring-1 ring-line">EXT</span>}
    </span>
  );
}

export function TaxYearSelect({ value, onChange, years, allowAll }: { value: number | "all"; onChange: (v: number | "all") => void; years: number[]; allowAll?: boolean }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Tax year</span>
      <select
        aria-label="Tax year"
        value={String(value)}
        onChange={(e) => onChange(e.target.value === "all" ? "all" : Number(e.target.value))}
        className="h-10 rounded-xl border border-line bg-surface pl-3 pr-8 text-[14px] font-semibold text-ink focus:border-accent focus:outline-none"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            Tax year {y}
          </option>
        ))}
        {allowAll && <option value="all">All years</option>}
      </select>
    </label>
  );
}

/** Preview the Tax Center as staff with fewer permissions (enforced server-side in Phase 3). */
export function AccessPreviewBar() {
  const { preset, setPreset } = useTax();
  const limited = preset !== "full";
  return (
    <div className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] ${limited ? "border-warning/40 bg-warning-soft text-warning-ink" : "border-dashed border-line-strong text-muted"}`}>
      <Eye size={14} className="shrink-0" />
      <span className="font-medium">Preview access:</span>
      <select aria-label="Preview access" value={preset} onChange={(e) => setPreset(e.target.value as AccessPreset)} className="rounded-lg border border-line bg-surface px-2 py-1 text-[12.5px] font-medium text-ink">
        {Object.entries(ACCESS_PRESETS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
      <span className="basis-full sm:basis-auto">
        {limited ? "Showing what staff with these permissions would see." : "Custom roles are built in Team & Permissions; this switch previews permission combinations."}
      </span>
    </div>
  );
}

export function NoAccess({ what }: { what: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-6 text-[13.5px] text-muted">
      <CircleDashed size={16} /> {what} requires a permission this preview doesn&rsquo;t include.
    </div>
  );
}
