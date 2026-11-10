"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileSignature, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LogoMark } from "@/components/brand/Logo";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { LetterView } from "@/components/engagement/LetterView";
import { money } from "@/lib/fees/config";
import { proposalTotals, type ProposalLine } from "@/lib/books/proposal";

/**
 * The client's proposal link: MKB's reviewed bookkeeping price and the
 * engagement letter (already filled in with that price), signed with a drawn
 * signature. No sign-in; the link closes once signed.
 */
type Letter = { title: string; body: string; version: number };
type Loaded = {
  businessName: string; firstName: string; expiresAt: string;
  proposal: { version: number; plan: string; lines: Omit<ProposalLine, "id">[]; message?: string; planIncludes: string[] };
  letters: { books: Letter; terms: Letter };
};

export function PublicProposal({ token }: { token: string }) {
  const base = `/api/public/proposal/${encodeURIComponent(token)}`;
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState<{ status: number; message: string } | null>(null);
  const [done, setDone] = useState<{ emailed: boolean } | null>(null);
  const load = () => fetch(base, { cache: "no-store", referrerPolicy: "no-referrer" }).then(async (r) => { const j = (await r.json().catch(() => ({}))) as Loaded & { error?: string }; if (!r.ok) setErr({ status: r.status, message: j.error ?? "We couldn't open this link." }); else setData(j); }).catch(() => setErr({ status: 0, message: "Couldn't reach MKB — check your internet connection and try again." }));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-center gap-3">
          <LogoMark height={26} />
          <div><p className="text-[15px] font-bold text-ink">MKB Financial Group</p><p className="flex items-center gap-1 text-[12px] text-muted"><Lock size={11} /> Private, secure proposal</p></div>
        </header>
        {done ? (
          <Card className="p-6 sm:p-8">
            <h1 className="flex items-center gap-2 text-[22px] font-bold text-ink"><CheckCircle2 size={24} className="text-success" /> Thank you{data ? `, ${data.firstName}` : ""} — you&rsquo;re all signed.</h1>
            <p className="mt-2 text-[14.5px] text-ink-2">We received your signed proposal and engagement letter. {done.emailed ? "A signed copy is on its way to your email." : "We'll email you a signed copy shortly."} Our team will be in touch to connect your accounts and set your first monthly close date.</p>
            <p className="mt-3 text-[13.5px] text-muted">This link is now closed. Questions? Call us at 833-379-3320.</p>
          </Card>
        ) : err ? (
          <Card className="p-8 text-center">
            <h1 className="text-[20px] font-bold text-ink">{err.status === 410 ? "This link isn't active" : err.status === 0 ? "Connection problem" : "We couldn't open this link"}</h1>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">{err.message}</p>
            <p className="mt-4 text-[13.5px] text-ink-2">Call MKB Financial Group at <a className="font-semibold text-accent" href="tel:8333793320">833-379-3320</a>.</p>
          </Card>
        ) : !data ? (
          <Card className="p-10 text-center text-[14px] text-muted"><span role="status">Loading your proposal…</span></Card>
        ) : <Sign data={data} base={base} onDone={setDone} onErr={(e) => { setErr(e); setData(null); }} />}
        <p className="mt-8 text-center text-[12px] text-muted">© MKB Financial Group · 833-379-3320</p>
      </div>
    </main>
  );
}

const amount = (l: Omit<ProposalLine, "id">) => (l.billing === "quote" ? "Custom quote" : `${l.startingAt ? "from " : ""}${money(l.amount)}`);

function Sign({ data, base, onDone, onErr }: { data: Loaded; base: string; onDone: (d: { emailed: boolean }) => void; onErr: (e: { status: number; message: string }) => void }) {
  const p = data.proposal;
  const t = proposalTotals(p);
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sign = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${base}/sign`, { method: "POST", headers: { "content-type": "application/json" }, referrerPolicy: "no-referrer", body: JSON.stringify({ name: name.trim(), signature: drawn, version: p.version, engagement: { version: data.letters.books.version, termsVersion: data.letters.terms.version } }) });
      const j = (await r.json().catch(() => ({}))) as { emailed?: boolean; error?: string };
      if (r.ok) return onDone({ emailed: !!j.emailed });
      if (r.status === 410 || r.status === 404) return onErr({ status: r.status, message: j.error ?? "This link isn't active." });
      setMsg(j.error ?? "Couldn't sign — please try again.");
    } catch { setMsg("Couldn't reach MKB — check your connection and try again."); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">Your bookkeeping proposal — {data.businessName}</h1>
        <p className="mt-0.5 text-[13px] text-muted">Prepared by MKB after reviewing your intake · link expires {new Date(data.expiresAt).toLocaleDateString("en-US", { dateStyle: "long" })}</p>
      </div>
      <Card className="p-5 sm:p-6">
        <h2 className="text-[17px] font-bold text-ink">{p.plan} plan</h2>
        {p.message && <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] text-ink-2">{p.message}</p>}
        <table className="mt-3 w-full text-[14px]">
          <tbody>
            {p.lines.filter((l) => l.billing === "monthly").map((l, i) => <tr key={i}><td className="py-1 text-ink-2">{l.label}</td><td className="py-1 text-right tabular-nums">{amount(l)}/mo</td></tr>)}
            <tr className="border-t border-line font-semibold"><td className="py-1.5">Monthly total</td><td className="py-1.5 text-right tabular-nums">{t.startingAt ? "from " : ""}{money(t.monthly)}/mo</td></tr>
            {p.lines.filter((l) => l.billing !== "monthly").map((l, i) => <tr key={`o${i}`}><td className="py-1 text-ink-2">{l.label} {l.billing === "one_time" && <span className="text-muted">(one-time)</span>}</td><td className="py-1 text-right tabular-nums">{amount(l)}</td></tr>)}
          </tbody>
        </table>
        {p.planIncludes.length > 0 && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-ink">Your plan includes</p>
            <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">{p.planIncludes.map((x) => <li key={x} className="text-[13px] text-ink-2">• {x}</li>)}</ul>
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-muted">Questions about your price? Call us at 833-379-3320 before you sign.</p>
      </Card>
      <Card className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><FileSignature size={16} className="text-accent" /> Engagement letter</h3>
        <div tabIndex={0} aria-label="Engagement letter text" className="scrollbar-thin mt-3 max-h-[420px] space-y-6 overflow-y-auto rounded-xl border border-line bg-bg p-4">
          <LetterView title={data.letters.books.title} body={data.letters.books.body} version={data.letters.books.version} vars={{}} />
          <LetterView title={data.letters.terms.title} body={data.letters.terms.body} version={data.letters.terms.version} vars={{}} />
        </div>
        <label className="mt-3 flex items-start gap-2 text-[14px] text-ink"><input type="checkbox" checked={accepted} onChange={() => setAccepted(!accepted)} className="mt-0.5 h-5 w-5 accent-[var(--accent)]" />I reviewed the proposal and read the engagement letter and standard terms, and I agree to them.</label>
      </Card>
      <Card className="space-y-3 p-5 sm:p-6">
        <div className="max-w-sm"><label htmlFor="pp-name" className="mb-1 block text-[13px] font-medium text-ink-2">Your full name (printed)</label><input id="pp-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink" /></div>
        <div className="max-w-lg"><SignaturePad label="Sign here with your finger or mouse" onChange={setDrawn} /></div>
        <Button variant="primary" icon={Send} disabled={busy || !accepted || name.trim().length < 3 || !drawn} onClick={sign}>{busy ? "Signing…" : "Sign and accept"}</Button>
        {msg && <p role="alert" className="text-[13px] text-danger-ink">{msg}</p>}
        <p className="text-[12px] text-muted">Once you sign, this link closes and we email you a signed copy.</p>
      </Card>
    </div>
  );
}
