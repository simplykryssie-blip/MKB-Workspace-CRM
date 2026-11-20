"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Download, FileText, Lock, PenLine, Printer } from "lucide-react";
import { BUREAUS, CREDIT_DISCLAIMER, CREDIT_VAULT, GUIDE, LETTERS, renderLetter, type BureauKey, type LetterDef, type Sender } from "@/lib/funnels/credit-vault";
import { copyText } from "@/lib/clipboard";

/**
 * The private Credit Comeback Vault: download the PDF, read the guide, and build letters.
 * The Letter Builder runs only in this browser — nothing typed here is sent anywhere,
 * and it never asks for a Social Security number (written by hand on the mailed copy).
 */
const FOIL = "linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)";
const CSS = `
.cvk .foil-text{background:${FOIL};background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
.cvk .foil-btn{background:${FOIL};background-size:200% 100%;color:#1a1206;font-weight:700}
.cvk .paper{background:#fff;color:#111;font-family:Georgia,'Times New Roman',serif}
@media print{
  body *{visibility:hidden!important}
  .cvk .print-area,.cvk .print-area *{visibility:visible!important}
  .cvk .print-area{position:absolute;left:0;top:0;width:100%}
  .cvk .paper{box-shadow:none!important;border:0!important;margin:0!important;padding:0.6in!important;page-break-after:always}
  .cvk .paper:last-child{page-break-after:auto}
}
`;
const input = "h-11 w-full rounded-xl border border-[#d9d3c6] bg-white px-3 text-[15px] text-[#111] focus:border-[#8a5d0f] focus:outline-none focus:ring-4 focus:ring-[#8a5d0f]/15";
const area = "w-full rounded-xl border border-[#d9d3c6] bg-white px-3 py-2.5 text-[15px] text-[#111] focus:border-[#8a5d0f] focus:outline-none focus:ring-4 focus:ring-[#8a5d0f]/15";
const GROUPS: { label: string; keys: string[] }[] = [
  { label: "The 3 rounds", keys: ["round1", "round2", "round3"] },
  { label: "Clean-up first", keys: ["personal", "obsolete", "inquiry"] },
  { label: "Collectors & creditors", keys: ["validation", "paydelete", "goodwill"] },
  { label: "Identity theft", keys: ["idtheft"] },
];
const EMPTY: Sender = { name: "", address1: "", address2: "", city: "", state: "", zip: "" };

function Paper({ l, sender, v }: { l: LetterDef; sender: Sender; v: Record<string, string> }) {
  const r = renderLetter(l, sender.name ? sender : null, v);
  return (
    <div className="paper mx-auto max-w-[720px] rounded-lg border border-[#e5e0d6] p-7 text-[14.5px] leading-[1.55] shadow-[0_12px_40px_-20px_rgba(0,0,0,.35)] sm:p-10">
      {r.from.map((x, i) => <div key={i}>{x}</div>)}
      {r.idLines.map((x) => <div key={x} className="text-[12.5px] text-[#555]">{x}</div>)}
      <div className="mt-4">{r.date}</div>
      <div className="mt-4">{r.to.map((x, i) => <div key={i}>{x}</div>)}</div>
      <div className="mt-4 font-bold">{r.re}</div>
      <div className="mt-4">To whom it may concern:</div>
      {r.body.split(/\n\n+/).map((p, i) => <p key={i} className="mt-3 whitespace-pre-wrap">{p}</p>)}
      <div className="mt-6">Sincerely,</div>
      <div className="mt-10 w-64 border-t border-[#111]" />
      <div>{r.signName || "Signature and printed name"}</div>
      {r.enclosures.length > 0 && <div className="mt-5 text-[13px]"><b>Enclosures:</b>{r.enclosures.map((e) => <div key={e}>• {e}</div>)}</div>}
    </div>
  );
}

function Builder() {
  const [sender, setSender] = useState<Sender>(EMPTY);
  const [pick, setPick] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [all3, setAll3] = useState(false);
  const [copied, setCopied] = useState(false);
  const l = LETTERS.find((x) => x.key === pick) ?? null;
  const senderOk = sender.name.trim() && sender.address1.trim() && sender.city.trim() && sender.state.trim() && sender.zip.trim();
  const missing = l ? l.fields.filter((f) => f.required && !(f.type === "bureau" && all3) && !(v[f.id] ?? "").trim()) : [];
  const copies = useMemo(() => (l && l.to === "bureau" && all3 ? (Object.keys(BUREAUS) as BureauKey[]).map((b) => ({ ...v, bureau: b })) : [v]), [l, all3, v]);
  const asText = () => {
    if (!l) return "";
    return copies.map((c) => { const r = renderLetter(l, sender, c); return [...r.from, ...r.idLines, "", r.date, "", ...r.to, "", r.re, "", "To whom it may concern:", "", r.body, "", "Sincerely,", "", "", r.signName, ...(r.enclosures.length ? ["", "Enclosures:", ...r.enclosures.map((e) => `- ${e}`)] : [])].join("\n"); }).join("\n\n----------\n\n");
  };
  return (
    <div>
      <ol className="mb-5 flex flex-wrap gap-2 text-[12.5px] font-semibold uppercase tracking-wider text-[#8a7a5c]">
        <li className={!pick ? "text-[#8a5d0f]" : ""}>1. Your details</li><li>·</li><li className={pick && !missing.length ? "" : pick ? "text-[#8a5d0f]" : ""}>2. Pick a letter</li><li>·</li><li className={pick && !missing.length ? "text-[#8a5d0f]" : ""}>3. Print &amp; mail</li>
      </ol>
      <div className="rounded-2xl border border-[#e5e0d6] bg-[#fbfaf7] p-4 sm:p-5">
        <p className="text-[15px] font-semibold text-[#111]">Your name and mailing address</p>
        <p className="mt-0.5 text-[12.5px] text-[#666]"><Lock size={12} className="mr-1 inline" />Stays on this device: nothing you type in the Letter Builder is sent to MKB or anyone else.</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <input aria-label="Full legal name" placeholder="Full legal name" className={input} value={sender.name} onChange={(e) => setSender({ ...sender, name: e.target.value })} />
          <input aria-label="Street address" placeholder="Street address" className={input} value={sender.address1} onChange={(e) => setSender({ ...sender, address1: e.target.value })} />
          <input aria-label="Apartment or unit (optional)" placeholder="Apt / unit (optional)" className={input} value={sender.address2} onChange={(e) => setSender({ ...sender, address2: e.target.value })} />
          <div className="grid grid-cols-[1fr_70px_100px] gap-2">
            <input aria-label="City" placeholder="City" className={input} value={sender.city} onChange={(e) => setSender({ ...sender, city: e.target.value })} />
            <input aria-label="State" placeholder="ST" maxLength={2} className={input} value={sender.state} onChange={(e) => setSender({ ...sender, state: e.target.value.toUpperCase() })} />
            <input aria-label="ZIP" placeholder="ZIP" inputMode="numeric" className={input} value={sender.zip} onChange={(e) => setSender({ ...sender, zip: e.target.value })} />
          </div>
        </div>
      </div>

      {!l ? (
        <div className="mt-6 space-y-5">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#8a5d0f]">{g.label}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {g.keys.map((k) => { const x = LETTERS.find((y) => y.key === k)!; return (
                  <button key={k} type="button" onClick={() => { setPick(k); setV({}); setAll3(false); }} className="rounded-xl border border-[#e5e0d6] bg-white p-4 text-left transition hover:border-[#b87912] hover:shadow-md">
                    <span className="block text-[15px] font-semibold text-[#111]">Letter {x.n}: {x.title}</span>
                    <span className="mt-1 block text-[13px] leading-snug text-[#666]">{x.when}</span>
                  </button>
                ); })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <button type="button" onClick={() => setPick(null)} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#8a5d0f]"><ArrowLeft size={15} /> All letters</button>
          <h3 className="mt-2 font-serif text-[24px] font-medium text-[#111]">Letter {l.n}: {l.title}</h3>
          <p className="text-[14px] text-[#555]">{l.when}</p>
          <div className="mt-4 grid gap-3">
            {l.fields.map((f) => (
              <div key={f.id} role={f.type === "bureau" ? "group" : undefined} aria-label={f.type === "bureau" ? f.label : undefined}>
                <label htmlFor={`cvk-${f.id}`} className="mb-1 block text-[14px] font-semibold text-[#222]">{f.label}{f.required ? "" : " (optional)"}</label>
                {f.type === "bureau" ? (
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(BUREAUS) as BureauKey[]).map((b) => <button key={b} type="button" onClick={() => { setAll3(false); setV({ ...v, bureau: b }); }} className={`h-10 rounded-xl border px-4 text-[14px] font-semibold ${!all3 && v.bureau === b ? "border-[#8a5d0f] bg-[#f7eedc] text-[#6b470a]" : "border-[#d9d3c6] bg-white text-[#333]"}`}>{b === "transunion" ? "TransUnion" : b[0].toUpperCase() + b.slice(1)}</button>)}
                    <button type="button" onClick={() => setAll3(true)} className={`h-10 rounded-xl border px-4 text-[14px] font-semibold ${all3 ? "border-[#8a5d0f] bg-[#f7eedc] text-[#6b470a]" : "border-[#d9d3c6] bg-white text-[#333]"}`}>All three</button>
                  </div>
                ) : f.type === "textarea" ? (
                  <textarea id={`cvk-${f.id}`} rows={f.id === "items" || f.id === "error" ? 5 : 3} placeholder={f.placeholder} className={area} value={v[f.id] ?? ""} onChange={(e) => setV({ ...v, [f.id]: e.target.value })} />
                ) : (
                  <input id={`cvk-${f.id}`} type={f.type === "date" ? "date" : "text"} placeholder={f.placeholder} className={input} value={v[f.id] ?? ""} onChange={(e) => setV({ ...v, [f.id]: e.target.value })} />
                )}
                {f.help && <span className="mt-1 block text-[12.5px] text-[#777]">{f.help}</span>}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!senderOk || missing.length > 0} onClick={() => window.print()} className="foil-btn inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] disabled:opacity-40"><Printer size={17} /> Print or save as PDF{copies.length > 1 ? " (3 letters)" : ""}</button>
            <button type="button" disabled={!senderOk || missing.length > 0} onClick={() => void copyText(asText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })} className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#d9d3c6] bg-white px-5 text-[15px] font-semibold text-[#222] disabled:opacity-40">{copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Copied" : "Copy text"}</button>
            {(!senderOk || missing.length > 0) && <span className="text-[13px] text-[#8a5d0f]">{!senderOk ? "Add your name and address above." : `Fill in: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`}</span>}
          </div>
          <p className="mt-2 text-[12.5px] text-[#777]">Then sign it, add your date of birth and Social Security number by hand, enclose the copies listed, and mail it certified with return receipt.</p>
          <div className="print-area mt-6 space-y-6">
            {copies.map((c, i) => <Paper key={i} l={l} sender={sender} v={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreditVaultKit({ token }: { token: string | null }) {
  const [tab, setTab] = useState<"builder" | "guide">("builder");
  if (!token) {
    return (
      <main className="cvk grid min-h-screen place-items-center bg-[#0b0a08] px-4 text-center text-white">
        <style>{CSS}</style>
        <div className="max-w-md">
          <Lock size={36} className="mx-auto text-[#f6d37a]" />
          <h1 className="mt-4 font-serif text-[28px]">This Vault link isn&rsquo;t valid</h1>
          <p className="mt-2 text-white/75">Open the link in your &ldquo;Your Credit Comeback Vault is unlocked&rdquo; email, or claim yours below.</p>
          <a href={CREDIT_VAULT.path} className="foil-btn mt-6 inline-flex h-12 items-center rounded-xl px-6">Get my Golden Ticket</a>
        </div>
      </main>
    );
  }
  const pdf = `/api/public/funnels/credit-vault/pdf?k=${encodeURIComponent(token)}`;
  return (
    <main className="cvk min-h-screen bg-[#f7f4ee] text-[#111]">
      <style>{CSS}</style>
      <header className="bg-[#0b0a08] text-white">
        <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mkb-monogram.webp" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-lg" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/85">MKB Financial Group · VIP</span>
          </div>
          <p className="foil-text mt-8 text-[12.5px] font-bold uppercase tracking-[0.22em]">Unlocked</p>
          <h1 className="mt-2 font-serif text-[36px] font-medium leading-tight sm:text-[48px]">{CREDIT_VAULT.title}</h1>
          <p className="mt-2 text-[16.5px] text-white/80">{CREDIT_VAULT.subtitle}. Start with the PDF, then build your Round 1 letters below.</p>
          <a href={pdf} className="foil-btn mt-6 inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px]"><Download size={17} /> Download the full PDF (22 pages)</a>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div role="tablist" className="mb-6 flex gap-2">
          {([["builder", "Letter Builder", PenLine], ["guide", "Read the guide", FileText]] as const).map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[14.5px] font-semibold ${tab === k ? "border-[#8a5d0f] bg-[#f7eedc] text-[#6b470a]" : "border-[#d9d3c6] bg-white text-[#333]"}`}><Icon size={16} />{label}</button>
          ))}
        </div>
        {tab === "builder" ? <Builder /> : (
          <div className="space-y-3">
            {GUIDE.map((g) => (
              <details key={g.id} className="rounded-2xl border border-[#e5e0d6] bg-white p-5 open:shadow-md">
                <summary className="cursor-pointer list-none font-serif text-[20px] font-medium">{g.title}</summary>
                <div className="mt-3 text-[15px] leading-relaxed text-[#333]">
                  {g.body.split(/\n\n+/).map((blk, i) => blk.startsWith("## ") ? <h3 key={i} className="mt-4 text-[16px] font-bold text-[#111]">{blk.slice(3).split("\n")[0]}{blk.includes("\n") && <span className="block font-normal">{blk.split("\n").slice(1).map((ln) => ln.startsWith("- ") ? <span key={ln} className="block pl-4">• {ln.slice(2)}</span> : <span key={ln} className="block">{ln}</span>)}</span>}</h3> : blk.split("\n").every((ln) => ln.startsWith("- ")) ? <ul key={i} className="mt-2 space-y-1 pl-4">{blk.split("\n").map((ln) => <li key={ln}>• {ln.slice(2)}</li>)}</ul> : <p key={i} className="mt-2">{blk}</p>)}
                </div>
              </details>
            ))}
          </div>
        )}
        <div className="mt-10 rounded-2xl bg-[#0b0a08] p-6 text-white">
          <p className="font-serif text-[22px]">Your refund can power your comeback.</p>
          <p className="mt-1 text-[14.5px] text-white/75">MKB Financial Group prepares individual and small-business tax returns virtually in Louisiana and Texas. VIPs hear about tax-season offers first.</p>
          <a href="/book-consultation" className="foil-btn mt-4 inline-flex h-11 items-center rounded-xl px-5 text-[14.5px]">Book a call</a>
        </div>
        <p className="mt-8 text-[12px] leading-relaxed text-[#777]">{CREDIT_DISCLAIMER}</p>
      </div>
    </main>
  );
}
