"use client";

import { useState } from "react";
import { Check, CheckCircle2, Lock } from "lucide-react";
import { SERVICES } from "@/lib/sample-data";
import { US_STATES, formatPhone } from "@/lib/validation";
import type { FormField, LeadForm } from "@/lib/forms/config";
import { validateSubmission, visibleFields } from "@/lib/store/forms-store";

/**
 * The public-facing form (website embed, direct link, and the in-app preview/test).
 * Plain, accessible, mobile-first; uses MKB's application palette.
 */
/** `onSubmit` may be async; returning an error message keeps the form open and shows it. */
export function FormRenderer({ form, mode, onSubmit, note }: { form: LeadForm; mode: "preview" | "live"; onSubmit?: (data: Record<string, string>, honeypot: string) => void | string | Promise<void | string | unknown>; note?: React.ReactNode }) {
  const [data, setData] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const fields = visibleFields(form, data);
  const set = (id: string, v: string) => { setData((d) => ({ ...d, [id]: v })); if (errs[id]) setErrs((e) => { const n = { ...e }; delete n[id]; return n; }); };

  if (done)
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-soft">
        <CheckCircle2 size={40} className="mx-auto text-success" />
        <h2 className="mt-3 text-[22px] font-bold text-ink">Thank you!</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-2">{form.thankYou}</p>
        {note}
        <button onClick={() => { setData({}); setDone(false); }} className="mt-5 text-[13px] font-semibold text-accent hover:underline">Submit another response</button>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (sending) return;
        if (mode === "preview") return;
        const v = validateSubmission(form, data);
        setErrs(v);
        if (Object.keys(v).length) { document.getElementById(`ff-${Object.keys(v)[0]}`)?.focus(); return; }
        // Only answers to visible fields are sent.
        const sent = Object.fromEntries(fields.map((f) => [f.id, data[f.id] ?? ""]));
        setSending(true);
        setFormErr(null);
        const res = await onSubmit?.(sent, hp);
        setSending(false);
        if (typeof res === "string") return setFormErr(res);
        setDone(true);
      }}
      className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8"
      aria-label={form.title}
    >
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mkb-monogram.webp" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
          <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">MKB Financial Group</span>
        </div>
        <h1 className="text-[24px] font-bold tracking-tight text-ink">{form.title}</h1>
        {form.intro && <p className="mt-1.5 text-[15px] text-ink-2">{form.intro}</p>}
      </div>
      <div className="space-y-5">
        {fields.map((f) => <Field key={f.id} f={f} value={data[f.id] ?? ""} err={errs[f.id]} onChange={(v) => set(f.id, v)} disabled={mode === "preview"} />)}
        {/* Spam trap: hidden from people, filled in by bots. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" /></label></div>
      </div>
      {formErr && <p role="alert" className="mt-5 rounded-xl bg-danger-soft/60 px-3 py-2 text-[13.5px] text-danger-ink">{formErr}</p>}
      <button type="submit" disabled={mode === "preview" || sending} className="mt-7 h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60 sm:w-auto sm:px-8">Submit</button>
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
  const text = <>{f.label}{f.required && f.type !== "consent" && <span className="text-danger"> *</span>}</>;
  // Groups are named by their question (aria-labelledby); single inputs use a <label>.
  const label = group ? <p id={`${id}-l`} className="mb-1.5 block text-[15px] font-semibold text-ink">{text}</p> : <label htmlFor={id} id={`${id}-l`} className="mb-1.5 block text-[15px] font-semibold text-ink">{text}</label>;
  const help = f.help && <p className="mb-1.5 -mt-1 text-[13px] text-muted">{f.help}</p>;
  const error = err && <p className="mt-1 text-[13px] text-danger-ink" role="alert">{err}</p>;
  const multi = (opts: string[], keys?: string[]) => {
    const set = value ? value.split("|") : [];
    return <div role="group" id={id} tabIndex={-1} aria-labelledby={`${id}-l`} className="grid gap-2 sm:grid-cols-2 focus:outline-none">{opts.map((o, i) => { const k = keys?.[i] ?? o; const on = set.includes(k); return <button type="button" key={k} disabled={disabled} aria-pressed={on} onClick={() => onChange((on ? set.filter((x) => x !== k) : [...set, k]).join("|"))} className={pill(on)}><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-accent bg-accent text-white" : "border-line-strong"}`}>{on && <Check size={11} />}</span>{o}</button>; })}</div>;
  };
  switch (f.type) {
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
