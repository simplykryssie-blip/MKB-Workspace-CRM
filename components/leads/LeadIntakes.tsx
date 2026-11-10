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

type TaxItem = { id: string; taxYear: number; form: string; status: string; submittedAt?: string; updatedAt?: string; link: { email: string; state: string; openedAt?: string } | null; pdfFileId?: string };
type Data = { prospect: { clientId: string; status: string; leadStatus: string } | null; intakes: BooksIntake[]; taxReturns: TaxItem[] };

/** The lead's intake forms (sent before they're a client). */
export function useLeadIntakes(leadId: string) {
  const [data, setData] = useState<Data | null>(BACKEND ? null : { prospect: null, intakes: [], taxReturns: [] });
  const load = useCallback(() => { if (BACKEND) call<Data>("GET", `/api/leads/${leadId}/intakes`).then(setData).catch(() => setData({ prospect: null, intakes: [], taxReturns: [] })); }, [leadId]);
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
  const [sending, setSending] = useState<null | "books" | "tax">(null);
  const forms = lead.type === "business" ? ["1040 + Sch C", "1120-S", "1065", "1120"] : ["1040", "1040 + Sch C", "1040-X"];
  const FORM_HELP: Record<string, string> = {
    "1040 + Sch C": lead.type === "business" ? "Owner's personal return with Schedule C — sole proprietor or single-member LLC (most small LLCs)" : "Personal return with Schedule C (self-employed)",
    "1120-S": "S corporation, or an LLC that elected S-corp status",
    "1065": "Partnership or LLC with more than one owner",
    "1120": "C corporation",
    "1040": "Personal return",
    "1040-X": "Amended personal return",
  };
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);
  const [form, setForm] = useState(forms[0]);
  const [email, setEmail] = useState(lead.email ?? "");
  const [busy, setBusy] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  if (!BACKEND) return null;
  const open = lead.status === "open";
  const d = h.data;
  const list = d?.intakes ?? [];
  const taxList = d?.taxReturns ?? [];
  const canBooks = team.can("leads", "edit") && team.can("books", "edit") && !list.length;
  const canTax = team.can("leads", "edit") && team.can("tax", "create");
  const submitted = list.some((i) => i.status === "submitted") || taxList.some((t) => t.status === "submitted" || t.status === "reviewed");

  const send = async () => {
    setBusy(true);
    try {
      const r = await call<{ url: string; emailed: boolean }>("POST", `/api/leads/${lead.id}/intakes`, sending === "tax" ? { kind: "tax", email, taxYear, form } : { kind: "books", email });
      setSentUrl(r.url);
      toast(r.emailed ? `${sending === "tax" ? `${taxYear} tax interview` : "Bookkeeping intake"} emailed to ${email}` : "Link created — the email is queued");
      h.reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send", "info"); }
    setBusy(false);
  };
  const accept = async () => {
    if (!window.confirm(`Accept ${lead.name} as a client? Their intake and interview answers, signed PDFs, tax return, document requests and anything else on file move onto their new client record.`)) return;
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
      <CardHeader icon={ClipboardList} title="Intake forms" subtitle="Send the bookkeeping intake or tax interview before accepting them as a client. They aren't added to Clients until you accept." action={open && (canBooks || canTax) ? (
        <div className="flex flex-wrap justify-end gap-2">
          {canBooks && <Button size="sm" variant="primary" icon={Mail} onClick={() => { setSentUrl(null); setEmail(lead.email ?? ""); setSending("books"); }}>Bookkeeping intake</Button>}
          {canTax && <Button size="sm" variant="primary" icon={Mail} onClick={() => { setSentUrl(null); setEmail(lead.email ?? ""); setSending("tax"); }}>Tax interview</Button>}
        </div>
      ) : undefined} />
      {taxList.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {taxList.map((t) => {
            const done = t.status === "submitted" || t.status === "reviewed";
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink">{t.taxYear} tax interview ({t.form})</span><span className="block text-[12px] text-muted">{done ? `Submitted ${t.submittedAt ? relTime(t.submittedAt) : ""} — review the signed PDF` : t.link ? `Sent to ${t.link.email}${t.link.openedAt ? " · opened" : ""}${t.updatedAt ? ` · updated ${relTime(t.updatedAt)}` : ""}` : "Not sent"}</span></span>
                {done && t.pdfFileId && d?.prospect && <Button size="sm" href={`/api/clients/${d.prospect.clientId}/files/${t.pdfFileId}`}>View answers (PDF)</Button>}
                {done ? <Badge tone="info">Submitted — review</Badge> : t.link?.state === "active" ? <Badge tone="warning">{t.link.openedAt ? "Lead filling in" : "Link sent"}</Badge> : t.link?.state === "expired" ? <Badge tone="warning">Link expired</Badge> : <Badge tone="warning">Not sent</Badge>}
              </li>
            );
          })}
        </ul>
      )}
      {d === null ? <p className="border-t border-line px-6 py-4 text-[13px] text-muted">Loading…</p> : list.length === 0 ? (taxList.length ? null : (
        <p className="border-t border-line px-6 py-4 text-[13.5px] text-muted">{open ? "No intake sent yet. They fill it in on their phone or computer, sign and submit — no login." : "No intake forms."}</p>
      )) : (
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

      <Modal open={!!sending} onClose={() => setSending(null)} title={sending === "tax" ? "Send tax interview" : "Send bookkeeping intake"} description={`The lead fills it in on their phone or computer, signs${sending === "tax" ? " the engagement letter" : ""} and submits — no login, and they aren't a client yet.`}
        footer={sentUrl ? <Button variant="primary" onClick={() => setSending(null)}>Done</Button> : <><Button onClick={() => setSending(null)}>Cancel</Button><Button variant="primary" icon={Mail} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email the intake"}</Button></>}>
        {sentUrl ? (
          <div className="space-y-3 text-[13.5px] text-ink-2">
            <p>Sent to <b>{email}</b>. The link works for 14 days and closes once they submit.</p>
            <p className="text-[12.5px] text-muted">Need to text it instead? Copy it now — it isn&rsquo;t shown again. Only send it to the lead.</p>
            <Button size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(sentUrl).then(() => toast("Link copied"), () => toast("Couldn't copy", "info"))}>Copy link</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sending === "tax" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[13px] font-medium text-ink-2">Tax year<select value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">{[0, 1, 2, 3].map((n) => { const y = new Date().getFullYear() - 1 - n; return <option key={y} value={y}>{y}</option>; })}</select></label>
                <label className="block text-[13px] font-medium text-ink-2">Return<select value={form} onChange={(e) => setForm(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">{forms.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
                <p className="col-span-2 -mt-1 text-[12.5px] text-muted">{FORM_HELP[form]}{lead.type === "business" && form === "1040 + Sch C" ? `. They get the personal interview (with the Schedule C questions for ${lead.name}); the record becomes ${lead.contactName || "the owner"}, keeping the business on it.` : ""}</p>
              </div>
            )}
            <label className="block text-[13px] font-medium text-ink-2">Lead&rsquo;s email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /></label>
            <ul className="space-y-1.5 text-[12.5px] text-muted">
              <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />Same private link as for clients: opens only this form, expires in 14 days, can be cancelled, closes once submitted. SSN, EIN and bank numbers are encrypted.</li>
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
