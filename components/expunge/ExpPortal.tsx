"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Circle, CreditCard, Download, FileText, Plus, Send, Trash2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { downloadPlaceholder } from "@/components/crm/dialogs";
import { FilePicker } from "@/components/biz/BizDialogs";
import { staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { matterCases, useExp } from "@/lib/store/exp-store";
import { ACKNOWLEDGMENTS, chargeCount, type ExpCase, type ExpMatter, type InfoRequest, type Phase } from "@/lib/expunge/config";
import { casePhase } from "@/lib/expunge/derive";
import { fmtDate, fmtDateTime, usd } from "@/lib/format";
import { maskDOB } from "@/lib/validation";
import { CaseEditor, NotLegalAdvice, TriField, blankCase, caseErrors, draftFrom, type CaseDraft } from "./ExpParts";

const toFiles = (fs: File[]) => fs.map((f) => ({ name: f.name.replace(/\.[^.]+$/, ""), sizeKb: Math.max(1, Math.round(f.size / 1024)) }));
/** Plain-language progress for the client — no screening outcomes, flags or internal detail. */
const CLIENT_STATUS: Record<Phase, { text: string; tone: "info" | "warning" | "success" | "neutral"; pct: number }> = {
  "New inquiry": { text: "Request received", tone: "info", pct: 5 },
  "Intake awaiting completion": { text: "Finish your intake", tone: "warning", pct: 10 },
  "Awaiting criminal records": { text: "Gathering your records", tone: "info", pct: 25 },
  "Awaiting court minutes": { text: "Gathering your records", tone: "info", pct: 30 },
  "Awaiting eligibility review": { text: "Being reviewed by MKB", tone: "info", pct: 40 },
  "Flagged for legal review": { text: "Being reviewed by MKB", tone: "info", pct: 40 },
  "Documents being prepared": { text: "Preparing your documents", tone: "info", pct: 55 },
  "Awaiting client approval": { text: "Waiting for your approval", tone: "warning", pct: 65 },
  "Ready for filing": { text: "Ready to file", tone: "info", pct: 72 },
  "Filed / awaiting court action": { text: "Filed — waiting on the court", tone: "info", pct: 80 },
  "Hearing scheduled": { text: "Court date scheduled", tone: "warning", pct: 85 },
  "Order received — finishing": { text: "Court order received", tone: "success", pct: 95 },
  Completed: { text: "Complete", tone: "success", pct: 100 },
  "Closed — not granted": { text: "Closed", tone: "neutral", pct: 100 },
  "On hold": { text: "Paused — MKB will contact you", tone: "neutral", pct: 40 },
};

export function ExpPortal({ clientId }: { clientId: string }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const c = clientStore.clients.find((x) => x.id === clientId);
  // Only this client's matter, cases and documents are ever read here.
  const m = exp.matters.find((x) => x.clientId === clientId);
  if (!c) return <p className="py-20 text-center text-muted">Client not found.</p>;
  const banner = (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/60 px-4 py-2.5 text-[13px] text-accent-ink">
      <span className="font-semibold">Client portal preview</span> — what {c.name} sees. Internal notes, screening discussions and staff flags are never shown.
      <Link href={m ? `/services/record-expungement/matters/${m.id}` : "/services/record-expungement"} className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline"><ArrowLeft size={14} /> Back to MKB view</Link>
    </div>
  );
  if (!m)
    return (
      <>
        {banner}
        <Card className="p-8 text-center">
          <h1 className="text-[22px] font-bold text-ink">Record expungement help</h1>
          <p className="mx-auto mt-2 max-w-xl text-[14px] text-ink-2">MKB can help you gather your records and prepare paperwork. Start by telling us a little about your situation.</p>
          <Button className="mt-4" variant="primary" onClick={() => { exp.createInquiry(clientId, "portal"); toast("Started — complete your intake below"); }}>Get started</Button>
          <div className="mx-auto mt-5 max-w-2xl"><NotLegalAdvice compact /></div>
        </Card>
      </>
    );
  const intakeOpen = m.intake.status === "inquiry" || m.intake.status === "sent" || m.intake.status === "in_progress";
  return (
    <>
      {banner}
      {intakeOpen ? <IntakeWizard m={m} /> : <PortalHome m={m} />}
    </>
  );
}

/* ================================================================== */

const STEPS = ["Your information", "Criminal history", "Additional history", "Review & consent"];

function IntakeWizard({ m }: { m: ExpMatter }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const c = clientStore.clients.find((x) => x.id === m.clientId)!;
  const [step, setStep] = useState(Math.min(m.intake.step, 3));
  const [v, setV] = useState(m.intake);
  const [alias, setAlias] = useState("");
  const [prev, setPrev] = useState("");
  const [idFiles, setIdFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<{ id?: string; v: CaseDraft } | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => setV((x) => ({ ...m.intake, ...x, acks: m.intake.acks, idDoc: m.intake.idDoc, status: m.intake.status })), [m.intake]);
  const cases = matterCases(exp, m.id);
  const save = (next: number) => { exp.saveIntake(m.id, { ...v, step: Math.max(next, m.intake.step) }, "client"); setStep(next); window.scrollTo({ top: 0 }); };
  const errA = [!v.first.trim() && "Enter your legal first name", !v.last.trim() && "Enter your legal last name", !v.currentAddress.trim() && "Enter your current address"].filter(Boolean) as string[];
  const allAck = ACKNOWLEDGMENTS.every((a) => m.intake.acks[a.key]);
  const ad = v.additional;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <p className="text-[13px] text-muted">Hi {c.name.split(" ")[0]},</p>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">Expungement intake</h1>
        <p className="mt-1 text-[13.5px] text-ink-2">About 15 minutes. Your progress is saved as you go. Share what you know — it&rsquo;s okay to say &ldquo;not sure&rdquo;.</p>
        <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Intake steps">
          {STEPS.map((s, i) => <li key={s}><button type="button" onClick={() => i <= Math.max(m.intake.step, step) && setStep(i)} aria-current={i === step ? "step" : undefined} className={`w-full rounded-lg px-2 py-1.5 text-left text-[11.5px] font-semibold leading-tight ${i === step ? "bg-accent text-white" : i < step ? "bg-success-soft text-success-ink" : "bg-surface-2 text-muted"}`}>{i < step && <Check size={11} className="mr-0.5 inline" strokeWidth={3} />}{i + 1}. {s}</button></li>)}
        </ol>
      </section>

      {step === 0 && (
        <Card>
          <CardHeader title="A. Your information" />
          <div className="space-y-4 px-5 pb-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="pi-first" label="Legal first name" required value={v.first} onChange={(e) => setV({ ...v, first: e.target.value })} />
              <TextField id="pi-middle" label="Middle name" value={v.middle} onChange={(e) => setV({ ...v, middle: e.target.value })} />
              <TextField id="pi-last" label="Legal last name" required value={v.last} onChange={(e) => setV({ ...v, last: e.target.value })} />
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Other names you&rsquo;ve used (maiden name, nicknames on records)</span>
              <div className="flex flex-wrap items-center gap-1.5">{v.aliases.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] text-ink-2">{a}<button type="button" aria-label={`Remove ${a}`} onClick={() => setV({ ...v, aliases: v.aliases.filter((_, j) => j !== i) })} className="text-muted">×</button></span>)}<input aria-label="Add a name" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Add a name" className="h-9 w-40 rounded-full border border-line bg-surface px-3 text-[13px] text-ink" /><Button size="sm" variant="ghost" disabled={!alias.trim()} onClick={() => { setV({ ...v, aliases: [...v.aliases, alias.trim()] }); setAlias(""); }}>Add</Button></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Date of birth</span><p className="text-[13.5px] text-ink">{maskDOB(c.dob) ? `On file (${maskDOB(c.dob)})` : "We'll confirm this with you by phone."}</p></div>
              <div><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Contact</span><p className="text-[13.5px] text-ink">{c.email} · {c.phone}</p></div>
            </div>
            <TextField id="pi-addr" label="Current address" required value={v.currentAddress} onChange={(e) => setV({ ...v, currentAddress: e.target.value })} />
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Previous addresses (if you lived somewhere else when any arrest happened)</span>
              <ul className="space-y-1">{v.previousAddresses.map((a, i) => <li key={i} className="flex items-center gap-2 text-[13px] text-ink-2"><span className="flex-1">{a}</span><button type="button" aria-label={`Remove address ${i + 1}`} onClick={() => setV({ ...v, previousAddresses: v.previousAddresses.filter((_, j) => j !== i) })} className="text-muted">×</button></li>)}</ul>
              <div className="mt-1.5 flex gap-2"><input aria-label="Add previous address" value={prev} onChange={(e) => setPrev(e.target.value)} placeholder="Address and years" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /><Button disabled={!prev.trim()} onClick={() => { setV({ ...v, previousAddresses: [...v.previousAddresses, prev.trim()] }); setPrev(""); }}>Add</Button></div>
            </div>
            <SelectField id="pi-pref" label="Best way to reach you" value={v.preferredContact} onChange={(e) => setV({ ...v, preferredContact: e.target.value })} options={["Phone", "Text", "Email", "Portal"].map((x) => [x, x])} />
            {m.intake.idDoc !== "received" ? (
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Photo ID {m.intake.idDoc === "requested" ? "(requested by MKB)" : "(only if MKB asks for it)"}</span>
                <FilePicker files={idFiles} setFiles={setIdFiles} label="Upload your ID" multiple={false} />
                {idFiles.length > 0 && <Button className="mt-2" size="sm" onClick={() => { exp.uploadId(m.id, toFiles(idFiles)[0], "client"); setIdFiles([]); toast("ID uploaded"); }}>Upload ID</Button>}
              </div>
            ) : <p className="flex items-center gap-2 text-[13.5px] text-success-ink"><CheckCircle2 size={16} /> ID received</p>}
            <p className="text-[12px] text-muted">We don&rsquo;t ask for your Social Security number. If an official form ever requires it, MKB will collect it through a secure process.</p>
            {tried && errA.length > 0 && <p className="text-[12.5px] text-danger-ink" role="alert">{errA.join(" · ")}</p>}
            <div className="flex justify-end"><Button variant="primary" onClick={() => { setTried(true); if (errA.length) return; setTried(false); save(1); }}>Save & continue</Button></div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader title="B. Criminal history" subtitle="Add each arrest or court case separately. One arrest can have several court cases and charges." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing({ v: blankCase() })}>Add an arrest or case</Button>} />
          <ul className="divide-y divide-line border-t border-line">
            {cases.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No cases added yet. Add every arrest you know about, even if it was dismissed.</li>}
            {cases.map((x, i) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                <div className="min-w-0 flex-1"><div className="text-[14px] font-medium text-ink">Case {i + 1}: {x.state === "LA" ? "Louisiana" : x.state === "TX" ? "Texas" : x.state} · {x.locality || "location not set"}</div><div className="text-[12.5px] text-muted">{x.arrestDate ? `Arrested ${fmtDate(`${x.arrestDate}T12:00`)}` : "Date not sure"} · {x.dockets.length} court case(s) · {chargeCount(x)} charge(s)</div></div>
                {x.draft && <><Button size="sm" onClick={() => setEditing({ id: x.id, v: draftFrom(x) })}>Edit</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove case ${i + 1}`} onClick={() => exp.removeDraftCase(x.id)} /></>}
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-2 p-5 sm:px-6"><Button onClick={() => setStep(0)}>Back</Button><Button variant="primary" disabled={!cases.length} title={!cases.length ? "Add at least one arrest or case" : undefined} onClick={() => save(2)}>Save & continue</Button></div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader title="C. Additional history" />
          <div className="grid gap-4 px-5 pb-6 sm:grid-cols-2 sm:px-6">
            <TriField id="pa-pend" label="Do you have any pending criminal charges?" value={ad.pendingCharges} onChange={(x) => setV({ ...v, additional: { ...ad, pendingCharges: x } })} />
            <TriField id="pa-sup" label="Are you on probation or parole now?" value={ad.onSupervision} onChange={(x) => setV({ ...v, additional: { ...ad, onSupervision: x } })} />
            <TriField id="pa-prior" label="Have you had a record expunged before?" value={ad.priorExpungements} onChange={(x) => setV({ ...v, additional: { ...ad, priorExpungements: x } })} />
            <TriField id="pa-prev" label="Have you applied for expungement before?" value={ad.previousApplications} onChange={(x) => setV({ ...v, additional: { ...ad, previousApplications: x } })} />
            <TriField id="pa-den" label="Was an application ever denied?" value={ad.deniedApplications} onChange={(x) => setV({ ...v, additional: { ...ad, deniedApplications: x } })} />
            <TriField id="pa-rec" label="Do you have court minutes or disposition papers?" value={ad.hasRecords} onChange={(x) => setV({ ...v, additional: { ...ad, hasRecords: x } })} />
            <div className="sm:col-span-2"><TextArea id="pa-other" label="Anything else we should know? (other cases, details about the answers above)" value={ad.otherCases ?? ""} onChange={(e) => setV({ ...v, additional: { ...ad, otherCases: e.target.value } })} /></div>
            <div className="flex justify-between gap-2 sm:col-span-2"><Button onClick={() => setStep(1)}>Back</Button><Button variant="primary" onClick={() => save(3)}>Save & continue</Button></div>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader title="D. Review & consent" subtitle="Please read and check each statement" />
          <div className="space-y-2 px-5 pb-6 sm:px-6">
            {ACKNOWLEDGMENTS.map((a) => <Checkbox key={a.key} label={a.text} checked={!!m.intake.acks[a.key]} onChange={(e) => exp.setAck(m.id, a.key, e.target.checked)} />)}
            <NotLegalAdvice compact />
            <div className="flex justify-between gap-2 pt-2"><Button onClick={() => setStep(2)}>Back</Button><Button variant="primary" icon={Send} disabled={!allAck || !cases.length} onClick={() => { exp.saveIntake(m.id, { ...v, step: 3 }, "client"); exp.submitIntake(m.id, "client"); toast("Intake submitted to MKB"); }}>Submit intake</Button></div>
            {!allAck && <p className="text-[12.5px] text-muted">Check every statement to submit.</p>}
          </div>
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" title={editing?.id ? "Edit arrest or case" : "Add an arrest or case"} description="Fill in what you know. Court and case numbers are on court papers or letters — skip anything you're unsure of." footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={() => { if (!editing) return; const e = caseErrors(editing.v, true); if (e.length) { toast(e[0]); return; } if (editing.id) exp.updateCase(editing.id, editing.v, "client updated case details"); else exp.addCase(m.id, editing.v, "client"); toast("Saved"); setEditing(null); }}>Save</Button></>}>
        {editing && <CaseEditor v={editing.v} setV={(x) => setEditing({ ...editing, v: x })} client />}
      </Modal>
    </div>
  );
}

/* ================================================================== */

function PortalHome({ m }: { m: ExpMatter }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const c = clientStore.clients.find((x) => x.id === m.clientId)!;
  const cases = matterCases(exp, m.id);
  const open = m.info.filter((i) => i.status === "open");
  const [responding, setResponding] = useState<InfoRequest | null>(null);
  const [approving, setApproving] = useState<{ c: ExpCase; i: InfoRequest } | null>(null);
  const [adding, setAdding] = useState<CaseDraft | null>(null);
  const [msg, setMsg] = useState("");
  const invoices = c.invoices.filter((i) => i.expMatterId === m.id && i.status !== "draft");
  const delivered = c.documents.filter((d) => d.expMatterId === m.id && d.deliveredAt);
  const msgs = c.messages.filter((x) => x.expMatterId === m.id);
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <p className="text-[13px] text-muted">Hi {c.name.split(" ")[0]},</p>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">Your expungement cases</h1>
        <p className="mt-1 text-[13.5px] text-ink-2">{m.intake.status === "submitted" ? "Thanks — MKB is reviewing your intake." : `Your MKB contact is ${staffById(m.assignments["Client follow-up"]).name}.`}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button icon={Plus} onClick={() => setAdding(blankCase())}>Add another arrest or case</Button></div>
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="What we need from you" subtitle={open.length ? `${open.length} to do` : "You're all caught up"} />
            <ul className="divide-y divide-line border-t border-line">
              {open.length === 0 && <li className="flex items-center gap-2 px-6 py-6 text-[14px] text-success-ink"><CheckCircle2 size={18} /> Nothing to do right now.</li>}
              {open.map((i) => {
                const cs = cases.find((x) => x.id === i.caseId);
                const approval = i.label.startsWith("Review and approve") && cs?.status === "Awaiting Client Approval";
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                    <Circle size={20} className="shrink-0 text-line-strong" />
                    <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto"><div className="text-[14.5px] font-medium text-ink">{i.label}</div>{i.detail && <div className="text-[13px] text-ink-2">{i.detail}</div>}</div>
                    {approval ? <Button variant="primary" onClick={() => setApproving({ c: cs!, i })}>Review documents</Button> : <Button variant="primary" icon={i.file ? UploadCloud : Send} onClick={() => setResponding(i)}>{i.file ? "Upload" : "Respond"}</Button>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Case progress" subtitle="Each case moves on its own timeline" />
            <ul className="divide-y divide-line border-t border-line">
              {cases.map((x, i) => {
                const st = x.draft ? { text: "Received — MKB will review", tone: "info" as const, pct: 10 } : CLIENT_STATUS[casePhase(x, m)];
                return (
                  <li key={x.id} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[14.5px] font-semibold text-ink">Case {i + 1} · {x.state === "LA" ? "Louisiana" : x.state === "TX" ? "Texas" : x.state}</span><Badge tone={st.tone}>{st.text}</Badge></div>
                    <div className="text-[12.5px] text-muted">{x.locality}{x.arrestDate ? ` · ${new Date(`${x.arrestDate}T12:00`).getFullYear()}` : ""}{x.status === "Hearing Scheduled" && x.filing.hearingAt ? ` · court date ${fmtDateTime(x.filing.hearingAt)}` : ""}</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line" role="progressbar" aria-label={`Case ${i + 1} progress`} aria-valuenow={st.pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full ${st.pct === 100 ? "bg-success" : "bg-accent"}`} style={{ width: `${st.pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={FileText} title="Your documents" />
            <ul className="divide-y divide-line border-t border-line">
              {delivered.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">Documents appear here when MKB delivers them.</li>}
              {delivered.map((d) => <li key={d.id} className="flex items-center gap-3 px-5 py-3 sm:px-6"><span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{d.name}</span><span className="block text-[12px] text-muted">Delivered {fmtDate(d.deliveredAt!)}</span></span><Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${d.name}`} onClick={() => downloadPlaceholder(d.name)} /></li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={CreditCard} title="Invoices & payments" />
            <ul className="divide-y divide-line border-t border-line">
              {invoices.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No invoices yet.</li>}
              {invoices.map((i) => <li key={i.id} className="px-5 py-3 sm:px-6"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[13px] font-semibold text-ink">{i.number}</span><Badge tone={i.status === "paid" ? "success" : i.status === "overdue" ? "danger" : i.status === "partial" ? "warning" : "info"}>{i.status === "paid" ? "Paid" : i.status === "overdue" ? "Past due" : i.status === "partial" ? "Partially paid" : "Due"}</Badge><span className="ml-auto text-[14px] font-semibold tabular-nums text-ink">{usd(i.amount, 2)}</span></div><div className="text-[12px] text-muted">{i.status === "paid" ? `Paid${i.paidAt ? ` ${fmtDate(i.paidAt)}` : ""}` : `${usd(i.amount - i.paid, 2)} due ${fmtDate(i.dueAt)}`}</div></li>)}
            </ul>
            <div className="border-t border-line p-4 sm:px-5"><Button disabled className="w-full" icon={CreditCard}>Pay online (coming soon)</Button></div>
          </Card>
          <Card>
            <CardHeader title="Messages with MKB" />
            <div className="scrollbar-thin max-h-[280px] space-y-2.5 overflow-y-auto border-y border-line bg-surface-2 px-4 py-3">
              {msgs.length === 0 && <p className="py-3 text-center text-[13px] text-muted">No messages yet.</p>}
              {msgs.map((x) => <div key={x.id} className={`flex ${x.from === "client" ? "justify-end" : ""}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13.5px] ${x.from === "client" ? "rounded-tr-md bg-accent text-white" : "rounded-tl-md border border-line bg-surface text-ink"}`}>{x.body}<div className={`mt-0.5 text-[11px] ${x.from === "client" ? "text-white/80" : "text-muted"}`}>{x.from === "client" ? "You" : x.author} · {fmtDateTime(x.at)}</div></div></div>)}
            </div>
            <div className="flex gap-2 p-4"><input aria-label="Message MKB" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message MKB…" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /><Button variant="primary" icon={Send} disabled={!msg.trim()} onClick={() => { clientStore.sendMessage(c.id, msg.trim(), "expunge", { from: "client", expMatterId: m.id }); setMsg(""); toast("Sent to MKB"); }}>Send</Button></div>
          </Card>
          <NotLegalAdvice compact />
        </div>
      </div>
      {responding && <RespondModal m={m} i={responding} onClose={() => setResponding(null)} />}
      {approving && <ApproveModal c={approving.c} onClose={() => setApproving(null)} />}
      <Modal open={!!adding} onClose={() => setAdding(null)} size="lg" title="Add an arrest or case" footer={<><Button onClick={() => setAdding(null)}>Cancel</Button><Button variant="primary" onClick={() => { if (!adding) return; const e = caseErrors(adding, true); if (e.length) { toast(e[0]); return; } exp.addCase(m.id, adding, "client"); toast("Sent to MKB for review"); setAdding(null); }}>Send to MKB</Button></>}>
        {adding && <CaseEditor v={adding} setV={setAdding} client />}
      </Modal>
    </div>
  );
}

function RespondModal({ m, i, onClose }: { m: ExpMatter; i: InfoRequest; onClose: () => void }) {
  const exp = useExp();
  const toast = useToast();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const valid = i.file ? files.length > 0 : text.trim().length > 0;
  return (
    <Modal open onClose={onClose} title={i.label} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { exp.respondInfo(m.id, i.id, { response: text.trim() || undefined, files: toFiles(files), by: "client" }); toast("Sent to MKB"); onClose(); }}>Send to MKB</Button></>}>
      <div className="space-y-4">
        {i.detail && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] text-ink-2 ring-1 ring-line">{i.detail}</p>}
        <TextArea id="rp-text" label={i.file ? "Note (optional)" : "Your answer"} required={!i.file} value={text} onChange={(e) => setText(e.target.value)} />
        <FilePicker files={files} setFiles={setFiles} label={i.file ? "Attach the file" : "Attach a file (optional)"} required={i.file} />
      </div>
    </Modal>
  );
}

function ApproveModal({ c, onClose }: { c: ExpCase; onClose: () => void }) {
  const exp = useExp();
  const toast = useToast();
  const [changes, setChanges] = useState(false);
  const [comment, setComment] = useState("");
  return (
    <Modal open onClose={onClose} title="Review your prepared documents" description="Prepared by MKB from your information. Not filed and not approved by any court." footer={changes ? <><Button onClick={() => setChanges(false)}>Back</Button><Button variant="primary" disabled={!comment.trim()} onClick={() => { exp.clientDecision(c.id, false, comment.trim()); toast("Sent to MKB"); onClose(); }}>Send changes</Button></> : <><Button onClick={() => setChanges(true)}>Request changes</Button><Button variant="primary" icon={CheckCircle2} onClick={() => { exp.clientDecision(c.id, true); toast("Thanks — approved"); onClose(); }}>Approve documents</Button></>}>
      {changes ? (
        <TextArea id="ap-comment" label="What should change?" required value={comment} onChange={(e) => setComment(e.target.value)} />
      ) : (
        <ul className="space-y-2">
          {c.prep.forms.map((f) => <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2"><FileText size={16} className="text-muted" /><span className="flex-1 text-[13.5px] text-ink">{f.name}</span><Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${f.name}`} onClick={() => downloadPlaceholder(`${f.name} (prepared by MKB, not filed)`)} /></li>)}
          <li className="text-[12px] text-muted">Approving lets MKB move ahead with filing coordination. It doesn&rsquo;t guarantee any result — the court decides.</li>
        </ul>
      )}
    </Modal>
  );
}
