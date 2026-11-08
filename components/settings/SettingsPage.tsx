"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSignature, History, Mail, RotateCcw, Save } from "lucide-react";
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

const SAMPLE = { clientName: "Jordan Sample", date: "November 8, 2026", taxYear: "2025", service: "Foundation", fee: "$399", firstName: "Jordan", count: "2 documents" };
const input = "w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink disabled:opacity-60";

export function SettingsPage() {
  const [tab, setTab] = useState<"letters" | "emails">("letters");
  useEffect(() => {
    const read = () => setTab(window.location.hash === "#emails" ? "emails" : "letters");
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[28px]">Settings</h1>
        <p className="mt-1 text-[14px] text-muted">Wording clients see: engagement letters and automatic emails.</p>
      </div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {([["letters", "Engagement letters", FileSignature], ["emails", "Client emails", Mail]] as const).map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); history.replaceState(null, "", `#${k}`); }} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[14px] font-semibold ${tab === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-hover"}`}><Icon size={16} />{l}</button>
        ))}
      </div>
      {tab === "letters" ? <LettersEditor /> : <EmailsEditor />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LettersEditor() {
  const team = useTeam();
  const toast = useToast();
  const canEdit = team.can("settings", "settings");
  const L = useLetters();
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
              <div className="rounded-xl border border-line bg-bg p-4"><LetterView title={title} body={body} vars={SAMPLE} /></div>
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
              <div className="rounded-xl border border-line bg-bg p-4"><LetterView title={old.title} body={old.body} version={old.version} vars={SAMPLE} /></div>
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
  useEffect(() => { if (cur) setW({ ...cur.wording }); }, [cur]);
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
