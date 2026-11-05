"use client";

import { Building2, Check, CheckCircle2, CircleDashed, Link2, Link2Off, MailQuestion, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MONTH_STAGES, QBO_STATUS, STAGE_META, periodLabel, type BooksMonth, type MonthStage, type QboStatus, type ReconStatus, type ReportDelivery, type ReportReview } from "@/lib/books/config";

export function StageBadge({ stage }: { stage: MonthStage }) {
  return <Badge tone={STAGE_META[stage].tone} icon={stage === "Month Closed" ? CheckCircle2 : undefined}>{stage}</Badge>;
}

/** Who owns the next step — always text + icon, never color alone. */
export function OwnerBadge({ owner }: { owner: "Client" | "MKB" | "Done" }) {
  if (owner === "Done") return <Badge tone="success" icon={Check}>Done</Badge>;
  return owner === "Client" ? <Badge tone="warning" icon={UserRound}>Client</Badge> : <Badge tone="info" icon={Building2}>MKB</Badge>;
}

export function QboBadge({ status }: { status: QboStatus }) {
  const m = QBO_STATUS[status];
  return <Badge tone={m.tone} icon={status === "connected" ? Link2 : status === "invite_pending" ? MailQuestion : status === "not_connected" ? CircleDashed : Link2Off}>QuickBooks: {m.label}</Badge>;
}

export const RECON_META: Record<ReconStatus, { label: string; tone: "neutral" | "info" | "danger" | "success" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  discrepancy: { label: "Discrepancy", tone: "danger" },
  reconciled: { label: "Reconciled", tone: "success" },
};
export const REVIEW_META: Record<ReportReview, { label: string; tone: "neutral" | "info" | "warning" | "success" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  preparing: { label: "Preparing", tone: "info" },
  in_review: { label: "In review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
};
export const DELIVERY_META: Record<ReportDelivery, { label: string; tone: "neutral" | "info" | "success" }> = {
  not_delivered: { label: "Not delivered", tone: "neutral" },
  available: { label: "Available in portal", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
};

/** Compact 8-step progress for a month. "Follow-up" is shown as a detour, not a step. */
export function MonthStepper({ m }: { m: BooksMonth }) {
  const steps: MonthStage[] = MONTH_STAGES.filter((s) => s !== "Client Follow-up Needed");
  const effective = m.stage === "Client Follow-up Needed" ? m.followupFrom ?? "MKB Reviewing" : m.stage;
  const idx = steps.indexOf(effective);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={`${periodLabel(m.period)} workflow`}>
      {steps.map((s, i) => {
        const done = i < idx || m.stage === "Month Closed";
        const cur = i === idx && m.stage !== "Month Closed";
        return (
          <li key={s}>
            <span aria-current={cur ? "step" : undefined} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${cur ? (m.stage === "Client Follow-up Needed" ? "bg-warning text-white" : "bg-accent text-white") : done ? "bg-success-soft text-success-ink" : "bg-surface-2 text-muted ring-1 ring-line"}`}>
              {done && <Check size={12} strokeWidth={3} />}
              {cur && m.stage === "Client Follow-up Needed" ? `${s} · waiting on client` : s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export const money = (n?: number) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));
