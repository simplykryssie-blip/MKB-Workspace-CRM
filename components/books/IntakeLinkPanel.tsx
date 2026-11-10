"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Mail, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { call } from "@/lib/sync/remote";
import { fmtDate, relTime } from "@/lib/format";
import type { BooksIntake } from "@/lib/server/books-intake";
import type { LinkInfo } from "@/lib/server/secure-links";

const STATE: Record<LinkInfo["state"], string> = { active: "Active", expired: "Expired", cancelled: "Cancelled", used: "Submitted" };

/**
 * Send intake link: emails the client a private link to fill in this intake
 * themselves on their phone or computer — no portal login. Shows the link's
 * status, and lets staff resend or cancel it.
 */
export function IntakeLinkPanel({ intake, defaultEmail, beforeSend, reload }: { intake: BooksIntake; defaultEmail: string; beforeSend: () => Promise<void>; reload: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const link = intake.link;
  // Opened from a client's profile with "Send intake link": go straight to the send window.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("send") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    setOpen(true);
  }, []);
  const active = link?.state === "active";

  const send = async () => {
    setBusy(true);
    try {
      // Save what's on screen first (including details pre-filled from the client's profile).
      await beforeSend();
      const r = await call<{ link: LinkInfo; emailed: boolean; url: string }>("POST", `/api/books/intakes/${intake.id}/link`, { email });
      setSentUrl(r.url);
      toast(r.emailed ? `Intake link emailed to ${r.link.email}` : `Link created — the email is queued (not sent yet)`);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send the link", "info"); }
    setBusy(false);
  };
  const cancel = async () => {
    if (!window.confirm("Cancel this link? It stops working right away. Answers already saved are kept.")) return;
    try { await call("POST", `/api/books/intakes/${intake.id}/link/cancel`); toast("Link cancelled"); reload(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't cancel the link", "info"); }
  };
  const close = () => { setOpen(false); if (sentUrl) { setSentUrl(null); reload(); } };

  return (
    <>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Link2 size={18} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1 text-[13px]">
          {!link ? <p className="text-ink-2">Let the client fill this in themselves: email them a private link (no portal login).</p> : (
            <>
              <p className="font-medium text-ink">Secure link · {STATE[link.state]}{active ? ` until ${fmtDate(link.expiresAt)}` : ""}</p>
              <p className="text-muted">Sent to {link.email} {relTime(link.sentAt)} · {link.openedAt ? `opened ${relTime(link.lastOpenedAt ?? link.openedAt)}` : "not opened yet"}{active ? " · the client's answers appear here as they save — reload to see them" : ""}</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {active && <Button size="sm" variant="ghost" icon={RefreshCw} onClick={reload}>Reload answers</Button>}
          {active && <Button size="sm" variant="ghost" icon={XCircle} onClick={cancel}>Cancel link</Button>}
          <Button size="sm" variant={active ? "secondary" : "primary"} icon={Mail} onClick={() => { setEmail(defaultEmail || link?.email || ""); setOpen(true); }}>{link ? "Send a new link" : "Send intake link"}</Button>
        </div>
      </Card>
      <Modal open={open} onClose={close} title="Send intake link" description="The client fills in this intake on their phone or computer, signs and submits — no portal login. You then review the price and send the proposal."
        footer={sentUrl ? <Button variant="primary" onClick={close}>Done</Button> : <><Button onClick={close}>Cancel</Button><Button variant="primary" icon={Mail} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email the link"}</Button></>}>
        {sentUrl ? (
          <div className="space-y-3 text-[13.5px] text-ink-2">
            <p>Sent to <b>{email}</b>. The link works for 14 days, only for this intake, and stops once they submit.</p>
            <p className="text-[12.5px] text-muted">Need to text it instead? Copy it now — it isn&rsquo;t shown again. Only send it to the client.</p>
            <Button size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(sentUrl).then(() => toast("Link copied"), () => toast("Couldn't copy", "info"))}>Copy link</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="il-email" className="mb-1 block text-[13px] font-medium text-ink-2">Client&rsquo;s email</label>
              <input id="il-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
            </div>
            <ul className="space-y-1.5 text-[12.5px] text-muted">
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />Long and random; opens only this intake; expires in 14 days; you can cancel it anytime; it stops working once they submit.</li>
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />EIN and bank numbers go straight to encrypted storage. They can check a number while typing it, but after saving the link only ever shows the last 4. They sign with a drawn signature.</li>
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />Not a portal login: the link is only for this intake. After submitting, they upload their documents in the client portal.</li>
              {active && <li className="flex gap-2"><XCircle size={14} className="mt-0.5 shrink-0 text-warning-ink" />Sending a new link cancels the one sent {relTime(link!.sentAt)}.</li>}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
