"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Crown, Mail, Timer, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { taxRules, useTax, waitForReturnSave } from "@/lib/store/tax-store";
import { useTeam } from "@/lib/store/team-store";
import { staffById } from "@/lib/sample/clients";
import { BACKEND, call } from "@/lib/sync/remote";
import { DD_CREDITS, PAY_METHODS, dueDates, type DdCredit, type DueDiligence, type Extension, type TaxReturn } from "@/lib/tax/config";
import { checksFor, ddComplete } from "@/lib/tax/due-diligence";
import { fmtDate, fmtDateTime } from "@/lib/format";

const money = (n?: number) => (n === undefined || !isFinite(n) ? "—" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);

/* ------------------------------------------------------------------ */
/* Due diligence (Form 8867)                                           */
/* ------------------------------------------------------------------ */

export function DueDiligenceCard({ r }: { r: TaxReturn }) {
  const tax = useTax();
  const toast = useToast();
  const can = tax.access.edit && !r.reviewSignoff;
  const done = ddComplete(r.dueDiligence);
  const initial = (): DueDiligence => r.dueDiligence ?? { applies: true, credits: r.filingStatus === "Head of household" ? ["Head of Household"] : [], checks: {} };
  const [dd, setDd] = useState<DueDiligence>(initial);
  const [open, setOpen] = useState(!done);
  useEffect(() => { setDd(initial()); }, [r.dueDiligence]); // eslint-disable-line react-hooks/exhaustive-deps
  const checks = useMemo(() => checksFor(dd.credits), [dd.credits]);
  const ready = dd.applies && dd.credits.length > 0 && !!dd.priorDisallowed && checks.every((c) => dd.checks[c.id]);
  const save = (complete: boolean, data = dd) => {
    tax.saveDueDiligence(r.id, { ...data, completedAt: complete ? new Date().toISOString() : undefined, completedBy: undefined });
    toast(complete ? (data.applies ? "Due diligence completed" : "Marked not applicable") : "Saved");
    if (complete) setOpen(false);
  };
  const toggleCredit = (c: DdCredit) => setDd({ ...dd, credits: dd.credits.includes(c) ? dd.credits.filter((x) => x !== c) : [...dd.credits, c] });

  if (r.kind === "business") return null;
  return (
    <Card>
      <CardHeader icon={ClipboardCheck} title="Due diligence" subtitle="Required when the return claims EITC, CTC/ACTC/ODC, AOTC or Head of Household (Form 8867)" action={<Badge tone={done ? "success" : "warning"}>{done ? (r.dueDiligence?.applies ? "Complete" : "Not applicable") : "Not done"}</Badge>} />
      <div className="space-y-3 px-5 pb-5 sm:px-6">
        {done && !open ? (
          <>
            <p className="text-[13.5px] text-ink-2">{r.dueDiligence!.applies ? `Completed for ${r.dueDiligence!.credits.join(", ")}` : "No due-diligence credits or Head of Household on this return"}{r.dueDiligence!.completedBy ? ` by ${staffById(r.dueDiligence!.completedBy).name}` : ""}{r.dueDiligence!.completedAt ? ` · ${fmtDate(r.dueDiligence!.completedAt)}` : ""}.</p>
            {r.dueDiligence!.notes && <p className="rounded-lg bg-bg px-3 py-2 text-[13px] text-ink-2">{r.dueDiligence!.notes}</p>}
            {can && <Button size="sm" onClick={() => setOpen(true)}>Edit</Button>}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="w-full text-[13px] font-medium text-ink-2">Which of these does the return claim?</span>
              {DD_CREDITS.map((c) => (
                <label key={c} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] ${dd.applies && dd.credits.includes(c) ? "border-accent bg-accent-soft/40" : "border-line"}`}>
                  <input type="checkbox" disabled={!can} checked={dd.applies && dd.credits.includes(c)} onChange={() => { if (!dd.applies) setDd({ ...dd, applies: true, credits: [c] }); else toggleCredit(c); }} className="h-4 w-4 accent-[var(--accent)]" />{c}
                </label>
              ))}
            </div>
            {dd.applies && dd.credits.length > 0 && (
              <>
                <ul className="space-y-1.5">
                  {checks.map((c) => (
                    <li key={c.id}>
                      <label className="flex items-start gap-2 text-[13px] text-ink"><input type="checkbox" disabled={!can} checked={!!dd.checks[c.id]} onChange={() => setDd({ ...dd, checks: { ...dd.checks, [c.id]: !dd.checks[c.id] } })} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />{c.text}</label>
                    </li>
                  ))}
                </ul>
                <fieldset className="flex flex-wrap items-center gap-3 text-[13px]">
                  <legend className="mb-1 text-[13px] font-medium text-ink-2">Was any of these credits reduced or disallowed by the IRS in a prior year?</legend>
                  {(["no", "yes"] as const).map((v) => <label key={v} className="flex items-center gap-1.5"><input type="radio" disabled={!can} name={`dd-prior-${r.id}`} checked={dd.priorDisallowed === v} onChange={() => setDd({ ...dd, priorDisallowed: v })} className="accent-[var(--accent)]" />{v === "no" ? "No" : "Yes — Form 8862 may be needed"}</label>)}
                </fieldset>
              </>
            )}
            <div><label htmlFor={`dd-notes-${r.id}`} className="mb-1 block text-[13px] font-medium text-ink-2">Notes <span className="font-normal text-muted">(what you asked, documents reviewed)</span></label><textarea id={`dd-notes-${r.id}`} disabled={!can} rows={3} value={dd.notes ?? ""} onChange={(e) => setDd({ ...dd, notes: e.target.value })} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13.5px] text-ink" /></div>
            {can && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" disabled={!ready} onClick={() => save(true)}>Complete due diligence</Button>
                <Button size="sm" onClick={() => save(true, { applies: false, credits: [], checks: {}, notes: dd.notes })}>None of these — not applicable</Button>
                <Button size="sm" variant="ghost" onClick={() => save(false)}>Save progress</Button>
              </div>
            )}
            <p className="text-[12px] text-muted">Complete the official Form 8867 in the tax software too — it&rsquo;s filed with the return. The reviewer can&rsquo;t sign off until this is done.</p>
          </>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Owner's final approval                                              */
/* ------------------------------------------------------------------ */

export function FinalApprovalCard({ r }: { r: TaxReturn }) {
  const tax = useTax();
  const team = useTeam();
  const toast = useToast();
  const [note, setNote] = useState("");
  const isOwner = !!team.myRole?.isOwner;
  const required = taxRules().requireOwnerApproval;
  const ready = !!r.reviewSignoff && !!r.clientApprovedAt;
  const a = r.ownerApproval;
  return (
    <Card>
      <CardHeader icon={Crown} title="Final approval (Owner)" subtitle={required ? "Required before the return can be e-filed" : "Optional — turned off in Settings → Tax & IRS"} action={<Badge tone={a ? "success" : ready ? "warning" : "neutral"}>{a ? "Approved" : ready ? "Waiting for you" : "Not yet"}</Badge>} />
      <div className="space-y-3 px-5 pb-5 sm:px-6">
        {a ? (
          <div className="rounded-xl border border-success/30 bg-success-soft/60 p-3.5">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-success-ink"><CheckCircle2 size={16} /> Approved by {staffById(a.by).name}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">{fmtDateTime(a.at)}{a.note ? ` — ${a.note}` : ""}</p>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted">{ready ? "The reviewer signed off and the client approved. Check the return, then approve it for e-filing." : "Comes after the reviewer's sign-off and the client's approval."}</p>
        )}
        {isOwner && !a && (
          <>
            <input aria-label="Approval note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
            <Button variant="primary" icon={Crown} disabled={!ready} onClick={() => { tax.finalApprove(r.id, note.trim()); setNote(""); toast("Final approval given — ready to e-file"); }}>Give final approval</Button>
          </>
        )}
        {isOwner && a && ["Awaiting Final Approval", "Ready to E-file"].includes(r.status) && <Button size="sm" onClick={() => { tax.clearFinalApproval(r.id); toast("Final approval withdrawn"); }}>Withdraw approval</Button>}
        {!isOwner && !a && <p className="text-[12px] text-muted">Only the Owner can give final approval. They get a notification when it&rsquo;s waiting.</p>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Extensions                                                          */
/* ------------------------------------------------------------------ */

export function ExtensionDialog({ r, open, onClose }: { r: TaxReturn; open: boolean; onClose: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const opts = ["Federal", ...r.states];
  const [sel, setSel] = useState<string[]>(opts);
  const [ids, setIds] = useState<Record<string, string>>({});
  const [est, setEst] = useState("");
  const [paid, setPaid] = useState("");
  const [pay, setPay] = useState("");
  const [method, setMethod] = useState<NonNullable<Extension["payMethod"]>>("none");
  const [notifyClient, setNotifyClient] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setSel(["Federal", ...r.states]); setIds({}); setEst(""); setPaid(""); setPay(""); setMethod("none"); setNotifyClient(true); } }, [open, r.states]);
  const balance = Math.max(0, (Number(est) || 0) - (Number(paid) || 0));
  const { extended } = dueDates(r.form, r.taxYear);
  const file = async () => {
    setBusy(true);
    tax.fileExtension(r.id, { filings: sel.map((j) => ({ jurisdiction: j, submissionId: ids[j]?.trim() || undefined, result: "pending" })), estimatedTax: est ? Number(est) : undefined, paymentsMade: paid ? Number(paid) : undefined, payWithExtension: pay ? Number(pay) : balance || undefined, payMethod: method });
    let note = "";
    if (BACKEND && notifyClient) {
      try {
        if (!(await waitForReturnSave(r.id))) throw new Error("not saved yet");
        const res = await call<{ sent: boolean }>("POST", `/api/tax/returns/${r.id}/extension-email`, {});
        tax.markExtensionNotified(r.id);
        note = res.sent ? " · client emailed" : " · client email queued";
      } catch (e) { note = ` · couldn't email the client (${e instanceof Error ? e.message : "error"})`; }
    }
    setBusy(false);
    toast(`Extension recorded${note}`);
    onClose();
  };
  const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink";
  return (
    <Modal open={open} onClose={onClose} size="lg" title="File extension" description={`Record the extension you filed in the tax software. New due date: ${extended ? fmtDate(extended) : "—"}. An extension gives more time to file, not to pay.`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || !sel.length} onClick={file}>{busy ? "Saving…" : "Record extension"}</Button></>}>
      <div className="space-y-4">
        <div className="space-y-2">
          <span className="block text-[13px] font-medium text-ink-2">Filed for</span>
          {opts.map((j) => (
            <div key={j} className="flex flex-wrap items-center gap-3">
              <label className="flex w-48 items-center gap-2 text-[13.5px]"><input type="checkbox" checked={sel.includes(j)} onChange={() => setSel(sel.includes(j) ? sel.filter((x) => x !== j) : [...sel, j])} className="h-4 w-4 accent-[var(--accent)]" />{j === "Federal" ? `Federal (Form ${r.kind === "business" ? "7004" : "4868"})` : `${j} state`}</label>
              {sel.includes(j) && <input aria-label={`Submission ID — ${j}`} value={ids[j] ?? ""} onChange={(e) => setIds({ ...ids, [j]: e.target.value })} placeholder="Submission ID (optional)" className={`${input} max-w-[240px]`} />}
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label htmlFor="ext-est" className="mb-1 block text-[13px] font-medium text-ink-2">Estimated total tax</label><input id="ext-est" type="number" min={0} inputMode="decimal" value={est} onChange={(e) => setEst(e.target.value)} className={input} /></div>
          <div><label htmlFor="ext-paid" className="mb-1 block text-[13px] font-medium text-ink-2">Withholding &amp; payments so far</label><input id="ext-paid" type="number" min={0} inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} className={input} /></div>
          <div><label htmlFor="ext-pay" className="mb-1 block text-[13px] font-medium text-ink-2">Paying with extension</label><input id="ext-pay" type="number" min={0} inputMode="decimal" value={pay} placeholder={balance ? String(balance) : "0"} onChange={(e) => setPay(e.target.value)} className={input} /></div>
        </div>
        {balance > 0 && <p className="text-[12.5px] text-muted">Estimated balance due: <b className="text-ink">{money(balance)}</b>. Interest (and possibly a late-payment penalty) applies to anything not paid by the original due date.</p>}
        <div><label htmlFor="ext-method" className="mb-1 block text-[13px] font-medium text-ink-2">Payment</label><select id="ext-method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={input}>{Object.entries(PAY_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {BACKEND && <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={notifyClient} onChange={() => setNotifyClient(!notifyClient)} className="h-4 w-4 accent-[var(--accent)]" />Email the client the new due date and payment reminder</label>}
      </div>
    </Modal>
  );
}

export function ExtensionCard({ r }: { r: TaxReturn }) {
  const tax = useTax();
  const toast = useToast();
  const e = r.extension;
  if (!e) return null;
  const filings = e.filings ?? [{ jurisdiction: "Federal", result: "pending" as const }];
  const record = (j: string, result: "accepted" | "rejected") => {
    const reason = result === "rejected" ? prompt(`Why was the ${j} extension rejected?`) ?? undefined : undefined;
    tax.recordExtensionResult(r.id, j, result, reason || undefined);
    toast(`${j} extension ${result}`);
  };
  return (
    <Card>
      <CardHeader icon={Timer} title="Extension" subtitle={`Filed ${fmtDate(e.filedAt)} · new due date ${fmtDate(e.dueAt)}`} action={e.clientNotifiedAt ? <Badge tone="info" icon={Mail}>Client emailed</Badge> : undefined} />
      <ul className="divide-y divide-line border-t border-line">
        {filings.map((f) => (
          <li key={f.jurisdiction} className="flex flex-wrap items-center gap-3 px-5 py-2.5 sm:px-6">
            <span className="flex-1 text-[13.5px] text-ink">{f.jurisdiction}{f.submissionId ? <span className="ml-2 font-mono text-[12px] text-muted">{f.submissionId}</span> : null}{f.reason ? <span className="block text-[12px] text-danger-ink">{f.reason}</span> : null}</span>
            <Badge tone={f.result === "accepted" ? "success" : f.result === "rejected" ? "danger" : "info"}>{f.result === "pending" ? "Awaiting ack" : f.result === "accepted" ? "Accepted" : "Rejected"}</Badge>
            {f.result === "pending" && tax.access.edit && <><Button size="sm" icon={CheckCircle2} onClick={() => record(f.jurisdiction, "accepted")}>Accepted</Button><Button size="sm" variant="ghost" icon={XCircle} onClick={() => record(f.jurisdiction, "rejected")}>Rejected</Button></>}
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-[13px] sm:grid-cols-4 sm:px-6">
        <dt className="text-muted">Estimated tax</dt><dd className="font-medium text-ink">{money(e.estimatedTax)}</dd>
        <dt className="text-muted">Paid with extension</dt><dd className="font-medium text-ink">{money(e.payWithExtension)}{e.payMethod && e.payMethod !== "none" ? ` · ${PAY_METHODS[e.payMethod]}` : ""}</dd>
      </dl>
    </Card>
  );
}
