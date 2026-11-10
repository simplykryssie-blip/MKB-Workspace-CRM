"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Copy, Mail, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { booksStage, STAGE_LABEL } from "@/lib/books/proposal";
import { relTime } from "@/lib/format";
import type { BooksIntake } from "@/lib/server/books-intake";
import type { Lead } from "@/lib/types";

type Data = { prospect: { clientId: string; status: string; leadStatus: string } | null; intakes: BooksIntake[] };

/** The lead's intake forms (sent before they're a client). */
export function useLeadIntakes(leadId: string) {
  const [data, setData] = useState<Data | null>(BACKEND ? null : { prospect: null, intakes: [] });
  const load = useCallback(() => { if (BACKEND) call<Data>("GET", `/api/leads/${leadId}/intakes`).then(setData).catch(() => setData({ prospect: null, intakes: [] })); }, [leadId]);
  useEffect(() => { load(); }, [load]);
  return { data, reload: load, hasProspect: data?.prospect?.status === "prospect" };
}

const badge = (i: BooksIntake) => {
  const st = booksStage(i);
  if (st === "in_progress") return i.link?.state === "active" ? <Badge tone="warning">{i.link.openedAt ? "Lead filling in" : "Link sent"}</Badge> : i.link?.state === "expired" ? <Badge tone="warning">Link expired</Badge> : <Badge tone="warning">In progress</Badge>;
  return <Badge tone={st === "signed" ? "success" : st === "in_review" ? "info" : "warning"}>{STAGE_LABEL[st]}</Badge>;
};

/**
 * Lead page: send the lead an intake by private link before they're a client,
 * follow its progress, then Accept as client (everything moves onto the new
 * client record) or Decline.
 */
export function LeadIntakesCard({ lead, intakes: h }: { lead: Lead; intakes: ReturnType<typeof useLeadIntakes> }) {
  const toast = useToast();
  const team = useTeam();
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState(lead.email ?? "");
  const [busy, setBusy] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  if (!BACKEND) return null;
  const open = lead.status === "open";
  const d = h.data;
  const list = d?.intakes ?? [];
  const canSend = team.can("leads", "edit") && team.can("books", "edit");
  const submitted = list.some((i) => i.status === "submitted");
  const hasOpenIntake = list.some((i) => i.status === "in_progress");

  const send = async () => {
    setBusy(true);
    try {
      const r = await call<{ url: string; emailed: boolean }>("POST", `/api/leads/${lead.id}/intakes`, { kind: "books", email });
      setSentUrl(r.url);
      toast(r.emailed ? `Bookkeeping intake emailed to ${email}` : "Intake link created — the email is queued");
      h.reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send", "info"); }
    setBusy(false);
  };
  const accept = async () => {
    if (!window.confirm(`Accept ${lead.name} as a client? Their intake answers, signed PDF, document requests and anything else on file move onto their new client record.`)) return;
    setBusy(true);
    try {
      const r = await call<{ clientId: string }>("POST", `/api/leads/${lead.id}/accept`);
      toast(`${lead.name} is now a client`);
      window.location.assign(`/clients/${r.clientId}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't accept", "info"); setBusy(false); }
  };
  const decline = async () => {
    setBusy(true);
    try {
      await call("POST", `/api/leads/${lead.id}/decline`, { reason });
      toast("Lead declined — their links no longer work");
      window.location.reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't decline", "info"); setBusy(false); }
  };

  return (
    <Card>
      <CardHeader icon={ClipboardList} title="Intake forms" subtitle="Send intake forms before accepting them as a client. They aren't added to Clients until you accept." action={open && canSend && !hasOpenIntake && !submitted ? <Button size="sm" variant="primary" icon={Mail} onClick={() => { setSentUrl(null); setEmail(lead.email ?? ""); setSending(true); }}>Send bookkeeping intake</Button> : undefined} />
      {d === null ? <p className="border-t border-line px-6 py-4 text-[13px] text-muted">Loading…</p> : list.length === 0 ? (
        <p className="border-t border-line px-6 py-4 text-[13.5px] text-muted">{open ? "No intake sent yet. They fill it in on their phone or computer, sign and submit — no login." : "No intake forms."}</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {list.map((i) => (
            <li key={i.id}>
              <Link href={`/services/bookkeeping/intake/${i.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6">
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink">Bookkeeping intake{typeof i.answers.legalName === "string" && i.answers.legalName ? ` — ${i.answers.legalName}` : ""}</span><span className="block text-[12px] text-muted">{i.status === "submitted" ? `Submitted ${i.submittedAt ? relTime(i.submittedAt) : ""} — review the answers` : `Sent to ${i.link?.email ?? "the lead"} · updated ${relTime(i.updatedAt)}`}</span></span>
                {badge(i)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open && h.hasProspect && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 sm:px-6">
          <span className="mr-auto text-[12.5px] text-muted">{submitted ? "Reviewed their answers? Accept them as a client, or decline." : "You can accept or decline at any time; most firms wait for the submitted intake."}</span>
          <Button size="sm" icon={XCircle} disabled={busy} onClick={() => { setReason(""); setDeclining(true); }}>Decline</Button>
          <Button size="sm" variant="primary" icon={UserCheck} disabled={busy || !team.can("crm", "create")} onClick={accept}>Accept as client</Button>
        </div>
      )}

      <Modal open={sending} onClose={() => setSending(false)} title="Send bookkeeping intake" description="The lead fills it in on their phone or computer, signs and submits — no login, and they aren't a client yet."
        footer={sentUrl ? <Button variant="primary" onClick={() => setSending(false)}>Done</Button> : <><Button onClick={() => setSending(false)}>Cancel</Button><Button variant="primary" icon={Mail} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email the intake"}</Button></>}>
        {sentUrl ? (
          <div className="space-y-3 text-[13.5px] text-ink-2">
            <p>Sent to <b>{email}</b>. The link works for 14 days and closes once they submit.</p>
            <p className="text-[12.5px] text-muted">Need to text it instead? Copy it now — it isn&rsquo;t shown again. Only send it to the lead.</p>
            <Button size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(sentUrl).then(() => toast("Link copied"), () => toast("Couldn't copy", "info"))}>Copy link</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-[13px] font-medium text-ink-2">Lead&rsquo;s email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /></label>
            <ul className="space-y-1.5 text-[12.5px] text-muted">
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />Same private link as for clients: opens only this intake, expires in 14 days, can be cancelled, closes once submitted. EIN and bank numbers are encrypted.</li>
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />They&rsquo;re not added to Clients. After you review, Accept as client moves everything onto their new client record; Decline closes it.</li>
            </ul>
          </div>
        )}
      </Modal>
      <Modal open={declining} onClose={() => setDeclining(false)} title="Decline this lead?" description="Their intake and proposal links stop working and the lead is marked lost. They never appear in Clients. You can reopen the lead later."
        footer={<><Button onClick={() => setDeclining(false)}>Cancel</Button><Button variant="primary" icon={XCircle} disabled={busy} onClick={decline}>Decline lead</Button></>}>
        <label className="block text-[13px] font-medium text-ink-2">Reason (for your records)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not a fit for our services" className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /></label>
      </Modal>
    </Card>
  );
}
