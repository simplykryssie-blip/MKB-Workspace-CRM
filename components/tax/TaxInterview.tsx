"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, FileUp, Lock, MessageSquareReply, Pencil, Plus, Save, Send, Trash2, Type, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useClientGate } from "@/components/team/AccessGuard";
import { useClients } from "@/lib/store/clients-store";
import { useTax } from "@/lib/store/tax-store";
import { useTeam } from "@/lib/store/team-store";
import { FORM_LABEL, type TaxReturn } from "@/lib/tax/config";
import { display, docsFor, maskLast4, missingIn, progress, qVisible, rowsOf, sectionVisible, type Answers, type Q, type Row, type Section } from "@/lib/tax/interview/engine";
import { INTERVIEW_VERSION, sectionsFor } from "@/lib/tax/interview/questions";
import { applyPrefill, prefillFrom } from "@/lib/tax/interview/prefill";
import { US_STATES, formatPhone } from "@/lib/validation";
import { fmtDate } from "@/lib/format";
import { BACKEND, call } from "@/lib/sync/remote";

export const interviewHref = (id: string) => `/services/tax-preparation/returns/${id}/interview`;

/** The guided tax interview — one sitting, branching on every answer. Used by clients (portal) and staff (in office). */
export function TaxInterview({ id }: { id: string }) {
  const tax = useTax();
  const team = useTeam();
  const { clients, ready: clientsReady } = useClients();
  const r = tax.returns.find((x) => x.id === id);
  const c = clients.find((x) => x.id === r?.clientId);
  const gate = useClientGate(r?.clientId, "this tax interview");
  if (gate) return gate;
  // With the backend on, the return arrives from the server a moment after the page opens.
  if (!tax.ready || !clientsReady) return <Card className="p-10 text-center text-muted"><span role="status">Loading the interview…</span></Card>;
  if (!r || !c) return <Card className="p-10 text-center text-muted">Interview not found.</Card>;
  if (r.form === "990") return <Card className="p-10 text-center"><h1 className="text-[20px] font-bold text-ink">Nonprofit interview coming next</h1><p className="mt-2 text-[14px] text-muted">The guided interview for Form 990 hasn&rsquo;t been built yet. Your preparer will collect this return&rsquo;s information directly.</p></Card>;
  return <Runner key={r.id} r={r} clientName={c.name} by={team.acting.kind === "client" ? "client" : "staff"} prefillSource={c} />;
}

function Runner({ r, clientName, by, prefillSource }: { r: TaxReturn; clientName: string; by: "client" | "staff"; prefillSource: Parameters<typeof prefillFrom>[0] }) {
  const tax = useTax();
  const toast = useToast();
  const sections = useMemo(() => sectionsFor(r.form), [r.form]);
  const initial = useMemo(() => applyPrefill(sections, { ...(r.organizer.interview?.answers ?? {}) }, prefillFrom(prefillSource)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const a: Answers = useMemo(() => ({ ...answers, __form: r.form, __year: String(r.taxYear) }), [answers, r.form, r.taxYear]);
  const visible = sections.filter((s) => sectionVisible(s, a));
  const followUps = (r.organizer.followUps ?? []).filter((f) => f.status === "sent");
  const submitted = r.organizer.status === "submitted" || r.organizer.status === "reviewed";
  const steps = [...(followUps.length ? [{ key: "followups", title: "Questions from your preparer", group: "Follow-up" }] : []), ...(submitted ? [] : visible.map((s) => ({ key: s.id, title: s.title, group: s.group }))), { key: "review", title: submitted ? "Submitted" : "Review & submit", group: "Finish" }];
  // Resume where the client left off: the first step that still has unanswered questions.
  const [step, setStep] = useState(() => {
    if (!r.organizer.interview || submitted || followUps.length) return 0;
    const i = steps.findIndex((st) => { const x = visible.find((v) => v.id === st.key); return x ? missingIn(x, a).length > 0 : st.key === "review"; });
    return i < 0 ? steps.length - 1 : i;
  });
  const cur = steps[Math.min(step, steps.length - 1)];
  const sec = visible.find((s) => s.id === cur.key);
  const [tried, setTried] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const pg = progress(sections, a);

  const persist = (next = step) => { tax.saveInterview(r.id, answers, by, next); setSaved(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })); };
  const go = (n: number) => { persist(n); setStep(n); top.current?.scrollIntoView({ block: "start" }); };
  const next = () => {
    if (sec && missingIn(sec, a).length) { setTried({ ...tried, [sec.id]: true }); return; }
    go(Math.min(step + 1, steps.length - 1));
  };
  const setVal = (qid: string, v: string) => setAnswers((x) => ({ ...x, [qid]: v }));
  const setRows = (sid: string, rows: Row[]) => setAnswers((x) => ({ ...x, [sid]: rows }));

  return (
    <div ref={top} className="scroll-mt-28">
      {by === "staff" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft/60 px-4 py-2.5 text-[13px] text-accent-ink">
          <UserCog size={15} /> Entering on {clientName}&rsquo;s behalf — answers are recorded as entered by staff.
          <Link href={`/services/tax-preparation/returns/${r.id}#organizer`} className="ml-auto font-semibold hover:underline">Back to the return</Link>
        </div>
      )}
      <Card className="mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">{r.taxYear} tax interview · {clientName}</p>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-ink">{FORM_LABEL[r.form]}</h1>
            <p className="mt-1 text-[13px] text-muted">Answer simple questions and we&rsquo;ll only ask what applies to you. Your answers save as you go — you can stop and come back anytime.</p>
          </div>
          <Button icon={Type} aria-pressed={big} onClick={() => setBig(!big)}>{big ? "Normal text" : "Larger text"}</Button>
          {!submitted && <Button icon={Save} onClick={() => { persist(); toast("Saved — you can come back anytime"); }}>Save &amp; finish later</Button>}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-surface-2" role="progressbar" aria-label="Interview progress" aria-valuenow={submitted ? 100 : pg.pct} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded-full bg-success transition-all" style={{ width: `${submitted ? 100 : pg.pct}%` }} /></div>
          <span className="text-[12.5px] font-semibold tabular-nums text-ink-2">{submitted ? 100 : pg.pct}%</span>
          {saved && <span className="hidden text-[12px] text-muted sm:inline">Saved {saved}</span>}
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[250px_minmax(0,1fr)]" style={big ? { zoom: 1.2 } : undefined}>
        <nav aria-label="Interview steps" className="hidden self-start lg:sticky lg:top-[140px] lg:block">
          <Card className="p-2">
            {[...new Set(steps.map((s) => s.group))].map((g) => (
              <div key={g} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">{g}</p>
                {steps.map((s, i) => s.group === g && (
                  <button key={s.key} onClick={() => go(i)} aria-current={i === step ? "step" : undefined} className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] ${i === step ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-2 hover:bg-surface-hover"}`}>
                    <StepIcon done={(() => { const x = visible.find((v) => v.id === s.key); return x ? missingIn(x, a).length === 0 : s.key === "review" && submitted; })()} />
                    <span className="truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </Card>
        </nav>
        <div className="min-w-0">
          <div className="mb-3 lg:hidden">
            <select aria-label="Interview step" value={step} onChange={(e) => go(Number(e.target.value))} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">
              {steps.map((s, i) => <option key={s.key} value={i}>Step {i + 1} of {steps.length}: {s.title}</option>)}
            </select>
          </div>

          {cur.key === "followups" && <FollowUpStep r={r} by={by} onDone={() => go(step + 1)} />}
          {sec && <SectionView s={sec} a={a} prefilled={initial.ids} showErrors={!!tried[sec.id]} setVal={setVal} setRows={setRows} secure={BACKEND ? (key, kind, value) => call("PUT", `/api/tax/returns/${r.id}/secure`, { key, kind, value }) : undefined} />}
          {cur.key === "review" && (submitted ? <Submitted r={r} by={by} /> : <Review r={r} sections={visible} a={a} by={by} answers={answers} goTo={(sid) => go(steps.findIndex((x) => x.key === sid))} />)}

          {cur.key !== "review" && cur.key !== "followups" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button icon={ArrowLeft} disabled={step === 0} onClick={() => go(step - 1)}>Back</Button>
              <span className="ml-auto text-[12.5px] text-muted">Step {step + 1} of {steps.length}</span>
              <Button variant="primary" onClick={next}>Continue <ArrowRight size={16} /></Button>
            </div>
          )}
          {sec && tried[sec.id] && missingIn(sec, a).length > 0 && <p role="alert" className="mt-2 text-right text-[12.5px] text-danger-ink">Please answer the {missingIn(sec, a).length} highlighted question{missingIn(sec, a).length > 1 ? "s" : ""} to continue. If you&rsquo;re not sure, pick the closest answer and add a note at the end.</p>}
        </div>
      </div>
    </div>
  );
}

const StepIcon = ({ done }: { done: boolean }) => (done ? <CheckCircle2 size={15} className="shrink-0 text-success" /> : <Circle size={15} className="shrink-0 text-faint" />);

/* ------------------------------------------------------------------ */

type SecureSave = (key: string, kind: "ssn" | "ein" | "bank", value: string) => Promise<unknown>;
function SectionView({ s, a, prefilled, showErrors, setVal, setRows, secure }: { s: Section; a: Answers; prefilled: Set<string>; showErrors: boolean; setVal: (id: string, v: string) => void; setRows: (sid: string, rows: Row[]) => void; secure?: SecureSave }) {
  const rows = rowsOf(a, s.id);
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[19px] font-bold tracking-tight text-ink">{s.title}</h2>
      {s.intro && <p className="mt-1 text-[13.5px] text-muted">{s.intro}</p>}
      {s.repeat ? (
        <div className="mt-5 space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="flex-1 text-[15px] font-semibold text-ink">{s.repeat!.rowTitle?.(row, i) ?? `${s.repeat!.noun} ${i + 1}`}</h3>
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${s.repeat!.noun} ${i + 1}`} onClick={() => setRows(s.id, rows.filter((_, j) => j !== i))}>Remove</Button>
              </div>
              <div className="space-y-5">
                {s.questions.filter((q) => qVisible(q, a, row)).map((q) => <Field key={q.id} q={q} idp={`${s.id}-${i}`} secureKey={`${s.id}.${i}.${q.id}`} secure={secure} value={row[q.id] ?? ""} row={row} err={showErrors && !q.optional && !(row[q.id] ?? "").trim()} onChange={(v) => setRows(s.id, rows.map((x, j) => (j === i ? { ...x, [q.id]: v } : x)))} />)}
              </div>
            </div>
          ))}
          <Button icon={Plus} onClick={() => setRows(s.id, [...rows, {}])}>{rows.length ? `Add another ${s.repeat.noun}` : `Add a ${s.repeat.noun}`}</Button>
          {showErrors && rows.length < (s.repeat.min ?? 1) && <p role="alert" className="text-[12.5px] text-danger-ink">Add at least one {s.repeat.noun}.</p>}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {s.questions.filter((q) => qVisible(q, a)).map((q) => <Field key={q.id} q={q} idp={s.id} secureKey={`${s.id}.${q.id}`} secure={secure} value={(a[q.id] as string) ?? ""} prefilled={prefilled.has(q.id) && a[q.id] !== ""} err={showErrors && !q.optional && !((a[q.id] as string) ?? "").trim()} onChange={(v) => setVal(q.id, v)} />)}
        </div>
      )}
    </Card>
  );
}

const inputCls = (err?: boolean) => `h-11 w-full rounded-xl border bg-surface px-3 text-[15px] text-ink placeholder:text-faint focus:outline-none focus:ring-4 ${err ? "border-danger focus:ring-danger/15" : "border-line focus:border-accent focus:ring-accent/15"}`;

function Field({ q, idp, value, onChange, err, prefilled, row, secure, secureKey }: { q: Q; idp: string; value: string; onChange: (v: string) => void; err?: boolean; prefilled?: boolean; row?: Row; secure?: SecureSave; secureKey?: string }) {
  const id = `iv-${idp}-${q.id}`;
  const pill = (on: boolean) => `rounded-xl border px-4 py-2.5 text-left text-[14px] font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`;
  const label = (
    <div className="mb-2">
      <label htmlFor={id} id={`${id}-l`} className="block text-[15px] font-semibold text-ink">{q.label}{q.optional && <span className="ml-1.5 text-[12px] font-normal text-muted">(optional)</span>}</label>
      {q.help && <p className="mt-0.5 text-[12.5px] text-muted">{q.help}</p>}
      {prefilled && <p className="mt-0.5 text-[12px] font-medium text-success-ink">From your MKB profile — change it if it&rsquo;s out of date.</p>}
    </div>
  );
  let input: React.ReactNode;
  switch (q.type) {
    case "yesno":
      input = (
        <div role="radiogroup" aria-labelledby={`${id}-l`} aria-label={q.label} className="flex gap-2">
          {["Yes", "No"].map((v) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`${pill(value === v)} min-w-[96px] text-center`}>{v}</button>)}
        </div>
      );
      break;
    case "choice":
      input = (
        <div role="radiogroup" aria-labelledby={`${id}-l`} aria-label={q.label} className="grid gap-2 sm:grid-cols-2">
          {q.options!.map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={pill(value === o)}>{o}</button>)}
        </div>
      );
      break;
    case "multi": {
      const set = value ? value.split("|") : [];
      input = (
        <div role="group" aria-labelledby={`${id}-l`} className="grid gap-2 sm:grid-cols-2">
          {q.options!.map((o) => { const on = set.includes(o); return <button key={o} type="button" aria-pressed={on} onClick={() => onChange((on ? set.filter((x) => x !== o) : [...set, o]).join("|"))} className={`${pill(on)} flex items-center gap-2`}><span className={`grid h-4 w-4 place-items-center rounded border ${on ? "border-accent bg-accent text-white" : "border-line-strong"}`}>{on && <Check size={11} />}</span>{o}</button>; })}
        </div>
      );
      break;
    }
    case "textarea":
      input = <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls(err)} h-auto py-2.5`} />;
      break;
    case "state":
      input = <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls(err)}><option value="">Choose a state…</option>{US_STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
      break;
    case "money":
      input = <div className="relative max-w-[240px]"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">$</span><input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} className={`${inputCls(err)} pl-7 tabular-nums`} placeholder="0" /></div>;
      break;
    case "number":
    case "year":
    case "percent":
      input = <div className="relative max-w-[160px]"><input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(q.type === "percent" ? /[^\d.]/g : /\D/g, "").slice(0, q.type === "year" ? 4 : 9))} className={`${inputCls(err)} tabular-nums ${q.type === "percent" ? "pr-8" : ""}`} placeholder={q.type === "year" ? "YYYY" : "0"} />{q.type === "percent" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>}</div>;
      break;
    case "date":
      input = <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls(err)} max-w-[220px]`} />;
      break;
    case "phone":
      input = <input id={id} inputMode="tel" value={value} onChange={(e) => onChange(formatPhone(e.target.value))} className={`${inputCls(err)} max-w-[260px]`} />;
      break;
    case "ssn":
    case "ein":
    case "tin":
    case "bank":
      input = <SecureNumber id={id} q={q} value={value} onChange={onChange} err={err} save={secure && secureKey ? (kind, v) => secure(secureKey, kind, v) : undefined} kind={q.type === "tin" ? (row?.okind && row.okind !== "Individual" ? "ein" : row?.okind === "Individual" ? "ssn" : "ein") : q.type} />;
      break;
    default:
      input = <input id={id} type={q.type === "email" ? "email" : "text"} value={value} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls(err)} />;
  }
  return (
    <div data-q={q.id} data-type={q.type} data-answered={value ? "1" : "0"} className={err ? "rounded-xl bg-danger-soft/30 p-2 -m-2" : ""}>
      {label}
      {input}
      {err && <p className="mt-1 text-[12px] text-danger-ink">Please answer this question.</p>}
    </div>
  );
}

/** Sensitive numbers: entered once, kept as the last four digits only (production: full value goes straight to the encrypted vault). */
/** With the backend on, the full number is sent once to the server's encrypted vault; only the last four stay here. */
function SecureNumber({ id, value, onChange, err, kind, save }: { id: string; q: Q; value: string; onChange: (v: string) => void; err?: boolean; kind: "ssn" | "ein" | "bank"; save?: (kind: "ssn" | "ein" | "bank", value: string) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(!value);
  useEffect(() => { if (!value) setEditing(true); }, [value]);
  const need = kind === "bank" ? 4 : 9;
  const digits = draft.replace(/\D/g, "");
  if (!editing && value)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-[14px] tabular-nums text-ink ring-1 ring-line"><Lock size={13} className="text-success" /> {value}</span>
        <span className="text-[12px] text-muted">Stored securely — only the last 4 digits are shown</span>
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => { setDraft(""); setEditing(true); }}>Change</Button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input id={id} type="password" autoComplete="off" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^\d-]/g, "").slice(0, kind === "bank" ? 17 : 11))} placeholder={kind === "ssn" ? "•••-••-••••" : kind === "ein" ? "••-•••••••" : "Digits only"} className={`${inputCls(err)} max-w-[240px] tabular-nums`} />
      <Button size="sm" disabled={busy || (kind === "bank" ? digits.length < need : digits.length !== need)} onClick={async () => {
        if (save) {
          setBusy(true); setSaveErr(null);
          try { await save(kind, digits); } catch (e) { setBusy(false); return setSaveErr(e instanceof Error ? e.message : "Couldn't save the number."); }
          setBusy(false);
        }
        onChange(maskLast4(digits, kind)); setDraft(""); setEditing(false);
      }}>{busy ? "Saving…" : "Save number"}</Button>
      {value && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
      {saveErr && <p role="alert" className="w-full text-[12px] text-danger-ink">{saveErr}</p>}
      <p className="w-full text-[12px] text-muted"><Lock size={11} className="mr-1 inline" />Encrypted and visible only to authorized MKB staff. {kind !== "bank" && `Enter all ${need} digits.`}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Review({ r, sections, a, answers, by, goTo }: { r: TaxReturn; sections: Section[]; a: Answers; answers: Answers; by: "client" | "staff"; goTo: (sid: string) => void }) {
  const tax = useTax();
  const toast = useToast();
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState("");
  const missing = sections.flatMap((s) => missingIn(s, a).map((m) => ({ ...m, s })));
  const docs = docsFor(sections, a);
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <h2 className="text-[19px] font-bold text-ink">Review your answers</h2>
        <p className="mt-1 text-[13.5px] text-muted">Check everything once. Your preparer gets it all at once — so we only need to contact you if something is unclear.</p>
        {missing.length > 0 ? (
          <div className="mt-4 rounded-xl border border-warning/40 bg-warning-soft/50 p-3">
            <p className="text-[13.5px] font-semibold text-warning-ink">{missing.length} question{missing.length > 1 ? "s" : ""} still need an answer</p>
            <ul className="mt-1.5 space-y-1">{missing.slice(0, 8).map((m, i) => <li key={i}><button onClick={() => goTo(m.s.id)} className="text-left text-[13px] text-ink hover:text-accent hover:underline">{m.s.title}: {m.label}{m.row !== undefined ? ` (#${m.row + 1})` : ""}</button></li>)}</ul>
          </div>
        ) : <p className="mt-4 flex items-center gap-2 rounded-xl bg-success-soft/60 p-3 text-[13.5px] font-semibold text-success-ink"><CheckCircle2 size={16} /> Every question is answered.</p>}
      </Card>
      {sections.map((s) => (
        <Card key={s.id} className="p-5 sm:p-6">
          <div className="mb-2 flex items-center gap-2"><h3 className="flex-1 text-[15px] font-semibold text-ink">{s.title}</h3><Button size="sm" variant="ghost" icon={Pencil} onClick={() => goTo(s.id)}>Edit</Button></div>
          {s.repeat ? rowsOf(a, s.id).map((row, i) => (
            <div key={i} className="mb-2 rounded-xl bg-surface-2 p-3 ring-1 ring-line"><p className="mb-1 text-[13px] font-semibold text-ink">{s.repeat!.rowTitle?.(row, i)}</p><Answered qs={s.questions.filter((q) => qVisible(q, a, row))} get={(q) => row[q.id]} /></div>
          )) : <Answered qs={s.questions.filter((q) => qVisible(q, a))} get={(q) => a[q.id] as string} />}
        </Card>
      ))}
      <Card className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><FileUp size={16} className="text-accent" /> Documents you&rsquo;ll upload next ({docs.length})</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">Based on your answers. You can upload them right after you submit.</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">{docs.map((d) => <li key={d.name} className="text-[13px] text-ink-2">• {d.name}</li>)}</ul>
      </Card>
      <Card className="space-y-3 p-5 sm:p-6">
        <label className="flex items-start gap-2 text-[13.5px] text-ink"><input type="checkbox" checked={agree} onChange={() => setAgree(!agree)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />{by === "staff" ? "The client confirmed these answers are complete and accurate to the best of their knowledge." : "My answers are complete and accurate to the best of my knowledge. I'll tell MKB if anything changes."}</label>
        <div className="max-w-sm"><label htmlFor="iv-sig" className="mb-1 block text-[13px] font-medium text-ink-2">{by === "staff" ? "Client's name (confirmed verbally or in person)" : "Type your full name"}</label><input id="iv-sig" value={sig} onChange={(e) => setSig(e.target.value)} className={inputCls()} /></div>
        <Button variant="primary" icon={Send} disabled={!agree || sig.trim().length < 3 || missing.length > 0} onClick={() => { const n = tax.submitInterview(r.id, answers, by, sig.trim()); toast(`Interview submitted — ${n} document${n === 1 ? "" : "s"} added to the upload list`); }}>Submit to MKB</Button>
        {missing.length > 0 && <p className="text-[12px] text-muted">Answer the remaining questions to submit.</p>}
      </Card>
    </div>
  );
}

function Answered({ qs, get }: { qs: Q[]; get: (q: Q) => string | undefined }) {
  return <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">{qs.map((q) => <div key={q.id} className="min-w-0"><dt className="text-[12px] text-muted">{q.label}</dt><dd className="text-[13.5px] text-ink">{display(q, get(q))}</dd></div>)}</dl>;
}

function Submitted({ r, by }: { r: TaxReturn; by: "client" | "staff" }) {
  const tax = useTax();
  const toast = useToast();
  const needed = r.checklist.filter((i) => i.required && !i.docId && !i.waivedReason && !i.archived);
  return (
    <div className="space-y-5">
      <Card className="p-6 text-center">
        <CheckCircle2 size={36} className="mx-auto text-success" />
        <h2 className="mt-2 text-[20px] font-bold text-ink">Interview submitted</h2>
        <p className="mt-1 text-[13.5px] text-muted">Submitted {r.organizer.submittedAt ? fmtDate(r.organizer.submittedAt) : ""}{r.organizer.interview?.consentName ? ` · confirmed by ${r.organizer.interview.consentName}` : ""}. Your preparer reviews everything together and will send any questions in one request.</p>
      </Card>
      <Card className="p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold text-ink">Upload your documents ({needed.length} remaining)</h3>
        <ul className="mt-3 divide-y divide-line">
          {needed.length === 0 && <li className="py-3 text-[13.5px] text-success-ink">Everything has been uploaded. Thank you!</li>}
          {needed.map((i) => <li key={i.id} className="flex items-center gap-3 py-2.5"><span className="min-w-0 flex-1 text-[13.5px] text-ink">{i.name}{i.sensitive && <span className="ml-2"><Badge tone="neutral">Sensitive</Badge></span>}</span><Button size="sm" icon={FileUp} onClick={() => { tax.receiveItem(r.id, i.id); toast(`Uploaded ${i.name} (sample)`); }}>Upload</Button></li>)}
        </ul>
        <p className="mt-2 text-[12px] text-muted">Sample preview — uploads aren&rsquo;t stored. {by === "staff" && "Staff can also mark documents received on the return."}</p>
      </Card>
    </div>
  );
}

function FollowUpStep({ r, by, onDone }: { r: TaxReturn; by: "client" | "staff"; onDone: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const open = (r.organizer.followUps ?? []).filter((f) => f.status === "sent");
  const [v, setV] = useState<Record<string, string>>({});
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[19px] font-bold text-ink"><MessageSquareReply size={18} className="text-accent" /> Questions from your preparer</h2>
      <p className="mt-1 text-[13.5px] text-muted">Your preparer collected everything they need into this one request. Answer them all here.</p>
      <div className="mt-5 space-y-5">
        {open.map((f, i) => (
          <div key={f.id}>
            <label htmlFor={`fu-${f.id}`} className="block text-[15px] font-semibold text-ink">{i + 1}. {f.question}</label>
            {f.ref && <p className="text-[12px] text-muted">About: {f.ref}</p>}
            <textarea id={`fu-${f.id}`} rows={2} value={v[f.id] ?? ""} onChange={(e) => setV({ ...v, [f.id]: e.target.value })} className={`${inputCls()} mt-1.5 h-auto py-2.5`} />
          </div>
        ))}
      </div>
      <Button className="mt-4" variant="primary" icon={Send} disabled={open.some((f) => !(v[f.id] ?? "").trim())} onClick={() => { tax.answerFollowUps(r.id, v, by); toast("Answers sent to your preparer"); onDone(); }}>Send all answers</Button>
    </Card>
  );
}
