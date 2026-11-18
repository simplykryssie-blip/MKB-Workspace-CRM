"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { call } from "@/lib/sync/remote";

type Dest = "lead" | "monarch" | "skip";
type Row = { row: number; name: string; email: string; phone: string; tags: string[]; interests?: string[]; value?: number; suggested: Dest; why: string; duplicate: string | null };
const DEST: Record<Dest, string> = { lead: "MKB lead", monarch: "Monarch office", skip: "Skip" };

/**
 * Owner-only: contacts from an old CRM (CSV). Preview shows where each one will go
 * (QuickBooks tags → MKB lead, tax-pro tags → Monarch, your own row → skip); change any
 * row, then import. Duplicates already in the CRM are always skipped.
 */
export function ImportContacts() {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pick, setPick] = useState<Record<number, Dest>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ lead: number; monarch: number; skipped: number } | null>(null);

  const load = async (f: File) => {
    setBusy(true); setDone(null);
    try {
      const text = await f.text();
      const r = await call<{ rows: Row[] }>("POST", "/api/import/contacts", { csv: text });
      setCsv(text); setFileName(f.name); setRows(r.rows); setPick({});
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't read that file", "info"); }
    setBusy(false);
  };
  const dest = (r: Row): Dest => (r.duplicate ? "skip" : pick[r.row] ?? r.suggested);
  const counts = rows ? rows.reduce((c, r) => ({ ...c, [dest(r)]: c[dest(r)] + 1 }), { lead: 0, monarch: 0, skip: 0 } as Record<Dest, number>) : null;
  const apply = async () => {
    if (!csv || !rows || !counts) return;
    if (!window.confirm(`Import ${counts.lead} MKB lead${counts.lead === 1 ? "" : "s"} and ${counts.monarch} Monarch office${counts.monarch === 1 ? "" : "s"}? ${counts.skip} will be skipped.`)) return;
    setBusy(true);
    try {
      const r = await call<{ lead: number; monarch: number; skipped: number }>("POST", "/api/import/contacts", { csv, apply: true, choices: pick });
      setDone(r); setRows(null); setCsv(null);
      toast(`Imported ${r.lead} leads and ${r.monarch} Monarch offices`);
    } catch (e) { toast(e instanceof Error ? e.message : "Import failed", "info"); }
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader icon={Users} title="Import contacts from your old CRM" subtitle="CSV with Name, Email, Phone and Tags (or a CRM lead export, e.g. Verexa → Leads → Export). Preview first — nothing is saved until you import. Owner only." />
      <div className="space-y-3 px-5 pb-5 text-[13.5px] text-ink-2 sm:px-6">
        <input ref={ref} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Contacts CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ""; }} />
        <Button icon={FileUp} disabled={busy} onClick={() => ref.current?.click()}>{rows ? "Choose a different file" : "Choose CSV file"}</Button>
        {done && <p className="flex items-center gap-1.5 rounded-xl bg-success-soft/60 px-3 py-2 text-success-ink"><CheckCircle2 size={15} /> Imported {done.lead} MKB lead{done.lead === 1 ? "" : "s"} and {done.monarch} Monarch office{done.monarch === 1 ? "" : "s"} ({done.skipped} skipped). Find them in Leads and in Monarch → Offices.</p>}
        {rows && counts && (
          <>
            <p><b>{fileName}</b>: {rows.length} contacts &mdash; {counts.lead} to MKB Leads, {counts.monarch} to Monarch, {counts.skip} skipped. Change any row below.</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {rows.map((r) => (
                <li key={r.row} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                  <span className="min-w-[180px] flex-1">
                    <span className="block truncate font-medium text-ink">{r.name}</span>
                    <span className="block truncate text-[12px] text-muted">{[r.email, r.phone].filter(Boolean).join(" · ") || "No email or phone"}</span>
                    <span className={`block text-[11.5px] ${r.duplicate ? "text-warning-ink" : "text-faint"}`}>{r.why}{r.interests?.length ? ` · Interested in: ${r.interests.join(", ")}` : ""}{r.value ? ` · est. $${r.value.toLocaleString("en-US")}` : ""}{r.tags.length ? ` · ${r.tags.join("; ")}` : ""}</span>
                  </span>
                  <select aria-label={`Where ${r.name} goes`} disabled={!!r.duplicate} value={dest(r)} onChange={(e) => setPick((x) => ({ ...x, [r.row]: e.target.value as Dest }))} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink disabled:opacity-60">
                    {(Object.keys(DEST) as Dest[]).map((k) => <option key={k} value={k}>{DEST[k]}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" disabled={busy || counts.lead + counts.monarch === 0} onClick={apply}>Import {counts.lead + counts.monarch} contact{counts.lead + counts.monarch === 1 ? "" : "s"}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => { setRows(null); setCsv(null); }}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
