"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, CircleDashed, Eye, UserRound } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { RemoteError } from "@/lib/sync/remote";
import { useMonarch } from "@/lib/store/monarch-store";
import { stageLabel, type ItemDef, type ItemState, type MonarchData, type Stage } from "@/lib/monarch/types";

export const STAGE_TONE: Record<Stage, Tone> = { interested: "neutral", paid: "info", collecting: "warning", setup: "info", active: "success", inactive: "neutral" };
export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge tone={STAGE_TONE[stage]}>{stageLabel(stage)}</Badge>;
}

/** Checklist status — whose turn it is, always with words and an icon. */
export function ItemBadge({ def, state }: { def: ItemDef; state: ItemState }) {
  if (state.status === "done") return <Badge tone="success" icon={CheckCircle2}>Done</Badge>;
  if (state.status === "na") return <Badge tone="neutral">Not needed</Badge>;
  if (state.status === "review") return <Badge tone="info" icon={Eye}>Sent — review</Badge>;
  return def.who === "office" ? <Badge tone="warning" icon={UserRound}>Waiting on office</Badge> : <Badge tone="neutral" icon={Building2}>Your step</Badge>;
}

export const SALE_TONE = { unpaid: "warning", paid: "success", refunded: "neutral", void: "neutral" } as const;
export const SALE_LABEL = { unpaid: "Unpaid", paid: "Paid", refunded: "Refunded", void: "Cancelled" } as const;

/** Shows loading / error until Monarch's data is in. */
export function MonarchGate({ children }: { children: (d: MonarchData) => React.ReactNode }) {
  const { data, error, reload } = useMonarch();
  if (error)
    return (
      <Card className="mx-auto mt-10 max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning-soft text-warning-ink"><AlertTriangle size={22} /></span>
        <h1 className="mt-4 text-[18px] font-bold text-ink">Monarch couldn&rsquo;t load</h1>
        <p className="mt-2 text-[14px] text-muted">{error}</p>
        <button type="button" onClick={() => void reload()} className="mt-4 text-[14px] font-semibold text-accent hover:underline">Try again</button>
      </Card>
    );
  if (!data) return <div className="grid min-h-[40vh] place-items-center text-[14px] text-muted" role="status">Loading Monarch…</div>;
  return <>{children(data)}</>;
}

/** Runs an action with a busy flag; errors become a toast. */
export function useAct() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>, ok?: string | ((r: T) => string | undefined)): Promise<T | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      const msg = typeof ok === "function" ? ok(r) : ok;
      if (msg) toast(msg);
      return r;
    } catch (e) {
      toast(e instanceof RemoteError || e instanceof Error ? e.message : "Something went wrong.");
      return undefined;
    } finally {
      setBusy(null);
    }
  }, [toast]);
  return { busy, run };
}

export function Stat({ label, value, sub, href, bar }: { label: string; value: React.ReactNode; sub?: string; href?: string; bar?: string }) {
  const inner = (
    <>
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className="text-[26px] font-bold tracking-tight text-ink">{value}</span>
      {sub && <span className="text-[12.5px] text-muted">{sub}</span>}
    </>
  );
  const cls = "flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 shadow-soft";
  const style = bar ? { boxShadow: `inset 0 3px 0 ${bar}` } : undefined;
  return href ? <Link href={href} className={`${cls} hover:border-line-strong`} style={style}>{inner}</Link> : <div className={cls} style={style}>{inner}</div>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <CircleDashed size={22} className="mx-auto text-faint" />
      <p className="mt-2 text-[14px] font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export const shortDate = (iso?: string) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
export const dollars = (cents: number) => (cents / 100).toFixed(2);
export const TABLE_HEAD = "border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted";
