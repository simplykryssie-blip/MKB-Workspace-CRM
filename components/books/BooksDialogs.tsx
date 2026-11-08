"use client";

import { useEffect, useState } from "react";
import { FileText, ShieldCheck, UploadCloud, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { staffList, staffById } from "@/lib/sample/clients";
import { useBooks } from "@/lib/store/books-store";
import { REVIEW_KIND, TASK_TYPE, periodEnd, periodLabel, type BooksMonth, type BooksWorkspace, type ClientTask, type MonthStage, type ReviewKind } from "@/lib/books/config";
import { fileSize } from "@/lib/format";

type Base = { w: BooksWorkspace; m: BooksMonth; open: boolean; onClose: () => void };

export function AddReviewItemDialog({ w, m, open, onClose }: Base) {
  const books = useBooks();
  const toast = useToast();
  const [kind, setKind] = useState<ReviewKind>("uncategorized");
  const [txnRef, setTxnRef] = useState("");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState(m.assignedTo);
  useEffect(() => {
    if (open) {
      setKind("uncategorized");
      setTxnRef("");
      setAmount("");
      setDesc("");
      setAssignee(m.assignedTo);
    }
  }, [open, m.assignedTo]);
  return (
    <Modal open={open} onClose={onClose} title="Flag a transaction" description={`${w.businessName} · ${periodLabel(m.period)} — reference the QuickBooks transaction; nothing is changed in QuickBooks.`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!txnRef.trim() || !desc.trim()} onClick={() => { books.addReviewItem(w.id, m.id, { kind, txnRef: txnRef.trim(), amount: amount ? Number(amount) : undefined, description: desc.trim(), assignedTo: assignee }); toast("Review item added"); onClose(); }}>Add item</Button></>}>
      <div className="space-y-4">
        <SelectField id="ri-kind" label="Type" value={kind} onChange={(e) => setKind(e.target.value as ReviewKind)} options={Object.entries(REVIEW_KIND).map(([k, v]) => [k, v])} />
        <TextField id="ri-ref" label="QuickBooks transaction" required value={txnRef} onChange={(e) => setTxnRef(e.target.value)} placeholder="e.g. Oct 12 · Business card ••1007 · SAMPLE VENDOR" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="ri-amount" label="Amount ($)" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <SelectField id="ri-assignee" label="Assigned to" value={assignee} onChange={(e) => setAssignee(e.target.value)} options={staffList().map((s) => [s.id, s.name])} />
        </div>
        <TextArea id="ri-desc" label="What needs attention" required value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
    </Modal>
  );
}

export function ResolveItemDialog({ w, m, itemId, onClose }: { w: BooksWorkspace; m: BooksMonth; itemId: string | null; onClose: () => void }) {
  const books = useBooks();
  const toast = useToast();
  const [text, setText] = useState("");
  useEffect(() => setText(""), [itemId]);
  const it = m.reviewItems.find((r) => r.id === itemId);
  if (!it) return null;
  return (
    <Modal open={!!itemId} onClose={onClose} title="Resolve review item" description={it.txnRef} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!text.trim()} onClick={() => { books.resolveItem(w.id, m.id, it.id, text.trim()); toast("Resolved"); onClose(); }}>Resolve</Button></>}>
      <div className="space-y-3">
        {it.clientResponse && <p className="rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-ink-2"><strong>Client:</strong> {it.clientResponse}</p>}
        <TextArea id="rs-text" label="Resolution (what was done in QuickBooks)" required value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Client recategorized to Office Supplies" />
      </div>
    </Modal>
  );
}

export function StatementDialog({ w, m, accountId, onClose }: { w: BooksWorkspace; m: BooksMonth; accountId: string | null; onClose: () => void }) {
  const books = useBooks();
  const toast = useToast();
  const r = m.recons.find((x) => x.accountId === accountId);
  const acct = w.accounts.find((a) => a.id === accountId);
  // Initial values are set on mount (the dialog is keyed by account), never by a later effect that could overwrite typing.
  const [date, setDate] = useState(() => (r ? (r.statementDate ?? periodEnd(m.period)).slice(0, 10) : ""));
  const [bal, setBal] = useState(() => (r && r.endingBalance != null && !r.sample ? String(r.endingBalance) : ""));
  if (!r || !acct) return null;
  const valid = date && bal !== "" && !isNaN(Number(bal));
  return (
    <Modal open={!!accountId} onClose={onClose} title="Record statement" description={`${acct.name} ••${acct.mask} · ${periodLabel(m.period)}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { books.recordStatement(w.id, m.id, acct.id, new Date(`${date}T12:00`).toISOString(), Number(bal)); toast("Statement recorded"); onClose(); }}>Save</Button></>}>
      <div className="space-y-4">
        <TextField id="st-date" label="Statement date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField id="st-bal" label={`Statement ending balance ($)${acct.kind === "credit_card" ? " — amount owed" : ""}`} type="number" step="0.01" required value={bal} onChange={(e) => setBal(e.target.value)} />
        <p className="text-[12px] text-muted">Copied from the statement for MKB&rsquo;s tracking. QuickBooks remains the system of record.</p>
      </div>
    </Modal>
  );
}

export function DiscrepancyDialog({ w, m, accountId, onClose }: { w: BooksWorkspace; m: BooksMonth; accountId: string | null; onClose: () => void }) {
  const books = useBooks();
  const toast = useToast();
  const acct = w.accounts.find((a) => a.id === accountId);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [send, setSend] = useState(true);
  useEffect(() => {
    setAmount("");
    setNote("");
    setSend(true);
  }, [accountId]);
  if (!acct) return null;
  return (
    <Modal open={!!accountId} onClose={onClose} title="Record discrepancy" description={`${acct.name} ••${acct.mask} · ${periodLabel(m.period)}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!(Number(amount) > 0) || !note.trim()} onClick={() => { books.recordDiscrepancy(w.id, m.id, acct.id, Number(amount), note.trim(), send); toast(send ? "Discrepancy recorded — client follow-up sent" : "Discrepancy recorded"); onClose(); }}>Save</Button></>}>
      <div className="space-y-4">
        <TextField id="dc-amount" label="Difference ($)" type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextArea id="dc-note" label="What doesn't match" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Register is short of the statement — likely a missing charge" />
        <Checkbox label="Send a follow-up request to the client" hint="Creates a task in the client's portal and moves the month to Client Follow-up Needed." checked={send} onChange={() => setSend((v) => !v)} />
      </div>
    </Modal>
  );
}

const APPROVAL_CHECKS = ["Every account is reconciled to its statement", "Review items are resolved", "P&L and balance sheet reviewed for reasonableness against prior months", "Agreed reports are prepared and approved"];

export function FinalApprovalDialog({ w, m, open, onClose }: Base) {
  const books = useBooks();
  const toast = useToast();
  const [by, setBy] = useState(w.reviewerId);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState(APPROVAL_CHECKS.map(() => false));
  useEffect(() => {
    if (open) {
      setBy(w.reviewerId);
      setNote("");
      setChecks(APPROVAL_CHECKS.map(() => false));
    }
  }, [open, w.reviewerId]);
  return (
    <Modal open={open} onClose={onClose} title="Final review approval" description={`${w.businessName} · ${periodLabel(m.period)}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={ShieldCheck} disabled={!checks.every(Boolean)} onClick={() => { books.finalApprove(w.id, m.id, by, note.trim()); toast(`Approved by ${staffById(by).name} — Reports Ready`); onClose(); }}>Approve</Button></>}>
      <div className="space-y-3">
        <SelectField id="fa-by" label="Approver" value={by} onChange={(e) => setBy(e.target.value)} options={staffList().map((s) => [s.id, s.name])} />
        {by === m.assignedTo && <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">The approver also did this month&rsquo;s bookkeeping — a second reviewer is recommended.</p>}
        {APPROVAL_CHECKS.map((c, i) => <Checkbox key={c} label={c} checked={checks[i]} onChange={() => setChecks((x) => x.map((v, j) => (j === i ? !v : v)))} />)}
        <TextArea id="fa-note" label="Notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

export function ReopenDialog({ w, m, open, onClose }: Base) {
  const books = useBooks();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [to, setTo] = useState<MonthStage>("MKB Reviewing");
  useEffect(() => {
    if (open) {
      setReason("");
      setTo("MKB Reviewing");
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={`Reopen ${periodLabel(m.period)}`} description="Use when a correction is needed after close. The reopen is recorded in the month's history." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!reason.trim()} onClick={() => { books.reopenMonth(w.id, m.id, reason.trim(), to); toast(`${periodLabel(m.period)} reopened`); onClose(); }}>Reopen month</Button></>}>
      <div className="space-y-4">
        <TextArea id="ro-reason" label="Why is it being reopened?" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client found a duplicate deposit after reports were delivered" />
        <SelectField id="ro-to" label="Reopen to" value={to} onChange={(e) => setTo(e.target.value as MonthStage)} options={(["Client Entry in Progress", "MKB Reviewing", "Reconciliation in Progress", "MKB Final Review"] as MonthStage[]).map((s) => [s, s])} />
        <p className="text-[12px] text-muted">Final approval is cleared and reports return to review.</p>
      </div>
    </Modal>
  );
}

export function RequestDocDialog({ w, period, open, onClose }: { w: BooksWorkspace; period: string; open: boolean; onClose: () => void }) {
  const books = useBooks();
  const toast = useToast();
  const presets = [
    ...w.accounts.map((a) => ({ name: `Statement — ${a.name} ••${a.mask} — ${periodLabel(period)}`, category: a.kind === "bank" ? "Bank statement" : "Credit card statement" })),
    { name: `Receipts — ${periodLabel(period)}`, category: "Receipts" },
    { name: `Loan statement — ${periodLabel(period)}`, category: "Supporting document" },
    { name: `Payroll report — ${periodLabel(period)}`, category: "Supporting document" },
  ];
  const [pick, setPick] = useState("0");
  const [custom, setCustom] = useState("");
  useEffect(() => {
    if (open) {
      setPick("0");
      setCustom("");
    }
  }, [open]);
  const name = pick === "custom" ? custom.trim() : presets[Number(pick)].name;
  return (
    <Modal open={open} onClose={onClose} title="Request a document" description={`${w.businessName} — appears as a task in the client's portal`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name} onClick={() => { books.requestDocument(w.id, period, name, pick === "custom" ? "Supporting document" : presets[Number(pick)].category); toast(`Requested "${name}"`); onClose(); }}>Send request</Button></>}>
      <div className="space-y-4">
        <SelectField id="rd-pick" label="Document" value={pick} onChange={(e) => setPick(e.target.value)} options={[...presets.map((p, i) => [String(i), p.name] as [string, string]), ["custom", "Other…"]]} />
        {pick === "custom" && <TextField id="rd-custom" label="Document name" required value={custom} onChange={(e) => setCustom(e.target.value)} />}
      </div>
    </Modal>
  );
}

/** Used by staff and by the client portal preview. Files stay in the browser. */
export function CompleteTaskDialog({ w, task, by, onClose }: { w: BooksWorkspace; task: ClientTask | null; by: "client" | "staff"; onClose: () => void }) {
  const books = useBooks();
  const toast = useToast();
  const [response, setResponse] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => {
    setResponse("");
    setFiles([]);
  }, [task?.id]);
  if (!task) return null;
  const needsAnswer = task.type === "question" || task.type === "confirm";
  const needsFile = task.type === "receipts" || task.type === "statement";
  const valid = (!needsAnswer || response.trim()) && (!needsFile || files.length > 0);
  return (
    <Modal open={!!task} onClose={onClose} title={TASK_TYPE[task.type]} description={task.title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { books.completeTask(w.id, task.id, { response: response.trim() || undefined, files: files.map((f) => ({ name: f.name.replace(/\.[^.]+$/, ""), sizeKb: Math.max(1, Math.round(f.size / 1024)) })), by }); toast(by === "client" ? "Sent to MKB" : "Marked complete"); onClose(); }}>{by === "client" ? "Send to MKB" : "Mark complete"}</Button></>}>
      <div className="space-y-4">
        {task.detail && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] text-ink-2 ring-1 ring-line">{task.detail}</p>}
        {(needsAnswer || !needsFile) && <TextArea id="ct-response" label={needsAnswer ? "Your answer" : "Note (optional)"} required={needsAnswer} value={response} onChange={(e) => setResponse(e.target.value)} />}
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong px-4 py-6 text-center hover:bg-surface-hover">
          <input type="file" multiple className="sr-only" aria-label="Attach files" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
          <UploadCloud size={24} className="text-muted" />
          <span className="mt-1 text-[13.5px] font-medium text-ink">{needsFile ? "Attach the file(s)" : "Attach supporting files (optional)"}</span>
          <span className="text-[12px] text-muted">Preview mode — files stay in your browser and are not stored.</span>
        </label>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px] text-ink-2">
                <FileText size={14} className="text-accent" /> <span className="flex-1 truncate">{f.name}</span> <span className="text-muted">{fileSize(Math.round(f.size / 1024))}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="text-muted hover:text-danger"><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export function ExtraChargeDialog({ w, period, open, onClose }: { w: BooksWorkspace; period: string; open: boolean; onClose: () => void }) {
  const books = useBooks();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  useEffect(() => {
    if (open) {
      setLabel("");
      setAmount("");
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Additional service charge" description={`${w.businessName} · ${periodLabel(period)}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!label.trim() || !(Number(amount) > 0)} onClick={() => { books.addExtra(w.id, label.trim(), Number(amount), period); toast("Charge added — included on the next invoice"); onClose(); }}>Add charge</Button></>}>
      <div className="space-y-4">
        <TextField id="ex-label" label="Service" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Catch-up cleanup, extra reconciliation, 1099 prep" />
        <TextField id="ex-amount" label="Amount ($)" type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
    </Modal>
  );
}

export function StageOverrideDialog({ w, m, open, onClose }: Base) {
  const books = useBooks();
  const toast = useToast();
  const [stage, setStage] = useState<MonthStage>(m.stage);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setStage(m.stage);
      setNote("");
    }
  }, [open, m.stage]);
  const stages: MonthStage[] = ["Client Entry in Progress", "Ready for MKB Review", "MKB Reviewing", "Reconciliation in Progress", "Client Follow-up Needed", "MKB Final Review", "Reports Ready", "Month Closed"];
  return (
    <Modal open={open} onClose={onClose} title="Change stage" description="Owner override — the guided workflow is recommended." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={stage === m.stage || !note.trim()} onClick={() => { books.setStage(w.id, m.id, stage, note.trim()); toast(`Stage → ${stage}`); onClose(); }}>Change stage</Button></>}>
      <div className="space-y-4">
        <SelectField id="so-stage" label="Stage" value={stage} onChange={(e) => setStage(e.target.value as MonthStage)} options={stages.map((s) => [s, s])} />
        <TextField id="so-note" label="Reason" required value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
