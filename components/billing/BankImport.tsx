"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { call } from "@/lib/sync/remote";
import { fmtDate } from "@/lib/format";
import type { Row } from "./BillingPage";

type ImportRow = { n: number; date: string; amount: number; description: string; invoiceId?: string; match?: "name_amount" | "amount" | "manual"; applied?: boolean; error?: string };
type Inv = { id: string; number: string; clientName: string; balance: number; paymentMode: string };
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Upload a bank CSV → review suggested matches → approve. Nothing is marked paid until you approve. */
export function BankImport({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void; rows: Row[] }) {
  const toast = useToast();
  const [imp, setImp] = useState<{ id: string; fileName: string; rows: ImportRow[]; invoices: Inv[] } | null>(null);
  const [pick, setPick] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportRow[] | null>(null);
  useEffect(() => { if (open) { setImp(null); setPick({}); setResult(null); } }, [open]);
  const upload = async (f: File) => {
    if (f.size > 2_000_000) return toast("Choose a file under 2 MB.", "info");
    setBusy(true);
    try {
      const r = await call<{ id: string; fileName: string; rows: ImportRow[]; invoices: Inv[] }>("POST", "/api/billing/imports", { fileName: f.name, text: await f.text() });
      setImp(r);
      setPick(Object.fromEntries(r.rows.filter((x) => x.invoiceId).map((x) => [x.n, x.invoiceId!])));
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't read the file", "info"); }
    setBusy(false);
  };
  const approve = async () => {
    if (!imp) return;
    const matches = Object.entries(pick).filter(([, v]) => v).map(([n, invoiceId]) => ({ n: Number(n), invoiceId }));
    if (!matches.length) return toast("Choose at least one invoice to mark paid.", "info");
    if (!confirm(`Mark ${matches.length} invoice payment${matches.length === 1 ? "" : "s"} as received?`)) return;
    setBusy(true);
    try { const r = await call<{ applied: number; rows: ImportRow[] }>("POST", `/api/billing/imports/${imp.id}/approve`, { matches }); setResult(r.rows); toast(`${r.applied} payment${r.applied === 1 ? "" : "s"} recorded`); onDone(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't apply", "info"); }
    setBusy(false);
  };
  const discard = async () => { if (imp) await call("POST", `/api/billing/imports/${imp.id}/discard`, {}).catch(() => {}); onClose(); };
  const chosen = Object.values(pick).filter(Boolean).length;
  const input = "h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink";
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Import bank file" description="Upload a CSV of deposits from your bank (or your refund-transfer report). Review the matches — invoices are only marked paid after you approve."
      footer={result ? <Button variant="primary" onClick={onClose}>Done</Button> : imp ? <><Button onClick={discard}>Discard</Button><Button variant="primary" disabled={busy || !chosen} onClick={approve}>Approve {chosen} payment{chosen === 1 ? "" : "s"}</Button></> : <Button onClick={onClose}>Cancel</Button>}>
      {!imp ? (
        <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong p-8 text-center">
          <span className="text-[14px] font-semibold text-ink">{busy ? "Reading…" : "Choose a CSV file"}</span>
          <span className="text-[12.5px] text-muted">Needs Date and Amount (or Credit) columns. Only deposits are read.</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      ) : (
        <div className="space-y-2">
          <p className="text-[13px] text-muted">{imp.fileName}: {imp.rows.length} deposits · {imp.rows.filter((r) => r.invoiceId).length} matched automatically.</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {(result ?? imp.rows).map((r) => (
              <li key={r.n} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[110px_1fr_90px_minmax(200px,260px)] sm:items-center">
                <span className="text-[12.5px] text-muted">{fmtDate(r.date)}</span>
                <span className="min-w-0 truncate text-[13px] text-ink" title={r.description}>{r.description || "—"}</span>
                <span className="text-right text-[13.5px] font-semibold tabular-nums">{usd(r.amount)}</span>
                {result ? (
                  <span>{r.applied ? <Badge tone="success">Recorded</Badge> : r.error ? <Badge tone="danger">{r.error}</Badge> : <Badge tone="neutral">Skipped</Badge>}</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <select aria-label={`Invoice for deposit on row ${r.n}`} value={pick[r.n] ?? ""} onChange={(e) => setPick({ ...pick, [r.n]: e.target.value })} className={input}>
                      <option value="">Don&rsquo;t apply</option>
                      {imp.invoices.map((i) => <option key={i.id} value={i.id}>{i.clientName} · {i.number} · {usd(i.balance)}{i.paymentMode === "bank_product" ? " (refund)" : ""}</option>)}
                    </select>
                    {r.match && pick[r.n] === r.invoiceId && <Badge tone={r.match === "name_amount" ? "success" : "warning"}>{r.match === "name_amount" ? "Name + amount" : "Amount only"}</Badge>}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!result && <p className="text-[12px] text-muted">&ldquo;Amount only&rdquo; matches found one unpaid invoice with that exact balance — double-check them. The same deposit can never be applied twice.</p>}
        </div>
      )}
    </Modal>
  );
}
