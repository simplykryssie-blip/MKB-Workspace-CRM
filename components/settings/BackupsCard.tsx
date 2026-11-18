"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseBackup, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { call } from "@/lib/sync/remote";

type Last = { ok: boolean; day: string; finishedAt: string; seconds: number; error?: string; db: { tables: number; rows: number; bytes: number }; files: { total: number; copied: number; unchanged: number; tooLarge: string[]; unfinished: boolean } };
type Status = { connected: boolean; last: Last | null; snapshots: { day: string; bytes: number }[] };

const size = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Owner-only: the automatic daily backup (database snapshot + copy of every uploaded file). */
export function BackupsCard() {
  const toast = useToast();
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => call<Status>("GET", "/api/settings/backup").then(setS).catch(() => setS(null));
  useEffect(() => { void load(); }, []);
  const now = async () => {
    setBusy(true);
    try {
      const r = await call<Last>("POST", "/api/settings/backup", {});
      toast(r.ok ? "Backup finished" : `Backup failed: ${r.error ?? "unknown error"}`, r.ok ? undefined : "info");
      await load();
    } catch (e) { toast(e instanceof Error ? e.message : "Backup failed", "info"); }
    setBusy(false);
  };
  const last = s?.last;
  const stale = last ? Date.now() - new Date(last.finishedAt).getTime() > 36 * 3_600_000 : true;
  return (
    <Card>
      <CardHeader icon={DatabaseBackup} title="Backups" subtitle="Every day at 6:23 am Central: a full copy of the database and a copy of every new or changed client file, kept in a separate private storage area. Daily copies are kept 90 days, monthly copies 7 years." />
      <div className="space-y-3 px-5 pb-5 text-[13.5px] text-ink-2 sm:px-6">
        {!s ? <p className="text-muted">Loading…</p> : !s.connected ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-warning-soft/60 px-3 py-2 text-warning-ink"><AlertTriangle size={15} /> Backup storage isn&apos;t connected on this address.</p>
        ) : !last ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-warning-soft/60 px-3 py-2 text-warning-ink"><AlertTriangle size={15} /> No backup has run yet. Run one now.</p>
        ) : (
          <p className={`flex items-start gap-1.5 rounded-xl px-3 py-2 ${last.ok && !stale ? "bg-success-soft/60 text-success-ink" : "bg-warning-soft/60 text-warning-ink"}`}>
            {last.ok && !stale ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
            <span>
              {last.ok ? `Last backup ${when(last.finishedAt)}: database ${last.db.tables} tables, ${last.db.rows.toLocaleString("en-US")} rows (${size(last.db.bytes)}); ${last.files.total} client file${last.files.total === 1 ? "" : "s"} backed up (${last.files.copied} new or changed this run).` : `Last backup failed ${when(last.finishedAt)}: ${last.error}`}
              {last.ok && last.files.unfinished ? " Some files will be copied on the next run." : ""}
              {last.ok && last.files.tooLarge.length ? ` ${last.files.tooLarge.length} file(s) over 80 MB were not copied.` : ""}
              {last.ok && stale ? " That's more than a day ago — check that the daily job is running." : ""}
            </span>
          </p>
        )}
        {s?.connected && s.snapshots.length > 0 && <p className="text-[12.5px] text-muted">{s.snapshots.length} database cop{s.snapshots.length === 1 ? "y" : "ies"} saved, newest {s.snapshots[0].day}, oldest {s.snapshots[s.snapshots.length - 1].day}.</p>}
        {s?.connected && <Button icon={RefreshCw} disabled={busy} onClick={now}>{busy ? "Backing up…" : "Back up now"}</Button>}
      </div>
    </Card>
  );
}
