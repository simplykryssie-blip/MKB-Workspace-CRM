"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Eye, FileSignature, Info, Mail, Plus, RotateCcw, Save, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { call, RemoteError } from "@/lib/sync/remote";
import { useServiceFees } from "@/lib/fees/use-fees";
import { money, quarterlyOf, QUARTERLY_TERMS } from "@/lib/fees/config";
import { quoteFor } from "@/lib/books/intake";
import { booksStage, isQuarterly, lineId, proposalFromQuote, proposalTotals, recurring, STAGE_LABEL, type ProposalBilling, type ProposalLine } from "@/lib/books/proposal";
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
  // Fees can arrive after the first render: start from the quote once it exists (only if nothing is filled in yet).
  const startKey = start ? `${start.plan}|${start.version}|${start.updatedAt}` : "";
  useEffect(() => {
    if (!start || plan) return;
    setPlan(start.plan); setLines(start.lines); setMessage(start.message ?? "");
  }, [startKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!F.fees || !start) return <Card className="p-6 text-[13px] text-muted">Loading the price review…</Card>;
  const p = intake.proposal;
  const stage = booksStage(intake);
  const reviewed = !!p?.updatedBy;
  const dirty = !p || JSON.stringify([plan, lines.map((l) => [l.label, l.billing, l.amount, !!l.startingAt]), message.trim()]) !== JSON.stringify([p.plan, p.lines.map((l) => [l.label, l.billing, l.amount, !!l.startingAt]), p.message ?? ""]);
  const t = proposalTotals({ lines });
  const plans = F.fees.books.plans;
  const disc = F.fees.books.quarterlyDiscountPct ?? 20;
  const quarterly = isQuarterly({ lines });
  const rec = recurring({ lines });
  // Switch the recurring lines between monthly and quarterly (3 months less the quarterly discount).
  const switchCadence = () => setLines((x) => x.map((l) => quarterly
    ? (l.billing === "quarterly" ? { ...l, billing: "monthly" as const, amount: Math.round(l.amount / (3 * (1 - disc / 100))) } : l)
    : (l.billing === "monthly" ? { ...l, billing: "quarterly" as const, amount: quarterlyOf(l.amount, disc) } : l)));
  const upd = (id: string, patch: Partial<ProposalLine>) => setLines((x) => x.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const pickPlan = (key: string) => {
    const np = plans.find((x) => x.key === key);
    if (!np) return;
    // Swap the plan line's name and price; everything else stays as reviewed.
    setLines((x) => x.map((l) => ((l.billing === "monthly" || l.billing === "quarterly") && l.label === `${plan} plan` ? { ...l, label: `${np.key} plan`, amount: l.billing === "quarterly" ? quarterlyOf(np.fee, disc) : np.fee, startingAt: np.startingAt || undefined } : l)));
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
          <p className="mt-0.5 text-[12.5px] text-muted">The client hasn&rsquo;t seen any price yet. Check the price below, save it, then send it for their signature.</p>
        </div>
        <Badge tone={stage === "signed" ? "success" : stage === "proposal_sent" ? "info" : "warning"}>{STAGE_LABEL[stage]}{p && p.version > 1 ? ` · v${p.version}` : ""}</Badge>
      </div>

      {/* Where you are: 1 review → 2 save → 3 send → signed. */}
      <ol className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
        {([
          ["1", "Review the price", true],
          ["2", "Save it", reviewed && !dirty],
          ["3", "Send to sign", p?.status === "sent" || p?.status === "signed"],
        ] as const).map(([n, label, done]) => (
          <li key={n} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${done ? "bg-success-soft/60 text-success-ink" : "bg-surface-2 text-muted"}`}>
            {done ? <CheckCircle2 size={14} /> : <span className="grid h-4 w-4 place-items-center rounded-full border border-current text-[10px] font-bold">{n}</span>}
            <span className="font-semibold">{label}</span>
          </li>
        ))}
      </ol>

      {auto && (
        <details className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[12.5px] text-ink-2" open={!reviewed}>
          <summary className="cursor-pointer font-semibold text-ink"><Info size={13} className="mr-1 inline" />Why the CRM suggested this price</summary>
          <p className="mt-1.5">From their answers: <b>{auto.plan.key}</b> plan ({auto.plan.transactions.toLocaleString()} transactions, {auto.plan.accounts} accounts){auto.cadence === "quarterly" ? ", billed quarterly" : ""}. It&rsquo;s a starting point &mdash; change anything below.</p>
          {!!auto.notes?.length && <ul className="mt-1 space-y-0.5">{auto.notes.map((n) => <li key={n}>&bull; {n}</li>)}</ul>}
        </details>
      )}

      {/* Plan and how often they pay. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-semibold text-ink">Plan
          <select value={plan} onChange={(e) => pickPlan(e.target.value)} className={`${input} mt-1 h-10 w-full font-normal`}>{plans.map((x) => <option key={x.key} value={x.key}>{x.key} — {money(x.fee)}{x.startingAt ? "+" : ""}/mo · {x.transactions.toLocaleString()} transactions, {x.accounts} accounts</option>)}</select>
        </label>
        <div>
          <p className="text-[13px] font-semibold text-ink">How they pay</p>
          <div role="radiogroup" aria-label="How they pay" className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
            {([["monthly", "Monthly"], ["quarterly", `Quarterly (−${disc}%)`]] as const).map(([k, l]) => {
              const on = (k === "quarterly") === quarterly;
              return <button key={k} type="button" role="radio" aria-checked={on} onClick={() => { if (!on) switchCadence(); }} className={`h-8 rounded-lg text-[13px] font-semibold ${on ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink"}`}>{l}</button>;
            })}
          </div>
          {quarterly && <p className="mt-1 text-[11.5px] text-warning-ink">Paid in full before any work on each quarter begins.</p>}
        </div>
      </div>

      {/* The price, in two parts. */}
      {([
        { key: "recurring", title: quarterly ? "Ongoing price — every quarter" : "Ongoing price — every month", help: quarterly ? "The plan and anything billed every quarter." : "The plan and anything billed every month (add-ons like A/R or extra accounts).", match: (l: ProposalLine) => l.billing === "monthly" || l.billing === "quarterly", addLabel: quarterly ? "Add an ongoing item" : "Add a monthly item", newBilling: (quarterly ? "quarterly" : "monthly") as ProposalBilling },
        { key: "once", title: "One-time & custom-quote work", help: "Billed once (QuickBooks setup, catch-up, cleanup…). Custom quote = no price yet; you agree it with the client in writing.", match: (l: ProposalLine) => l.billing === "one_time" || l.billing === "quote", addLabel: "Add a one-time item", newBilling: "one_time" as ProposalBilling },
      ]).map((sec) => {
        const rows = lines.filter(sec.match);
        return (
          <section key={sec.key} className="mt-4">
            <h4 className="text-[14px] font-bold text-ink">{sec.title}</h4>
            <p className="text-[12px] text-muted">{sec.help}</p>
            <ul className="mt-2 space-y-2">
              {rows.length === 0 && <li className="rounded-xl border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">Nothing here.</li>}
              {rows.map((l) => (
                <li key={l.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start gap-2">
                    <input aria-label="Description" value={l.label} placeholder="What it is (the client sees this)" onChange={(e) => upd(l.id, { label: e.target.value })} className={`${input} h-10 min-w-0 flex-1`} />
                    <button aria-label={`Remove ${l.label || "this line"}`} onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-danger-ink"><Trash2 size={16} /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {sec.key === "once" && (
                      <select aria-label="Billing" value={l.billing} onChange={(e) => upd(l.id, { billing: e.target.value as ProposalBilling })} className={`${input} h-10`}>
                        <option value="one_time">One-time price</option>
                        <option value="quote">Custom quote (no price yet)</option>
                      </select>
                    )}
                    {l.billing === "quote" ? <span className="text-[12.5px] text-muted">The client sees &ldquo;custom quote&rdquo;.</span> : (
                      <>
                        <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">$<input aria-label="Amount" inputMode="decimal" value={String(l.amount)} onChange={(e) => upd(l.id, { amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} className={`${input} h-10 w-28 text-right tabular-nums`} /><span className="text-muted">{l.billing === "quarterly" ? "/ quarter" : l.billing === "monthly" ? "/ month" : "one-time"}</span></label>
                        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2" title="Shows this price as “starting at” — use it when the final price can go up once you see the work.">
                          <input type="checkbox" aria-label="Starting at" checked={!!l.startingAt} onChange={() => upd(l.id, { startingAt: !l.startingAt || undefined })} className="h-4 w-4 accent-[var(--accent)]" />
                          Show as &ldquo;starting at&rdquo;
                        </label>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" icon={Plus} className="mt-1" onClick={() => setLines((x) => [...x, { id: lineId(), label: "", billing: sec.newBilling, amount: 0 }])}>{sec.addLabel}</Button>
          </section>
        );
      })}
      <p className="mt-2 text-[12px] text-muted">&ldquo;Starting at&rdquo; means the price can go up once you see the work (Advanced, A/P, A/R, catch-up, cleanup). Leave it off for fixed prices.</p>
      {auto && <Button size="sm" variant="ghost" icon={RotateCcw} className="mt-1" onClick={reset}>Start over from the suggested price</Button>}

      {/* Exactly what the proposal will say. */}
      <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/30 p-3.5">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink"><Eye size={14} /> What the client will see</p>
        <p className="mt-1.5 text-[13.5px] text-ink">{quarterly ? "Quarterly" : "Monthly"} total: <b className="tabular-nums">{t.startingAt ? "from " : ""}{money(rec.amount)}/{quarterly ? "quarter" : "mo"}</b>{t.oneTime ? <> · one-time <b className="tabular-nums">{money(t.oneTime)}</b></> : null}{t.quoted.length ? ` · ${t.quoted.length} custom-quoted` : ""}</p>
        <ul className="mt-1 space-y-0.5 text-[12.5px] text-ink-2">
          {lines.filter((l) => l.label.trim()).map((l) => <li key={l.id}>&bull; {l.label}: {l.billing === "quote" ? "custom quote" : `${l.startingAt ? "starting at " : ""}${money(l.amount)}${l.billing === "monthly" ? "/month" : l.billing === "quarterly" ? "/quarter" : " one-time"}`}</li>)}
        </ul>
        {quarterly && <p className="mt-1.5 rounded-lg bg-warning-soft/50 px-2.5 py-1.5 text-[12px] text-warning-ink">Quarterly: {QUARTERLY_TERMS} The proposal and engagement letter say so.</p>}
        {auto && rec.amount !== auto.monthlyTotal && <p className="mt-1 text-[11.5px] text-muted">The suggested price was {money(auto.monthlyTotal)}/{auto.cadence === "quarterly" ? "quarter" : "mo"}.</p>}
      </div>
      <label className="mt-3 block text-[13px] font-semibold text-ink">Note to the client <span className="font-normal text-muted">(optional, shown above the price)</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="e.g. We put you on Growth because of your monthly volume." className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13.5px] font-normal text-ink" /></label>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button icon={Save} disabled={busy || !dirty} onClick={save}>{dirty ? (p && p.status !== "draft" ? "Save new version" : "Save price") : "Saved"}</Button>
        <Button variant="primary" icon={Mail} disabled={busy || dirty || !reviewed || p?.status === "signed"} title={dirty ? "Save the price first" : !reviewed ? "Review and save the price first" : undefined} onClick={() => { setSentUrl(null); setSending(true); }}>{p?.status === "sent" ? "Send again" : "Send proposal & engagement letter"}</Button>
        {p?.status === "sent" && <Button icon={XCircle} variant="ghost" onClick={cancel}>Cancel link</Button>}
        <span className="text-[12px] text-muted">{dirty ? "Save first — then you can send it." : !reviewed ? "Save the price to unlock Send." : p?.status === "sent" ? "Waiting for their signature." : p?.status === "signed" ? "Signed — start bookkeeping from this intake." : "Ready to send."}</span>
      </div>
      {p?.status === "sent" && <p className="mt-2 text-[12.5px] text-muted">Sent to {p.sentTo} {p.sentAt ? relTime(p.sentAt) : ""}{intake.proposalLink ? ` · ${intake.proposalLink.openedAt ? `opened ${relTime(intake.proposalLink.lastOpenedAt ?? intake.proposalLink.openedAt)}` : "not opened yet"} · expires ${fmtDate(intake.proposalLink.expiresAt)}` : ""}.</p>}
      {p?.status === "signed" && <p className="mt-2 text-[12.5px] text-success-ink">Signed by {p.signedName} on {p.signedAt ? fmtDate(p.signedAt) : ""} (drawn signature). The signed proposal and engagement letter are in the client&rsquo;s Documents.</p>}
      {!!p?.previous?.length && <p className="mt-1 text-[12px] text-muted">Earlier signed versions: {p.previous.map((x) => `v${x.version} ${money(x.monthlyTotal)}, signed ${fmtDate(x.signedAt)} by ${x.signedName}`).join("; ")}.</p>}

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
            <p className="text-[13px] text-ink-2">They&rsquo;ll see: <b>{plan}</b> · {t.startingAt ? "from " : ""}{money(rec.amount)}/{quarterly ? "quarter (paid upfront)" : "mo"}{t.oneTime ? ` + ${money(t.oneTime)} one-time` : ""}.</p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
