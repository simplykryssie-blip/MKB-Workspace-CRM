"use client";

import { TaxFeeSchedule } from "@/components/tax/TaxFeeSchedule";
import { useTax } from "@/lib/store/tax-store";
import { useEffect, useMemo, useState } from "react";
import { DollarSign, FileSignature, History, Mail, Plus, RotateCcw, Save, ShieldCheck, Trash2, ChevronDown, Upload } from "lucide-react";
import { ImportIdentifiers } from "./ImportIdentifiers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { LetterView } from "@/components/engagement/LetterView";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { LETTER_INFO, LETTER_KEYS, PLACEHOLDERS, type Letter, type LetterKey } from "@/lib/engagement/letters";
import { useLetters } from "@/lib/engagement/use-letters";
import { EMAIL_TEMPLATES, WORDING_FIELDS, renderEmail, type EmailWording, type TemplateKey } from "@/lib/email/templates";
import { fmtDate } from "@/lib/format";
import { checkFees, expungeFee, feeWords, money, type ServiceFees } from "@/lib/fees/config";
import { useServiceFees } from "@/lib/fees/use-fees";
import { EMPTY_BUREAU, EMPTY_DESIGNEE, designeeReady, type Bureau, type Designee } from "@/lib/irs/f8821";

const SAMPLE = { clientName: "Jordan Sample", date: "November 8, 2026", taxYear: "2025", service: "Foundation", fee: "$399", firstName: "Jordan", count: "2 documents", businessName: "Sample Co. LLC", expires: "November 22, 2026", days: "14", staffName: "Krystal", plan: "Essential — $549/month" };
const input = "w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink disabled:opacity-60";

export function SettingsPage() {
  const team = useTeam();
  const owner = !!team.me && !!team.roles?.find((r) => r.id === team.me?.roleId)?.isOwner;
  const [tab, setTab] = useState<"letters" | "emails" | "fees" | "designee" | "import">("letters");
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); setTab(h === "emails" || h === "fees" || h === "designee" || h === "import" ? h : "letters"); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">Settings</h1>
        <p className="mt-1 text-[14px] text-muted">Engagement letters, automatic client emails and your service fees.</p>
      </div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {([["letters", "Engagement letters", FileSignature], ["emails", "Client emails", Mail], ["fees", "Fees", DollarSign], ["designee", "Tax & IRS", ShieldCheck], ...(owner && BACKEND ? [["import", "Import", Upload]] as const : [])] as const).map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); history.replaceState(null, "", `#${k}`); }} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[14px] font-semibold ${tab === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-hover"}`}><Icon size={16} />{l}</button>
        ))}
      </div>
      {tab === "import" && owner ? <ImportIdentifiers /> : tab === "letters" ? <LettersEditor /> : tab === "emails" ? <EmailsEditor /> : tab === "fees" ? <FeesEditor /> : <div className="space-y-5"><TaxRulesCard /><DesigneeEditor /></div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LettersEditor() {
  const team = useTeam();
  const toast = useToast();
  const canEdit = team.can("settings", "settings");
  const L = useLetters();
  const F = useServiceFees();
  const vars = useMemo(() => ({ ...(F.fees ? feeWords(F.fees) : {}), ...SAMPLE }), [F.fees]);
  const [key, setKey] = useState<LetterKey>("terms");
  const cur = L.letters?.[key];
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [old, setOld] = useState<Letter | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (cur) { setTitle(cur.title); setBody(cur.body); setNote(""); setOld(null); } }, [cur, key]);
  const dirty = !!cur && (title !== cur.title || body !== cur.body);

  const save = async () => {
    if (!BACKEND) return toast("Saving letters needs the live CRM (preview or production).", "info");
    setSaving(true);
    try {
      const r = await call<{ letter: Letter; unchanged?: boolean }>("PUT", `/api/engagement-letters/${key}`, { title, body, note });
      L.reload();
      toast(r.unchanged ? "No changes to save" : `Saved as version ${r.letter.version}. New clients will see this version.`);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setSaving(false);
  };
  const openVersion = async (v: number) => {
    if (v === cur?.version) return setOld(null);
    try { setOld((await call<{ letter: Letter }>("GET", `/api/engagement-letters/${key}?version=${v}`)).letter); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't open that version", "info"); }
  };
  const insert = (ph: string) => setBody((b) => `${b}{{${ph}}}`);

  if (!L.letters) return <Card className="p-8 text-center text-muted">Loading letters…</Card>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="h-fit p-2">
        <ul>
          {LETTER_KEYS.map((k) => (
            <li key={k}>
              <button onClick={() => { if (dirty && !confirm("Discard your unsaved changes?")) return; setKey(k); }} aria-current={k === key ? "true" : undefined} className={`w-full rounded-lg px-3 py-2 text-left ${k === key ? "bg-accent-soft" : "hover:bg-surface-hover"}`}>
                <span className={`block text-[14px] ${k === key ? "font-semibold text-accent-ink" : "text-ink"}`}>{LETTER_INFO[k].name}</span>
                <span className="block text-[12px] text-muted">Version {L.letters![k].version}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader icon={FileSignature} title={LETTER_INFO[key].name} subtitle={LETTER_INFO[key].when} action={<Badge tone="warning">Draft — attorney review recommended</Badge>} />
          <div className="space-y-4 px-5 pb-5 sm:px-6">
            {!canEdit && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">You can read these letters. Editing needs the &ldquo;Manage settings&rdquo; permission.</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={preview ? "ghost" : "primary"} onClick={() => setPreview(false)}>Edit</Button>
              <Button size="sm" variant={preview ? "primary" : "ghost"} onClick={() => setPreview(true)}>Preview with a sample client</Button>
            </div>
            {preview ? (
              <div className="rounded-xl border border-line bg-bg p-4"><LetterView title={title} body={body} vars={vars} /></div>
            ) : (
              <>
                <div><label htmlFor="lt-title" className="mb-1 block text-[13px] font-medium text-ink-2">Title</label><input id="lt-title" disabled={!canEdit} value={title} onChange={(e) => setTitle(e.target.value)} className={`${input} h-10`} /></div>
                <div>
                  <label htmlFor="lt-body" className="mb-1 block text-[13px] font-medium text-ink-2">Letter</label>
                  <p className="mb-2 text-[12px] text-muted">Start a line with <code>## </code> for a heading and <code>- </code> for a bullet. Leave a blank line between paragraphs. Fill-ins:</p>
                  <div className="mb-2 flex flex-wrap gap-1.5">{PLACEHOLDERS.map((p) => <button key={p.key} type="button" disabled={!canEdit} title={p.label} onClick={() => insert(p.key)} className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-2 hover:bg-surface-hover disabled:opacity-50">{`{{${p.key}}}`}</button>)}</div>
                  <textarea id="lt-body" disabled={!canEdit} value={body} onChange={(e) => setBody(e.target.value)} rows={22} className={`${input} py-2 font-mono text-[13px] leading-relaxed`} />
                </div>
              </>
            )}
            {canEdit && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1"><label htmlFor="lt-note" className="mb-1 block text-[13px] font-medium text-ink-2">What changed? <span className="font-normal text-muted">(optional)</span></label><input id="lt-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated fee wording after attorney review" className={`${input} h-10`} /></div>
                <Button variant="primary" icon={Save} disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save as new version"}</Button>
                {dirty && <Button variant="ghost" icon={RotateCcw} onClick={() => { setTitle(cur!.title); setBody(cur!.body); }}>Undo changes</Button>}
              </div>
            )}
            <p className="text-[12px] text-muted">Saving never changes letters clients already accepted — each acceptance keeps the exact version the client agreed to.</p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={History} title="Version history" />
          <ul className="divide-y divide-line border-t border-line">
            {(L.history?.[key] ?? []).map((h) => (
              <li key={h.version} className="flex flex-wrap items-center gap-3 px-5 py-2.5 sm:px-6">
                <span className="text-[13.5px] font-semibold text-ink">Version {h.version}</span>
                {h.version === cur?.version && <Badge tone="success">Current</Badge>}
                <span className="flex-1 text-[12.5px] text-muted">{h.note ?? ""}{h.at ? ` · ${fmtDate(h.at)}` : ""}{h.by ? ` · ${team.members.find((m) => m.id === h.by)?.name ?? ""}` : ""}</span>
                {BACKEND && h.version !== cur?.version && <Button size="sm" variant="ghost" onClick={() => openVersion(h.version)}>View</Button>}
              </li>
            ))}
          </ul>
          {old && (
            <div className="space-y-3 border-t border-line p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">
                {canEdit && <Button size="sm" icon={RotateCcw} onClick={() => { setTitle(old.title); setBody(old.body); setPreview(false); setOld(null); toast(`Version ${old.version} copied into the editor — save to make it current`, "info"); }}>Use this wording</Button>}
                <Button size="sm" variant="ghost" onClick={() => setOld(null)}>Close</Button>
              </div>
              <div className="rounded-xl border border-line bg-bg p-4"><LetterView title={old.title} body={old.body} version={old.version} vars={vars} /></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Tpl = { key: TemplateKey; wording: EmailWording; updatedAt?: string; custom: boolean };

function EmailsEditor() {
  const team = useTeam();
  const toast = useToast();
  const canEdit = team.can("settings", "settings");
  const [list, setList] = useState<Tpl[] | null>(null);
  const [key, setKey] = useState<TemplateKey>("tax_intake_received");
  const [w, setW] = useState<EmailWording | null>(null);
  const [saving, setSaving] = useState(false);
  const load = () => {
    if (!BACKEND) return setList((Object.keys(EMAIL_TEMPLATES) as TemplateKey[]).map((k) => ({ key: k, wording: EMAIL_TEMPLATES[k], custom: false })));
    call<{ templates: Tpl[] }>("GET", "/api/email-templates").then((r) => setList(r.templates)).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load emails", "info"));
  };
  useEffect(load, []);
  const cur = list?.find((t) => t.key === key);
  // Reset the form only when switching emails or after a save — not when the list reloads.
  const curStamp = cur ? `${cur.key}|${cur.updatedAt ?? ""}|${cur.custom}` : "";
  useEffect(() => { if (cur) setW({ ...cur.wording }); }, [curStamp]); // eslint-disable-line react-hooks/exhaustive-deps
  const html = useMemo(() => (w ? renderEmail({ wording: w, docsTitle: EMAIL_TEMPLATES[key].docsTitle, vars: SAMPLE, documents: ["Forms W-2 from each employer", "Year-end inventory count or report"], buttonUrl: "#", logoUrl: "/brand/mkb-seal-192.png" }) : null), [w, key]);
  const dirty = !!cur && !!w && JSON.stringify(w) !== JSON.stringify(cur.wording);

  const put = async (b: object, msg: string) => {
    if (!BACKEND) return toast("Saving emails needs the live CRM (preview or production).", "info");
    setSaving(true);
    try { await call("PUT", `/api/email-templates/${key}`, b); toast(msg); load(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setSaving(false);
  };

  if (!list || !w) return <Card className="p-8 text-center text-muted">Loading emails…</Card>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="h-fit p-2">
        <ul>
          {list.map((t) => (
            <li key={t.key}>
              <button onClick={() => { if (dirty && !confirm("Discard your unsaved changes?")) return; setKey(t.key); }} aria-current={t.key === key ? "true" : undefined} className={`w-full rounded-lg px-3 py-2 text-left ${t.key === key ? "bg-accent-soft" : "hover:bg-surface-hover"}`}>
                <span className={`block text-[14px] ${t.key === key ? "font-semibold text-accent-ink" : "text-ink"}`}>{EMAIL_TEMPLATES[t.key].name}</span>
                <span className="block text-[12px] text-muted">{t.custom ? `Edited ${t.updatedAt ? fmtDate(t.updatedAt) : ""}` : "Default wording"}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 2xl:grid-cols-2">
        <Card>
          <CardHeader icon={Mail} title={EMAIL_TEMPLATES[key].name} subtitle={EMAIL_TEMPLATES[key].when} />
          <div className="space-y-3 px-5 pb-5 sm:px-6">
            <p className="text-[12px] text-muted">Fill-ins: {EMAIL_TEMPLATES[key].placeholders.map((p) => `{{${p}}}`).join(" ")}. The logo, colors, document list, portal button and security footer are added automatically. Never ask clients to email SSNs or tax documents.</p>
            {WORDING_FIELDS.filter((f) => f.key !== "steps" || EMAIL_TEMPLATES[key].steps || w.steps).map((f) => (
              <div key={f.key}>
                <label htmlFor={`em-${f.key}`} className="mb-1 block text-[13px] font-medium text-ink-2">{f.label}</label>
                {f.long ? <textarea id={`em-${f.key}`} disabled={!canEdit} rows={f.key === "steps" ? 5 : 3} value={w[f.key]} onChange={(e) => setW({ ...w, [f.key]: e.target.value })} className={`${input} py-2`} />
                  : <input id={`em-${f.key}`} disabled={!canEdit} value={w[f.key]} onChange={(e) => setW({ ...w, [f.key]: e.target.value })} className={`${input} h-10`} />}
              </div>
            ))}
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" icon={Save} disabled={!dirty || saving} onClick={() => put({ wording: w }, "Email saved")}>{saving ? "Saving…" : "Save"}</Button>
                {cur?.custom && <Button variant="ghost" icon={RotateCcw} disabled={saving} onClick={() => confirm("Go back to the original wording?") && put({ reset: true }, "Back to the default wording")}>Reset to default</Button>}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Preview" subtitle={`Subject: ${html?.subject ?? ""}`} />
          <div className="px-3 pb-3">{html && <iframe title="Email preview" srcDoc={html.html} className="h-[720px] w-full rounded-xl border border-line bg-white" />}</div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Num({ id, label, value, onChange, disabled, step = 1, prefix, suffix }: { id: string; label: string; value: number; onChange: (n: number) => void; disabled?: boolean; step?: number; prefix?: string; suffix?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-ink-2">{label}</label>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-[13px] text-muted">{prefix}</span>}
        <input id={id} type="number" inputMode="decimal" min={0} step={step} disabled={disabled} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} className={`${input} h-10 max-w-[140px]`} />
        {suffix && <span className="text-[13px] text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function FeesEditor() {
  const team = useTeam();
  const toast = useToast();
  const canEdit = team.can("settings", "settings");
  const F = useServiceFees();
  const taxFees = useTax().fees;
  const [f, setF] = useState<ServiceFees | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (F.fees) setF(structuredClone(F.fees)); }, [F.fees]);
  if (!f) return <Card className="p-8 text-center text-muted">Loading fees…</Card>;
  const dirty = JSON.stringify(f) !== JSON.stringify(F.fees);
  const err = checkFees(f);
  const plans = f.books.plans;
  const setPlan = (i: number, patch: Partial<ServiceFees["books"]["plans"][number]>) => setF({ ...f, books: { ...f.books, plans: plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) } });
  const save = async () => {
    if (!BACKEND) return toast("Saving fees needs the live CRM (preview or production).", "info");
    if (err) return toast(err, "info");
    setSaving(true);
    try { await call("PUT", "/api/service-fees", { fees: f }); F.reload(); toast("Fees saved — letters and new work use them right away"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setSaving(false);
  };
  const ro = !canEdit;
  return (
    <div className="space-y-5">
      {ro && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">You can see the fees. Changing them needs the &ldquo;Manage settings&rdquo; permission.</p>}
      <FeeSection title="Tax preparation" subtitle="Return prices (forms, schedules, states, amendments, extensions) and your tax partners. Back-end bank and service bureau fees come with billing." summary={`${taxFees.length} return price${taxFees.length === 1 ? "" : "s"} · ${f.taxPartners.software || "software not set"}`}>
        <div className="space-y-4 px-5 pb-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {([["software", "Tax software (staff only)"], ["serviceBureau", "Service bureau (staff only)"], ["bankProduct", "Refund transfer bank (shown on bank product invoices)"]] as const).map(([k, l]) => (
              <div key={k}><label htmlFor={`tp-${k}`} className="mb-1 block text-[13px] font-medium text-ink-2">{l}</label><input id={`tp-${k}`} disabled={ro} value={f.taxPartners[k]} onChange={(e) => setF({ ...f, taxPartners: { ...f.taxPartners, [k]: e.target.value } })} className={`${input} h-10`} /></div>
            ))}
          </div>
          <p className="text-[12.5px] text-muted">Clients never see the tax software or service bureau names. Only the refund transfer bank appears on bank product invoices, because the client signs that bank&rsquo;s agreement.</p>
          <TaxFeeSchedule />
        </div>
      </FeeSection>

      <FeeSection title="Bookkeeping plans" subtitle="Monthly price and what each plan includes. Clients over their limits get an overage bill; after the set number of months in a row they move up a plan." summary={plans.map((p) => `${p.key} ${money(p.fee)}${p.startingAt ? "+" : ""}`).join(" · ")}>
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          {plans.map((p, i) => (
            <details key={i} className="rounded-xl border border-line p-3" open={i === 0}>
              <summary className="cursor-pointer text-[14px] font-semibold text-ink">{p.key || "New plan"} · {money(p.fee)}{p.startingAt ? "+" : ""}/mo · {p.transactions.toLocaleString()} transactions · {p.accounts} accounts · {p.locations} location{p.locations === 1 ? "" : "s"}</summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] sm:items-end">
                  <div><label htmlFor={`bp-name-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">Plan name</label><input id={`bp-name-${i}`} disabled={ro} value={p.key} onChange={(e) => setPlan(i, { key: e.target.value })} className={`${input} h-10`} /></div>
                  <Num id={`bp-fee-${i}`} label="Price / month" prefix="$" value={p.fee} disabled={ro} onChange={(n) => setPlan(i, { fee: n })} />
                  <Num id={`bp-tx-${i}`} label="Transactions" suffix="/ mo" value={p.transactions} disabled={ro} onChange={(n) => setPlan(i, { transactions: n })} />
                  <Num id={`bp-acct-${i}`} label="Accounts" value={p.accounts} disabled={ro} onChange={(n) => setPlan(i, { accounts: n })} />
                  <Num id={`bp-loc-${i}`} label="Locations" value={p.locations} disabled={ro} onChange={(n) => setPlan(i, { locations: n })} />
                  {canEdit && <button type="button" aria-label={`Remove ${p.key || "plan"}`} disabled={plans.length < 2} onClick={() => setF({ ...f, books: { ...f.books, plans: plans.filter((_, j) => j !== i) } })} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-hover disabled:opacity-40"><Trash2 size={16} /></button>}
                </div>
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" disabled={ro} checked={!!p.startingAt} onChange={() => setPlan(i, { startingAt: !p.startingAt })} className="accent-[var(--accent)]" />Show price as &ldquo;starting at&rdquo; ({money(p.fee)}+)</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor={`bp-tag-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">Tagline</label><input id={`bp-tag-${i}`} disabled={ro} value={p.tagline ?? ""} onChange={(e) => setPlan(i, { tagline: e.target.value })} className={`${input} h-10`} /></div>
                  <div><label htmlFor={`bp-desc-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">Package overview</label><textarea id={`bp-desc-${i}`} disabled={ro} rows={2} value={p.description ?? ""} onChange={(e) => setPlan(i, { description: e.target.value })} className={`${input} py-2`} /></div>
                  <div><label htmlFor={`bp-inc-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">What&rsquo;s included <span className="font-normal text-muted">(one per line)</span></label><textarea id={`bp-inc-${i}`} disabled={ro} rows={7} value={p.includes.join("\n")} onChange={(e) => setPlan(i, { includes: e.target.value.split("\n") })} className={`${input} py-2 text-[13px]`} /></div>
                  <div><label htmlFor={`bp-exc-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">What&rsquo;s not included <span className="font-normal text-muted">(one per line)</span></label><textarea id={`bp-exc-${i}`} disabled={ro} rows={7} value={p.excludes.join("\n")} onChange={(e) => setPlan(i, { excludes: e.target.value.split("\n") })} className={`${input} py-2 text-[13px]`} /></div>
                </div>
              </div>
            </details>
          ))}
          {canEdit && <Button size="sm" icon={Plus} onClick={() => setF({ ...f, books: { ...f.books, plans: [...plans, { key: "", fee: 0, transactions: 0, accounts: 0, locations: 1, includes: [...(plans[0]?.includes ?? [])], excludes: [...(plans[0]?.excludes ?? [])] }] } })}>Add plan</Button>}
          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <Num id="bo-tx" label="Overage per extra transaction" prefix="$" step={0.01} value={f.books.overagePerTransaction} disabled={ro} onChange={(n) => setF({ ...f, books: { ...f.books, overagePerTransaction: n } })} />
            <Num id="bo-acct" label="Overage per extra account" prefix="$" step={0.01} value={f.books.overagePerAccount} disabled={ro} onChange={(n) => setF({ ...f, books: { ...f.books, overagePerAccount: n } })} />
            <Num id="bo-up" label="Move up a plan after" suffix="months in a row over" value={f.books.upgradeAfterMonths} disabled={ro} onChange={(n) => setF({ ...f, books: { ...f.books, upgradeAfterMonths: n } })} />
          </div>
          {!f.books.overagePerTransaction && <p className="text-[12.5px] text-muted">No per-transaction overage set — set one if you bill for transactions over a plan&rsquo;s limit.</p>}
        </div>
      </FeeSection>

      <FeeSection title="Bookkeeping add-on services" subtitle="Offered in the bookkeeping intake and added to the client's quote. Monthly add-ons go on the monthly fee; one-time ones are billed once; custom quotes are priced per client." summary={`${(f.books.addOns ?? []).length} add-on${(f.books.addOns ?? []).length === 1 ? "" : "s"}`}>
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          {(f.books.addOns ?? []).map((x, i) => {
            const setAdd = (patch: Partial<typeof x>) => setF({ ...f, books: { ...f.books, addOns: f.books.addOns.map((y, j) => (j === i ? { ...y, ...patch } : y)) } });
            return (
              <details key={i} className="rounded-xl border border-line p-3">
                <summary className="cursor-pointer text-[14px] font-semibold text-ink">{x.name || "New add-on"} · {x.billing === "quote" ? "Custom quote" : `${x.startingAt ? "Starting at " : ""}${money(x.price)}${x.billing === "monthly" ? "/month" : " one-time"}${x.unit ? ` ${x.unit}` : ""}`}</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] sm:items-end">
                  <div><label htmlFor={`ad-name-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">Name</label><input id={`ad-name-${i}`} disabled={ro} value={x.name} onChange={(e) => setAdd({ name: e.target.value })} className={`${input} h-10`} /></div>
                  <div><label htmlFor={`ad-bill-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">Billed</label><select id={`ad-bill-${i}`} disabled={ro} value={x.billing} onChange={(e) => setAdd({ billing: e.target.value as typeof x.billing })} className={`${input} h-10`}><option value="monthly">Monthly</option><option value="one_time">One time</option><option value="quote">Custom quote</option></select></div>
                  {x.billing !== "quote" ? <Num id={`ad-price-${i}`} label="Price" prefix="$" value={x.price} disabled={ro} onChange={(n) => setAdd({ price: n })} /> : <span />}
                  <div><label htmlFor={`ad-unit-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">Per</label><input id={`ad-unit-${i}`} disabled={ro} value={x.unit} placeholder="e.g. per account" onChange={(e) => setAdd({ unit: e.target.value })} className={`${input} h-10`} /></div>
                  {canEdit && <button type="button" aria-label={`Remove ${x.name || "add-on"}`} onClick={() => setF({ ...f, books: { ...f.books, addOns: f.books.addOns.filter((_, j) => j !== i) } })} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-hover"><Trash2 size={16} /></button>}
                </div>
                {x.billing !== "quote" && <label className="mt-2 flex items-center gap-2 text-[13px]"><input type="checkbox" disabled={ro} checked={x.startingAt} onChange={() => setAdd({ startingAt: !x.startingAt })} className="accent-[var(--accent)]" />Show as &ldquo;starting at&rdquo;</label>}
                <div className="mt-2"><label htmlFor={`ad-inc-${i}`} className="mb-1 block text-[13px] font-medium text-ink-2">What it includes <span className="font-normal text-muted">(one per line)</span></label><textarea id={`ad-inc-${i}`} disabled={ro} rows={4} value={x.includes.join("\n")} onChange={(e) => setAdd({ includes: e.target.value.split("\n") })} className={`${input} py-2 text-[13px]`} /></div>
              </details>
            );
          })}
          {canEdit && <Button size="sm" icon={Plus} onClick={() => setF({ ...f, books: { ...f.books, addOns: [...(f.books.addOns ?? []), { key: `addon${Date.now() % 100000}`, name: "", billing: "monthly", price: 0, startingAt: false, unit: "", includes: [] }] } })}>Add add-on</Button>}
          <p className="text-[12px] text-muted">&ldquo;Additional financial accounts&rdquo; and &ldquo;Additional locations&rdquo; are added to a client&rsquo;s quote automatically when they have more accounts or locations than their plan includes.</p>
        </div>
      </FeeSection>

      <FeeSection title="Record expungement" subtitle="Basic expungements only. Third-party fees (court, clerk, fingerprinting, records) are billed separately." summary={`${money(f.expunge.baseFee)} up to ${f.expunge.chargesIncluded} charges · ${money(f.expunge.extraChargeFee)} each additional`}>
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Num id="ex-base" label="MKB fee" prefix="$" value={f.expunge.baseFee} disabled={ro} onChange={(n) => setF({ ...f, expunge: { ...f.expunge, baseFee: n } })} />
            <Num id="ex-incl" label="Covers up to" suffix="charges" value={f.expunge.chargesIncluded} disabled={ro} onChange={(n) => setF({ ...f, expunge: { ...f.expunge, chargesIncluded: n } })} />
            <Num id="ex-extra" label="Each additional charge" prefix="$" value={f.expunge.extraChargeFee} disabled={ro} onChange={(n) => setF({ ...f, expunge: { ...f.expunge, extraChargeFee: n } })} />
          </div>
          <p className="text-[12.5px] text-muted">Examples: 1–{f.expunge.chargesIncluded} charges = {money(expungeFee(f.expunge, 1))} · {f.expunge.chargesIncluded + 1} charges = {money(expungeFee(f.expunge, f.expunge.chargesIncluded + 1))} · {f.expunge.chargesIncluded + 2} charges = {money(expungeFee(f.expunge, f.expunge.chargesIncluded + 2))}</p>
        </div>
      </FeeSection>

      <FeeSection title="Business services" subtitle="Each business service has its own price in the Business Services catalog. That module is being connected next; its prices will be edited there." summary={"Priced in the Business Services catalog"}>
      </FeeSection>

      <FeeSection title="Invoice wording" subtitle="Shown on invoices. {{bank}} becomes your refund transfer bank." summary={"Payment note and bank product disclosure"}>
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          <div><label htmlFor="iw-up" className="mb-1 block text-[13px] font-medium text-ink-2">Pay upfront invoices — payment note</label><textarea id="iw-up" rows={2} disabled={ro} value={f.invoiceText.upfrontNote} onChange={(e) => setF({ ...f, invoiceText: { ...f.invoiceText, upfrontNote: e.target.value } })} className={`${input} py-2`} /></div>
          <div><label htmlFor="iw-bp" className="mb-1 block text-[13px] font-medium text-ink-2">Bank product invoices — how fees paid from the refund work</label><textarea id="iw-bp" rows={8} disabled={ro} value={f.invoiceText.bankDisclosure} onChange={(e) => setF({ ...f, invoiceText: { ...f.invoiceText, bankDisclosure: e.target.value } })} className={`${input} py-2`} /></div>
          <p className="text-[12px] text-warning-ink">Draft wording — check it against your refund transfer bank&rsquo;s agreement before clients see it.</p>
        </div>
      </FeeSection>

      <FeeSection title="Late payments (all services)" subtitle="Used in the Standard terms of every engagement letter." summary={`Late after ${f.late.graceDays} days · ${money(f.late.adminFee)} fee · ${f.late.monthlyRatePct}% per month`}>
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Num id="lt-grace" label="Late after" suffix="days" value={f.late.graceDays} disabled={ro} onChange={(n) => setF({ ...f, late: { ...f.late, graceDays: n } })} />
            <Num id="lt-admin" label="Late admin fee" prefix="$" value={f.late.adminFee} disabled={ro} onChange={(n) => setF({ ...f, late: { ...f.late, adminFee: n } })} />
            <Num id="lt-rate" label="Interest" suffix="% per month" step={0.1} value={f.late.monthlyRatePct} disabled={ro} onChange={(n) => setF({ ...f, late: { ...f.late, monthlyRatePct: n } })} />
            <Num id="lt-court" label="Court after" suffix="days late" value={f.late.courtAfterDays} disabled={ro} onChange={(n) => setF({ ...f, late: { ...f.late, courtAfterDays: n } })} />
            <Num id="lt-claim" label="Admin fee if we file a claim" prefix="$" value={f.late.courtAdminFee} disabled={ro} onChange={(n) => setF({ ...f, late: { ...f.late, courtAdminFee: n } })} />
          </div>
          <p className="text-[12.5px] text-muted">Louisiana generally caps agreed interest at 12% a year (1% per month), so this can&rsquo;t be set higher. If MKB files a claim, the claim admin fee plus all court costs are added. Have your attorney confirm these fees and the rate.</p>
        </div>
      </FeeSection>

      {canEdit && (
        <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-pop">
          <Button variant="primary" icon={Save} disabled={!dirty || saving || !!err} onClick={save}>{saving ? "Saving…" : "Save fees"}</Button>
          {dirty && <Button variant="ghost" icon={RotateCcw} onClick={() => setF(structuredClone(F.fees!))}>Undo changes</Button>}
          {err && dirty && <span role="alert" className="text-[13px] text-danger-ink">{err}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** A collapsible group on the Fees page: click the header to open or close; a summary shows while closed. */
function FeeSection({ title, subtitle, summary, children }: { title: string; subtitle: string; summary?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = `fees-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <Card>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-surface-hover sm:px-6">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><DollarSign size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-semibold text-ink">{title}</span>
          <span className="block text-[12.5px] text-muted">{open ? subtitle : summary ?? subtitle}</span>
        </span>
        <ChevronDown size={18} className={`mt-2 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && children && <div id={id} className="pt-1">{children}</div>}
    </Card>
  );
}

/** Blank designee name/address/phone/fax use the service bureau details (same rule as the server). */
const withBureau = (d: Designee, b: Bureau): Designee => ({ ...d, ...Object.fromEntries((["name", "address", "city", "state", "zip", "phone", "fax"] as const).filter((k) => !d[k].trim() && b[k].trim()).map((k) => [k, b[k]])) });

/** MKB as its own e-file service bureau. Fill in later; blank Form 8821 designee details come from here. */
function BureauEditor({ onSaved }: { onSaved: (b: Bureau) => void }) {
  const team = useTeam();
  const toast = useToast();
  const canEdit = team.can("settings", "settings");
  const [b, setB] = useState<Bureau | null>(BACKEND ? null : EMPTY_BUREAU);
  const [saved, setSaved] = useState<Bureau | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (BACKEND) call<{ bureau: Bureau }>("GET", "/api/settings/bureau").then((r) => { setSaved((cur) => cur ?? r.bureau); setB((cur) => cur ?? r.bureau); }).catch(() => setB(EMPTY_BUREAU)); }, []);
  if (!b) return <Card className="p-8 text-center text-muted">Loading…</Card>;
  const save = async () => {
    if (!BACKEND) return toast("Saving needs the live CRM (preview or production).", "info");
    setSaving(true);
    try { const r = await call<{ bureau: Bureau }>("PUT", "/api/settings/bureau", { bureau: b }); setB(r.bureau); setSaved(r.bureau); onSaved(r.bureau); toast("Service bureau saved"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setSaving(false);
  };
  const F = (k: keyof Bureau, label: string, hint?: string, className = "") => (
    <div className={className}><label htmlFor={`sb-${k}`} className="mb-1 block text-[13px] font-medium text-ink-2">{label}{hint && <span className="font-normal text-muted"> {hint}</span>}</label><input id={`sb-${k}`} disabled={!canEdit} value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink disabled:opacity-60" /></div>
  );
  const filled = !!(b.name && b.efin);
  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="Your service bureau" subtitle="Your own e-file service bureau details. Staff only — never shown to clients." action={<Badge tone={filled ? "success" : "neutral"}>{filled ? "On file" : "Fill in later"}</Badge>} />
      <div className="space-y-4 px-5 pb-5 sm:px-6">
        <p className="text-[13px] text-muted">Fill these in whenever you have them (for example once the IRS assigns your EFIN). Your Form 8821 designee uses the name, address, phone and fax from here for anything left blank below.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {F("name", "Service bureau legal name", undefined, "sm:col-span-2")}
          {F("ein", "EIN", "(9 digits)")}
          {F("efin", "EFIN", "(6 digits, from the IRS)")}
          {F("etin", "ETIN", "(5 digits, transmitters only — optional)")}
          {F("email", "Email")}
          {F("address", "Street address", undefined, "sm:col-span-2")}
          {F("city", "City")}
          <div className="grid grid-cols-2 gap-4">{F("state", "State")}{F("zip", "ZIP")}</div>
          {F("phone", "Telephone")}
          {F("fax", "Fax", "(optional)")}
        </div>
        {canEdit && <Button variant="primary" icon={Save} disabled={saving || JSON.stringify(b) === JSON.stringify(saved)} onClick={save}>{saving ? "Saving…" : "Save"}</Button>}
      </div>
    </Card>
  );
}

function DesigneeEditor() {
  const team = useTeam();
  const toast = useToast();
  const canEdit = team.can("settings", "settings");
  const [d, setD] = useState<Designee | null>(BACKEND ? null : EMPTY_DESIGNEE);
  const [saved, setSaved] = useState<Designee | null>(null);
  const [saving, setSaving] = useState(false);
  const [bureau, setBureau] = useState<Bureau>(EMPTY_BUREAU);
  // Only the first answer fills the form, so a slow second load never wipes what's been typed.
  useEffect(() => { if (BACKEND) call<{ designee: Designee; bureau?: Bureau }>("GET", "/api/settings/designee").then((r) => { if (r.bureau) setBureau(r.bureau); setSaved((cur) => cur ?? r.designee); setD((cur) => cur ?? r.designee); }).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load", "info")); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Card className="p-8 text-center text-muted">Loading…</Card>;
  const save = async () => {
    if (!BACKEND) return toast("Saving needs the live CRM (preview or production).", "info");
    setSaving(true);
    try { const r = await call<{ designee: Designee }>("PUT", "/api/settings/designee", { designee: d }); setD(r.designee); setSaved(r.designee); toast("Designee saved"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setSaving(false);
  };
  const F = ({ k, label, hint, className = "" }: { k: keyof Designee; label: string; hint?: string; className?: string }) => (
    <div className={className}><label htmlFor={`dg-${k}`} className="mb-1 block text-[13px] font-medium text-ink-2">{label}{hint && <span className="font-normal text-muted"> {hint}</span>}</label><input id={`dg-${k}`} disabled={!canEdit} value={d[k]} placeholder={k in bureau ? (bureau as Record<string, string>)[k] : ""} onChange={(e) => setD({ ...d, [k]: e.target.value })} className={`${input} h-10`} /></div>
  );
  return (
    <>
    <BureauEditor onSaved={setBureau} />
    <Card>
      <CardHeader icon={ShieldCheck} title="IRS designee (Form 8821)" subtitle="Who the IRS sends transcripts and notice copies to. Staff only — never shown to clients." action={<Badge tone={designeeReady(withBureau(d, bureau)) ? "success" : "warning"}>{designeeReady(withBureau(d, bureau)) ? "Ready" : "Incomplete"}</Badge>} />
      <div className="space-y-4 px-5 pb-5 sm:px-6">
        <p className="text-[13px] text-muted">Enter your details exactly as the IRS has them on your CAF record. They fill line 2 of every Form 8821. Leave name, address, phone or fax blank to use your service bureau details (shown in gray).</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {F({ k: "name", label: "Designee name" })}
          {F({ k: "caf", label: "CAF number" })}
          {F({ k: "address", label: "Street address", className: "sm:col-span-2" })}
          {F({ k: "city", label: "City" })}
          <div className="grid grid-cols-2 gap-4">{F({ k: "state", label: "State" })}{F({ k: "zip", label: "ZIP" })}</div>
          {F({ k: "ptin", label: "PTIN", hint: "(optional)" })}
          {F({ k: "phone", label: "Telephone" })}
          {F({ k: "fax", label: "Fax", hint: "(optional)" })}
        </div>
        {canEdit && <Button variant="primary" icon={Save} disabled={saving || JSON.stringify(d) === JSON.stringify(saved)} onClick={save}>{saving ? "Saving…" : "Save"}</Button>}
      </div>
    </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

type TaxRules = { requireOwnerApproval: boolean; requireEngagement: boolean };
function TaxRulesCard() {
  const team = useTeam();
  const toast = useToast();
  const canEdit = team.can("settings", "settings");
  const [r, setR] = useState<TaxRules | null>(BACKEND ? null : { requireOwnerApproval: true, requireEngagement: true });
  useEffect(() => { if (BACKEND) call<{ rules: TaxRules }>("GET", "/api/settings/tax-rules").then((x) => setR(x.rules)).catch(() => {}); }, []);
  if (!r) return <Card className="p-6 text-center text-muted">Loading…</Card>;
  const set = async (patch: Partial<TaxRules>) => {
    if (!BACKEND) return toast("Saving needs the live CRM (preview or production).", "info");
    const next = { ...r, ...patch };
    try { const x = await call<{ rules: TaxRules }>("PUT", "/api/settings/tax-rules", { rules: next }); setR(x.rules); toast("Saved — reload open returns to apply"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
  };
  const Row = ({ k, title, text }: { k: keyof TaxRules; title: string; text: string }) => (
    <label className="flex items-start gap-3 rounded-xl border border-line p-3">
      <input type="checkbox" disabled={!canEdit} checked={r[k]} onChange={() => set({ [k]: !r[k] })} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
      <span><span className="block text-[14px] font-semibold text-ink">{title}</span><span className="block text-[12.5px] text-muted">{text}</span></span>
    </label>
  );
  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="Tax workflow" subtitle="Checked on the server for every return, whoever is signed in." />
      <div className="space-y-3 px-5 pb-5 sm:px-6">
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" />
          <span><span className="block text-[14px] font-semibold text-ink">Two sign-offs before e-file — always required</span><span className="block text-[12.5px] text-muted">1) The reviewer signs off on the return. 2) After the client approves, the Owner gives final approval. E-filing stays locked until both are done. You get a bell notification when a return is waiting for you.</span></span>
        </div>
        <Row k="requireEngagement" title="Engagement letter before review" text="A return can't move to review until the client has accepted the engagement letter." />
      </div>
    </Card>
  );
}
