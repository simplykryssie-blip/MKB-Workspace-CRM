"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, Label, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { STAFF, SAMPLE_NOW, staffById, meId, staffList } from "@/lib/sample/clients";
import { TAX_YEARS } from "@/lib/sample/tax";
import { useClients } from "@/lib/store/clients-store";
import { billing, taxRules, useTax } from "@/lib/store/tax-store";
import { FILING_STATUSES, FORM_LABEL, REJECTION_REASONS, RETURN_STATUSES, dueDates, formForEntity, formsFor, type EfileAttempt, type FilingStatus, type ReturnStatus, type TaxForm, type TaxReturn } from "@/lib/tax/config";
import { US_STATES } from "@/lib/validation";
import { fmtDate, usd } from "@/lib/format";

const dateIn = (days: number) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + days);
  return t.toISOString().slice(0, 10);
};

/* ------------------------------------------------------------------ */

export function NewReturnDialog({ open, onClose, defaultYear, clientId: presetClient, onCreated }: { open: boolean; onClose: () => void; defaultYear: number; clientId?: string; onCreated: (id: string) => void }) {
  const tax = useTax();
  const { clients } = useClients();
  const toast = useToast();
  const sorted = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);
  const [clientId, setClientId] = useState(presetClient ?? "");
  const [year, setYear] = useState(defaultYear);
  const [form, setForm] = useState<TaxForm>("1040");
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("Single");
  const [preparer, setPreparer] = useState(meId());
  const [reviewer, setReviewer] = useState(meId());
  const [states, setStates] = useState<string[]>(["GA"]);
  const [extension, setExtension] = useState(false);
  const [extOnly, setExtOnly] = useState(false);
  const client = clients.find((c) => c.id === clientId);

  useEffect(() => {
    if (!open) return;
    setClientId(presetClient ?? "");
    setYear(defaultYear);
    setExtension(false);
    setStates(["GA"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!client) return;
    setForm(client.type === "business" ? formForEntity(client.business?.entityType) : "1040");
    if (client.address.state && client.address.state.length === 2) setStates([client.address.state]);
  }, [client]);

  const duplicate = tax.returns.find((r) => r.clientId === clientId && r.taxYear === year && r.form === form);
  const { due, extended } = dueDates(form, year);
  const valid = !!client && !duplicate;

  const create = () => {
    if (!valid) return;
    const id = tax.createReturn({ clientId, taxYear: year, form, filingStatus: client!.type === "individual" ? filingStatus : undefined, preparerId: preparer, reviewerId: reviewer, states, extension, extensionOnly: extOnly });
    toast(`TY ${year} ${form} return created for ${client!.name}`);
    onCreated(id);
  };

  return (
    <Modal open={open} onClose={onClose} title="New tax return" description="Every return belongs to a client record. Each tax year is a separate return." size="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={create}>Create return</Button></>}>
      <div className="space-y-4">
        <div>
          <SelectField id="nr-client" label="Client" required value={clientId} onChange={(e) => setClientId(e.target.value)} options={[["", "Choose a client…"], ...sorted.map((c) => [c.id, `${c.name} — ${c.type === "business" ? c.business?.entityType ?? "Business" : "Individual"}`] as [string, string])]} />
          <p className="mt-1 text-[12px] text-muted">
            Not a client yet? <Link href="/clients/new" className="font-semibold text-accent">Create the client</Link> or convert their lead first.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="nr-year" label="Tax year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))} options={TAX_YEARS.map((y) => [String(y), String(y)])} />
          <SelectField id="nr-form" label="Return" value={form} onChange={(e) => setForm(e.target.value as TaxForm)} options={(client ? formsFor(client.type) : formsFor("individual")).map((f) => [f, FORM_LABEL[f]])} />
          {client?.type !== "business" && <SelectField id="nr-fs" label="Filing status" value={filingStatus} onChange={(e) => setFilingStatus(e.target.value as FilingStatus)} options={FILING_STATUSES.map((f) => [f, f])} />}
          <SelectField id="nr-preparer" label="Preparer" value={preparer} onChange={(e) => setPreparer(e.target.value)} options={staffList().map((s) => [s.id, s.name])} />
          <SelectField id="nr-reviewer" label="Reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)} options={staffList().map((s) => [s.id, s.name])} />
          <div>
            <Label>State returns</Label>
            <div className="flex flex-wrap gap-1.5">
              {states.map((st) => (
                <button key={st} type="button" onClick={() => setStates((x) => x.filter((y) => y !== st))} className="rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-[12.5px] font-semibold text-accent-ink" aria-label={`Remove ${st}`}>
                  {st} ×
                </button>
              ))}
              <select aria-label="Add state" value="" onChange={(e) => e.target.value && setStates((x) => [...new Set([...x, e.target.value])])} className="rounded-full border border-line bg-surface px-2 py-1 text-[12.5px] text-ink-2">
                <option value="">+ State</option>
                {US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
        {preparer === reviewer && <p className="flex items-center gap-1.5 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink"><AlertTriangle size={14} /> Preparer and reviewer are the same person — a second reviewer is recommended.</p>}
        <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-2 ring-1 ring-line">
          {due ? <>Due {fmtDate(due)}{extended && <> · extended deadline {fmtDate(extended)}</>}</> : "Amended returns have no fixed filing deadline."}
        </div>
        {due && <Checkbox label="Extension only — file the extension now, prepare the return later" checked={extOnly} onChange={() => { setExtOnly((v) => !v); setExtension(false); }} />}
        {due && !extOnly && <Checkbox label="Extension already filed" checked={extension} onChange={() => setExtension((v) => !v)} />}
        {duplicate && (
          <p className="flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
            <AlertTriangle size={14} /> {client?.name} already has a TY {year} {form} return.{" "}
            <Link href={`/services/tax-preparation/returns/${duplicate.id}`} className="font-semibold underline">Open it</Link>
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

const SIGNOFF_CHECKS = ["Return ties to source documents", "Prior-year carryovers and estimates checked", "Taxpayer identity and bank details verified"];

export function SignOffDialog({ r, open, onClose }: { r: TaxReturn; open: boolean; onClose: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const [by, setBy] = useState(r.reviewerId);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<boolean[]>(SIGNOFF_CHECKS.map(() => false));
  useEffect(() => {
    if (open) {
      setBy(r.reviewerId);
      setNote("");
      setChecks(SIGNOFF_CHECKS.map(() => false));
    }
  }, [open, r.reviewerId]);
  const save = () => {
    tax.signOff(r.id, by, note.trim());
    toast(`Signed off by ${staffById(by).name}`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Reviewer sign-off" description={`TY ${r.taxYear} ${r.form}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={ShieldCheck} disabled={!checks.every(Boolean)} onClick={save}>Sign off</Button></>}>
      <div className="space-y-3">
        <SelectField id="so-by" label="Reviewer" value={by} onChange={(e) => setBy(e.target.value)} options={staffList().map((s) => [s.id, s.name])} />
        {by === r.preparerId && <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">The reviewer is also the preparer on this return.</p>}
        {SIGNOFF_CHECKS.map((c, i) => (
          <Checkbox key={c} label={c} checked={checks[i]} onChange={() => setChecks((x) => x.map((v, j) => (j === i ? !v : v)))} />
        ))}
        <TextArea id="so-note" label="Review notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function TransmitDialog({ r, open, onClose }: { r: TaxReturn; open: boolean; onClose: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const options = ["Federal", ...r.states];
  const [sel, setSel] = useState<string[]>(options);
  useEffect(() => {
    if (open) setSel(["Federal", ...r.states]);
  }, [open, r.states]);
  const [ids, setIds] = useState<Record<string, string>>({});
  const blockers = [!r.reviewSignoff && "Reviewer sign-off is missing", !r.clientApprovedAt && "Client approval (e-file authorization) is missing", taxRules().requireOwnerApproval && !r.ownerApproval && "The Owner's final approval is missing"].filter(Boolean) as string[];
  const send = () => {
    tax.submitEfile(r.id, sel, ids);
    toast(`Transmitted ${sel.join(" + ")} — awaiting acknowledgement`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Record e-file" description="Transmit the return in your tax software, then record it here with the submission IDs." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!sel.length || blockers.length > 0} onClick={send}>Record e-file</Button></>}>
      <div className="space-y-3">
        {blockers.map((b) => <p key={b} className="flex items-center gap-1.5 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-ink"><AlertTriangle size={14} /> {b}</p>)}
        <Label>Jurisdictions</Label>
        {options.map((o) => (
          <div key={o} className="flex flex-wrap items-center gap-3">
            <Checkbox label={o === "Federal" ? `Federal — Form ${r.form}` : `${o} state return`} checked={sel.includes(o)} onChange={() => setSel((x) => (x.includes(o) ? x.filter((y) => y !== o) : [...x, o]))} />
            {sel.includes(o) && <input aria-label={`Submission ID — ${o}`} value={ids[o] ?? ""} onChange={(e) => setIds({ ...ids, [o]: e.target.value })} placeholder="Submission ID" className="h-9 max-w-[220px] flex-1 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink" />}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function AckDialog({ r, attempt, onClose }: { r: TaxReturn; attempt: EfileAttempt | null; onClose: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const [result, setResult] = useState<"accepted" | "rejected">("accepted");
  const [code, setCode] = useState(REJECTION_REASONS[0].code);
  const [detail, setDetail] = useState("");
  useEffect(() => {
    if (attempt) {
      setResult("accepted");
      setCode(REJECTION_REASONS[0].code);
      setDetail("");
    }
  }, [attempt]);
  if (!attempt) return null;
  const reason = REJECTION_REASONS.find((x) => x.code === code)!;
  const save = () => {
    tax.recordAck(r.id, attempt.id, result, result === "rejected" ? code : undefined, result === "rejected" ? (detail.trim() ? `${reason.reason} — ${detail.trim()}` : reason.reason) : undefined);
    toast(result === "accepted" ? `${attempt.jurisdiction} accepted` : `${attempt.jurisdiction} rejected — ${code}`, result === "accepted" ? "success" : "info");
    onClose();
  };
  return (
    <Modal open={!!attempt} onClose={onClose} title="Record acknowledgement" description={`${attempt.jurisdiction} · ${attempt.submissionId}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Result" className="grid grid-cols-2 gap-2">
          {(["accepted", "rejected"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={result === v} onClick={() => setResult(v)} className={`rounded-xl border p-3 text-[14px] font-semibold capitalize ${result === v ? (v === "accepted" ? "border-success bg-success-soft text-success-ink" : "border-danger bg-danger-soft text-danger-ink") : "border-line text-ink-2 hover:bg-surface-hover"}`}>
              {v}
            </button>
          ))}
        </div>
        {result === "rejected" && (
          <>
            <SelectField id="ack-code" label="Rejection code (sample codes)" value={code} onChange={(e) => setCode(e.target.value)} options={REJECTION_REASONS.map((x) => [x.code, `${x.code} — ${x.reason}`])} />
            <TextField id="ack-detail" label="Details" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Anything from the acknowledgement" />
          </>
        )}
      </div>
    </Modal>
  );
}

export function ResolveDialog({ r, open, onClose }: { r: TaxReturn; open: boolean; onClose: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const [next, setNext] = useState<"Ready to E-file" | "In Preparation">("Ready to E-file");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setNext("Ready to E-file");
      setNote("");
    }
  }, [open]);
  const last = r.efile.find((e) => e.result === "rejected");
  return (
    <Modal open={open} onClose={onClose} title="Resolve rejection" description={last ? `${last.code} — ${last.reason}` : undefined} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!note.trim()} onClick={() => { tax.resolveRejection(r.id, next, note.trim()); toast(next === "Ready to E-file" ? "Corrected — ready to resubmit" : "Sent back to preparation"); onClose(); }}>Save</Button></>}>
      <div className="space-y-4">
        <TextArea id="rs-note" label="What was corrected?" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Business name updated to match IRS records" />
        <div role="radiogroup" aria-label="Next step" className="space-y-2">
          {(
            [
              ["Ready to E-file", "Ready to resubmit", "Correction doesn't change the return's numbers"],
              ["In Preparation", "Back to preparation", "Return changed — needs a new review and client approval"],
            ] as const
          ).map(([v, l, h]) => (
            <button key={v} type="button" role="radio" aria-checked={next === v} onClick={() => setNext(v)} className={`block w-full rounded-xl border p-3 text-left ${next === v ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-hover"}`}>
              <span className="block text-[14px] font-semibold text-ink">{l}</span>
              <span className="block text-[12.5px] text-muted">{h}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function StatusDialog({ r, open, onClose }: { r: TaxReturn; open: boolean; onClose: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const [status, setStatus] = useState<ReturnStatus>(r.status);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setStatus(r.status);
      setNote("");
    }
  }, [open, r.status]);
  return (
    <Modal open={open} onClose={onClose} title="Change status" description="Manual override — the guided workflow is recommended." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={status === r.status || !note.trim()} onClick={() => { tax.setStatus(r.id, status, note.trim()); toast(`Status → ${status}`); onClose(); }}>Change status</Button></>}>
      <div className="space-y-4">
        <SelectField id="st-status" label="Status" value={status} onChange={(e) => setStatus(e.target.value as ReturnStatus)} options={RETURN_STATUSES.map((s) => [s, s])} />
        <TextField id="st-note" label="Reason" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Recorded in the status history" />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function AddItemDialog({ r, open, onClose }: { r: TaxReturn; open: boolean; onClose: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Supporting");
  const [sensitive, setSensitive] = useState(false);
  const [required, setRequired] = useState(true);
  useEffect(() => {
    if (open) {
      setName("");
      setSensitive(false);
      setRequired(true);
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Add checklist item" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={() => { tax.addItem(r.id, { name: name.trim(), category, sensitive, required }); toast(`Added "${name.trim()}"`); onClose(); }}>Add</Button></>}>
      <div className="space-y-4">
        <TextField id="ai-name" label="Document" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HSA contribution statement (5498-SA)" />
        <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={["Income", "Deductions", "Credits", "Identity", "Tax return", "Financials", "Payroll", "Supporting", "Correspondence"].map((x) => [x, x])} />
        <Checkbox label="Restricted (sensitive document)" hint="Only staff with sensitive-document access can open it." checked={sensitive} onChange={() => setSensitive((v) => !v)} />
        <Checkbox label="Required before review" checked={required} onChange={() => setRequired((v) => !v)} />
      </div>
    </Modal>
  );
}

export function WaiveDialog({ r, itemId, onClose }: { r: TaxReturn; itemId: string | null; onClose: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const [reason, setReason] = useState("Not applicable this year");
  if (!itemId) return null;
  const it = r.checklist.find((i) => i.id === itemId);
  return (
    <Modal open={!!itemId} onClose={onClose} title="Mark not needed" description={it?.name} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { tax.waiveItem(r.id, itemId, reason); toast("Marked not needed"); onClose(); }}>Save</Button></>}>
      <SelectField id="wv-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={["Not applicable this year", "Client confirmed none", "Already on file", "Will be provided at signing"].map((x) => [x, x])} />
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function AddLineDialog({ r, open, onClose }: { r: TaxReturn; open: boolean; onClose: () => void }) {
  const tax = useTax();
  const items = tax.fees.filter((f) => f.kind === "both" || f.kind === r.kind);
  const [code, setCode] = useState(items[0]?.code ?? "custom");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");
  useEffect(() => {
    if (open) {
      setCode(items[0]?.code ?? "custom");
      setQty("1");
      setDesc("");
      setUnit("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const f = items.find((x) => x.code === code);
  const valid = Number(qty) > 0 && (code !== "custom" || (desc.trim() && Number(unit) >= 0 && unit !== ""));
  return (
    <Modal open={open} onClose={onClose} title="Add price line" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { tax.addLine(r.id, { code: f?.code, description: f ? f.label : desc.trim(), qty: Number(qty), unit: f ? f.price : Number(unit) }); onClose(); }}>Add</Button></>}>
      <div className="space-y-4">
        <SelectField id="al-code" label="Fee schedule item" value={code} onChange={(e) => setCode(e.target.value)} options={[...items.map((x) => [x.code, `${x.label} — ${usd(x.price)}${x.unit ? ` ${x.unit}` : ""}`] as [string, string]), ["custom", "Custom line…"]]} />
        {code === "custom" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="al-desc" label="Description" required value={desc} onChange={(e) => setDesc(e.target.value)} />
            <TextField id="al-unit" label="Price ($)" type="number" min={0} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        )}
        <TextField id="al-qty" label="Quantity" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
    </Modal>
  );
}

export function TaxInvoiceDialog({ r, open, onClose }: { r: TaxReturn; open: boolean; onClose: () => void }) {
  const tax = useTax();
  const { clients } = useClients();
  const toast = useToast();
  const client = clients.find((c) => c.id === r.clientId);
  const b = billing(r, client);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState(dateIn(14));
  useEffect(() => {
    if (open) {
      setAmount(String(b.unbilled));
      setDesc(`TY ${r.taxYear} ${r.form} tax preparation${b.billed > 0 ? " — balance" : ""}`);
      setDue(dateIn(14));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const n = Number(amount);
  return (
    <Modal open={open} onClose={onClose} title="Invoice this return" description={`Price ${usd(b.price)} · billed ${usd(b.billed)} · unbilled ${usd(b.unbilled)}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!(n > 0) || !desc.trim()} onClick={() => { const num = tax.invoice(r.id, n, desc.trim(), new Date(due + "T17:00").toISOString()); toast(`${num} sent — appears on the client profile`); onClose(); }}>Send invoice</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAmount(String(b.unbilled))} className="rounded-full border border-line px-3 py-1 text-[12.5px] font-medium text-ink-2 hover:bg-surface-hover">Full unbilled ({usd(b.unbilled)})</button>
          <button type="button" onClick={() => setAmount(String(Math.round(b.price / 2)))} className="rounded-full border border-line px-3 py-1 text-[12.5px] font-medium text-ink-2 hover:bg-surface-hover">50% deposit ({usd(Math.round(b.price / 2))})</button>
        </div>
        <TextField id="ti-amount" label="Amount ($)" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField id="ti-desc" label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <TextField id="ti-due" label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
    </Modal>
  );
}
