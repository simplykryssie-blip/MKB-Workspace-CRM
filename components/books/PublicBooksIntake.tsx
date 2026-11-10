"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, FileSignature, FileUp, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LogoMark } from "@/components/brand/Logo";
import { SectionView } from "@/components/tax/TaxInterview";
import { LetterView } from "@/components/engagement/LetterView";
import { BOOKS_SECTIONS, pickableAddOns, quoteFor } from "@/lib/books/intake";
import { feeWords, money, type ServiceFees } from "@/lib/fees/config";
import type { Letter } from "@/lib/engagement/letters";
import { docsFor, missingIn, rowsOf, sectionVisible, type Answers, type Row } from "@/lib/tax/interview/engine";
import { QuoteView } from "./QuoteView";
import { SignaturePad } from "@/components/ui/SignaturePad";

/**
 * The client's own bookkeeping intake, opened from the private link MKB emailed
 * them — no portal login. Same questions, engagement letter and submission as
 * the staff screen. Full EIN / bank numbers are sent once to encrypted storage
 * and never read back here: after saving, only the last 4 digits are shown.
 */
type Loaded = {
  intake: { status: string; answers: Answers; step: number; rev: number; businessName: string; firstName: string };
  expiresAt: string;
  letters: { books: Letter; terms: Letter };
  fees: ServiceFees;
};
class LinkError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function PublicBooksIntake({ token }: { token: string }) {
  const base = `/api/public/intake/${encodeURIComponent(token)}`;
  const api = useCallback(async <T,>(method: "GET" | "PUT" | "POST", path = "", body?: unknown): Promise<T> => {
    let r: Response;
    try {
      r = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}), cache: "no-store", referrerPolicy: "no-referrer" });
    } catch { throw new LinkError(0, "Couldn't reach MKB — check your internet connection and try again."); }
    const data = (await r.json().catch(() => ({}))) as T & { error?: string };
    if (!r.ok) throw new LinkError(r.status, data.error ?? "Something went wrong. Please try again or call us at 833-379-3320.");
    return data;
  }, [base]);
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState<LinkError | null>(null);
  const [done, setDone] = useState<{ documents: string[]; emailed: boolean; plan: string } | null>(null);
  const [gen, setGen] = useState(0);
  const load = useCallback(() => api<Loaded>("GET").then((d) => { setData(d); setGen((g) => g + 1); }).catch((e) => setErr(e instanceof LinkError ? e : new LinkError(0, "Something went wrong."))), [api]);
  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-center gap-3">
          <LogoMark height={26} />
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-ink">MKB Financial Group</p>
            <p className="flex items-center gap-1 text-[12px] text-muted"><Lock size={11} /> Private, secure intake</p>
          </div>
        </header>
        {done ? <Thanks done={done} name={data?.intake.firstName ?? ""} />
          : err ? <Gone err={err} />
          : !data ? <Card className="p-10 text-center text-[14px] text-muted"><span role="status">Loading your intake…</span></Card>
          : <Runner key={gen} data={data} api={api} reload={load} onDone={setDone} onGone={setErr} />}
        <p className="mt-8 text-center text-[12px] text-muted">© MKB Financial Group · 833-379-3320 · Upload documents in your client portal — we never ask you to email bank statements or tax documents.</p>
      </div>
    </main>
  );
}

function Gone({ err }: { err: LinkError }) {
  return (
    <Card className="p-8 text-center">
      <h1 className="text-[20px] font-bold text-ink">{err.status === 410 ? "This link isn't active" : err.status === 429 ? "Please wait a moment" : err.status === 0 ? "Connection problem" : "We couldn't open this link"}</h1>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">{err.message}</p>
      <p className="mt-4 text-[13.5px] text-ink-2">Call MKB Financial Group at <a className="font-semibold text-accent" href="tel:8333793320">833-379-3320</a>.</p>
    </Card>
  );
}

function Thanks({ done, name }: { done: { documents: string[]; emailed: boolean; plan: string }; name: string }) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="flex items-center gap-2 text-[22px] font-bold text-ink"><CheckCircle2 size={24} className="text-success" /> Thank you{name ? `, ${name}` : ""} — your intake is in.</h1>
      <p className="mt-2 text-[14.5px] text-ink-2">We received your bookkeeping intake and your accepted engagement letter. {done.emailed ? "A copy is on its way to your email." : "We'll email you a copy shortly."} Recommended plan: <b>{done.plan}</b>.</p>
      {done.documents.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
          <p className="text-[14px] font-semibold text-ink">Please upload these in your client portal</p>
          <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">{done.documents.map((d) => <li key={d} className="text-[13.5px] text-ink-2">• {d}</li>)}</ul>
          <p className="mt-2 text-[12.5px] text-muted">We&rsquo;ll email you when your portal is ready. Please don&rsquo;t email bank statements or tax documents.</p>
        </div>
      )}
      <p className="mt-4 text-[13.5px] text-muted">This link is now closed. Questions? Call us at 833-379-3320. You can close this page.</p>
    </Card>
  );
}

type Api = <T>(method: "GET" | "PUT" | "POST", path?: string, body?: unknown) => Promise<T>;

function Runner({ data, api, reload, onDone, onGone }: { data: Loaded; api: Api; reload: () => void; onDone: (d: { documents: string[]; emailed: boolean; plan: string }) => void; onGone: (e: LinkError) => void }) {
  const fees = data.fees;
  // Add-on choices come from MKB's current price list.
  const sections = useMemo(() => BOOKS_SECTIONS.map((s) => (s.id !== "goals" ? s : { ...s, questions: s.questions.map((q) => (q.id === "addons" ? { ...q, options: pickableAddOns(fees.books).map((x) => x.name) } : q)) })), [fees]);
  const [answers, setAnswers] = useState<Answers>(data.intake.answers);
  const rev = useRef(data.intake.rev);
  const dirty = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const visible = sections.filter((s) => sectionVisible(s, answers));
  const steps = [...visible.map((s) => ({ key: s.id, title: s.title })), { key: "review", title: "Review & submit" }];
  const [step, setStep] = useState(() => Math.min(data.intake.step, steps.length - 1));
  const [tried, setTried] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const cur = steps[Math.min(step, steps.length - 1)];
  const sec = visible.find((s) => s.id === cur.key);
  const doneCount = visible.filter((s) => !missingIn(s, answers).length).length;
  const latest = useRef(answers);
  latest.current = answers;
  const stepRef = useRef(step);
  stepRef.current = step;

  const handleErr = useCallback((e: unknown) => {
    if (e instanceof LinkError && (e.status === 410 || e.status === 404)) return onGone(e);
    if (e instanceof LinkError && e.status === 409) { setNotice(e.message); return reload(); }
    setNotice(e instanceof Error ? e.message : "Couldn't save — check your connection.");
  }, [onGone, reload]);

  // Saves as they go: on every step change, and a few seconds after they stop typing.
  const persist = useCallback(async (nextStep = stepRef.current) => {
    if (saving.current) await saving.current;
    const p = (async () => {
      try {
        dirty.current = false;
        const r = await api<{ rev: number }>("PUT", "", { answers: latest.current, step: nextStep, rev: rev.current });
        rev.current = r.rev;
        setSaved(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
        setNotice(null);
      } catch (e) { dirty.current = true; handleErr(e); }
    })();
    saving.current = p;
    await p;
    saving.current = null;
  }, [api, handleErr]);
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => void persist(), 2500);
    return () => clearTimeout(t);
  }, [answers, persist]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { void persist(); e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [persist]);

  const go = (n: number) => { void persist(n); setStep(n); top.current?.scrollIntoView({ block: "start" }); };
  const next = () => {
    if (sec && missingIn(sec, answers).length) {
      setTried({ ...tried, [sec.id]: true });
      requestAnimationFrame(() => { const el = document.querySelector<HTMLElement>('[data-missing="1"]'); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); });
      return;
    }
    go(Math.min(step + 1, steps.length - 1));
  };
  const setVal = (qid: string, v: string) => { dirty.current = true; setAnswers((x) => ({ ...x, [qid]: v })); };
  const setRows = (sid: string, rows: Row[]) => { dirty.current = true; setAnswers((x) => ({ ...x, [sid]: rows })); };
  // Full numbers go straight to encrypted storage. Nothing here can read them back.
  const secure = async (key: string, _kind: "ssn" | "ein" | "bank", value: string) => {
    try { return await api("PUT", "/secure", { key, value }); } catch (e) { if (e instanceof LinkError && (e.status === 410 || e.status === 404)) onGone(e); throw e; }
  };

  return (
    <div ref={top} className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">Bookkeeping intake — {data.intake.businessName}</h1>
        <p className="mt-0.5 text-[13px] text-muted">{doneCount} of {visible.length} sections complete{saved ? ` · saved ${saved}` : ""} · link expires {new Date(data.expiresAt).toLocaleDateString("en-US", { dateStyle: "long" })}</p>
        {step === 0 && <p className="mt-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13.5px] text-ink-2">Hi {data.intake.firstName} — your answers save as you go, so you can stop and come back to this link anytime before it expires. Bank and EIN numbers are encrypted as soon as you save them; afterwards only the last 4 digits are shown.</p>}
        {notice && <p role="alert" className="mt-2 rounded-xl bg-warning-soft/60 px-3 py-2 text-[13px] text-warning-ink">{notice}</p>}
      </div>
      <select aria-label="Intake step" value={step} onChange={(e) => go(Number(e.target.value))} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">
        {steps.map((s, i) => <option key={s.key} value={i}>{i + 1}. {s.title}</option>)}
      </select>
      {sec && <SectionView s={sec} a={answers} prefilled={new Set()} showErrors={!!tried[sec.id]} setVal={setVal} setRows={setRows} secure={secure} />}
      {cur.key === "review" && <Review data={data} sections={sections} answers={answers} rev={rev} api={api} flush={persist} goTo={(sid) => go(steps.findIndex((x) => x.key === sid))} onDone={onDone} onErr={handleErr} />}
      {cur.key !== "review" && (
        <div className="flex items-center gap-2">
          <Button icon={ArrowLeft} disabled={step === 0} onClick={() => go(step - 1)}>Back</Button>
          <span className="ml-auto text-[12.5px] text-muted">Step {step + 1} of {steps.length}</span>
          <Button variant="primary" onClick={next}>Continue <ArrowRight size={16} /></Button>
        </div>
      )}
      {sec && tried[sec.id] && missingIn(sec, answers).length > 0 && <p role="alert" className="text-right text-[12.5px] text-danger-ink">Please answer or fix the highlighted question{missingIn(sec, answers).length > 1 ? "s" : ""} to continue.</p>}
    </div>
  );
}

function Review({ data, sections, answers, rev, api, flush, goTo, onDone, onErr }: { data: Loaded; sections: typeof BOOKS_SECTIONS; answers: Answers; rev: React.MutableRefObject<number>; api: Api; flush: () => Promise<void>; goTo: (sid: string) => void; onDone: (d: { documents: string[]; emailed: boolean; plan: string }) => void; onErr: (e: unknown) => void }) {
  const [agree, setAgree] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [sig, setSig] = useState("");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const missing = sections.flatMap((s) => (sectionVisible(s, answers) ? missingIn(s, answers).map((m) => ({ ...m, s })) : []));
  const docs = docsFor(sections, answers);
  const quote = quoteFor(answers, data.fees.books);
  const plan = quote.plan;
  const L = data.letters;
  const vars = { ...feeWords(data.fees), clientName: sig.trim() || data.intake.businessName, date: new Date().toLocaleDateString("en-US", { dateStyle: "long" }), service: plan.key, fee: `${quote.monthly.some((l) => l.startingAt) ? "starting at " : ""}${money(quote.monthlyTotal)}`, planIncludes: plan.includes.join("; "), addOns: [...quote.monthly.slice(1), ...quote.oneTime, ...quote.quoted].map((l) => l.label).join("; ") || "none" };
  const submit = async () => {
    setBusy(true);
    try {
      await flush();
      const r = await api<{ documents: string[]; emailed: boolean; plan: string }>("POST", "/submit", { answers, rev: rev.current, consentName: sig.trim(), engagement: { version: L.books.version, termsVersion: L.terms.version }, signature: drawn });
      onDone(r);
    } catch (e) { onErr(e); setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        <h2 className="text-[19px] font-bold text-ink">Review and submit</h2>
        {missing.length > 0 ? (
          <div className="mt-3 rounded-xl border border-warning/40 bg-warning-soft/50 p-3">
            <p className="text-[13.5px] font-semibold text-ink">{missing.length} answer{missing.length > 1 ? "s" : ""} still needed</p>
            <ul className="mt-1.5 space-y-1">{missing.slice(0, 12).map((m, i) => <li key={i}><button onClick={() => goTo(m.s.id)} className="text-left text-[13px] text-accent hover:underline">{m.s.title}: {m.label}</button></li>)}</ul>
          </div>
        ) : <p className="mt-1 text-[13.5px] text-success-ink">Every question is answered.</p>}
        <QuoteView quote={quote} accounts={rowsOf(answers, "accounts").length} />
      </Card>
      {docs.length > 0 && (
        <Card className="p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><FileUp size={16} className="text-accent" /> Documents we&rsquo;ll ask for ({docs.length})</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">After you submit, upload these in your client portal. Please don&rsquo;t email them.</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">{docs.map((d) => <li key={d.name} className="text-[13px] text-ink-2">• {d.name}</li>)}</ul>
        </Card>
      )}
      <Card className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><FileSignature size={16} className="text-accent" /> Bookkeeping engagement letter</h3>
        <div tabIndex={0} aria-label="Engagement letter text" className="scrollbar-thin mt-3 max-h-[380px] space-y-6 overflow-y-auto rounded-xl border border-line bg-bg p-4">
          <LetterView title={L.books.title} body={L.books.body} version={L.books.version} vars={vars} />
          <LetterView title={L.terms.title} body={L.terms.body} version={L.terms.version} vars={vars} />
        </div>
        <label className="mt-3 flex items-start gap-2 text-[14px] text-ink"><input type="checkbox" checked={accepted} onChange={() => setAccepted(!accepted)} className="mt-0.5 h-5 w-5 accent-[var(--accent)]" />I read the bookkeeping engagement letter and standard terms, and I agree to them.</label>
      </Card>
      <Card className="space-y-3 p-5 sm:p-6">
        <label className="flex items-start gap-2 text-[14px] text-ink"><input type="checkbox" checked={agree} onChange={() => setAgree(!agree)} className="mt-0.5 h-5 w-5 accent-[var(--accent)]" />My answers are complete and accurate to the best of my knowledge.</label>
        <div className="max-w-sm"><label htmlFor="pi-sig" className="mb-1 block text-[13px] font-medium text-ink-2">Your full name (printed)</label><input id="pi-sig" autoComplete="name" value={sig} onChange={(e) => setSig(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink" /></div>
        <div className="max-w-lg"><SignaturePad label="Sign here with your finger or mouse" onChange={setDrawn} /></div>
        <Button variant="primary" icon={Send} disabled={busy || !agree || !accepted || sig.trim().length < 3 || !drawn || missing.length > 0} onClick={submit}>{busy ? "Submitting…" : "Sign and submit"}</Button>
        {!drawn && missing.length === 0 && <p className="text-[12px] text-muted">Draw your signature in the box to submit.</p>}
        {missing.length > 0 && <p className="text-[12px] text-muted">Answer the remaining questions to submit.</p>}
        <p className="text-[12px] text-muted">Once you submit, this link closes. To change something afterwards, call us at 833-379-3320.</p>
      </Card>
    </div>
  );
}
