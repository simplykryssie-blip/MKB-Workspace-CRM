"use client";

import { useRef, useState } from "react";
import { Check, CheckCircle2, Lock } from "lucide-react";
import { SERVICES } from "@/lib/sample-data";
import { US_STATES, formatPhone } from "@/lib/validation";
import type { FormField, LeadForm } from "@/lib/forms/config";
import { validateSubmission, visibleFields } from "@/lib/store/forms-store";

/** Funnel/analytics events — never carry answers or anything a visitor typed. */
export type FormEvent = { name: "form_started" | "step_completed" | "form_submitted" | "form_success" | "form_error"; step?: number; total?: number; stepName?: string };

type Step = { title: string; fields: FormField[] };
/** "steps" layout: each Section heading starts a new step (only visible questions count). */
function splitSteps(form: LeadForm, fields: FormField[]): Step[] {
  const out: Step[] = [];
  for (const f of fields) {
    if (f.type === "heading") { out.push({ title: f.label, fields: [] }); continue; }
    if (!out.length) out.push({ title: form.title, fields: [] });
    out[out.length - 1].fields.push(f);
  }
  return out.filter((x) => x.fields.some((f) => f.type !== "paragraph"));
}
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
/** How an answer reads on the review step. */
const shown = (f: FormField, v: string) => (f.type === "services" ? v.split("|").map((k) => SERVICES[k as keyof typeof SERVICES]?.label ?? k).join(", ") : v.split("|").join(", "));

/**
 * The public-facing form (website embed, direct link, funnel pages, and the in-app preview/test).
 * Plain, accessible, mobile-first; uses MKB's application palette.
 * `onSubmit` may be async; returning an error message keeps the form open and shows it.
 * `clientKey` is a one-time key for this submission, so a double tap or retry is only counted once.
 */
export function FormRenderer({ form, mode, onSubmit, note, onEvent, hideHeader, doneTitle }: {
  form: LeadForm; mode: "preview" | "live";
  onSubmit?: (data: Record<string, string>, honeypot: string, clientKey: string) => void | string | Promise<void | string | unknown>;
  note?: React.ReactNode; onEvent?: (e: FormEvent) => void; hideHeader?: boolean; doneTitle?: string;
}) {
  const [data, setData] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [key, setKey] = useState(newKey);
  const [at, setAt] = useState(0);
  const started = useRef(false);
  const top = useRef<HTMLFormElement>(null);
  const fields = visibleFields(form, data);
  const steps = form.layout === "steps" ? splitSteps(form, fields) : null;
  const step = steps ? Math.min(at, steps.length - 1) : 0;
  const last = !steps || step === steps.length - 1;
  const emit = (e: FormEvent) => { try { onEvent?.(e); } catch { /* analytics must never break the form */ } };
  const set = (id: string, v: string) => {
    if (!started.current) { started.current = true; emit({ name: "form_started", total: steps?.length }); }
    setData((d) => ({ ...d, [id]: v }));
    if (errs[id]) setErrs((e) => { const n = { ...e }; delete n[id]; return n; });
  };
  const go = (i: number) => { setAt(i); setFormErr(null); requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const focusFirst = (v: Record<string, string>) => document.getElementById(`ff-${Object.keys(v)[0]}`)?.focus();

  if (done)
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-soft" role="status">
        <CheckCircle2 size={40} className="mx-auto text-success" />
        <h2 className="mt-3 text-[22px] font-bold text-ink">{doneTitle ?? "Thank you!"}</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-2">{form.thankYou}</p>
        {note}
        {!steps && <button onClick={() => { setData({}); setDone(false); setKey(newKey()); }} className="mt-5 text-[13px] font-semibold text-accent hover:underline">Submit another response</button>}
      </div>
    );

  const current = steps ? steps[step].fields : fields;
  const answered = steps ? steps.slice(0, step).map((s, i) => ({ i, title: s.title, rows: s.fields.filter((f) => !["heading", "paragraph", "consent", "marketing"].includes(f.type) && (data[f.id] ?? "").trim()) })).filter((s) => s.rows.length) : [];

  return (
    <form
      ref={top}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (sending) return;
        if (!last && steps && mode === "preview") return go(step + 1);
        if (mode === "preview") return;
        if (!last && steps) {
          const ids = new Set(current.map((f) => f.id));
          const v = Object.fromEntries(Object.entries(validateSubmission(form, data)).filter(([k]) => ids.has(k)));
          setErrs(v);
          if (Object.keys(v).length) return focusFirst(v);
          emit({ name: "step_completed", step: step + 1, total: steps.length, stepName: steps[step].title });
          return go(step + 1);
        }
        const v = validateSubmission(form, data);
        setErrs(v);
        if (Object.keys(v).length) {
          // On a step form, take them back to the first step with a problem.
          if (steps) { const i = steps.findIndex((s) => s.fields.some((f) => v[f.id])); if (i >= 0 && i !== step) go(i); }
          return focusFirst(v);
        }
        // Only answers to visible fields are sent.
        const sent = Object.fromEntries(fields.map((f) => [f.id, data[f.id] ?? ""]));
        setSending(true);
        setFormErr(null);
        emit({ name: "form_submitted", total: steps?.length });
        const res = await Promise.resolve(onSubmit?.(sent, hp, key)).catch(() => "Something went wrong. Please try again or call us.");
        setSending(false);
        if (typeof res === "string") { emit({ name: "form_error" }); return setFormErr(res); }
        emit({ name: "form_success" });
        setDone(true);
      }}
      className="scroll-mt-6 rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8"
      aria-label={form.title}
    >
      {!hideHeader && (
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mkb-monogram.webp" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">MKB Financial Group</span>
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-ink">{form.title}</h1>
          {form.intro && <p className="mt-1.5 text-[15px] text-ink-2">{form.intro}</p>}
        </div>
      )}
      {steps && (
        <div className="mb-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[19px] font-bold text-ink">{steps[step].title}</h2>
            <span className="shrink-0 text-[12.5px] font-semibold text-muted">Step {step + 1} of {steps.length}</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
      )}
      {last && answered.length > 0 && (
        <div className="mb-6 space-y-3" aria-label="Review your answers">
          {answered.map((s) => (
            <div key={s.i} className="rounded-2xl bg-surface-2 px-4 py-3 ring-1 ring-line">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">{s.title}</p>
                <button type="button" onClick={() => go(s.i)} className="text-[13px] font-semibold text-accent hover:underline" aria-label={`Edit ${s.title}`}>Edit</button>
              </div>
              <dl className="mt-1.5 space-y-1 text-[14px]">
                {s.rows.map((f) => <div key={f.id} className="flex flex-wrap gap-x-2"><dt className="text-muted">{f.label}:</dt><dd className="font-medium text-ink">{shown(f, data[f.id])}</dd></div>)}
              </dl>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-5">
        {current.map((f) => <Field key={f.id} f={f} value={data[f.id] ?? ""} err={errs[f.id]} onChange={(v) => set(f.id, v)} disabled={mode === "preview"} />)}
        {/* Spam trap: hidden from people, filled in by bots. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" /></label></div>
      </div>
      {formErr && <p role="alert" className="mt-5 rounded-xl bg-danger-soft/60 px-3 py-2 text-[13.5px] text-danger-ink">{formErr}</p>}
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {steps && step > 0 && <button type="button" onClick={() => go(step - 1)} className="h-12 rounded-xl border border-line px-6 text-[15px] font-semibold text-ink-2 hover:border-line-strong">Back</button>}
        <button type="submit" disabled={(mode === "preview" && last) || sending} className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60 sm:w-auto sm:px-8">{last ? (sending ? "Sending…" : "Submit") : "Continue"}</button>
      </div>
      <p className="mt-4 flex items-start gap-1.5 text-[12px] text-muted"><Lock size={12} className="mt-0.5 shrink-0" /> Please don&rsquo;t include Social Security, bank or case numbers. We collect sensitive information only through our secure client portal.</p>
    </form>
  );
}

const box = (err?: string) => `h-12 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink placeholder:text-faint focus:outline-none focus:ring-4 disabled:opacity-70 ${err ? "border-danger focus:ring-danger/15" : "border-line focus:border-accent focus:ring-accent/15"}`;

function Field({ f, value, err, onChange, disabled }: { f: FormField; value: string; err?: string; onChange: (v: string) => void; disabled: boolean }) {
  const id = `ff-${f.id}`;
  if (f.type === "heading") return <h2 className="pt-2 text-[17px] font-semibold text-ink">{f.label}</h2>;
  if (f.type === "paragraph") return <p className="rounded-xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2 ring-1 ring-line">{f.label}</p>;
  const pill = (on: boolean) => `flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-[15px] ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:border-line-strong"}`;
  const group = f.type === "radio" || f.type === "yesno" || f.type === "checkboxes" || f.type === "services";
  const text = <>{f.label}{f.required && f.type !== "consent" && f.type !== "marketing" && <span className="text-danger"> *</span>}</>;
  // Groups are named by their question (aria-labelledby); single inputs use a <label>.
  const label = group ? <p id={`${id}-l`} className="mb-1.5 block text-[15px] font-semibold text-ink">{text}</p> : <label htmlFor={id} id={`${id}-l`} className="mb-1.5 block text-[15px] font-semibold text-ink">{text}</label>;
  const help = f.help && <p className="mb-1.5 -mt-1 text-[13px] text-muted">{f.help}</p>;
  const error = err && <p className="mt-1 text-[13px] text-danger-ink" role="alert">{err}</p>;
  const multi = (opts: string[], keys?: string[]) => {
    const set = value ? value.split("|") : [];
    return <div role="group" id={id} tabIndex={-1} aria-labelledby={`${id}-l`} className="grid gap-2 sm:grid-cols-2 focus:outline-none">{opts.map((o, i) => { const k = keys?.[i] ?? o; const on = set.includes(k); return <button type="button" key={k} disabled={disabled} aria-pressed={on} onClick={() => onChange((on ? set.filter((x) => x !== k) : [...set, k]).join("|"))} className={pill(on)}><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-accent bg-accent text-white" : "border-line-strong"}`}>{on && <Check size={11} />}</span>{o}</button>; })}</div>;
  };
  switch (f.type) {
    case "marketing":
    case "consent":
      return <div><label className={`flex items-start gap-3 rounded-xl border p-3.5 text-[13.5px] text-ink-2 ${err ? "border-danger" : "border-line"}`}><input id={id} type="checkbox" disabled={disabled} checked={value === "Yes"} onChange={(e) => onChange(e.target.checked ? "Yes" : "")} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" /><span>{f.label}</span></label>{error}</div>;
    case "textarea":
      return <div>{label}{help}<textarea id={id} rows={4} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className={`${box(err)} h-auto py-3`} />{error}</div>;
    case "state":
      return <div>{label}{help}<select id={id} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className={box(err)}><option value="">Choose…</option>{US_STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>{error}</div>;
    case "select":
      return <div>{label}{help}<select id={id} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className={box(err)}><option value="">Choose…</option>{(f.options ?? []).map((o) => <option key={o}>{o}</option>)}</select>{error}</div>;
    case "radio":
    case "yesno": {
      const opts = f.type === "yesno" ? ["Yes", "No"] : f.options ?? [];
      return <div>{label}{help}<div role="radiogroup" id={id} tabIndex={-1} aria-labelledby={`${id}-l`} className={`focus:outline-none grid gap-2 ${f.type === "yesno" ? "grid-cols-2 sm:max-w-xs" : "sm:grid-cols-2"}`}>{opts.map((o, i) => <button type="button" role="radio" key={o} disabled={disabled} aria-checked={value === o} onClick={() => onChange(o)} className={pill(value === o)}>{o}</button>)}</div>{error}</div>;
    }
    case "checkboxes":
      return <div>{label}{help}{multi(f.options ?? [])}{error}</div>;
    case "services":
      return <div>{label}{help}{multi(Object.values(SERVICES).map((s) => s.label), Object.keys(SERVICES))}{error}</div>;
    case "phone":
      return <div>{label}{help}<input id={id} type="tel" inputMode="tel" autoComplete="tel" disabled={disabled} value={value} onChange={(e) => onChange(formatPhone(e.target.value))} className={`${box(err)} sm:max-w-xs`} />{error}</div>;
    default:
      return <div>{label}{help}<input id={id} type={f.type === "email" ? "email" : f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} autoComplete={f.map === "email" ? "email" : f.map === "fullName" ? "name" : undefined} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className={box(err)} />{error}</div>;
  }
}
