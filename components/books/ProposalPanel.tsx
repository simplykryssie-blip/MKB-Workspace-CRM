"use client";

import { useMemo, useState } from "react";
import { Copy, FileSignature, Mail, Plus, RotateCcw, Save, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { call, RemoteError } from "@/lib/sync/remote";
import { useServiceFees } from "@/lib/fees/use-fees";
import { money } from "@/lib/fees/config";
import { quoteFor } from "@/lib/books/intake";
import { BILLING_LABEL, booksStage, lineId, proposalFromQuote, proposalTotals, STAGE_LABEL, type ProposalBilling, type ProposalLine } from "@/lib/books/proposal";
import { fmtDate, relTime } from "@/lib/format";
import type { BooksIntake } from "@/lib/server/books-intake";
import type { Client } from "@/lib/types";

/**
 * Review → proposal → signature. After the client submits, MKB checks the
 * price (starting from the automatic quote and its reasons), adjusts it, and
 * emails the proposal with the engagement letter to sign. Changing a sent or
 * signed price makes a new version the client has to sign again.
 */
export function ProposalPanel({ intake, client, reload }: { intake: BooksIntake; client: Client; reload: () => void }) {
  const toast = useToast();
  const F = useServiceFees();
  const auto = useMemo(() => (F.fees ? quoteFor(intake.answers, F.fees.books) : null), [F.fees, intake.answers]);
  const start = intake.proposal ?? (auto ? proposalFromQuote(auto, intake.updatedAt) : null);
  const [plan, setPlan] = useState(start?.plan ?? "");
  const [lines, setLines] = useState<ProposalLine[]>(start?.lines ?? []);
  const [message, setMessage] = useState(start?.message ?? "");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState((typeof intake.answers.email === "string" && intake.answers.email) || client.email || "");
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  if (!F.fees || !start) return <Card className="p-6 text-[13px] text-muted">Loading the price review…</Card>;
  const p = intake.proposal;
  const stage = booksStage(intake);
  const reviewed = !!p?.updatedBy;
  const dirty = !p || JSON.stringify([plan, lines.map((l) => [l.label, l.billing, l.amount, !!l.startingAt]), message.trim()]) !== JSON.stringify([p.plan, p.lines.map((l) => [l.label, l.billing, l.amount, !!l.startingAt]), p.message ?? ""]);
  const t = proposalTotals({ lines });
  const plans = F.fees.books.plans;
  const upd = (id: string, patch: Partial<ProposalLine>) => setLines((x) => x.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const pickPlan = (key: string) => {
    const np = plans.find((x) => x.key === key);
    if (!np) return;
    // Swap the plan line's name and price; everything else stays as reviewed.
    setLines((x) => x.map((l) => (l.billing === "monthly" && l.label === `${plan} plan` ? { ...l, label: `${np.key} plan`, amount: np.fee, startingAt: np.startingAt || undefined } : l)));
    setPlan(key);
  };
  const save = async () => {
    if (p && p.status !== "draft" && !window.confirm(p.status === "signed" ? "The client already signed this price. Saving makes a new version they must sign again (the signed letter stays on file). Continue?" : "This proposal was already sent. Saving cancels that link — you'll send the new version. Continue?")) return;
    setBusy(true);
    try {
      await call("PUT", `/api/books/intakes/${intake.id}/proposal`, { plan, lines, message, rev: intake.rev });
      toast("Price saved");
      reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); if (e instanceof RemoteError && e.status === 409) reload(); }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true);
    try {
      const r = await call<{ emailed: boolean; url: string }>("POST", `/api/books/intakes/${intake.id}/proposal/send`, { email });
      setSentUrl(r.url);
      toast(r.emailed ? `Proposal emailed to ${email}` : "Proposal link created — the email is queued");
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send", "info"); }
    setBusy(false);
  };
  const cancel = async () => {
    if (!window.confirm("Cancel the proposal link? It stops working right away and the proposal goes back to draft.")) return;
    try { await call("POST", `/api/books/intakes/${intake.id}/proposal/cancel`); toast("Proposal link cancelled"); reload(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't cancel", "info"); }
  };
  const reset = () => { if (!auto) return; const d = proposalFromQuote(auto, ""); setPlan(d.plan); setLines(d.lines); };
  const input = "h-9 rounded-lg border border-line bg-surface px-2 text-[13.5px] text-ink";
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[17px] font-bold text-ink"><FileSignature size={18} className="text-accent" /> Price review &amp; proposal</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">The client hasn&rsquo;t seen a price. Check it against their answers, adjust it, then send the proposal with the engagement letter to sign.</p>
        </div>
        <Badge tone={stage === "signed" ? "success" : stage === "proposal_sent" ? "info" : "warning"}>{STAGE_LABEL[stage]}{p && p.version > 1 ? ` · v${p.version}` : ""}</Badge>
      </div>

      {auto && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[12.5px] text-ink-2">
          <p><b>Automatic quote:</b> {auto.plan.key} · {money(auto.monthlyTotal)}/mo{auto.oneTimeTotal ? ` + ${money(auto.oneTimeTotal)} one-time` : ""} — a starting point only.</p>
          {!!auto.notes?.length && <ul className="mt-1 space-y-0.5 text-muted">{auto.notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-[13px] font-medium text-ink-2">Plan<br /><select value={plan} onChange={(e) => pickPlan(e.target.value)} className={`${input} mt-1 min-w-[220px]`}>{plans.map((x) => <option key={x.key} value={x.key}>{x.key} — {money(x.fee)}/mo · up to {x.transactions.toLocaleString()} transactions, {x.accounts} accounts</option>)}</select></label>
        {auto && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={reset}>Start over from the automatic quote</Button>}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13.5px]">
          <thead><tr className="text-left text-[12px] text-muted"><th className="py-1 font-medium">Description</th><th className="py-1 font-medium">Billing</th><th className="py-1 text-right font-medium">Amount</th><th className="py-1 text-center font-medium" title="Show as 'starting at'">From</th><th /></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="py-1.5 pr-2"><input aria-label="Description" value={l.label} onChange={(e) => upd(l.id, { label: e.target.value })} className={`${input} w-full`} /></td>
                <td className="py-1.5 pr-2"><select aria-label="Billing" value={l.billing} onChange={(e) => upd(l.id, { billing: e.target.value as ProposalBilling })} className={input}>{(Object.keys(BILLING_LABEL) as ProposalBilling[]).map((b) => <option key={b} value={b}>{BILLING_LABEL[b]}</option>)}</select></td>
                <td className="py-1.5 pr-2 text-right">{l.billing === "quote" ? <span className="text-muted">—</span> : <span className="inline-flex items-center gap-1">$<input aria-label="Amount" inputMode="decimal" value={String(l.amount)} onChange={(e) => upd(l.id, { amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className={`${input} w-24 text-right tabular-nums`} /></span>}</td>
                <td className="py-1.5 text-center"><input type="checkbox" aria-label="Starting at" checked={!!l.startingAt} onChange={() => upd(l.id, { startingAt: !l.startingAt || undefined })} className="h-4 w-4 accent-[var(--accent)]" /></td>
                <td className="py-1.5 text-right"><button aria-label={`Remove ${l.label}`} onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-danger-ink"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="ghost" icon={Plus} className="mt-1" onClick={() => setLines((x) => [...x, { id: lineId(), label: "", billing: "monthly", amount: 0 }])}>Add a line</Button>
      <p className="mt-2 text-[13.5px] text-ink">Monthly total: <b className="tabular-nums">{t.startingAt ? "from " : ""}{money(t.monthly)}/mo</b>{t.oneTime ? <> · one-time <b className="tabular-nums">{money(t.oneTime)}</b></> : null}{t.quoted.length ? ` · ${t.quoted.length} custom-quoted` : ""}{auto && t.monthly !== auto.monthlyTotal && <span className="text-muted"> (automatic quote {money(auto.monthlyTotal)}/mo)</span>}</p>
      <label className="mt-3 block text-[13px] font-medium text-ink-2">Note to the client (optional)<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="e.g. We moved you to Growth because of your monthly volume; your catch-up months will be quoted after we see your statements." className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13.5px] text-ink" /></label>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button icon={Save} disabled={busy || !dirty} onClick={save}>{dirty ? (p && p.status !== "draft" ? "Save new version" : "Save price") : "Saved"}</Button>
        <Button variant="primary" icon={Mail} disabled={busy || dirty || !reviewed || p?.status === "signed"} title={dirty ? "Save the price first" : !reviewed ? "Review and save the price first" : undefined} onClick={() => { setSentUrl(null); setSending(true); }}>{p?.status === "sent" ? "Send again" : "Send proposal & engagement letter"}</Button>
        {p?.status === "sent" && <Button icon={XCircle} variant="ghost" onClick={cancel}>Cancel link</Button>}
        {!reviewed && <span className="text-[12px] text-muted">Save the price after reviewing it to send.</span>}
      </div>
      {p?.status === "sent" && <p className="mt-2 text-[12.5px] text-muted">Sent to {p.sentTo} {p.sentAt ? relTime(p.sentAt) : ""}{intake.proposalLink ? ` · ${intake.proposalLink.openedAt ? `opened ${relTime(intake.proposalLink.lastOpenedAt ?? intake.proposalLink.openedAt)}` : "not opened yet"} · expires ${fmtDate(intake.proposalLink.expiresAt)}` : ""}.</p>}
      {p?.status === "signed" && <p className="mt-2 text-[12.5px] text-success-ink">Signed by {p.signedName} on {p.signedAt ? fmtDate(p.signedAt) : ""} (drawn signature). The signed proposal and engagement letter are in the client&rsquo;s Documents.</p>}
      {!!p?.previous?.length && <p className="mt-1 text-[12px] text-muted">Earlier signed versions: {p.previous.map((x) => `v${x.version} ${money(x.monthlyTotal)}/mo, signed ${fmtDate(x.signedAt)} by ${x.signedName}`).join("; ")}.</p>}

      <Modal open={sending} onClose={() => { setSending(false); if (sentUrl) reload(); }} title="Send proposal & engagement letter" description="The client opens a private link (no login) to see this price, read the engagement letter and sign with a drawn signature."
        footer={sentUrl ? <Button variant="primary" onClick={() => { setSending(false); reload(); }}>Done</Button> : <><Button onClick={() => setSending(false)}>Cancel</Button><Button variant="primary" icon={Mail} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email the proposal"}</Button></>}>
        {sentUrl ? (
          <div className="space-y-3 text-[13.5px] text-ink-2">
            <p>Sent to <b>{email}</b>. The link works for 14 days and closes once they sign. If you change the price, they&rsquo;ll need the new version.</p>
            <Button size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(sentUrl).then(() => toast("Link copied"), () => toast("Couldn't copy", "info"))}>Copy link</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-[13px] font-medium text-ink-2">Client&rsquo;s email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /></label>
            <p className="text-[13px] text-ink-2">They&rsquo;ll see: <b>{plan}</b> · {t.startingAt ? "from " : ""}{money(t.monthly)}/mo{t.oneTime ? ` + ${money(t.oneTime)} one-time` : ""}.</p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
