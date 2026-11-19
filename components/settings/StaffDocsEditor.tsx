"use client";

import { useEffect, useState } from "react";
import { FileSignature, FileUp, Plus, Save } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, SelectField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { BACKEND, call } from "@/lib/sync/remote";
import type { StaffDoc } from "@/lib/staff/onboarding-docs";

type List = { docs: StaffDoc[]; history: { key: string; version: number; note?: string; at: string; by?: string }[] };
type Form = { key?: string; title: string; kind: "sign" | "upload"; body: string; required: boolean; active: boolean; position: number; note: string };
const area = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink";

/** Settings → Staff onboarding: the documents every new team member signs before using the CRM. */
export function StaffDocsEditor() {
  const toast = useToast();
  const [l, setL] = useState<List | null>(null);
  const [sel, setSel] = useState<string | "new" | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (BACKEND) call<List>("GET", "/api/team/onboarding-docs").then((d) => { setL(d); setSel((s) => s ?? d.docs[0]?.key ?? null); }).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load", "info")); }, [toast]);
  useEffect(() => {
    if (!l || !sel) return;
    if (sel === "new") { setF({ title: "", kind: "sign", body: "", required: true, active: true, position: l.docs.length + 1, note: "" }); return; }
    const d = l.docs.find((x) => x.key === sel);
    if (d) setF({ key: d.key, title: d.title, kind: d.kind, body: d.body, required: d.required, active: d.active, position: d.position, note: "" });
  }, [l, sel]);
  if (!BACKEND) return <Card className="p-8 text-center text-muted">Staff onboarding documents need the live CRM.</Card>;
  if (!l || !f) return <Card className="p-8 text-center text-muted">Loading documents…</Card>;
  const cur = l.docs.find((x) => x.key === f.key);
  const save = async () => {
    setBusy(true);
    try { const d = await call<List>("POST", "/api/team/onboarding-docs", f); setL(d); if (!f.key) setSel(d.docs.find((x) => x.title === f.title.trim())?.key ?? null); toast("Saved as a new version"); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="h-fit p-2">
        {l.docs.map((d) => (
          <button key={d.key} type="button" onClick={() => setSel(d.key)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13.5px] ${sel === d.key ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-2 hover:bg-surface-hover"}`}>
            {d.kind === "upload" ? <FileUp size={15} /> : <FileSignature size={15} />}<span className="min-w-0 flex-1 truncate">{d.title}</span>{!d.active && <Badge tone="neutral">Off</Badge>}
          </button>
        ))}
        <button type="button" onClick={() => setSel("new")} className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13.5px] ${sel === "new" ? "bg-accent-soft font-semibold text-accent-ink" : "text-accent hover:bg-surface-hover"}`}><Plus size={15} /> Add a document</button>
      </Card>
      <Card>
        <CardHeader title={f.key ? f.title || "Document" : "New document"} subtitle={cur ? `Version ${cur.version}${cur.updatedAt ? ` · saved ${new Date(cur.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${cur.updatedBy ? ` by ${cur.updatedBy}` : ""}` : " · built-in draft"}` : "Every team member must complete it before using the CRM (if required)."} />
        <div className="space-y-4 border-t border-line px-5 py-5 sm:px-6">
          <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">The built-in documents are drafts for your attorney to review. Saving makes a new version; people who already signed keep the version they signed. A new required document blocks everyone's access until they complete it.</p>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <TextField label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <TextField label="Order" type="number" min={0} value={String(f.position)} onChange={(e) => setF({ ...f, position: Number(e.target.value) || 0 })} />
          </div>
          {!f.key && <SelectField label="What they do" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Form["kind"] })} options={[["sign", "Read and sign"], ["upload", "Upload a file (e.g. a tax form)"]]} />}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox label="Required before access" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} />
            <Checkbox label="In use" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          </div>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-2">{f.kind === "upload" ? "Instructions" : "Document text"}</span>
            <textarea aria-label="Document text" rows={18} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className={area} />
            <span className="mt-1 block text-[12px] text-muted">&quot;## &quot; starts a heading, &quot;- &quot; a bullet, a blank line a new paragraph. {"{{name}}"} = the signer, {"{{company}}"} = MKB Financial Group, {"{{date}}"} = today.</span>
          </label>
          <TextField label="What changed (for the history)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Attorney edits, Dec 2026" />
          <Button variant="primary" icon={Save} disabled={busy || f.title.trim().length < 3 || f.body.trim().length < 20} onClick={() => void save()}>{busy ? "Saving…" : f.key ? "Save new version" : "Add document"}</Button>
          {f.key && l.history.some((h) => h.key === f.key) && (
            <div className="border-t border-line pt-3 text-[12.5px] text-muted">
              <p className="font-semibold text-ink-2">History</p>
              {l.history.filter((h) => h.key === f.key).map((h) => <p key={h.version}>Version {h.version} · {new Date(h.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{h.by ? ` · ${h.by}` : ""}{h.note ? ` — ${h.note}` : ""}</p>)}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
