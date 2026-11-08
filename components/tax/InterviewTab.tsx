"use client";

import { useEffect, useMemo, useState } from "react";
import { BACKEND, call } from "@/lib/sync/remote";
import { UserCog, AlertTriangle, CheckCircle2, CircleDashed, ClipboardCheck, ExternalLink, FilePlus2, FileSignature, ListChecks, MessageSquarePlus, MinusCircle, NotebookPen, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useTax, waitForReturnSave } from "@/lib/store/tax-store";
import { fillLetter, taxLetterFor } from "@/lib/engagement/letters";
import { useLetters } from "@/lib/engagement/use-letters";
import { useServiceFees } from "@/lib/fees/use-fees";
import { feeWords } from "@/lib/fees/config";
import { LetterView } from "@/components/engagement/LetterView";
import { ORGANIZERS, type FollowUp, type TaxReturn } from "@/lib/tax/config";
import { coverage, display, docsFor, progress, qVisible, rowsOf, sectionVisible, type Answers, type Q } from "@/lib/tax/interview/engine";
import { INTERVIEW_VERSION, flagsFor, impliedFilingStatus, returnNeeds, sectionsFor, senior } from "@/lib/tax/interview/questions";
import { fmtDate, relTime } from "@/lib/format";
import { interviewHref } from "./TaxInterview";

const STATUS = {
  not_sent: ["neutral", "Not sent"],
  sent: ["info", "Sent — waiting on client"],
  in_progress: ["warning", "In progress"],
  submitted: ["info", "Submitted — needs review"],
  reviewed: ["success", "Reviewed"],
} as const;

/** Staff view of the guided interview: status, coverage, flags, what the return needs, answers and one-request follow-ups. */
export function InterviewTab({ r }: { r: TaxReturn }) {
  const tax = useTax();
  const toast = useToast();
  const can = tax.access.edit;
  const sections = useMemo(() => sectionsFor(r.form), [r.form]);
  const a: Answers = useMemo(() => ({ ...(r.organizer.interview?.answers ?? {}), __form: r.form, __year: String(r.taxYear) }), [r.organizer.interview?.answers, r.form, r.taxYear]);
  const started = !!r.organizer.interview;
  const pg = progress(sections, a);
  const cov = coverage(sections, a);
  const flags = started ? flagsFor(r.form, a) : [];
  const needs = started ? returnNeeds(r.form, a) : [];
  const docs = started ? docsFor(sections, a) : [];
  const missingDocs = docs.filter((d) => !r.checklist.some((i) => i.name === d.name));
  const priceable = needs.filter((n) => n.code && !r.pricing.lines.some((l) => l.code === n.code));
  const fs = r.kind === "individual" ? impliedFilingStatus(a) : undefined;
  const fus = r.organizer.followUps ?? [];
  const drafts = fus.filter((f) => f.status === "draft");
  const [q, setQ] = useState("");
  const ask = (text: string, ref?: string, qKey?: string) => { tax.addFollowUp(r.id, text, ref, qKey); toast("Added to the follow-up request (not sent yet)"); };
  /** The latest follow-up about one answer or flag. */
  const fuFor = (qKey: string) => [...fus].reverse().find((f) => f.qKey === qKey);
  const [tone, label] = STATUS[r.organizer.status];

  if (r.form === "990") return <Card className="p-8 text-center text-muted">The nonprofit (990) interview isn&rsquo;t built yet.</Card>;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card>
          <CardHeader icon={NotebookPen} title="Guided tax interview" subtitle={`TY ${INTERVIEW_VERSION.taxYear} question set ${INTERVIEW_VERSION.version} · ${INTERVIEW_VERSION.status}`} action={<span className="flex flex-wrap gap-1.5">{started && senior(a) && <Badge tone="info">65+ · senior questions on</Badge>}<Badge tone={tone}>{label}</Badge></span>} />
          <div className="space-y-3 px-5 pb-5 sm:px-6">
            <div className="flex items-center gap-3"><div className="h-2 flex-1 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-success" style={{ width: `${pg.pct}%` }} /></div><span className="text-[12.5px] font-semibold tabular-nums">{pg.pct}%</span></div>
            <p className="text-[12.5px] text-muted">
              {!started ? "Not started. Send it to the client portal, or fill it in with the client in the office." : <>Last saved {r.organizer.interview?.updatedAt ? relTime(r.organizer.interview.updatedAt) : "—"} by {r.organizer.interview?.enteredBy === "staff" ? "staff" : "the client"}{r.organizer.submittedAt ? ` · submitted ${fmtDate(r.organizer.submittedAt)}` : ""}{r.organizer.interview?.consentName ? ` · confirmed by ${r.organizer.interview.consentName}` : ""}.</>}
            </p>
            <div className="flex flex-wrap gap-2">
              {r.organizer.status === "not_sent" && <Button variant="primary" icon={Send} disabled={!can} onClick={() => { tax.sendOrganizer(r.id); toast("Interview sent to the client portal"); }}>Send to client portal</Button>}
              {(r.organizer.status === "sent" || r.organizer.status === "in_progress") && <Button icon={Send} disabled={!can} onClick={() => { tax.remindAll(r.id); toast("Reminder sent"); }}>Remind client</Button>}
              <Button icon={ExternalLink} href={interviewHref(r.id)} disabled={!can}>{r.organizer.status === "submitted" || r.organizer.status === "reviewed" ? "View interview" : "Fill in with client"}</Button>
              {r.organizer.status === "submitted" && <Button variant="primary" icon={CheckCircle2} disabled={!can} onClick={() => { tax.reviewOrganizer(r.id); toast("Interview reviewed"); }}>Mark reviewed</Button>}
              {BACKEND && started && <Button icon={UserCog} disabled={!can} onClick={async () => {
                try {
                  const res = await call<{ updated: string[]; skipped: string[] }>("POST", `/api/tax/returns/${r.id}/sync-profile`, {});
                  if (res.updated.length) window.dispatchEvent(new CustomEvent("mkb:client-changed", { detail: r.clientId }));
                  toast(res.updated.length ? `Client profile updated: ${res.updated.join(", ")}` : res.skipped.length ? res.skipped[0] : "The profile already matches the intake", "info");
                } catch (e) { toast(e instanceof Error ? e.message : "Couldn't update the profile", "info"); }
              }}>Update client profile</Button>}
            </div>
          </div>
        </Card>
        <EngagementCard r={r} can={can} />

        {started && flags.length > 0 && (
          <Card>
            <CardHeader icon={AlertTriangle} title="Needs your attention" subtitle="Found automatically from the answers" />
            <ul className="space-y-2 px-5 pb-5 sm:px-6">
              {flags.map((f) => {
                const fu = fuFor(`flag:${f}`);
                const done = !!fu?.resolvedAt;
                return (
                  <li key={f} className={`rounded-xl px-3 py-2 text-[13px] text-ink ${done ? "bg-success-soft/40" : "bg-warning-soft/50"}`}>
                    <div className="flex items-start gap-2">
                      {done ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning-ink" />}
                      <span className="flex-1">{f}</span>
                      {can && !fu && <button onClick={() => ask(`Can you tell us more? ${f}`, "Needs attention", `flag:${f}`)} className="shrink-0 text-[12px] font-semibold text-accent hover:underline">Ask client</button>}
                      {fu && !done && fu.status !== "answered" && <span className="shrink-0 text-[12px] font-semibold text-muted">{fu.status === "draft" ? "In the follow-up request" : "Asked — waiting for reply"}</span>}
                      {done && <span className="shrink-0 text-[12px] font-semibold text-success-ink">Resolved</span>}
                    </div>
                    {fu?.status === "answered" && !done && (
                      <div className="mt-2 rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
                        <p className="text-[12px] font-semibold text-muted">Client replied {fu.answeredAt ? fmtDate(fu.answeredAt) : ""}</p>
                        <p className="text-[13px] text-ink">{fu.answer}</p>
                        {can && <div className="mt-1.5 flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={() => { tax.resolveFollowUp(r.id, fu.id); toast("Marked resolved"); }}>Mark resolved</Button><span className="self-center text-[12px] text-muted">Update the related answer below if anything changed.</span></div>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {started && (
          <Card>
            <CardHeader icon={ListChecks} title="Answers" subtitle="Click “Ask” on anything unclear — questions collect into one request" />
            <div className="space-y-4 px-5 pb-5 sm:px-6">
              {sections.filter((s) => sectionVisible(s, a)).map((s) => (
                <div key={s.id}>
                  <p className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-muted">{s.title}</p>
                  {s.repeat ? (
                    rowsOf(a, s.id).length === 0 ? <p className="text-[13px] text-muted">None entered.</p> : rowsOf(a, s.id).map((row, i) => (
                      <div key={i} className="mb-2 rounded-xl border border-line p-2.5"><p className="mb-1 text-[13px] font-semibold text-ink">{s.repeat!.rowTitle?.(row, i)}</p><AnswerRows qs={s.questions.filter((x) => qVisible(x, a, row))} get={(x) => row[x.id]} revealKey={(x) => `${s.id}.${i}.${x.id}`} returnId={r.id} fuFor={fuFor} onUpdate={can ? (x, v, fuId) => { tax.updateAnswer(r.id, `${s.id}.${i}.${x.id}`, v, `${s.title}: ${x.label}`, fuId); toast("Intake updated"); } : undefined} onAsk={can ? (x) => ask(`About ${x.label.replace(/\?$/, "")} (${s.repeat!.rowTitle?.(row, i)}): `, s.title, `${s.id}.${i}.${x.id}`) : undefined} /></div>
                    ))
                  ) : <AnswerRows qs={s.questions.filter((x) => qVisible(x, a))} get={(x) => a[x.id] as string} revealKey={(x) => `${s.id}.${x.id}`} returnId={r.id} fuFor={fuFor} onUpdate={can ? (x, v, fuId) => { tax.updateAnswer(r.id, `${s.id}.${x.id}`, v, `${s.title}: ${x.label}`, fuId); toast("Intake updated"); } : undefined} onAsk={can ? (x) => ask(`About “${x.label}”: `, s.title, `${s.id}.${x.id}`) : undefined} />}
                </div>
              ))}
            </div>
          </Card>
        )}

        {!started && Object.keys(r.organizer.answers).length > 0 && (
          <Card>
            <CardHeader icon={NotebookPen} title="Earlier screener answers" subtitle="From the short organizer used before the full interview" />
            <dl className="grid gap-x-6 gap-y-1 px-5 pb-5 sm:grid-cols-2 sm:px-6">{ORGANIZERS[r.kind].questions.filter((x) => r.organizer.answers[x.id]).map((x) => <div key={x.id}><dt className="text-[12px] text-muted">{x.label}</dt><dd className="text-[13.5px] text-ink">{r.organizer.answers[x.id]}</dd></div>)}</dl>
          </Card>
        )}
      </div>

      <div className="space-y-5 xl:sticky xl:top-[140px] xl:self-start">
        <Card>
          <CardHeader icon={MessageSquarePlus} title="Follow-up request" subtitle="Collect every question, then send them together — one contact" />
          <div className="space-y-3 px-5 pb-5 sm:px-6">
            {fus.length === 0 && <p className="text-[13px] text-muted">No follow-up questions yet.</p>}
            <ul className="space-y-2">
              {fus.map((f) => (
                <li key={f.id} className="rounded-xl border border-line p-2.5 text-[13px]">
                  <div className="flex items-start gap-2"><span className="flex-1 text-ink">{f.question}</span><Badge tone={f.status === "answered" ? "success" : f.status === "sent" ? "info" : "neutral"}>{f.status === "draft" ? "Not sent" : f.status === "sent" ? "Waiting" : "Answered"}</Badge>{f.status === "draft" && can && <button aria-label="Remove question" onClick={() => tax.removeFollowUp(r.id, f.id)} className="text-muted hover:text-danger"><Trash2 size={14} /></button>}</div>
                  {f.answer && <p className="mt-1.5 rounded-lg bg-success-soft/50 px-2 py-1 text-ink-2">“{f.answer}”</p>}
                </li>
              ))}
            </ul>
            {can && (
              <div className="flex gap-2">
                <input aria-label="New follow-up question" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a question or document request…" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink" />
                <Button size="sm" disabled={!q.trim()} onClick={() => { ask(q.trim()); setQ(""); }}>Add</Button>
              </div>
            )}
            <Button variant="primary" icon={Send} className="w-full" disabled={!can || !drafts.length} onClick={() => { const n = tax.sendFollowUps(r.id); toast(`Sent ${n} question${n > 1 ? "s" : ""} to the client in one request`); }}>Send {drafts.length || ""} question{drafts.length === 1 ? "" : "s"} to client</Button>
          </div>
        </Card>

        {started && (
          <Card>
            <CardHeader icon={ClipboardCheck} title="What this return needs" subtitle={fs ? `Filing status from answers: ${fs}` : undefined} />
            <ul className="space-y-1 px-5 pb-3 sm:px-6">{needs.length === 0 ? <li className="text-[13px] text-muted">Nothing beyond the base return yet.</li> : needs.map((n) => <li key={n.label} className="flex items-center gap-2 text-[13px] text-ink-2"><CheckCircle2 size={13} className="text-success" />{n.label}{n.code && r.pricing.lines.some((l) => l.code === n.code) && <span className="text-[11.5px] text-muted">· priced</span>}</li>)}</ul>
            <div className="flex flex-wrap gap-2 px-5 pb-5 sm:px-6">
              {priceable.length > 0 && <Button size="sm" disabled={!can || !tax.access.billing} onClick={() => { const n = tax.applyNeeds(r.id, needs); toast(`Added ${n} price line${n === 1 ? "" : "s"}`); }}>Add {priceable.length} to pricing</Button>}
              {missingDocs.length > 0 && <Button size="sm" icon={FilePlus2} disabled={!can} onClick={() => { missingDocs.forEach((d) => tax.addItem(r.id, { ...d, required: true })); toast(`Added ${missingDocs.length} document(s) to the checklist`); }}>Add {missingDocs.length} document{missingDocs.length > 1 ? "s" : ""}</Button>}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader icon={ListChecks} title="Coverage" subtitle="Which parts of the return the interview has collected" />
          <ul className="space-y-1 px-5 pb-5 sm:px-6">
            {cov.map((c) => (
              <li key={c.part + c.sectionId} className={`flex items-start gap-2 text-[12.5px] ${c.status === "not_applicable" ? "text-faint" : "text-ink-2"}`}>
                {c.status === "complete" ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success" /> : c.status === "incomplete" ? <CircleDashed size={13} className="mt-0.5 shrink-0 text-warning-ink" /> : <MinusCircle size={13} className="mt-0.5 shrink-0" />}
                <span><span className={c.status === "not_applicable" ? "line-through" : ""}>{c.part}</span>{c.status === "not_applicable" && " — doesn't apply"}{c.status === "incomplete" && started && " — incomplete"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

const SECURE_TYPES = ["ssn", "ein", "tin", "bank"];
function AnswerRows({ qs, get, onAsk, onUpdate, fuFor, revealKey, returnId }: { qs: Q[]; get: (q: Q) => string | undefined; onAsk?: (q: Q) => void; onUpdate?: (q: Q, value: string, fuId?: string) => void; fuFor?: (key: string) => FollowUp | undefined; revealKey?: (q: Q) => string; returnId?: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  return (
    <dl className="divide-y divide-line rounded-xl border border-line">
      {qs.map((q) => {
        const key = revealKey?.(q) ?? q.id;
        const fu = fuFor?.(key);
        const open = editing === key;
        // Secure numbers are changed in the interview itself (they go to the vault).
        const editable = onUpdate && !SECURE_TYPES.includes(q.type);
        const start = () => { setDraft(get(q) ?? ""); setEditing(key); };
        return (
          <div key={q.id} className="group px-3 py-1.5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <dt className="min-w-[200px] flex-1 text-[12.5px] text-muted">{q.label}</dt>
              <dd className="text-[13px] font-medium text-ink">{BACKEND && returnId && revealKey && SECURE_TYPES.includes(q.type) && get(q) ? <RevealAnswer returnId={returnId} k={revealKey(q)} masked={display(q, get(q))} /> : display(q, get(q))}</dd>
              {editable && !open && <button onClick={start} className="text-[11.5px] font-semibold text-accent opacity-70 hover:underline group-hover:opacity-100">Edit</button>}
              {onAsk && !fu && <button onClick={() => onAsk(q)} className="text-[11.5px] font-semibold text-accent opacity-70 hover:underline group-hover:opacity-100">Ask</button>}
              {fu && !fu.resolvedAt && fu.status !== "answered" && <span className="text-[11.5px] font-semibold text-muted">{fu.status === "draft" ? "In follow-up" : "Asked"}</span>}
            </div>
            {fu?.status === "answered" && !fu.resolvedAt && (
              <div className="mt-1.5 rounded-lg bg-info-soft/40 px-3 py-2 ring-1 ring-line">
                <p className="text-[12px] font-semibold text-muted">Client replied {fu.answeredAt ? fmtDate(fu.answeredAt) : ""}</p>
                <p className="text-[13px] text-ink">{fu.answer}</p>
                {editable && !open && <button onClick={start} className="mt-1 text-[12px] font-semibold text-accent hover:underline">Update answer</button>}
              </div>
            )}
            {open && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {q.type === "yesno" || q.type === "choice" ? (
                  <select aria-label={`New answer: ${q.label}`} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink">
                    <option value="">—</option>{(q.type === "yesno" ? ["Yes", "No"] : q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input aria-label={`New answer: ${q.label}`} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 min-w-[220px] flex-1 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink" />
                )}
                <Button size="sm" variant="primary" onClick={() => { onUpdate!(q, draft.trim(), fu?.status === "answered" && !fu.resolvedAt ? fu.id : undefined); setEditing(null); }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                {q.type === "multi" && <span className="w-full text-[11.5px] text-muted">Separate choices with “|”.</span>}
              </div>
            )}
          </div>
        );
      })}
    </dl>
  );
}

/** Full value from the encrypted vault — the server checks the permission and logs every reveal. */
function RevealAnswer({ returnId, k, masked }: { returnId: string; k: string; masked: string }) {
  const toast = useToast();
  const [v, setV] = useState<string | null>(null);
  useEffect(() => { if (!v) return; const t = setTimeout(() => setV(null), 30000); return () => clearTimeout(t); }, [v]);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono tabular-nums">{v ?? masked}</span>
      <button className="text-[11.5px] font-semibold text-accent hover:underline" onClick={() => (v ? setV(null) : call<{ value: string }>("POST", `/api/tax/returns/${returnId}/secure`, { key: k }).then((r) => { setV(r.value); toast("Revealed for 30 seconds — recorded in the audit log", "info"); }).catch((e) => toast(e instanceof Error ? e.message : "Couldn't reveal", "info")))}>{v ? "Hide" : "Reveal"}</button>
    </span>
  );
}

/** Engagement letter status, and recording one accepted in the office or signed on paper. */
function EngagementCard({ r, can }: { r: TaxReturn; can: boolean }) {
  const tax = useTax();
  const toast = useToast();
  const L = useLetters();
  const F = useServiceFees();
  const fw = F.fees ? feeWords(F.fees) : {};
  const e = r.organizer.engagement;
  const key = taxLetterFor(r.kind);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"in_office" | "paper">("in_office");
  const [busy, setBusy] = useState(false);
  const record = async () => {
    if (!L.letters) return;
    setBusy(true);
    tax.recordEngagement(r.id, { letterKey: key, version: L.letters[key].version, termsVersion: L.letters.terms.version, title: fillLetter(L.letters[key].title, { taxYear: String(r.taxYear) }), acceptedName: name.trim(), acceptedAt: new Date().toISOString(), method });
    let note = "";
    if (BACKEND) {
      const saved = await waitForReturnSave(r.id);
      try {
        if (!saved) throw new Error("the acceptance hasn't saved yet");
        await call("POST", `/api/tax/returns/${r.id}/engagement-pdf`, {});
        window.dispatchEvent(new CustomEvent("mkb:client-changed", { detail: r.clientId }));
        note = " · signed copy saved to Documents";
      } catch (err) { note = ` · couldn't save the PDF copy (${err instanceof Error ? err.message : "error"})`; }
    }
    setBusy(false);
    setOpen(false);
    toast(`Engagement letter recorded${note}`);
  };
  return (
    <Card>
      <CardHeader icon={FileSignature} title="Engagement letter" subtitle={e ? `${e.title} · version ${e.version}` : "Required before this return can move to review"} action={<Badge tone={e ? "success" : "warning"}>{e ? "Accepted" : "Not accepted"}</Badge>} />
      <div className="space-y-3 px-5 pb-5 sm:px-6">
        {e ? (
          <p className="text-[13px] text-ink-2">Accepted by <b>{e.acceptedName}</b> on {fmtDate(e.acceptedAt)} — {e.method === "online" ? "online" : e.method === "in_office" ? "in the office" : "signed on paper"}. The signed copy is in the client&rsquo;s Documents.</p>
        ) : (
          <>
            <p className="text-[13px] text-muted">The client accepts it at the end of the interview. If they signed in the office or on paper, record it here.</p>
            {!open ? (
              <Button size="sm" icon={FileSignature} disabled={!can || !L.letters} onClick={() => setOpen(true)}>Record acceptance</Button>
            ) : (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <div className="scrollbar-thin max-h-[260px] space-y-5 overflow-y-auto rounded-lg bg-bg p-3">
                  {L.letters && <><LetterView title={L.letters[key].title} body={L.letters[key].body} version={L.letters[key].version} vars={{ ...fw, clientName: name || "the client", taxYear: String(r.taxYear), date: new Date().toLocaleDateString("en-US", { dateStyle: "long" }) }} /><LetterView title={L.letters.terms.title} body={L.letters.terms.body} version={L.letters.terms.version} vars={{ ...fw, clientName: name || "the client" }} /></>}
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-[13px]"><input type="radio" name={`em-${r.id}`} checked={method === "in_office"} onChange={() => setMethod("in_office")} className="accent-[var(--accent)]" />Accepted in the office</label>
                  <label className="flex items-center gap-2 text-[13px]"><input type="radio" name={`em-${r.id}`} checked={method === "paper"} onChange={() => setMethod("paper")} className="accent-[var(--accent)]" />Signed on paper</label>
                </div>
                <div className="max-w-sm"><label htmlFor={`em-name-${r.id}`} className="mb-1 block text-[13px] font-medium text-ink-2">Client&rsquo;s full name as they signed</label><input id={`em-name-${r.id}`} value={name} onChange={(ev) => setName(ev.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /></div>
                {method === "paper" && <p className="text-[12px] text-muted">Upload the scanned paper copy to the client&rsquo;s Documents too.</p>}
                <div className="flex gap-2"><Button size="sm" variant="primary" disabled={busy || name.trim().length < 2} onClick={record}>{busy ? "Saving…" : "Record acceptance"}</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
