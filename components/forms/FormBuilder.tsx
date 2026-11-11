"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronRight, Code2, Copy, Eye, ExternalLink, Link2, Plus, Rocket, Settings2, ShieldAlert, Trash2, Wrench, FlaskConical, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useForms } from "@/lib/store/forms-store";
import { useLeads } from "@/lib/store/leads-store";
import { useTeam } from "@/lib/store/team-store";
import { FIELD_TYPES, MAP_TARGETS, MOST_RECENT_YEAR, OUTCOME_META, TAX_RETURN_CHOICES, publicOrigin, fid, hasOptions, publicPath, sensitiveReason, type FieldType, type FormField, type LeadForm, type Submission } from "@/lib/forms/config";
import { SERVICES } from "@/lib/sample-data";
import { relTime } from "@/lib/format";
import type { ServiceKey } from "@/lib/types";
import { FormRenderer } from "./FormRenderer";
import { BACKEND } from "@/lib/sync/remote";
import { SubmissionsTable } from "./FormsCenter";

const TABS = [
  { key: "build", label: "Build", icon: Wrench },
  { key: "settings", label: "Lead routing & settings", icon: Settings2 },
  { key: "share", label: "Share", icon: Link2 },
  { key: "test", label: "Test", icon: FlaskConical },
  { key: "submissions", label: "Submissions", icon: Inbox },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function FormBuilder({ id }: { id: string }) {
  const forms = useForms();
  const team = useTeam();
  const toast = useToast();
  const router = useRouter();
  const f = forms.forms.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("build");
  const [tried, setTried] = useState(false);
  useEffect(() => { const h = window.location.hash.slice(1) as Tab; if (TABS.some((t) => t.key === h)) setTab(h); }, []);
  if (!f && !forms.ready) return <div className="grid min-h-[40vh] place-items-center text-[14px] text-muted" role="status">Loading…</div>;
  if (!f) return <Card className="p-10 text-center text-muted">Form not found. <Link href="/forms" className="text-accent">Back to Forms</Link></Card>;
  const can = team.can("leads", "edit");
  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };
  const subs = forms.submissions.filter((s) => s.formId === id).length;
  // Re-checked live once someone tries to publish, so fixed problems disappear immediately.
  const issues = tried && f.status !== "published" ? forms.publishIssues(id) : [];
  return (
    <>
      <Link href="/forms" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-accent"><ArrowLeft size={15} /> Forms</Link>
      <Card className="mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-bold tracking-tight text-ink">{f.name}</h1><Badge tone={f.status === "published" ? "success" : f.status === "archived" ? "warning" : "neutral"}>{f.status[0].toUpperCase() + f.status.slice(1)}</Badge></div>
            <p className="text-[13px] text-muted">{publicPath(f.slug)} · edited {relTime(f.updatedAt)} · {subs} submission{subs === 1 ? "" : "s"}</p>
          </div>
          {can && (
            <div className="flex flex-wrap gap-2">
              {f.status !== "published" ? <Button variant="primary" icon={Rocket} onClick={() => { setTried(true); if (forms.publish(id)) toast("Published — the form is live"); }}>Publish</Button> : <Button onClick={() => { forms.unpublish(id); toast("Unpublished — the link stops accepting responses"); }}>Unpublish</Button>}
              {f.status !== "archived" && <Button variant="ghost" onClick={() => { forms.archive(id); toast("Archived"); }}>Archive</Button>}
              {subs === 0 && <Button variant="ghost" icon={Trash2} onClick={() => { if (forms.deleteForm(id)) { toast("Form deleted"); router.push("/forms"); } }}>Delete</Button>}
            </div>
          )}
        </div>
        {issues.length > 0 && (
          <div role="alert" className="mt-4 rounded-xl border border-warning/40 bg-warning-soft/50 p-3">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-warning-ink"><AlertTriangle size={15} /> Fix these before publishing</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-[13px] text-ink">{issues.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
      </Card>
      <div role="tablist" aria-label="Form" className="scrollbar-thin mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}><t.icon size={15} />{t.label}{t.key === "submissions" && ` (${subs})`}</button>)}
      </div>
      {tab === "build" && <Build f={f} can={can} />}
      {tab === "settings" && <Settings f={f} can={can} />}
      {tab === "share" && <Share f={f} />}
      {tab === "test" && <Test f={f} />}
      {tab === "submissions" && <SubmissionsTable formId={id} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Build({ f, can }: { f: LeadForm; can: boolean }) {
  const forms = useForms();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<FieldType>("text");
  const setFields = (fields: FormField[]) => forms.setFields(f.id, fields);
  const upd = (fieldId: string, patch: Partial<FormField>) => setFields(f.fields.map((x) => (x.id === fieldId ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => { const a = [...f.fields]; [a[i], a[i + d]] = [a[i + d], a[i]]; setFields(a); };
  const typeLabel = (t: FieldType) => FIELD_TYPES.find((x) => x.key === t)!.label;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="space-y-2">
        {f.fields.map((x, i) => {
          const warn = sensitiveReason(x);
          const open = openId === x.id;
          const triggers = f.fields.slice(0, i).filter((y) => y.type === "radio" || y.type === "select" || y.type === "yesno" || y.type === "checkboxes");
          return (
            <Card key={x.id} className={warn ? "ring-1 ring-danger/50" : ""}>
              <div className="flex items-center gap-2 px-4 py-3">
                <button onClick={() => setOpenId(open ? null : x.id)} aria-expanded={open} aria-label={`Edit ${x.label}`} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {open ? <ChevronDown size={16} className="shrink-0 text-muted" /> : <ChevronRight size={16} className="shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink">{x.label || "Untitled"}</span><span className="text-[12px] text-muted">{typeLabel(x.type)}{x.required && x.type !== "heading" && x.type !== "paragraph" ? " · required" : ""}{x.map !== "none" ? ` · → ${MAP_TARGETS.find((m) => m.key === x.map)!.label.replace("Lead — ", "lead ")}` : ""}{x.showIf ? " · conditional" : ""}</span></span>
                </button>
                {warn && <ShieldAlert size={16} className="shrink-0 text-danger" aria-label="Sensitive field" />}
                {can && <>
                  <Button size="sm" variant="ghost" icon={ArrowUp} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button size="sm" variant="ghost" icon={ArrowDown} aria-label="Move down" disabled={i === f.fields.length - 1} onClick={() => move(i, 1)} />
                  <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${x.label}`} onClick={() => setFields(f.fields.filter((y) => y.id !== x.id).map((y) => (y.showIf?.fieldId === x.id ? { ...y, showIf: undefined } : y)))} />
                </>}
              </div>
              {warn && <p className="mx-4 mb-3 rounded-lg bg-danger-soft/40 px-3 py-2 text-[12.5px] text-danger-ink">{warn}</p>}
              {open && (
                <fieldset disabled={!can} className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><TextArea id={`fb-label-${x.id}`} label={x.type === "paragraph" ? "Text" : x.type === "consent" ? "Consent wording" : "Question"} value={x.label} onChange={(e) => upd(x.id, { label: e.target.value })} /></div>
                  {x.type !== "heading" && x.type !== "paragraph" && <TextField id={`fb-help-${x.id}`} label="Help text (optional)" value={x.help ?? ""} onChange={(e) => upd(x.id, { help: e.target.value || undefined })} />}
                  <SelectField id={`fb-type-${x.id}`} label="Answer type" value={x.type} onChange={(e) => upd(x.id, { type: e.target.value as FieldType, options: hasOptions(e.target.value as FieldType) ? x.options ?? ["Option 1"] : undefined })} options={FIELD_TYPES.map((t) => [t.key, t.label] as [string, string])} />
                  {hasOptions(x.type) && <div className="sm:col-span-2"><TextArea id={`fb-opts-${x.id}`} label="Options (one per line)" value={(x.options ?? []).join("\n")} onChange={(e) => upd(x.id, { options: e.target.value.split("\n") })} /></div>}
                  {x.type !== "heading" && x.type !== "paragraph" && <SelectField id={`fb-map-${x.id}`} label="Saves to" value={x.map} onChange={(e) => upd(x.id, { map: e.target.value as FormField["map"] })} options={MAP_TARGETS.map((m) => [m.key, m.label] as [string, string])} />}
                  {x.type !== "heading" && x.type !== "paragraph" && <div className="self-end pb-1"><Checkbox label="Required" checked={!!x.required} onChange={() => upd(x.id, { required: !x.required })} /></div>}
                  {triggers.length > 0 && (
                    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                      <SelectField id={`fb-if-${x.id}`} label="Show only if…" value={x.showIf?.fieldId ?? ""} onChange={(e) => upd(x.id, { showIf: e.target.value ? { fieldId: e.target.value, equals: "" } : undefined })} options={[["", "Always show"], ...triggers.map((t) => [t.id, t.label] as [string, string])]} />
                      {x.showIf && (() => { const t = f.fields.find((y) => y.id === x.showIf!.fieldId); const opts = t?.type === "yesno" ? ["Yes", "No"] : t?.options ?? []; return <SelectField id={`fb-eq-${x.id}`} label="…the answer is" value={x.showIf.equals} onChange={(e) => upd(x.id, { showIf: { ...x.showIf!, equals: e.target.value } })} options={[["", "Choose…"], ...opts.map((o) => [o, o] as [string, string])]} />; })()}
                    </div>
                  )}
                </fieldset>
              )}
            </Card>
          );
        })}
        {can && (
          <Card className="flex flex-wrap items-end gap-2 p-4">
            <div className="min-w-[200px] flex-1"><SelectField id="fb-add" label="Add a field" value={adding} onChange={(e) => setAdding(e.target.value as FieldType)} options={FIELD_TYPES.map((t) => [t.key, t.label] as [string, string])} /></div>
            <Button icon={Plus} onClick={() => { const nf: FormField = { id: fid(), type: adding, label: adding === "heading" ? "Section heading" : adding === "paragraph" ? "Add some helpful text." : "New question", required: adding !== "heading" && adding !== "paragraph", map: adding === "services" ? "services" : "none", options: hasOptions(adding) ? ["Option 1", "Option 2"] : undefined }; const consentAt = f.fields.findIndex((y) => y.type === "consent"); const a = [...f.fields]; a.splice(consentAt >= 0 ? consentAt : a.length, 0, nf); setFields(a); setOpenId(nf.id); }}>Add field</Button>
            <p className="w-full text-[12px] text-muted">Public forms can&rsquo;t ask for SSNs, bank or card numbers, dates of birth or criminal-history details — those are collected later in the secure client portal.</p>
          </Card>
        )}
      </div>
      <div className="xl:sticky xl:top-[140px] xl:self-start">
        <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-muted"><Eye size={14} /> Live preview</p>
        <div className="rounded-3xl bg-surface-2 p-3 ring-1 ring-line sm:p-5"><FormRenderer key={JSON.stringify(f.fields)} form={f} mode="preview" /></div>
      </div>
    </div>
  );
}

function Settings({ f, can }: { f: LeadForm; can: boolean }) {
  const forms = useForms();
  const leads = useLeads();
  const team = useTeam();
  const toast = useToast();
  const [v, setV] = useState(f);
  useEffect(() => setV(f), [f.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(v) !== JSON.stringify(f);
  const staff = team.members.filter((m) => m.status === "active" && team.roles.find((r) => r.id === m.roleId)?.perms.leads?.length);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Form details" />
        <fieldset disabled={!can} className="grid gap-4 px-5 pb-5 sm:px-6">
          <TextField id="fs-name" label="Internal name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <TextField id="fs-title" label="Title shown to visitors" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          <TextArea id="fs-intro" label="Introduction" value={v.intro ?? ""} onChange={(e) => setV({ ...v, intro: e.target.value })} />
          <TextField id="fs-slug" label="Link name" hint={`${publicOrigin()}${publicPath(v.slug)}`} value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} />
          <TextArea id="fs-thanks" label="Thank-you message" value={v.thankYou} onChange={(e) => setV({ ...v, thankYou: e.target.value })} />
        </fieldset>
      </Card>
      <Card>
        <CardHeader title="Where new leads go" subtitle="Every submission becomes a lead in your pipeline" />
        <fieldset disabled={!can} className="grid gap-4 px-5 pb-5 sm:px-6">
          <SelectField id="fs-owner" label="Assign to" value={v.routing.ownerId} onChange={(e) => setV({ ...v, routing: { ...v.routing, ownerId: e.target.value } })} options={staff.map((m) => [m.id, m.name] as [string, string])} />
          <SelectField id="fs-stage" label="Pipeline stage" value={v.routing.stageId} onChange={(e) => setV({ ...v, routing: { ...v.routing, stageId: e.target.value } })} options={leads.stages.map((s) => [s.id, s.name] as [string, string])} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="fs-source" label="Lead source" value={v.routing.source} onChange={(e) => setV({ ...v, routing: { ...v.routing, source: e.target.value } })} options={leads.sources.map((s) => [s, s] as [string, string])} />
            <TextField id="fs-campaign" label="Campaign / detail" value={v.routing.sourceDetail ?? ""} onChange={(e) => setV({ ...v, routing: { ...v.routing, sourceDetail: e.target.value || undefined } })} placeholder="e.g. Spring Facebook ad" />
          </div>
          <SelectField id="fs-follow" label="Follow-up reminder for the assignee" value={String(v.routing.followUpHours)} onChange={(e) => setV({ ...v, routing: { ...v.routing, followUpHours: Number(e.target.value) } })} options={[["4", "Within 4 hours"], ["24", "Within 1 business day"], ["48", "Within 2 business days"]]} />
          <SelectField id="fs-auto" label="After they submit, automatically email" value={v.routing.autoIntake?.kind ?? ""} onChange={(e) => { const k = e.target.value; const choice = v.fields.filter((x) => x.type === "radio" || x.type === "select"); setV({ ...v, routing: { ...v.routing, autoIntake: k === "tax" ? { kind: "tax", returnFieldId: v.routing.autoIntake?.returnFieldId ?? choice[0]?.id, yearFieldId: v.routing.autoIntake?.yearFieldId } : k === "books" ? { kind: "books" } : undefined } }); }} options={[["", "Nothing — we follow up ourselves"], ["tax", "Their private tax interview link"], ["books", "Their private bookkeeping intake link"]]} />
          {v.routing.autoIntake?.kind === "tax" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField id="fs-auto-ret" label="Question that picks the return" value={v.routing.autoIntake.returnFieldId ?? ""} onChange={(e) => setV({ ...v, routing: { ...v.routing, autoIntake: { ...v.routing.autoIntake!, returnFieldId: e.target.value || undefined } } })} options={[["", "Choose…"], ...v.fields.filter((x) => x.type === "radio" || x.type === "select").map((x) => [x.id, x.label] as [string, string])]} />
              <SelectField id="fs-auto-year" label="Question that picks the tax year (optional)" value={v.routing.autoIntake.yearFieldId ?? ""} onChange={(e) => setV({ ...v, routing: { ...v.routing, autoIntake: { ...v.routing.autoIntake!, yearFieldId: e.target.value || undefined } } })} options={[["", "None — always the most recent year"], ...v.fields.filter((x) => x.type === "radio" || x.type === "select").map((x) => [x.id, x.label] as [string, string])]} />
              <p className="text-[12.5px] text-muted sm:col-span-2">The return question&rsquo;s answers must be: {Object.keys(TAX_RETURN_CHOICES).join(" · ")} (anything else, like &ldquo;Not sure&rdquo;, means you follow up). The year question sends only for &ldquo;{MOST_RECENT_YEAR}&rdquo;.</p>
            </div>
          )}
          <TextField id="fs-tags" label="Tags (comma-separated)" value={v.routing.tags.join(", ")} onChange={(e) => setV({ ...v, routing: { ...v.routing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) } })} />
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Services added to every lead from this form</span>
            <div className="flex flex-wrap gap-1.5">{(Object.keys(SERVICES) as ServiceKey[]).map((k) => { const on = v.services.includes(k); return <button key={k} type="button" aria-pressed={on} onClick={() => setV({ ...v, services: on ? v.services.filter((x) => x !== k) : [...v.services, k] })} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{SERVICES[k].label}</button>; })}</div>
          </div>
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2 ring-1 ring-line">No duplicates: if the email or phone matches an existing <strong>client</strong>, the submission is added to their activity; if it matches an open <strong>lead</strong>, the answers are added to that lead.</p>
        </fieldset>
      </Card>
      {can && <div className="xl:col-span-2"><Button variant="primary" disabled={!dirty || !v.name.trim()} onClick={() => { forms.updateForm(f.id, { name: v.name, title: v.title, intro: v.intro, slug: v.slug, thankYou: v.thankYou, routing: v.routing, services: v.services }); toast("Settings saved"); }}>Save settings</Button></div>}
    </div>
  );
}

function Share({ f }: { f: LeadForm }) {
  const toast = useToast();
  const url = `${publicOrigin()}${publicPath(f.slug)}`;
  const embed = `<iframe src="${url}?embed=1" title="${f.title.replace(/"/g, "&quot;")}" style="width:100%;min-height:780px;border:0" loading="lazy"></iframe>`;
  const copy = (t: string, what: string) => { navigator.clipboard?.writeText(t).catch(() => {}); toast(`${what} copied`); };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      {f.status !== "published" && <div className="xl:col-span-2 rounded-2xl border border-warning/40 bg-warning-soft/50 px-4 py-3 text-[13px] text-warning-ink">This form is a {f.status}. Publish it before sharing — unpublished links don&rsquo;t accept responses.</div>}
      <Card>
        <CardHeader icon={Link2} title="Direct link" subtitle="For social media bios, texts, emails and QR codes" />
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          <code className="block break-all rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink ring-1 ring-line">{url}</code>
          <div className="flex flex-wrap gap-2"><Button icon={Copy} onClick={() => copy(url, "Link")}>Copy link</Button><Button variant="ghost" icon={ExternalLink} href={publicPath(f.slug)}>Open public page</Button></div>
        </div>
      </Card>
      <Card>
        <CardHeader icon={Code2} title="Embed on your website" subtitle="Paste this where the form should appear" />
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] text-ink ring-1 ring-line">{embed}</pre>
          <Button icon={Copy} onClick={() => copy(embed, "Embed code")}>Copy embed code</Button>
        </div>
      </Card>
      <p className="xl:col-span-2 text-[12px] text-muted">Preview note: the web address is a placeholder until MKB&rsquo;s domain is connected in Phase 3. The public page in this preview shows the sample forms; forms created here go live on the public page once the backend is connected.</p>
    </div>
  );
}

function Test({ f }: { f: LeadForm }) {
  const forms = useForms();
  const leads = useLeads();
  const toast = useToast();
  const [res, setRes] = useState<Submission | null>(null);
  const lead = res?.leadId ? leads.leads.find((l) => l.id === res.leadId) : undefined;
  const note = res && (
    <div className="mx-auto mt-4 max-w-md rounded-xl bg-surface-2 p-3 text-left text-[13px] ring-1 ring-line">
      <p className="font-semibold text-ink">Staff test result: <Badge tone={OUTCOME_META[res.outcome].tone}>{OUTCOME_META[res.outcome].label}</Badge></p>
      {lead && <p className="mt-1 text-ink-2">{res.outcome === "new_lead" ? "Created" : "Updated"} lead <Link href={`/leads/${lead.id}`} className="font-semibold text-accent hover:underline">{lead.name}</Link> — assigned and given a follow-up reminder.</p>}
      {res.clientId && <p className="mt-1 text-ink-2">Matched an existing client — <Link href={`/clients/${res.clientId}`} className="font-semibold text-accent hover:underline">open client</Link>.</p>}
    </div>
  );
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 rounded-xl bg-accent-soft/60 px-4 py-2.5 text-[13px] text-accent-ink">Fill it in exactly as a visitor would. Test submissions create real (sample) leads so you can see the whole flow — they&rsquo;re labelled “Staff test”.</p>
      <FormRenderer form={f} mode="live" note={note} onSubmit={(data, hp) => (BACKEND ? forms.submitRemote(f.id, data, hp).then((r) => { setRes(r); }).catch((e) => (e instanceof Error ? e.message : "Couldn't submit")) : setRes(forms.submit(f.id, data, "Staff test", hp)))} />
    </div>
  );
}
