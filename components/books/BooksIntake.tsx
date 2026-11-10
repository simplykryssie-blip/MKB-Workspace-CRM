"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, FileUp, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { SectionView } from "@/components/tax/TaxInterview";
import { useClients } from "@/lib/store/clients-store";
import { BACKEND, call, RemoteError } from "@/lib/sync/remote";
import { BOOKS_INTAKE_VERSION, BOOKS_SECTIONS, pickableAddOns } from "@/lib/books/intake";
import { docsFor, display, missingIn, qVisible, rowsOf, sectionVisible, type Answers, type Row, type SecureKind } from "@/lib/tax/interview/engine";
import { applyPrefill, prefillFrom } from "@/lib/tax/interview/prefill";
import { useServiceFees } from "@/lib/fees/use-fees";
import { fmtDate } from "@/lib/format";
import type { BooksIntake as Intake } from "@/lib/server/books-intake";
import { StartWorkspace } from "./StartWorkspace";
import { ProposalPanel } from "./ProposalPanel";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { IntakeLinkPanel } from "./IntakeLinkPanel";

export const intakeHref = (id: string) => `/services/bookkeeping/intake/${id}`;

/** Bookkeeping client intake — the guided questionnaire (staff with the client; the portal comes next). */
export function BooksIntake({ id }: { id: string }) {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { clients, ready } = useClients();
  const load = () => call<{ intake: Intake }>("GET", `/api/books/intakes/${id}`).then((r) => setIntake(r.intake)).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't open the intake"));
  useEffect(() => { if (BACKEND) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // A lead's intake belongs to a prospect record, which isn't in the client list — load it directly.
  const [prospect, setProspect] = useState<Client | null>(null);
  useEffect(() => { if (intake?.prospect && !prospect) call<{ client: Client }>("GET", `/api/clients/${intake.clientId}?full=1`).then((r) => setProspect(r.client)).catch(() => setErr("Couldn't open this lead's record.")); }, [intake?.prospect, intake?.clientId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!BACKEND) return <Card className="p-10 text-center text-muted">The bookkeeping intake works in the live CRM (preview or production).</Card>;
  if (err) return <Card className="p-10 text-center text-muted">{err}</Card>;
  const c = clients.find((x) => x.id === intake?.clientId) ?? (intake?.prospect ? prospect ?? undefined : undefined);
  if (!intake || !ready || !c) return <Card className="p-10 text-center text-muted"><span role="status">Loading the intake…</span></Card>;
  return <Runner key={intake.id + intake.status} intake={intake} client={c} reload={load} />;
}

type Client = ReturnType<typeof useClients>["clients"][number];

function Runner({ intake, client, reload }: { intake: Intake; client: Client; reload: () => void }) {
  const toast = useToast();
  const F0 = useServiceFees();
  // Add-on choices come from Settings → Fees.
  const sections = useMemo(() => (F0.fees ? BOOKS_SECTIONS.map((s) => (s.id !== "goals" ? s : { ...s, questions: s.questions.map((q) => (q.id === "addons" ? { ...q, options: pickableAddOns(F0.fees!.books).map((x) => x.name) } : q)) })) : BOOKS_SECTIONS), [F0.fees]);
  const initial = useMemo(() => applyPrefill(sections, { ...intake.answers }, prefillFrom(client)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const rev = useRef(intake.rev);
  const visible = sections.filter((s) => sectionVisible(s, answers));
  const submitted = intake.status === "submitted";
  const steps = [...(submitted ? [] : visible.map((s) => ({ key: s.id, title: s.title, group: s.group }))), { key: "review", title: submitted ? "Submitted" : "Review & submit", group: "Finish" }];
  const [step, setStep] = useState(() => (submitted ? 0 : Math.min(intake.step, steps.length - 1)));
  const [tried, setTried] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const cur = steps[Math.min(step, steps.length - 1)];
  const sec = visible.find((s) => s.id === cur.key);
  const doneCount = visible.filter((s) => !missingIn(s, answers).length).length;

  const persist = async (next: number) => {
    try {
      const r = await call<{ intake: Intake }>("PUT", `/api/books/intakes/${intake.id}`, { answers, step: next, rev: rev.current });
      rev.current = r.intake.rev;
      setSaved(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save — check your connection.", "info");
      if (e instanceof RemoteError && e.status === 409) reload();
    }
  };
  const go = (n: number) => { if (!submitted) void persist(n); setStep(n); top.current?.scrollIntoView({ block: "start" }); };
  const next = () => {
    if (sec && missingIn(sec, answers).length) {
      setTried({ ...tried, [sec.id]: true });
      requestAnimationFrame(() => { const el = document.querySelector<HTMLElement>('[data-missing="1"]'); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); });
      return;
    }
    go(Math.min(step + 1, steps.length - 1));
  };
  const setVal = (qid: string, v: string) => setAnswers((x) => ({ ...x, [qid]: v }));
  const setRows = (sid: string, rows: Row[]) => setAnswers((x) => ({ ...x, [sid]: rows }));
  // Full numbers go straight to encrypted storage; only the last 4 stay in the answers.
  // EIN → the client's vault; bank account / routing numbers → this intake's vault.
  const secure = async (key: string, kind: SecureKind, value: string) => {
    if (kind === "ein") return call("PUT", `/api/clients/${client.id}/identifiers/ein`, { value });
    if (kind === "bank") return call("PUT", `/api/books/intakes/${intake.id}/secure`, { key, value });
    throw new Error("Not collected here.");
  };
  const reveal = async (key: string) => (await call<{ value: string }>("POST", `/api/books/intakes/${intake.id}/secure`, { key })).value;

  return (
    <div ref={top} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {intake.prospect ? <Link href={`/leads/${intake.prospect.leadId}`} className="text-[13px] font-semibold text-accent">← Lead</Link> : <Link href="/services/bookkeeping#intakes" className="text-[13px] font-semibold text-accent">← Bookkeeping</Link>}
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">Bookkeeping intake — {client.name}</h1>
          <p className="text-[13px] text-muted">Question set {BOOKS_INTAKE_VERSION.version} · {submitted ? `Submitted ${intake.submittedAt ? fmtDate(intake.submittedAt) : ""}` : `${doneCount} of ${visible.length} sections complete${saved ? ` · saved ${saved}` : ""}`}</p>
        </div>
        {!submitted && (intake.link?.state === "active" ? <Badge tone="info">Link sent — the client can fill this in</Badge> : <Badge tone="info">Filling in with the client</Badge>)}
      </div>
      {!submitted && <IntakeLinkPanel intake={intake} defaultEmail={(typeof answers.email === "string" && answers.email) || client.email || ""} beforeSend={() => persist(step)} reload={reload} />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="Intake steps" className="hidden lg:block">
          <Card className="sticky top-24 p-2">
            {steps.map((s, i) => (
              <button key={s.key} onClick={() => go(i)} aria-current={i === step ? "step" : undefined} className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] ${i === step ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-2 hover:bg-surface-hover"}`}>
                {(() => { const x = visible.find((v) => v.id === s.key); const ok = x ? !missingIn(x, answers).length : submitted; return ok ? <CheckCircle2 size={15} className="shrink-0 text-success" /> : <Circle size={15} className="shrink-0 text-faint" />; })()}
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </Card>
        </nav>
        <div className="space-y-4">
          <select aria-label="Intake step" value={step} onChange={(e) => go(Number(e.target.value))} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink lg:hidden">
            {steps.map((s, i) => <option key={s.key} value={i}>{i + 1}. {s.title}</option>)}
          </select>
          {sec && <SectionView s={sec} a={answers} prefilled={initial.ids} showErrors={!!tried[sec.id]} setVal={setVal} setRows={setRows} secure={secure} reveal={reveal} />}
          {cur.key === "review" && (submitted ? <Submitted intake={intake} client={client} reload={reload} /> : <Review intake={intake} client={client} answers={answers} rev={rev} goTo={(sid) => go(steps.findIndex((x) => x.key === sid))} onSubmitted={reload} />)}
          {cur.key !== "review" && (
            <div className="flex items-center gap-2">
              <Button icon={ArrowLeft} disabled={step === 0} onClick={() => go(step - 1)}>Back</Button>
              <span className="ml-auto text-[12.5px] text-muted">Step {step + 1} of {steps.length}</span>
              <Button variant="primary" onClick={next}>Continue <ArrowRight size={16} /></Button>
            </div>
          )}
          {sec && tried[sec.id] && missingIn(sec, answers).length > 0 && <p role="alert" className="text-right text-[12.5px] text-danger-ink">Please answer or fix the highlighted question{missingIn(sec, answers).length > 1 ? "s" : ""} to continue.</p>}
        </div>
      </div>
    </div>
  );
}

function Review({ intake, client, answers, rev, goTo, onSubmitted }: { intake: Intake; client: Client; answers: Answers; rev: React.MutableRefObject<number>; goTo: (sid: string) => void; onSubmitted: () => void }) {
  const toast = useToast();
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState("");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const missing = BOOKS_SECTIONS.flatMap((s) => missingIn(s, answers).map((m) => ({ ...m, s })));
  const docs = docsFor(BOOKS_SECTIONS, answers);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await call<{ emailed: boolean; documents: string[] }>("POST", `/api/books/intakes/${intake.id}/submit`, { answers, rev: rev.current, consentName: sig.trim(), enteredBy: "staff", signature: drawn });
      window.dispatchEvent(new CustomEvent("mkb:client-changed", { detail: client.id }));
      toast(`Intake submitted for review · ${r.documents.length} documents requested${r.emailed ? " · client emailed" : ""}`);
      onSubmitted();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't submit", "info"); }
    setBusy(false);
  };
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <h2 className="text-[19px] font-bold text-ink">Review and submit</h2>
        {missing.length > 0 ? (
          <div className="mt-3 rounded-xl border border-warning/40 bg-warning-soft/50 p-3">
            <p className="text-[13.5px] font-semibold text-ink">{missing.length} answer{missing.length > 1 ? "s" : ""} still needed</p>
            <ul className="mt-1.5 space-y-1">{missing.slice(0, 12).map((m, i) => <li key={i}><button onClick={() => goTo(m.s.id)} className="text-left text-[13px] text-accent hover:underline">{m.s.title}: {m.label}</button></li>)}</ul>
          </div>
        ) : <p className="mt-1 text-[13.5px] text-success-ink">Every question is answered.</p>}
        <p className="mt-2 text-[13px] text-muted">No price is shown to the client here. After they submit, you review the price and send the proposal and engagement letter for their signature.</p>
      </Card>
      <Card className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><FileUp size={16} className="text-accent" /> Documents we&rsquo;ll request ({docs.length})</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">Added to the client&rsquo;s Documents as outstanding and listed in the email.</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">{docs.map((d) => <li key={d.name} className="text-[13px] text-ink-2">• {d.name}</li>)}</ul>
      </Card>
      <Card className="space-y-3 p-5 sm:p-6">
        <label className="flex items-start gap-2 text-[13.5px] text-ink"><input type="checkbox" checked={agree} onChange={() => setAgree(!agree)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />The client confirmed these answers are complete and accurate to the best of their knowledge.</label>
        <div className="max-w-sm"><label htmlFor="bi-sig" className="mb-1 block text-[13px] font-medium text-ink-2">Client&rsquo;s full name (printed)</label><input id="bi-sig" value={sig} onChange={(e) => setSig(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink" /></div>
        <div className="max-w-lg"><SignaturePad label="Client signs here" onChange={setDrawn} /></div>
        <Button variant="primary" icon={Send} disabled={busy || !agree || sig.trim().length < 3 || !drawn || missing.length > 0} onClick={submit}>{busy ? "Submitting…" : "Sign and submit for review"}</Button>
        {!drawn && missing.length === 0 && <p className="text-[12px] text-muted">The client needs to draw their signature to submit.</p>}
        {missing.length > 0 && <p className="text-[12px] text-muted">Answer the remaining questions to submit.</p>}
      </Card>
    </div>
  );
}

function Submitted({ intake, client, reload }: { intake: Intake; client: Client; reload: () => void }) {
  const [starting, setStarting] = useState(false);
  const a = intake.answers;
  const signed = intake.proposal?.status === "signed";
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-[19px] font-bold text-ink"><CheckCircle2 size={20} className="text-success" /> Intake submitted</h2>
        <p className="mt-1 text-[13.5px] text-muted">Submitted {intake.submittedAt ? fmtDate(intake.submittedAt) : ""}{intake.consentName ? ` · signed by ${intake.consentName}` : ""}. {intake.prospect ? "The signed PDF copy is on file and moves to their client record when you accept them." : <>The signed PDF copy is in the client&rsquo;s Documents.</>}</p>
        {intake.prospect && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft/50 px-3 py-2.5 text-[13.5px] text-ink">
            <span className="flex-1">{intake.prospect.declined ? "This lead was declined." : "This is a lead, not a client yet. Review the answers (and the price if you like), then accept or decline them on the lead."}</span>
            <Button size="sm" variant="primary" href={`/leads/${intake.prospect.leadId}`}>Open the lead</Button>
          </div>
        )}
        {!intake.prospect && <div className="mt-3 flex flex-wrap gap-2">
          {intake.workspaceId ? <Button variant="primary" href={`/services/bookkeeping/${intake.workspaceId}`}>Open bookkeeping workspace</Button> : <Button variant={signed ? "primary" : "secondary"} onClick={() => { if (signed || window.confirm("The client hasn't signed the proposal and engagement letter yet. Start bookkeeping anyway?")) setStarting(true); }}>Start bookkeeping from this intake</Button>}
          <Button href={`/clients/${client.id}#documents`}>Client documents</Button>
        </div>}
      </Card>
      {!intake.workspaceId && <ProposalPanel intake={intake} client={client} reload={reload} />}
      <Card className="p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold text-ink">Answers</h3>
        <div className="mt-3 space-y-4">
          {BOOKS_SECTIONS.filter((s) => sectionVisible(s, a)).map((s) => (
            <div key={s.id}>
              <h4 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{s.title}</h4>
              {s.repeat ? rowsOf(a, s.id).map((r, i) => (
                <dl key={i} className="mt-1 rounded-xl border border-line p-2.5">
                  <p className="text-[13px] font-semibold text-ink">{s.repeat!.rowTitle?.(r, i)}</p>
                  {s.questions.filter((q) => qVisible(q, a, r)).map((q) => <div key={q.id} className="flex flex-wrap gap-x-3 text-[13px]"><dt className="min-w-[200px] flex-1 text-muted">{q.label}</dt><dd className="font-medium text-ink">{display(q, r[q.id])}</dd></div>)}
                </dl>
              )) : (
                <dl className="mt-1 divide-y divide-line rounded-xl border border-line">
                  {s.questions.filter((q) => qVisible(q, a)).map((q) => <div key={q.id} className="flex flex-wrap gap-x-3 px-2.5 py-1.5 text-[13px]"><dt className="min-w-[200px] flex-1 text-muted">{q.label}</dt><dd className="font-medium text-ink">{display(q, a[q.id] as string)}</dd></div>)}
                </dl>
              )}
            </div>
          ))}
        </div>
      </Card>
      {starting && <StartWorkspace open intake={intake} onClose={() => setStarting(false)} onCreated={async (wsId) => {
        setStarting(false);
        await call("PUT", `/api/books/intakes/${intake.id}`, { workspaceId: wsId, rev: intake.rev }).catch(() => {});
        window.location.assign(`/services/bookkeeping/${wsId}`);
      }} />}
    </div>
  );
}
