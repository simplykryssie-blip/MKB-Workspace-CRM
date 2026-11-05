"use client";

import { AlertCircle, ArrowDown, ArrowUp, ChevronsUp, Clock, Minus, BellRing, CheckCircle2, XCircle, CircleDot } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { followUpBucket, nextFollowUp } from "@/lib/sample/leads";
import { fmtDate, fmtTime } from "@/lib/format";
import type { Lead, LeadPriority, LeadStatus } from "@/lib/types";

export const PRIORITY: Record<LeadPriority, { label: string; tone: Tone; icon: typeof ArrowUp }> = {
  urgent: { label: "Urgent", tone: "danger", icon: ChevronsUp },
  high: { label: "High", tone: "warning", icon: ArrowUp },
  medium: { label: "Medium", tone: "info", icon: Minus },
  low: { label: "Low", tone: "neutral", icon: ArrowDown },
};

export const STATUS: Record<LeadStatus, { label: string; tone: Tone; icon: typeof CircleDot }> = {
  open: { label: "Open", tone: "info", icon: CircleDot },
  converted: { label: "Converted", tone: "success", icon: CheckCircle2 },
  lost: { label: "Lost", tone: "neutral", icon: XCircle },
};

export function PriorityBadge({ p }: { p: LeadPriority }) {
  const m = PRIORITY[p];
  return <Badge tone={m.tone} icon={m.icon}>{m.label}</Badge>;
}

export function StatusBadge({ s }: { s: LeadStatus }) {
  const m = STATUS[s];
  return <Badge tone={m.tone} icon={m.icon}>{m.label}</Badge>;
}

/** Follow-up chip: overdue / today / date — always icon + text, never color alone. */
export function FollowUpChip({ lead, compact }: { lead: Lead; compact?: boolean }) {
  const r = nextFollowUp(lead);
  const b = followUpBucket(lead);
  if (!r || b === "none") return compact ? null : <span className="text-[12px] text-faint">No follow-up</span>;
  const when = b === "today" ? `Today ${fmtTime(r.at)}` : fmtDate(r.at, { month: "short", day: "numeric" });
  if (b === "overdue") return <Badge tone="danger" icon={AlertCircle}>Overdue · {when}</Badge>;
  if (b === "today") return <Badge tone="warning" icon={BellRing}>{when}</Badge>;
  return <Badge tone="neutral" icon={Clock}>{when}</Badge>;
}
