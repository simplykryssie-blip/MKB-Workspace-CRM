"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Download, PenLine, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { call } from "@/lib/sync/remote";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { Client, ServiceKey } from "@/lib/types";

export type SigItem = { id: string; service: ServiceKey; kind: string; kindLabel: string; title: string; status: "sent" | "signed" | "cancelled"; email?: string; sentAt: string; signedAt?: string; signedName?: string; pdfFileId?: string; link?: { openedAt?: string; expiresAt?: string } | null };
type Loaded = { requests: SigItem[]; intakes: { id: string; label: string; service: ServiceKey }[] };

/** Live CRM: documents sent to the client to sign online, with status, resend and cancel. */
export function LiveSignatures({ c }: { c: Client }) {
  const toast = useToast();
  const [d, setD] = useState<Loaded | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => call<Loaded>("GET", `/api/clients/${encodeURIComponent(c.id)}/signatures`).then(setD).catch((e) => { toast(e instanceof Error ? e.message : "Couldn't load signatures", "info"); setD({ requests: [], intakes: [] }); }), [c.id, toast]);
  useEffect(() => { void load(); }, [load]);
  const act = async (id: string, what: "resend" | "cancel") => {
    if (what === "cancel" && !confirm("Cancel this signature request? The client's link stops working.")) return;
    setBusy(id);
    try { await call("POST", `/api/signatures/${id}/${what}`, {}); toast(what === "resend" ? "New link emailed" : "Request cancelled"); await load(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't update", "info"); }
    setBusy(null);
  };
  return (
    <Card>
      <CardHeader title="Signatures" subtitle="Documents the client reads and signs online — signed copies go to Documents" action={<Button size="sm" variant="primary" icon={PenLine} onClick={() => setOpen(true)}>Send for signature</Button>} />
      {!d ? <p className="border-t border-line px-6 py-8 text-center text-muted">Loading…</p> : d.requests.length === 0 ? (
        <p className="border-t border-line px-6 py-8 text-center text-[13.5px] text-muted">No signature requests yet.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {d.requests.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{s.title}</span>
                <span className="block text-[12px] text-muted">{SERVICES[s.service].label} · {s.kindLabel} · sent {fmtDate(s.sentAt)}{s.email ? ` to ${s.email}` : ""}{s.status === "signed" && s.signedAt ? ` · signed ${fmtDateTime(s.signedAt)} by ${s.signedName}` : s.status === "sent" && s.link?.openedAt ? " · client opened it" : ""}</span>
              </span>
              <Badge tone={s.status === "signed" ? "success" : s.status === "cancelled" ? "neutral" : "warning"}>{s.status === "signed" ? "Signed" : s.status === "cancelled" ? "Cancelled" : "Waiting for signature"}</Badge>
              {s.status === "signed" && s.pdfFileId && <Button size="sm" variant="ghost" icon={Download} href={`/api/clients/${encodeURIComponent(c.id)}/files/${encodeURIComponent(s.pdfFileId)}?inline=1`}>Signed copy</Button>}
              {s.status === "sent" && <><Button size="sm" variant="ghost" icon={Send} disabled={busy === s.id} onClick={() => void act(s.id, "resend")}>Resend</Button><Button size="sm" variant="ghost" icon={Ban} disabled={busy === s.id} onClick={() => void act(s.id, "cancel")}>Cancel</Button></>}
            </li>
          ))}
        </ul>
      )}
      {d && <SendDialog c={c} open={open} intakes={d.intakes} onClose={() => setOpen(false)} onSent={() => { setOpen(false); void load(); }} />}
    </Card>
  );
}

function SendDialog({ c, open, intakes, onClose, onSent }: { c: Client; open: boolean; intakes: Loaded["intakes"]; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const svcs = [...new Set(c.enrollments.map((e) => e.service))];
  const [kind, setKind] = useState("engagement");
  const [service, setService] = useState<ServiceKey>(svcs[0] ?? "tax");
  const [intakeId, setIntakeId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(c.email ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setKind("engagement"); setService(svcs[0] ?? "tax"); setIntakeId(intakes[0]?.id ?? ""); setTitle(""); setBody(""); setMessage(""); setEmail(c.email ?? ""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && (kind !== "custom" || (title.trim() && body.trim().length >= 10)) && (kind !== "intake" || intakeId);
  const send = async () => {
    setBusy(true);
    try {
      const r = await call<{ emailed: boolean }>("POST", `/api/clients/${encodeURIComponent(c.id)}/signatures`, { kind, service, intakeId, title, body, message, email: email.trim() });
      toast(r.emailed ? `Sent to ${email.trim()} for signature` : "Request saved — the email is queued");
      onSent();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send", "info"); }
    setBusy(false);
  };
  const kinds: [string, string][] = [["engagement", "Engagement letter"], ["records_release", "Records release authorization (Expungement Relief)"], ["custom", "Custom document"], ...(intakes.length ? [["intake", "Manually entered intake — client reviews and signs"] as [string, string]] : [])];
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Send for signature" description="The client gets a private link by email, reads the document on their phone or computer, and signs. The signed PDF is saved to Documents and emailed to them." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Send} disabled={busy || !valid} onClick={() => void send()}>{busy ? "Sending…" : "Send"}</Button></>}>
      <div className="space-y-4">
        <SelectField id="sg-kind" label="What to send" value={kind} onChange={(e) => setKind(e.target.value)} options={kinds} />
        {kind === "engagement" && <SelectField id="sg-svc" label="Service" value={service} onChange={(e) => setService(e.target.value as ServiceKey)} options={(svcs.length ? svcs : SERVICE_ORDER).map((s) => [s, SERVICES[s].label] as [string, string])} />}
        {kind === "engagement" && <p className="-mt-2 text-[12px] text-muted">Uses the current letter wording from Settings → Engagement letters, plus the standard terms.</p>}
        {kind === "records_release" && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-muted">Lets MKB request arrest, court and criminal-history records for the client. Starting wording for your attorney to review.</p>}
        {kind === "intake" && <SelectField id="sg-intake" label="Intake" value={intakeId} onChange={(e) => setIntakeId(e.target.value)} options={intakes.map((i) => [i.id, i.label] as [string, string])} />}
        {kind === "intake" && <p className="-mt-2 text-[12px] text-muted">The client sees every answer you entered and signs to confirm they&rsquo;re correct.</p>}
        {kind === "custom" && (
          <>
            <SelectField id="sg-svc2" label="Service" value={service} onChange={(e) => setService(e.target.value as ServiceKey)} options={(svcs.length ? svcs : SERVICE_ORDER).map((s) => [s, SERVICES[s].label] as [string, string])} />
            <TextField id="sg-title" label="Document title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fee agreement addendum" />
            <TextArea id="sg-body" label="Document text" value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
            <p className="-mt-2 text-[12px] text-muted">Start a line with &ldquo;## &rdquo; for a heading or &ldquo;- &rdquo; for a bullet. Leave a blank line between paragraphs.</p>
          </>
        )}
        <TextField id="sg-email" label="Send to" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextArea id="sg-msg" label="Note to the client (optional)" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Please sign this before your consultation on Friday." />
      </div>
    </Modal>
  );
}
