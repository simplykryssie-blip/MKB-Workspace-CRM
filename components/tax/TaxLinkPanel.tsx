"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Mail, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { fmtDate, relTime } from "@/lib/format";
import type { TaxReturn } from "@/lib/tax/config";
import type { LinkInfo } from "@/lib/server/secure-links";

const STATE: Record<LinkInfo["state"], string> = { active: "Active", expired: "Expired", cancelled: "Cancelled", used: "Submitted" };

/** Send the client a private link to fill in this return's interview themselves (no portal login). */
export function TaxLinkPanel({ r }: { r: TaxReturn }) {
  const toast = useToast();
  const client = useClients().clients.find((c) => c.id === r.clientId);
  const [link, setLink] = useState<LinkInfo | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const load = () => call<{ link: LinkInfo | null }>("GET", `/api/tax/returns/${r.id}/link`).then((x) => setLink(x.link)).catch(() => setLink(null));
  useEffect(() => { if (BACKEND) load(); }, [r.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const submitted = r.organizer.status === "submitted" || r.organizer.status === "reviewed";
  if (!BACKEND || r.form === "990" || (submitted && !link)) return null;
  const active = link?.state === "active";
  const send = async () => {
    setBusy(true);
    try {
      const x = await call<{ link: LinkInfo; emailed: boolean; url: string }>("POST", `/api/tax/returns/${r.id}/link`, { email });
      setSentUrl(x.url); setLink(x.link);
      toast(x.emailed ? `Interview link emailed to ${x.link.email}` : "Link created — the email is queued");
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send the link", "info"); }
    setBusy(false);
  };
  const cancel = async () => {
    if (!window.confirm("Cancel this link? It stops working right away. Answers already saved are kept.")) return;
    try { await call("POST", `/api/tax/returns/${r.id}/link/cancel`); toast("Link cancelled"); load(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't cancel", "info"); }
  };
  // The return changed on the server (the client's answers / sent status): reload to see it.
  const close = () => { setOpen(false); if (sentUrl) window.location.reload(); };
  return (
    <>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Link2 size={18} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1 text-[13px]">
          {!link ? <p className="text-ink-2">Let the client fill in the interview themselves: email them a private link (no portal login).</p> : (
            <>
              <p className="font-medium text-ink">Interview link · {STATE[link.state]}{active ? ` until ${fmtDate(link.expiresAt)}` : ""}</p>
              <p className="text-muted">Sent to {link.email} {relTime(link.sentAt)} · {link.openedAt ? `opened ${relTime(link.lastOpenedAt ?? link.openedAt)}` : "not opened yet"}{active ? " · their answers save to this return — reload to see them" : ""}</p>
            </>
          )}
        </div>
        {!submitted && (
          <div className="flex flex-wrap gap-2">
            {active && <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => window.location.reload()}>Reload answers</Button>}
            {active && <Button size="sm" variant="ghost" icon={XCircle} onClick={cancel}>Cancel link</Button>}
            <Button size="sm" variant={active ? "secondary" : "primary"} icon={Mail} onClick={() => { setSentUrl(null); setEmail(link?.email || client?.email || ""); setOpen(true); }}>{link ? "Send a new link" : "Send interview link"}</Button>
          </div>
        )}
      </Card>
      <Modal open={open} onClose={close} title="Send interview link" description={`The client fills in their ${r.taxYear} interview on their phone or computer, signs${r.organizer.engagement ? "" : " the engagement letter"} and submits — no portal login.`}
        footer={sentUrl ? <Button variant="primary" onClick={close}>Done</Button> : <><Button onClick={close}>Cancel</Button><Button variant="primary" icon={Mail} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email the link"}</Button></>}>
        {sentUrl ? (
          <div className="space-y-3 text-[13.5px] text-ink-2">
            <p>Sent to <b>{email}</b>. The link works for 14 days, only for this return, and stops once they submit.</p>
            <p className="text-[12.5px] text-muted">Need to text it instead? Copy it now — it isn&rsquo;t shown again. Only send it to the client.</p>
            <Button size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(sentUrl).then(() => toast("Link copied"), () => toast("Couldn't copy", "info"))}>Copy link</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-[13px] font-medium text-ink-2">Client&rsquo;s email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /></label>
            <ul className="space-y-1.5 text-[12.5px] text-muted">
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />Long and random; opens only this return&rsquo;s interview; expires in 14 days; you can cancel it anytime; stops once submitted.</li>
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />SSN, EIN and bank numbers go straight to encrypted storage. They can check a number while typing it; after saving, only the last 4 show.</li>
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />When they submit: documents are requested, the return moves to Awaiting Documents, the signed PDFs are saved and you get a bell.</li>
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
