"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Ban, CreditCard, Download, Eye, FileUp, Pencil, Plus, RotateCcw, Send, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { useTeam } from "@/lib/store/team-store";
import { useServiceFees } from "@/lib/fees/use-fees";
import { BACKEND, call } from "@/lib/sync/remote";
import { invoiceStatus } from "@/lib/status";
import { staffById } from "@/lib/sample/clients";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { Invoice, InvoiceLine, ServiceKey } from "@/lib/types";
import { BankImport } from "./BankImport";

export type Row = Invoice & { clientId: string; clientName: string };
type Payment = { id: string; amount: number; method: string; source: string; reference?: string; receivedAt: string; note?: string };
const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const SERVICE_LABEL: Record<ServiceKey, string> = { tax: "Tax", books: "Bookkeeping", biz: "Business services", expunge: "Expungement" };
const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink";
const owed = (i: Invoice) => Math.max(0, i.amount - i.paid);

/** Billing: every invoice in one place (live CRM). */
export function BillingPage() {
  const toast = useToast();
  const team = useTeam();
  const { clients } = useClients();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "unpaid" | "overdue" | "refund" | "paid" | "draft" | "void">("unpaid");
  const [service, setService] = useState<ServiceKey | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [feesOpen, setFeesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const load = () => (BACKEND ? call<{ invoices: Row[] }>("GET", "/api/billing/invoices").then((r) => setRows(r.invoices)).catch((e) => { toast(e instanceof Error ? e.message : "Couldn't load billing", "info"); setRows([]); }) : setRows(clients.flatMap((c) => c.invoices.map((i) => ({ ...i, clientId: c.id, clientName: c.name })))));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const on = () => load(); window.addEventListener("mkb:billing-changed", on); return () => window.removeEventListener("mkb:billing-changed", on); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("invoice"); if (id) setOpen(id); }, []);
  const can = team.can("billing", "edit") || team.can("tax", "edit");
  const canSettings = team.can("billing", "settings");

  const stats = useMemo(() => {
    const live = (rows ?? []).filter((r) => r.status !== "void" && r.status !== "draft");
    const month = new Date().toISOString().slice(0, 7);
    return {
      outstanding: live.filter((r) => r.paymentMode !== "bank_product").reduce((s, r) => s + owed(r), 0),
      overdue: live.filter((r) => r.status === "overdue").reduce((s, r) => s + owed(r), 0),
      refund: live.filter((r) => r.paymentMode === "bank_product").reduce((s, r) => s + owed(r), 0),
      collected: live.filter((r) => r.paidAt?.startsWith(month)).reduce((s, r) => s + r.paid, 0),
    };
  }, [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => {
    if (service !== "all" && r.service !== service) return false;
    if (q && !`${r.number} ${r.clientName} ${r.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (status === "unpaid") return ["open", "partial", "overdue"].includes(r.status) && r.paymentMode !== "bank_product";
    if (status === "refund") return r.paymentMode === "bank_product" && owed(r) > 0 && r.status !== "void";
    if (status === "all") return true;
    return r.status === status;
  }), [rows, q, status, service]);

  if (!BACKEND) return <Card className="p-8 text-center text-muted">Billing works in the live CRM (preview or production).</Card>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">Billing</h1>
          <p className="mt-1 text-[14px] text-muted">Every invoice and payment across all services.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSettings && <Button icon={Settings2} onClick={() => setFeesOpen(true)}>Back-end fees</Button>}
          {team.can("billing", "approve") && <Button icon={FileUp} onClick={() => setImportOpen(true)}>Import bank file</Button>}
          {can && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New invoice</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[["Outstanding", stats.outstanding, "unpaid"], ["Overdue", stats.overdue, "overdue"], ["Waiting on refunds", stats.refund, "refund"], ["Collected this month", stats.collected, "paid"]].map(([l, v, f]) => (
          <button key={String(l)} onClick={() => setStatus(f as typeof status)} className="rounded-2xl border border-line bg-surface p-4 text-left shadow-soft hover:border-accent/40">
            <span className="block text-[22px] font-bold tabular-nums text-ink">{usd(v as number)}</span>
            <span className="text-[12.5px] text-muted">{l as string}</span>
          </button>
        ))}
      </div>

      {can && <LateFees onApplied={load} />}

      <Card>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <input aria-label="Search invoices" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, number or description" className={`${input} max-w-[320px]`} />
          <select aria-label="Service" value={service} onChange={(e) => setService(e.target.value as typeof service)} className={`${input} max-w-[180px]`}>
            <option value="all">All services</option>{(Object.keys(SERVICE_LABEL) as ServiceKey[]).map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {([["unpaid", "Unpaid"], ["overdue", "Overdue"], ["refund", "Paid from refund"], ["paid", "Paid"], ["draft", "Drafts"], ["void", "Void"], ["all", "All"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${status === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{l}</button>
            ))}
          </div>
        </div>
        {!rows ? <p className="border-t border-line px-6 py-8 text-center text-muted">Loading…</p> : shown.length === 0 ? <p className="border-t border-line px-6 py-8 text-center text-[13.5px] text-muted">No invoices in this view.</p> : (
          <ul className="divide-y divide-line border-t border-line">
            {shown.map((r) => (
              <li key={r.id}>
                <button onClick={() => setOpen(r.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-surface-hover sm:px-6">
                  <span className="min-w-0 flex-1 basis-[50%] sm:basis-auto">
                    <span className="block truncate text-[14px] font-medium text-ink">{r.clientName} <span className="font-mono text-[12px] text-muted">{r.number}</span></span>
                    <span className="block truncate text-[12px] text-muted">{SERVICE_LABEL[r.service]} · {r.description} · {r.paymentMode === "bank_product" ? "paid from refund" : `due ${fmtDate(r.dueAt)}`}</span>
                  </span>
                  <Badge tone={invoiceStatus[r.status].tone}>{invoiceStatus[r.status].label}</Badge>
                  <span className="w-28 text-right tabular-nums"><span className="block text-[14px] font-semibold text-ink">{usd(owed(r))}</span><span className="block text-[11px] text-muted">of {usd(r.amount)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <InvoicePanel id={open} onClose={() => { setOpen(null); history.replaceState(null, "", "/billing"); }} onChanged={load} />
      <InvoiceEditor open={creating} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); load(); setOpen(id); }} />
      <BureauFeesDialog open={feesOpen} onClose={() => setFeesOpen(false)} />
      <BankImport open={importOpen} onClose={() => setImportOpen(false)} onDone={load} rows={rows ?? []} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function InvoicePanel({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const team = useTeam();
  const [d, setD] = useState<{ invoice: Row; payments: Payment[] } | null>(null);
  const [mode, setMode] = useState<null | "edit" | "pay" | "adjust" | "void">(null);
  const [busy, setBusy] = useState(false);
  const load = () => id && call<{ invoice: Row; payments: Payment[] }>("GET", `/api/billing/invoices/${id}`).then(setD).catch((e) => { toast(e instanceof Error ? e.message : "Couldn't open", "info"); onClose(); });
  useEffect(() => { setD(null); setMode(null); if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const can = team.can("billing", "edit") || (d?.invoice.service === "tax" && team.can("tax", "edit"));
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); toast(msg); await load(); onChanged(); window.dispatchEvent(new CustomEvent("mkb:client-changed", { detail: d?.invoice.clientId })); setMode(null); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  const i = d?.invoice;
  return (
    <Modal open={!!id} onClose={onClose} size="lg" title={i ? `Invoice ${i.number}` : "Invoice"} description={i ? `${i.clientName} · issued ${fmtDate(i.issuedAt)}` : ""}>
      {!i ? <p className="py-6 text-center text-muted">Loading…</p> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={invoiceStatus[i.status].tone}>{invoiceStatus[i.status].label}</Badge>
            <Badge tone={i.paymentMode === "bank_product" ? "info" : "neutral"}>{i.paymentMode === "bank_product" ? "Paid from refund" : "Pay upfront"}</Badge>
            {i.sentAt && <span className="text-[12px] text-muted">Sent {fmtDate(i.sentAt)}</span>}
            <Link href={`/clients/${i.clientId}`} className="ml-auto text-[13px] font-semibold text-accent">Client profile</Link>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {(i.lines ?? []).map((l, n) => <li key={n} className="flex justify-between gap-3 px-3 py-2 text-[13.5px]"><span className="text-ink">{l.label}{l.kind === "backend" && <span className="ml-1.5 text-[11px] text-muted">back-end fee</span>}</span><span className="tabular-nums">{usd(l.kind === "discount" ? -Math.abs(l.amount) : l.amount)}</span></li>)}
            {(i.adjustments ?? []).map((a) => <li key={a.id} className="flex justify-between gap-3 px-3 py-2 text-[13px] text-muted"><span>{a.kind[0].toUpperCase() + a.kind.slice(1)} — {a.note}</span><span className="tabular-nums">{a.kind === "correction" ? usd(a.amount) : usd(-Math.abs(a.amount))}</span></li>)}
            <li className="flex justify-between px-3 py-2 text-[14px] font-semibold"><span>Total</span><span className="tabular-nums">{usd(i.amount)}</span></li>
            <li className="flex justify-between px-3 py-2 text-[13.5px]"><span className="text-muted">Paid</span><span className="tabular-nums">{usd(i.paid)}</span></li>
            <li className="flex justify-between px-3 py-2 text-[15px] font-bold"><span>Balance</span><span className="tabular-nums">{usd(owed(i))}</span></li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={Eye} onClick={() => window.open(`/api/billing/invoices/${i.id}/pdf?inline=1`, "_blank", "noopener")}>View PDF</Button>
            <Button size="sm" icon={Download} onClick={() => { const a = document.createElement("a"); a.href = `/api/billing/invoices/${i.id}/pdf`; a.click(); }}>Download</Button>
            {can && i.status !== "void" && <Button size="sm" variant="primary" icon={Send} disabled={busy} onClick={() => act(async () => { const r = await call<{ sent: boolean; payLink: boolean; stripe: boolean }>("POST", `/api/billing/invoices/${i.id}/send`, {}); if (r.payLink && !r.stripe) toast("Note: online payment isn't connected yet — the invoice says to pay at the office", "info"); }, i.sentAt ? "Invoice resent" : "Invoice sent")}>{i.sentAt ? "Resend" : "Send"}</Button>}
            {can && i.status !== "void" && i.paid === 0 && <Button size="sm" icon={Pencil} onClick={() => setMode("edit")}>Edit</Button>}
            {can && owed(i) > 0 && i.status !== "void" && <Button size="sm" icon={CreditCard} onClick={() => setMode("pay")}>Record payment</Button>}
            {can && i.status !== "void" && <Button size="sm" icon={RotateCcw} onClick={() => setMode("adjust")}>Refund / credit</Button>}
            {can && i.status !== "void" && i.paid === 0 && <Button size="sm" variant="ghost" icon={Ban} onClick={() => setMode("void")}>Void</Button>}
          </div>
          {mode === "pay" && <PayForm owed={owed(i)} busy={busy} onCancel={() => setMode(null)} onSave={(b) => act(() => call("POST", `/api/billing/invoices/${i.id}/payments`, b), "Payment recorded")} />}
          {mode === "adjust" && <AdjustForm busy={busy} onCancel={() => setMode(null)} onSave={(b) => act(() => call("POST", `/api/billing/invoices/${i.id}/adjust`, b), "Adjustment saved")} />}
          {mode === "void" && <VoidForm busy={busy} onCancel={() => setMode(null)} onSave={(reason) => act(() => call("POST", `/api/billing/invoices/${i.id}/void`, { reason }), "Invoice voided")} />}
          {d.payments.length > 0 && (
            <div>
              <h3 className="mb-1 text-[13px] font-semibold text-ink-2">Payments</h3>
              <ul className="divide-y divide-line rounded-xl border border-line">{d.payments.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-[13px]"><span>{fmtDate(p.receivedAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}{p.note ? ` — ${p.note}` : ""}</span><span className="tabular-nums font-medium">{usd(p.amount)}</span></li>)}</ul>
            </div>
          )}
          {(i.history ?? []).length > 0 && (
            <div>
              <h3 className="mb-1 text-[13px] font-semibold text-ink-2">History</h3>
              <ul className="space-y-0.5 text-[12.5px] text-muted">{(i.history ?? []).map((h, n) => <li key={n}>{fmtDateTime(h.at)} · {h.by === "system" ? "System" : staffById(h.by)?.name ?? "Staff"} — {h.text}</li>)}</ul>
            </div>
          )}
          <InvoiceEditor open={mode === "edit"} existing={i} onClose={() => setMode(null)} onSaved={() => { setMode(null); load(); onChanged(); }} />
        </div>
      )}
    </Modal>
  );
}

function PayForm({ owed, busy, onCancel, onSave }: { owed: number; busy: boolean; onCancel: () => void; onSave: (b: object) => void }) {
  const [amount, setAmount] = useState(String(owed));
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-4 sm:items-end">
      <div><label htmlFor="pay-amt" className="mb-1 block text-[12.5px] font-medium text-ink-2">Amount</label><input id="pay-amt" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} /></div>
      <div><label htmlFor="pay-method" className="mb-1 block text-[12.5px] font-medium text-ink-2">Method</label><select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} className={input}>{["Cash", "Card (in office)", "Check", "Zelle", "Cash App", "Bank transfer", "Refund transfer (bank product)", "Other"].map((m) => <option key={m}>{m}</option>)}</select></div>
      <div><label htmlFor="pay-ref" className="mb-1 block text-[12.5px] font-medium text-ink-2">Reference</label><input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check #, last 4…" className={input} /></div>
      <div><label htmlFor="pay-date" className="mb-1 block text-[12.5px] font-medium text-ink-2">Date received</label><input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} /></div>
      <div className="flex gap-2 sm:col-span-4"><Button size="sm" variant="primary" disabled={busy || !(Number(amount) > 0)} onClick={() => onSave({ amount: Number(amount), method, reference, receivedAt: date })}>Save payment</Button><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}

function AdjustForm({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (b: object) => void }) {
  const [kind, setKind] = useState<"credit" | "refund" | "correction">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-3 sm:items-end">
      <div><label htmlFor="adj-kind" className="mb-1 block text-[12.5px] font-medium text-ink-2">Type</label><select id="adj-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={input}><option value="credit">Credit (they owe less)</option><option value="refund">Refund (money returned)</option><option value="correction">Correction (+ or − total)</option></select></div>
      <div><label htmlFor="adj-amt" className="mb-1 block text-[12.5px] font-medium text-ink-2">Amount</label><input id="adj-amt" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} /></div>
      <div><label htmlFor="adj-note" className="mb-1 block text-[12.5px] font-medium text-ink-2">Reason</label><input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} className={input} /></div>
      <div className="flex gap-2 sm:col-span-3"><Button size="sm" variant="primary" disabled={busy || !Number(amount) || !note.trim()} onClick={() => onSave({ kind, amount: Number(amount), note })}>Save</Button><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}

function VoidForm({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-danger/30 p-3">
      <div className="min-w-[220px] flex-1"><label htmlFor="void-why" className="mb-1 block text-[12.5px] font-medium text-ink-2">Why is this invoice being voided?</label><input id="void-why" value={reason} onChange={(e) => setReason(e.target.value)} className={input} /></div>
      <Button size="sm" variant="primary" disabled={busy || !reason.trim()} onClick={() => onSave(reason)}>Void invoice</Button><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type EditLine = { label: string; amount: string; kind: InvoiceLine["kind"] };
/** New invoice, or edit one with no payments yet. Back-end fees are added by the server. */
export function InvoiceEditor({ open, onClose, onSaved, existing, preset }: { open: boolean; onClose: () => void; onSaved: (id: string) => void; existing?: Row; preset?: { clientId: string; service: ServiceKey; taxReturnId?: string; lines?: EditLine[]; description?: string } }) {
  const toast = useToast();
  const { clients } = useClients();
  const F = useServiceFees();
  const [clientId, setClientId] = useState("");
  const [service, setService] = useState<ServiceKey>("tax");
  const [mode, setMode] = useState<"upfront" | "bank_product">("upfront");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<EditLine[]>([{ label: "", amount: "", kind: "service" }]);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    if (existing) {
      setClientId(existing.clientId); setService(existing.service); setMode(existing.paymentMode ?? "upfront"); setDescription(existing.description);
      setLines((existing.lines ?? []).filter((l) => l.kind !== "backend").map((l) => ({ label: l.label, amount: String(l.amount), kind: l.kind })));
      setDue(existing.dueAt.slice(0, 10));
    } else {
      setClientId(preset?.clientId ?? ""); setService(preset?.service ?? "tax"); setMode("upfront"); setDescription(preset?.description ?? "");
      setLines(preset?.lines?.length ? preset.lines : [{ label: "", amount: "", kind: "service" }]); setDue(inTwoWeeks);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0) * (l.kind === "discount" ? -1 : 1), 0);
  const save = async (send: boolean) => {
    const body = { clientId, service, paymentMode: service === "tax" ? mode : "upfront", description, dueAt: due, lines: lines.filter((l) => l.label.trim()).map((l) => ({ label: l.label.trim(), amount: Number(l.amount) || 0, kind: l.kind })), taxReturnId: preset?.taxReturnId };
    setBusy(true);
    try {
      let id: string;
      if (existing) { id = (await call<{ invoice: Row }>("PUT", `/api/billing/invoices/${existing.id}`, { ...body, rev: existing.rev })).invoice.id; }
      else { id = (await call<{ invoice: Row }>("POST", "/api/billing/invoices", { ...body, draft: !send })).invoice.id; if (send) await call("POST", `/api/billing/invoices/${id}/send`, {}); }
      toast(existing ? "Invoice updated" : send ? "Invoice created and sent" : "Draft saved");
      window.dispatchEvent(new CustomEvent("mkb:client-changed", { detail: clientId }));
      onSaved(id);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={existing ? `Edit ${existing.number}` : "New invoice"} footer={<><Button onClick={onClose}>Cancel</Button>{!existing && <Button disabled={busy || !clientId} onClick={() => save(false)}>Save draft</Button>}<Button variant="primary" disabled={busy || !clientId || subtotal <= 0} onClick={() => save(!existing)}>{existing ? "Save changes" : "Create & send"}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="ie-client" className="mb-1 block text-[13px] font-medium text-ink-2">Client</label><select id="ie-client" disabled={!!existing || !!preset} value={clientId} onChange={(e) => setClientId(e.target.value)} className={input}><option value="">Choose…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label htmlFor="ie-service" className="mb-1 block text-[13px] font-medium text-ink-2">Service</label><select id="ie-service" disabled={!!existing || !!preset} value={service} onChange={(e) => setService(e.target.value as ServiceKey)} className={input}>{(Object.keys(SERVICE_LABEL) as ServiceKey[]).map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}</select></div>
        </div>
        {service === "tax" && (
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1 text-[13px] font-medium text-ink-2">How will the client pay?</legend>
            <label className={`flex flex-1 cursor-pointer items-start gap-2 rounded-xl border p-3 text-[13px] ${mode === "upfront" ? "border-accent bg-accent-soft/40" : "border-line"}`}><input type="radio" name="ie-mode" checked={mode === "upfront"} onChange={() => setMode("upfront")} className="mt-0.5 accent-[var(--accent)]" /><span><b>Pay upfront</b><span className="block text-muted">Invoice with a Pay now button.</span></span></label>
            <label className={`flex flex-1 cursor-pointer items-start gap-2 rounded-xl border p-3 text-[13px] ${mode === "bank_product" ? "border-accent bg-accent-soft/40" : "border-line"}`}><input type="radio" name="ie-mode" checked={mode === "bank_product"} onChange={() => setMode("bank_product")} className="mt-0.5 accent-[var(--accent)]" /><span><b>Pay from refund (bank product)</b><span className="block text-muted">Back-end fees are added, with the refund disclosure.</span></span></label>
          </fieldset>
        )}
        <div><label htmlFor="ie-desc" className="mb-1 block text-[13px] font-medium text-ink-2">Description</label><input id="ie-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 2025 tax preparation" className={input} /></div>
        <div className="space-y-2">
          <span className="block text-[13px] font-medium text-ink-2">Lines</span>
          {lines.map((l, n) => (
            <div key={n} className="grid grid-cols-[1fr_110px_auto] gap-2 sm:grid-cols-[1fr_150px_110px_auto]">
              <input aria-label={`Line ${n + 1} description`} value={l.label} onChange={(e) => setLines(lines.map((x, j) => (j === n ? { ...x, label: e.target.value } : x)))} placeholder="Description" className={input} />
              <select aria-label={`Line ${n + 1} type`} value={l.kind} onChange={(e) => setLines(lines.map((x, j) => (j === n ? { ...x, kind: e.target.value as InvoiceLine["kind"] } : x)))} className={`${input} hidden sm:block`}>
                <option value="service">MKB fee</option><option value="additional">Additional fee</option><option value="discount">Discount</option><option value="filing">Government fee</option><option value="third_party">Third-party fee</option><option value="late_fee">Late fee</option>
              </select>
              <input aria-label={`Line ${n + 1} amount`} type="number" step="0.01" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === n ? { ...x, amount: e.target.value } : x)))} placeholder="0.00" className={input} />
              <button type="button" aria-label={`Remove line ${n + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== n))} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-hover"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button size="sm" icon={Plus} onClick={() => setLines([...lines, { label: "", amount: "", kind: "service" }])}>Add line</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {mode !== "bank_product" || service !== "tax" ? <div><label htmlFor="ie-due" className="mb-1 block text-[13px] font-medium text-ink-2">Due date</label><input id="ie-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} /></div> : <p className="self-end text-[12.5px] text-muted">Collected from the client&rsquo;s refund — no due date shown to the client.</p>}
          <p className="self-end text-right text-[14px]">Subtotal <b className="tabular-nums">{usd(subtotal)}</b>{service === "tax" && <span className="block text-[12px] text-muted">{mode === "bank_product" ? `+ back-end fees for ${F.fees?.taxPartners.serviceBureau || "your service bureau"}` : "+ any back-end fees set to apply to every return"}</span>}</p>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

type Fee = { code: string; label: string; amount: string; applies: "all" | "bank_product" };
function BureauFeesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const F = useServiceFees();
  const [bureau, setBureau] = useState("");
  const [fees, setFees] = useState<Fee[]>([]);
  const [busy, setBusy] = useState(false);
  const load = (b: string) => call<{ fees: { code: string; label: string; amount: number; applies: Fee["applies"] }[] }>("GET", `/api/billing/bureau-fees?bureau=${encodeURIComponent(b)}`).then((r) => setFees(r.fees.length ? r.fees.map((f) => ({ ...f, amount: String(f.amount) })) : [
    { code: "BP", label: "Bank product fee (refund transfer)", amount: "", applies: "bank_product" },
    { code: "SB", label: "Service bureau fee", amount: "", applies: "bank_product" },
    { code: "TX", label: "Transmission fee", amount: "", applies: "bank_product" },
    { code: "EF", label: "E-file fee", amount: "", applies: "bank_product" },
    { code: "DP", label: "Document prep fee", amount: "", applies: "bank_product" },
  ]));
  useEffect(() => { if (open && F.fees) { const b = F.fees.taxPartners.serviceBureau || "Service bureau"; setBureau(b); load(b); } }, [open, F.fees]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true);
    try { await call("PUT", `/api/billing/bureau-fees?bureau=${encodeURIComponent(bureau)}`, { fees: fees.filter((f) => f.label.trim()).map((f) => ({ ...f, amount: Number(f.amount) || 0 })) }); toast("Back-end fees saved"); onClose(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Back-end fees" description={`Charged by ${bureau || "your service bureau"} — added to tax invoices automatically. Staff only; clients see the fee names, not the bureau.`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy} onClick={save}>Save fees</Button></>}>
      <div className="space-y-2">
        {fees.map((f, n) => (
          <div key={n} className="grid grid-cols-[1fr_100px_auto] gap-2 sm:grid-cols-[1fr_110px_190px_auto]">
            <input aria-label={`Fee ${n + 1} name`} value={f.label} onChange={(e) => setFees(fees.map((x, j) => (j === n ? { ...x, label: e.target.value } : x)))} className={input} />
            <input aria-label={`Fee ${n + 1} amount`} type="number" step="0.01" min={0} value={f.amount} onChange={(e) => setFees(fees.map((x, j) => (j === n ? { ...x, amount: e.target.value } : x)))} placeholder="0.00" className={input} />
            <select aria-label={`Fee ${n + 1} applies to`} value={f.applies} onChange={(e) => setFees(fees.map((x, j) => (j === n ? { ...x, applies: e.target.value as Fee["applies"] } : x)))} className={`${input} hidden sm:block`}><option value="bank_product">Bank product invoices</option><option value="all">Every tax invoice</option></select>
            <button type="button" aria-label={`Remove fee ${n + 1}`} onClick={() => setFees(fees.filter((_, j) => j !== n))} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-hover"><Trash2 size={16} /></button>
          </div>
        ))}
        <Button size="sm" icon={Plus} onClick={() => setFees([...fees, { code: `F${Date.now() % 100000}`, label: "", amount: "", applies: "bank_product" }])}>Add fee</Button>
        <p className="text-[12px] text-muted">Change the service bureau&rsquo;s name in Settings → Fees → Tax preparation. Each bureau keeps its own fee list.</p>
      </div>
    </Modal>
  );
}


/* ------------------------------------------------------------------ */

type Late = { id: string; number: string; clientName: string; daysLate: number; add: number; lines: string[] };
/** Invoices past the grace period: late fees are only added when staff apply them. */
function LateFees({ onApplied }: { onApplied: () => void }) {
  const toast = useToast();
  const [c, setC] = useState<Late[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => call<{ candidates: Late[] }>("GET", "/api/billing/late-fees").then((r) => setC(r.candidates)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!c.length) return null;
  const apply = async () => {
    setBusy(true);
    try { const r = await call<{ applied: number }>("POST", "/api/billing/late-fees", { ids: c.map((x) => x.id) }); toast(`Late fees added to ${r.applied} invoice${r.applied === 1 ? "" : "s"}`); await load(); onApplied(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't apply", "info"); }
    setBusy(false);
  };
  return (
    <div role="note" className="rounded-xl border border-warning/40 bg-warning-soft/50 px-4 py-3 text-[13.5px] text-ink">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1"><b>{c.length}</b> invoice{c.length === 1 ? " is" : "s are"} past the grace period — {usd(c.reduce((s, x) => s + x.add, 0))} in late fees can be added (Settings → Fees).</span>
        <Button size="sm" onClick={() => setOpen(!open)}>{open ? "Hide" : "Review"}</Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={apply}>Apply late fees</Button>
      </div>
      {open && <ul className="mt-2 space-y-1 text-[12.5px]">{c.map((x) => <li key={x.id}>{x.clientName} · {x.number} · {x.daysLate} days late · +{usd(x.add)} ({x.lines.join("; ")})</li>)}</ul>}
    </div>
  );
}
