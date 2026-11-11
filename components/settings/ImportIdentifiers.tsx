"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type Row = { row: number; name: string; client?: string; clientId?: string; ssn: string; dob: string; note?: string };
type Result = { applied: boolean; rows: Row[]; updated: number };
const LABEL: Record<string, { t: string; tone: "success" | "info" | "neutral" | "danger" | "warning" }> = {
  would_save: { t: "Will save", tone: "info" }, saved: { t: "Saved", tone: "success" }, kept: { t: "Already on file", tone: "neutral" }, invalid: { t: "Not valid", tone: "danger" }, missing: { t: "Blank", tone: "neutral" },
};

/** Owner-only: SSNs and dates of birth from an old spreadsheet (CSV), encrypted on the server onto matching clients. */
export function ImportIdentifiers() {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async (apply: boolean, f = file) => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/import/identifiers?${apply ? "apply=1&" : ""}${overwrite ? "overwrite=1" : ""}`, { method: "POST", credentials: "same-origin", headers: { "content-type": "text/csv" }, body: f });
      const d = (await r.json().catch(() => ({}))) as Result & { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Import failed.");
      setRes(d);
      if (apply) { toast(`SSN / date of birth saved for ${d.updated} client${d.updated === 1 ? "" : "s"}`); window.dispatchEvent(new CustomEvent("mkb:clients-reload")); }
    } catch (e) { toast(e instanceof Error ? e.message : "Import failed.", "info"); }
    setBusy(false);
  };
  const pending = res && !res.applied ? res.rows.filter((r) => r.clientId && (r.ssn === "would_save" || r.dob === "would_save")).length : 0;
  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="Import SSNs & dates of birth" subtitle="From your old client spreadsheet — matched to clients already in the CRM by email, then by name. Owner only." />
      <div className="space-y-4 px-5 pb-5 sm:px-6">
        <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-ink-2">
          <li>In Google Sheets, open the tab with your clients (e.g. <b>CLIENT INFORMATION</b>) and choose <b>File → Download → Comma-separated values (.csv)</b>.</li>
          <li>Choose that file here and check the preview — nothing is saved yet.</li>
          <li>Click <b>Save to clients</b>. Numbers are encrypted on the server; only the last 4 digits show afterwards.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={ref} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setRes(null); if (f) void send(false, f); }} />
          <Button icon={FileUp} onClick={() => ref.current?.click()} disabled={busy}>{file ? "Choose a different file" : "Choose CSV file"}</Button>
          {file && <span className="text-[13px] text-muted">{file.name}</span>}
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setRes(null); if (file) setTimeout(() => void send(false), 0); }} /> Replace numbers already on file</label>
        </div>
        {res && (
          <>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-surface-2 text-[12px] text-muted"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Name in file</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">SSN</th><th className="px-3 py-2">Date of birth</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {res.rows.map((r) => (
                    <tr key={r.row}>
                      <td className="px-3 py-2 text-muted">{r.row}</td>
                      <td className="px-3 py-2 text-ink">{r.name}</td>
                      <td className="px-3 py-2">{r.clientId ? <a className="font-medium text-accent hover:underline" href={`/clients/${r.clientId}`}>{r.client}</a> : <span className="flex items-center gap-1 text-warning-ink"><AlertTriangle size={13} />{r.note}</span>}{r.clientId && r.note && <span className="block text-[11.5px] text-muted">{r.note}</span>}</td>
                      <td className="px-3 py-2">{r.clientId ? <Badge tone={LABEL[r.ssn]?.tone}>{LABEL[r.ssn]?.t ?? r.ssn}</Badge> : null}</td>
                      <td className="px-3 py-2">{r.clientId ? <Badge tone={LABEL[r.dob]?.tone}>{LABEL[r.dob]?.t ?? r.dob}</Badge> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {res.applied ? <p className="flex items-center gap-1.5 text-[13.5px] text-success-ink"><CheckCircle2 size={15} />Saved for {res.updated} client{res.updated === 1 ? "" : "s"}. You can delete the CSV from your computer now.</p>
              : <div className="flex flex-wrap items-center gap-3"><Button variant="primary" icon={Lock} disabled={busy || !pending} onClick={() => void send(true)}>{busy ? "Saving…" : `Save to ${pending} client${pending === 1 ? "" : "s"}`}</Button><span className="text-[12.5px] text-muted">Rows without a matching client are skipped.</span></div>}
          </>
        )}
        <p className="text-[12px] text-muted">The file is read on the server and never stored. After importing, consider removing the SSN column from the Google Sheet — full SSNs shouldn&rsquo;t sit in a spreadsheet.</p>
      </div>
    </Card>
  );
}
