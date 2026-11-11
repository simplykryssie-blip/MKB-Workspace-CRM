"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMonarch } from "@/lib/store/monarch-store";
import { usd, type Layout, type MonarchData, type ReportType } from "@/lib/monarch/types";
import { Empty, MonarchGate, shortDate, TABLE_HEAD, useAct } from "./MonarchBits";

export function BankReportsPage() {
  return <MonarchGate>{(d) => <Reports d={d} />}</MonarchGate>;
}

/** First line of a CSV, split into column names. */
function headerOf(text: string) {
  const line = text.replace(/^﻿/, "").split(/\r?\n/).find((l) => l.trim()) ?? "";
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ",") { out.push(cur.trim()); cur = ""; } else cur += c; }
  out.push(cur.trim());
  return out.filter(Boolean);
}
const guess = (cols: string[], ...words: string[]) => cols.find((c) => words.some((w) => c.toLowerCase().includes(w))) ?? "";

function Reports({ d }: { d: MonarchData }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bankId, setBankId] = useState(d.banks.find((b) => b.active)?.id ?? "");
  const [type, setType] = useState<ReportType>("enrollment");
  const [file, setFile] = useState<{ name: string; text: string; cols: string[] } | null>(null);
  const [layout, setLayout] = useState<Layout>({ efin: "" });
  const bank = d.banks.find((b) => b.id === bankId);

  useEffect(() => {
    if (!file) return;
    const saved = bank?.layouts[type];
    const has = (c?: string) => (c && file.cols.includes(c) ? c : "");
    setLayout({
      efin: has(saved?.efin) || guess(file.cols, "efin"),
      name: has(saved?.name) || guess(file.cols, "office", "name", "company"),
      status: has(saved?.status) || guess(file.cols, "status", "enroll"),
      count: has(saved?.count) || guess(file.cols, "count", "funded", "number"),
      fees: has(saved?.fees) || guess(file.cols, "fee", "amount"),
    });
  }, [file, bank, type]);

  const pick = async (f: File) => {
    if (!/\.(csv|txt)$/i.test(f.name)) { alert("Save the report as a CSV file first (in Excel: File → Save As → CSV), then upload it here."); return; }
    if (f.size > 6_000_000) { alert("That file is larger than 6 MB. Split it into smaller reports."); return; }
    const text = await f.text();
    setFile({ name: f.name, text, cols: headerOf(text) });
  };
  const doImport = () => run("imp", async () => {
    const r = await m.apply<{ result: { rows: number; matched: number; skipped: number; approvedNow: number } }>("POST", "/api/monarch/bank-reports", { bankId, reportType: type, fileName: file?.name, text: file?.text, layout });
    setFile(null);
    return r;
  }, (r) => `Imported ${r.result.rows} EFIN${r.result.rows === 1 ? "" : "s"} — ${r.result.matched} matched to offices${r.result.approvedNow ? `, ${r.result.approvedNow} enrollment${r.result.approvedNow === 1 ? "" : "s"} checked off` : ""}`);

  const withBank = d.offices.filter((o) => o.bank.enrollment || o.bank.funded !== undefined);
  const offices = useMemo(() => [...d.offices].sort((a, b) => a.name.localeCompare(b.name)), [d.offices]);
  const colOpts = (label: string): [string, string][] => [["", label], ...(file?.cols ?? []).map((c): [string, string] => [c, c])];

  return (
    <div>
      <PageHeader title="Bank reports" subtitle="Download a report from your bank's portal and upload it here. Rows are matched to your offices by EFIN." />
      <div className="grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Upload a report" />
          <div className="space-y-3 border-t border-line px-5 py-4 sm:px-6">
            {!d.banks.length && <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">Add your banks in <Link href="/monarch/setup" className="font-semibold underline">Setup</Link> first.</p>}
            <SelectField label="Bank" value={bankId} onChange={(e) => setBankId(e.target.value)} options={[["", "Choose a bank"], ...d.banks.map((b): [string, string] => [b.id, b.name])]} />
            <SelectField label="Report type" value={type} onChange={(e) => setType(e.target.value as ReportType)} options={[["enrollment", "Enrollment status"], ["funded", "Funded products (season to date)"]]} />
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="grid w-full place-items-center gap-1 rounded-2xl border-2 border-dashed border-line-strong px-4 py-6 text-center text-[13.5px] text-muted hover:bg-surface-hover">
              <FileUp size={20} className="text-accent" />
              <b className="text-ink">{file ? file.name : "Choose a CSV file"}</b>
              <span>{file ? `${file.cols.length} columns found` : "In Excel: File → Save As → CSV"}</span>
            </button>
            {file && (
              <fieldset className="space-y-3 rounded-xl border border-line p-3">
                <legend className="px-1 text-[12.5px] font-semibold text-muted">Which column holds…</legend>
                <SelectField label="EFIN" required value={layout.efin} onChange={(e) => setLayout({ ...layout, efin: e.target.value })} options={colOpts("Choose a column")} />
                <SelectField label="Office name (optional)" value={layout.name ?? ""} onChange={(e) => setLayout({ ...layout, name: e.target.value })} options={colOpts("None")} />
                {type === "enrollment" ? (
                  <SelectField label="Enrollment status" required value={layout.status ?? ""} onChange={(e) => setLayout({ ...layout, status: e.target.value })} options={colOpts("Choose a column")} />
                ) : (
                  <>
                    <SelectField label="Number funded (optional)" value={layout.count ?? ""} onChange={(e) => setLayout({ ...layout, count: e.target.value })} options={colOpts("None — each row is one funded return")} />
                    <SelectField label="Your fees (optional)" value={layout.fees ?? ""} onChange={(e) => setLayout({ ...layout, fees: e.target.value })} options={colOpts("None")} />
                  </>
                )}
                <p className="text-[12px] text-muted">Your choices are remembered for {bank?.name ?? "this bank"}.</p>
              </fieldset>
            )}
            <Button variant="primary" className="w-full" disabled={!bankId || !file || !layout.efin || (type === "enrollment" && !layout.status) || busy === "imp"} onClick={() => void doImport()}>{busy === "imp" ? "Importing…" : "Import report"}</Button>
            <p className="text-[12px] text-muted">The newest report of each type replaces the last one for that bank, so upload the season-to-date funded report each time.</p>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="By office — this season" subtitle="From the newest report of each bank" />
            {withBank.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[13.5px]">
                <thead className={TABLE_HEAD}><tr><th className="px-5 py-2.5 sm:px-6">Office</th><th className="px-3 py-2.5">Bank</th><th className="px-3 py-2.5">Enrollment</th><th className="px-3 py-2.5 text-right">Funded</th><th className="px-3 py-2.5 text-right">Fees</th><th className="px-5 py-2.5 text-right sm:px-6">Expected SB fees</th></tr></thead>
                <tbody>{withBank.map((o) => {
                  const sw = d.software.find((s) => s.id === o.softwareId);
                  const exp = sw && o.bank.funded !== undefined ? sw.sbFeeCents * o.bank.funded : undefined;
                  return (
                    <tr key={o.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 sm:px-6"><Link href={`/monarch/offices/${o.id}`} className="font-semibold text-ink hover:text-accent">{o.name}</Link></td>
                      <td className="px-3 py-3 text-ink-2">{d.banks.find((b) => b.id === o.bankId)?.name ?? "—"}</td>
                      <td className="px-3 py-3">{o.bank.enrollment ? <Badge tone={/approv/i.test(o.bank.enrollment) ? "success" : /declin|reject|denied/i.test(o.bank.enrollment) ? "danger" : "warning"}>{o.bank.enrollment}</Badge> : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{o.bank.funded ?? "—"}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">{o.bank.feesCents !== undefined ? usd(o.bank.feesCents) : "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums sm:px-6">{exp !== undefined ? <span className={o.bank.feesCents !== undefined && o.bank.feesCents < exp ? "font-semibold text-warning-ink" : "text-ink-2"}>{usd(exp)}</span> : "—"}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            ) : <Empty title="No bank data yet">Upload an enrollment or funded report to see each office here.</Empty>}
          </Card>

          {d.unmatched.length > 0 && (
            <Card>
              <CardHeader title="Rows without an office" subtitle="The EFIN isn't on any office's locations. Match it once and it's remembered." />
              <ul className="border-t border-line">
                {d.unmatched.slice(0, 100).map((u) => (
                  <li key={`${u.bankId}:${u.reportType}:${u.efin}`} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-[13.5px] last:border-0 sm:px-6">
                    <span className="min-w-[220px] flex-1">EFIN <b>{u.efin}</b>{u.name ? ` · ${u.name}` : ""} <span className="text-muted">· {d.banks.find((b) => b.id === u.bankId)?.name} {u.reportType}{u.reportType === "funded" ? ` · ${u.funded} funded` : ""}</span></span>
                    <select aria-label={`Match EFIN ${u.efin} to an office`} defaultValue="" disabled={!!busy} onChange={(e) => e.target.value && void run("match", () => m.apply("POST", "/api/monarch/bank-reports/match", { efin: u.efin, officeId: e.target.value }), "Matched")} className="h-9 rounded-xl border border-line bg-surface px-2.5 text-[13px] text-ink">
                      <option value="">Match to office…</option>
                      {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Uploaded reports" />
            {d.uploads.length ? (
              <ul className="border-t border-line">
                {d.uploads.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0 sm:px-6">
                    <span className="min-w-[200px] flex-1"><b className="text-ink">{d.banks.find((b) => b.id === u.bankId)?.name} — {u.reportType === "funded" ? "Funded" : "Enrollment"}</b><span className="block text-[12px] text-muted">{u.fileName} · {shortDate(u.createdAt)} · {u.rows} EFINs, {u.matched} matched</span></span>
                    <Button size="sm" variant="ghost" icon={Trash2} disabled={!!busy} onClick={() => confirm(`Remove ${u.fileName}?`) && void run("del", () => m.apply("POST", `/api/monarch/bank-reports/${u.id}`, { action: "delete" }), "Report removed")}>Remove</Button>
                  </li>
                ))}
              </ul>
            ) : <Empty title="No reports uploaded yet" />}
          </Card>
        </div>
      </div>
    </div>
  );
}
