"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FilePlus2, FileSignature, Send, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useTax } from "@/lib/store/tax-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { IRS_SUBMIT_URL, STATUS_LABEL, type F8821, type F8821Status } from "@/lib/irs/f8821";
import { fmtDate } from "@/lib/format";

type Data = { forms: F8821[]; missing: { id: string; name: string; type: "individual" | "business" }[]; designeeReady: boolean };
const TONE: Record<F8821Status, "warning" | "info" | "success" | "neutral" | "danger"> = { needs_signature: "warning", signed: "info", submitted: "info", on_file: "success", revoked: "neutral" };
const ORDER: F8821Status[] = ["signed", "needs_signature", "submitted", "on_file"];

/** Tax Center → Form 8821: who still needs one, signatures, IRS upload and on-file tracking. */
export function Form8821Tab() {
  const tax = useTax();
  const toast = useToast();
  const can = tax.access.edit;
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState<F8821 | null>(null);
  const [filter, setFilter] = useState<F8821Status | "all">("all");
  const load = () => call<Data>("GET", "/api/tax/8821").then(setD).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load", "info"));
  useEffect(() => { if (BACKEND) load(); }, []);

  const counts = useMemo(() => Object.fromEntries(ORDER.map((s) => [s, d?.forms.filter((f) => f.status === s).length ?? 0])) as Record<F8821Status, number>, [d]);
  const shown = useMemo(() => (d?.forms ?? []).filter((f) => filter === "all" || f.status === filter).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.clientName.localeCompare(b.clientName)), [d, filter]);

  if (!BACKEND) return <Card className="p-8 text-center text-muted">Form 8821 tracking works in the live CRM (preview or production).</Card>;
  if (!d) return <Card className="p-8 text-center text-muted">Loading…</Card>;

  const prepare = async (body: object, msg: (n: number) => string) => {
    setBusy(true);
    try { const r = await call<{ created: number }>("POST", "/api/tax/8821", body); toast(msg(r.created)); await load(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't prepare", "info"); }
    setBusy(false);
  };
  const mark = async (f: F8821, to: F8821Status, msg: string) => {
    if (to === "revoked" && !confirm(`Revoke ${f.clientName}'s Form 8821? You'll need a new signed form to pull their transcripts.`)) return;
    try { await call("POST", `/api/tax/8821/${f.id}/status`, { to }); toast(msg); await load(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't update", "info"); }
  };
  const download = (f: F8821) => { const a = document.createElement("a"); a.href = `/api/tax/8821/${f.id}/file`; a.click(); };

  return (
    <div className="space-y-5">
      {!d.designeeReady && (
        <div role="note" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft/50 px-4 py-3 text-[13.5px] text-ink">
          <AlertTriangle size={17} className="text-warning-ink" />
          <span className="flex-1">Add your designee details (name, address and CAF number) before downloading forms.</span>
          <Button size="sm" href="/settings#designee">Open Settings</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Missing", d.missing.length, "danger"], ...ORDER.map((s) => [STATUS_LABEL[s], counts[s], TONE[s]])].map(([l, n]) => (
          <Card key={String(l)} className="p-4"><span className="block text-[24px] font-bold text-ink">{n as number}</span><span className="text-[12.5px] text-muted">{l as string}</span></Card>
        ))}
      </div>

      {d.missing.length > 0 && (
        <Card>
          <CardHeader icon={FilePlus2} title={`Tax clients without a Form 8821 (${d.missing.length})`} subtitle="New tax returns get one automatically. Prepare forms for existing clients here." action={can ? <Button size="sm" variant="primary" disabled={busy} onClick={() => prepare({ all: true }, (n) => `Prepared ${n} form${n === 1 ? "" : "s"}`)}>Prepare all</Button> : undefined} />
          <ul className="divide-y divide-line border-t border-line">
            {d.missing.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
                <Link href={`/clients/${m.id}`} className="flex-1 truncate text-[14px] font-medium text-ink hover:text-accent">{m.name}</Link>
                <span className="text-[12px] text-muted">{m.type === "business" ? "Business" : "Individual"}</span>
                {can && <Button size="sm" disabled={busy} onClick={() => prepare({ clientId: m.id }, () => `Form 8821 prepared for ${m.name}`)}>Prepare</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader icon={FileSignature} title="Form 8821 — Tax Information Authorization" subtitle="Lets you pull IRS transcripts and get copies of notices. Upload signed forms at the IRS (you sign in there), then mark them submitted." action={<Button size="sm" icon={ExternalLink} onClick={() => window.open(IRS_SUBMIT_URL, "_blank", "noopener")}>IRS submission page</Button>} />
        <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6">
          {(["all", ...ORDER] as const).map((s) => <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${filter === s ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{s === "all" ? "All" : STATUS_LABEL[s]}</button>)}
        </div>
        {shown.length === 0 ? <p className="border-t border-line px-6 py-8 text-center text-[13.5px] text-muted">No forms in this view.</p> : (
          <ul className="divide-y divide-line border-t border-line">
            {shown.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                  <Link href={`/clients/${f.clientId}`} className="truncate text-[14px] font-medium text-ink hover:text-accent">{f.clientName}</Link>
                  <p className="text-[12px] text-muted">
                    Tax years {f.yearsFrom}–{f.yearsTo} · {f.matters.map((m) => m.type).join(", ")}
                    {f.signedAt ? ` · signed ${fmtDate(f.signedAt)} by ${f.signerName}` : ` · prepared ${fmtDate(f.createdAt)}`}
                    {f.submittedAt ? ` · submitted ${fmtDate(f.submittedAt)}` : ""}{f.onFileAt ? ` · on file ${fmtDate(f.onFileAt)}` : ""}
                  </p>
                </div>
                <Badge tone={TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" icon={Download} disabled={!d.designeeReady} onClick={() => download(f)}>{f.status === "needs_signature" ? "Form to sign" : "IRS-ready PDF"}</Button>
                  {can && f.status === "needs_signature" && <Button size="sm" variant="primary" icon={FileSignature} onClick={() => setSigning(f)}>Record signature</Button>}
                  {can && f.status === "signed" && <Button size="sm" variant="primary" icon={Send} onClick={() => mark(f, "submitted", "Marked submitted to the IRS")}>Mark submitted</Button>}
                  {can && f.status === "submitted" && <Button size="sm" variant="primary" icon={CheckCircle2} onClick={() => mark(f, "on_file", "Marked on file — you can pull transcripts")}>Mark on file</Button>}
                  {can && <Button size="sm" variant="ghost" icon={XCircle} aria-label={`Revoke ${f.clientName}'s Form 8821`} onClick={() => mark(f, "revoked", "Form 8821 revoked")}>Revoke</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-start gap-1.5 border-t border-line px-5 py-3 text-[12px] text-muted sm:px-6">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" /> The IRS-ready PDF shows the full SSN or EIN, so it needs the reveal permission and every download is logged. The copy saved in the client&rsquo;s Documents shows only the last four digits.
        </p>
      </Card>

      <SignDialog f={signing} onClose={() => setSigning(null)} onDone={() => { setSigning(null); load(); }} />
    </div>
  );
}

function SignDialog({ f, onClose, onDone }: { f: F8821 | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [method, setMethod] = useState<"in_office" | "paper">("in_office");
  const [idCheck, setIdCheck] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (f) { setName(f.clientType === "individual" ? f.clientName : ""); setTitle(""); setMethod("in_office"); setIdCheck(""); } }, [f]);
  const save = async () => {
    if (!f) return;
    setBusy(true);
    try { await call("POST", `/api/tax/8821/${f.id}/sign`, { name, title, method, idCheck }); toast("Signature recorded — signed copy saved to Documents"); onDone(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't record", "info"); }
    setBusy(false);
  };
  const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink";
  return (
    <Modal open={!!f} onClose={onClose} title="Record Form 8821 signature" description={f ? `${f.clientName} · tax years ${f.yearsFrom}–${f.yearsTo}` : ""} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || name.trim().length < 2} onClick={save}>{busy ? "Saving…" : "Record signature"}</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-[13.5px]"><input type="radio" name="f8821-m" checked={method === "in_office"} onChange={() => setMethod("in_office")} className="accent-[var(--accent)]" />Signed in the office</label>
          <label className="flex items-center gap-2 text-[13.5px]"><input type="radio" name="f8821-m" checked={method === "paper"} onChange={() => setMethod("paper")} className="accent-[var(--accent)]" />Signed on paper (ink)</label>
        </div>
        <div><label htmlFor="f8821-name" className="mb-1 block text-[13px] font-medium text-ink-2">{f?.clientType === "business" ? "Officer or partner who signed" : "Taxpayer's full name as signed"}</label><input id="f8821-name" value={name} onChange={(e) => setName(e.target.value)} className={input} /></div>
        {f?.clientType === "business" && <div><label htmlFor="f8821-title" className="mb-1 block text-[13px] font-medium text-ink-2">Title</label><input id="f8821-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Owner, President, Managing member…" className={input} /></div>}
        <div><label htmlFor="f8821-id" className="mb-1 block text-[13px] font-medium text-ink-2">How you checked their ID {method === "paper" && <span className="font-normal text-muted">(optional for ink signatures)</span>}</label><input id="f8821-id" value={idCheck} onChange={(e) => setIdCheck(e.target.value)} placeholder="e.g. Louisiana driver's license, checked in person" className={input} /></div>
        <p className="text-[12.5px] text-muted">{method === "paper" ? "Upload the scanned ink-signed form to the IRS (or fax it). A copy with the last four digits is saved to Documents." : "The IRS accepts electronic signatures on 8821s uploaded through its online submission page, once you've verified the signer's identity."}</p>
      </div>
    </Modal>
  );
}
