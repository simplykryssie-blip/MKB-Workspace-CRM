"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { ArrowRight, CalendarClock, CheckCircle2, FileText, ListChecks, Lock, Mail, PenLine, Phone, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { FormRenderer, type FormEvent } from "@/components/forms/FormRenderer";
import { TOUCH_KEYS, type LeadForm, type Touch } from "@/lib/forms/config";
import { CREDIT_DISCLAIMER, CREDIT_VAULT } from "@/lib/funnels/credit-vault";

/**
 * Black Friday / Cyber Monday 2026: the Credit Comeback Vault golden-ticket scratch-off
 * (/credit-comeback). Analytics get event names only — never names, emails or answers.
 */
type Tracking = { metaPixelId: string; gaId: string };
type Props = { form: LeadForm; tracking: Tracking; home: string; privacyHref: string | null };

declare global {
  interface Window { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] }
}

/** The waitlist closes at the end of Cyber Monday, Nov 30, 2026 (11:59 pm Central). */
const CLOSES = Date.parse("2026-12-01T05:59:59Z");
const FOIL = "linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)";
const CSS = `
.cvf .foil-text{background:${FOIL};background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:cvf-shine 7s ease-in-out infinite}
.cvf .foil-btn,.cvf form button.bg-accent{background:${FOIL};background-size:200% 100%;color:#1a1206;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 0 1px rgba(184,121,18,.35),0 10px 26px -10px rgba(184,121,18,.7)}
.cvf .foil-btn:hover,.cvf form button.bg-accent:hover{background-position:100% 50%;filter:brightness(1.05)}
.cvf .foil-border{border:1.5px solid transparent;background:linear-gradient(#141210,#141210) padding-box,${FOIL} border-box}
.cvf .ticket{background:radial-gradient(120% 90% at 50% 0%,#2a2214 0%,#120f0a 60%,#0b0a08 100%);position:relative}
.cvf .ticket:before,.cvf .ticket:after{content:"";position:absolute;top:50%;width:26px;height:26px;border-radius:50%;background:#0b0a08;transform:translateY(-50%)}
.cvf .ticket:before{left:-13px}.cvf .ticket:after{right:-13px}
.cvf .panel{background:repeating-linear-gradient(135deg,rgba(255,231,161,.05) 0 8px,transparent 8px 16px),#1a160f}
.cvf .won{animation:cvf-pop .6s cubic-bezier(.2,1.6,.4,1) both}
.cvf .confetti i{position:absolute;top:-10px;width:8px;height:14px;border-radius:2px;opacity:.95;animation:cvf-fall 2.4s ease-in forwards}
@keyframes cvf-shine{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes cvf-pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes cvf-fall{to{transform:translateY(520px) rotate(540deg);opacity:0}}
@media (prefers-reduced-motion: reduce){.cvf .foil-text,.cvf .won,.cvf .confetti i{animation:none}}
`;
const PALETTE = { "--accent": "#8a5d0f", "--accent-hover": "#744e0c", "--accent-soft": "#f7eedc", "--accent-ink": "#6b470a" } as React.CSSProperties;

const FIRST_KEY = "mkb_cv_first_touch";
function thisTouch(): Touch {
  const q = new URLSearchParams(window.location.search);
  const t: Touch = {};
  for (const k of TOUCH_KEYS) { const v = q.get(k); if (v && k !== "landing" && k !== "referrer" && k !== "at") t[k] = v.slice(0, 150); }
  t.landing = window.location.pathname;
  try { const r = document.referrer ? new URL(document.referrer) : null; if (r && r.host !== window.location.host) t.referrer = `${r.origin}${r.pathname}`; } catch { /* none */ }
  t.at = new Date().toISOString();
  return t;
}
function track(e: FormEvent | { name: "ticket_scratched" }) {
  const fb = window.fbq, ga = window.gtag;
  try {
    if (e.name === "ticket_scratched") { fb?.("trackCustom", "TicketScratched"); ga?.("event", "ticket_scratched", { funnel: "credit_vault" }); }
    if (e.name === "form_started") ga?.("event", "form_start", { form_name: "credit_vault" });
    if (e.name === "form_success") { fb?.("track", "Lead"); ga?.("event", "generate_lead", { form_name: "credit_vault" }); }
  } catch { /* analytics never break the page */ }
}

const INSIDE = [
  { icon: ListChecks, title: "The credit report audit", text: "A line-by-line checklist to find the errors you can actually challenge." },
  { icon: TrendingUp, title: "The 3-round strategy", text: "Bureau dispute, method of verification, then straight to the source: in order, on time." },
  { icon: PenLine, title: "10 letters + the Letter Builder", text: "Answer a few questions and your letters are filled in, ready to print and sign." },
  { icon: Mail, title: "Mailing & tracking kit", text: "Addresses, certified-mail steps, a 30/45-day deadline calendar and a dispute log." },
  { icon: Phone, title: "Phone scripts", text: "What to say to creditors and collectors, and what never to say." },
  { icon: Sparkles, title: "Score-building playbook", text: "Utilization, secured cards, credit-builder loans and protecting your progress." },
  { icon: FileText, title: "Your refund, your comeback", text: "A simple plan to turn your tax refund into a credit glow-up." },
];

function useCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { const t = () => setLeft(Math.max(0, CLOSES - Date.now())); t(); const i = setInterval(t, 1000); return () => clearInterval(i); }, []);
  return left;
}

/** The golden ticket: scratch the foil (finger or mouse) to reveal three panels. */
function GoldenTicket({ onReveal }: { onReveal: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const down = useRef(false);
  const moves = useRef(0);
  const paint = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, r.width, r.height);
    [["#6e4105", 0], ["#b87912", .25], ["#f7d77f", .45], ["#a96808", .6], ["#ffe7a1", .78], ["#b87912", 1]].forEach(([c2, o]) => grad.addColorStop(o as number, c2 as string));
    g.fillStyle = grad; g.fillRect(0, 0, r.width, r.height);
    // fine glitter
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`; g.fillRect(Math.random() * r.width, Math.random() * r.height, 1.2, 1.2); }
    g.fillStyle = "rgba(40,25,4,.82)"; g.font = "700 15px Arial, sans-serif"; g.textAlign = "center";
    g.fillText("SCRATCH HERE  ✦  SCRATCH HERE  ✦  SCRATCH HERE", r.width / 2, r.height / 2 + 5);
    g.globalCompositeOperation = "destination-out";
  }, []);
  useEffect(() => { paint(); }, [paint]);
  const reveal = useCallback(() => {
    if (revealed) return;
    setRevealed(true);
    try { navigator.vibrate?.([30, 40, 60]); } catch { /* not supported */ }
    track({ name: "ticket_scratched" });
    onReveal();
  }, [revealed, onReveal]);
  const scratch = (e: React.PointerEvent) => {
    if (!down.current || revealed) return;
    const c = canvas.current!; const r = c.getBoundingClientRect(); const g = c.getContext("2d")!;
    g.beginPath(); g.arc(e.clientX - r.left, e.clientY - r.top, 24, 0, Math.PI * 2); g.fill();
    if (++moves.current % 12 === 0) {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let clear = 0, n = 0;
      for (let i = 3; i < d.length; i += 4 * 40) { n++; if (d[i] < 40) clear++; }
      if (clear / n > 0.5) reveal();
    }
  };
  return (
    <div className="ticket foil-border mx-auto w-full max-w-[560px] rounded-[22px] p-4 shadow-[0_30px_80px_-30px_rgba(184,121,18,.55)] sm:p-6">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.22em] text-[#f6d37a]/80">
        <span>MKB VIP · Golden Ticket</span><span>No. BF-2026</span>
      </div>
      <div className="relative mt-3 overflow-hidden rounded-2xl">
        <div className="grid grid-cols-3 gap-2 p-2">
          {["FREE", "FREE", "FREE"].map((w, i) => (
            <div key={i} className={`panel flex aspect-[4/5] flex-col items-center justify-center rounded-xl text-center ${revealed ? "won" : ""}`} style={{ animationDelay: `${i * 0.12}s` }}>
              <Lock size={20} className="text-[#f6d37a]" />
              <span className="foil-text mt-2 font-serif text-[22px] font-semibold sm:text-[28px]">{w}</span>
              <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/70">Round {i + 1}</span>
            </div>
          ))}
        </div>
        <canvas ref={canvas} aria-hidden className={`absolute inset-0 h-full w-full cursor-pointer touch-none transition-opacity duration-700 ${revealed ? "pointer-events-none opacity-0" : ""}`}
          onPointerDown={(e) => { down.current = true; (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); scratch(e); }}
          onPointerMove={scratch} onPointerUp={() => { down.current = false; }} onPointerCancel={() => { down.current = false; }} />
      </div>
      {revealed ? (
        <p className="won mt-4 text-center text-[15px] text-white/90">You won <b className="foil-text">The Credit Comeback Vault</b>: 3 rounds of do-it-yourself dispute letters and the full system, free.</p>
      ) : (
        <p className="mt-4 text-center text-[13.5px] text-white/70">Scratch all three panels with your finger or mouse. <button type="button" onClick={reveal} className="ml-1 font-semibold text-[#f6d37a] underline underline-offset-2">Reveal without scratching</button></p>
      )}
    </div>
  );
}

function Confetti() {
  const colors = ["#f7d77f", "#b87912", "#ffe7a1", "#ffffff", "#6e4105"];
  return (
    <div aria-hidden className="confetti pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
      {Array.from({ length: 36 }).map((_, i) => <i key={i} style={{ left: `${(i * 97) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.07}s`, transform: `rotate(${i * 23}deg)` }} />)}
    </div>
  );
}

export function CreditVaultFunnel({ form, tracking, home, privacyHref }: Props) {
  const first = useRef<Touch | undefined>(undefined);
  const latest = useRef<Touch | undefined>(undefined);
  const [won, setWon] = useState(false);
  const [kit, setKit] = useState<string | null>(null);
  const left = useCountdown();
  useEffect(() => {
    latest.current = thisTouch();
    try {
      const saved = localStorage.getItem(FIRST_KEY);
      if (saved) first.current = JSON.parse(saved) as Touch; else { first.current = latest.current; localStorage.setItem(FIRST_KEY, JSON.stringify(latest.current)); }
    } catch { first.current = latest.current; }
    try {
      if (!sessionStorage.getItem("mkb_cv_visit")) {
        sessionStorage.setItem("mkb_cv_visit", "1");
        fetch("/api/public/funnels/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ funnel: "credit-vault" }), keepalive: true }).catch(() => {});
      }
    } catch { /* storage blocked */ }
  }, []);
  const submit = async (data: Record<string, string>, honeypot: string, clientKey: string) => {
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      try {
        const r = await fetch("/api/public/funnels/credit-vault/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, honeypot, clientKey, attribution: { campaign: CREDIT_VAULT.campaignId, first: first.current, latest: latest.current } }) });
        const d = (await r.json().catch(() => ({}))) as { error?: string; kit?: string };
        if (r.ok) { if (d.kit) setKit(d.kit); return; }
        if (r.status < 500) return d.error ?? "Something went wrong. Please try again or call us at 888-379-9372.";
      } catch { /* retry once with the same key */ }
    }
    return "We couldn't send your answers. Please check your connection and try again, or call 888-379-9372.";
  };
  const claim = () => document.getElementById("claim")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const onReveal = () => { setWon(true); setTimeout(claim, 1600); };
  const d = left === null ? null : { d: Math.floor(left / 864e5), h: Math.floor((left % 864e5) / 36e5), m: Math.floor((left % 36e5) / 6e4), s: Math.floor((left % 6e4) / 1e3) };

  return (
    <div style={PALETTE} className="cvf min-h-screen bg-[#0b0a08] text-white">
      <style>{CSS}</style>
      {tracking.metaPixelId && <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,'${tracking.metaPixelId}');fbq('init','${tracking.metaPixelId}');fbq('track','PageView');`}</Script>}
      {tracking.gaId && (<><Script src={`https://www.googletagmanager.com/gtag/js?id=${tracking.gaId}`} strategy="afterInteractive" /><Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${tracking.gaId}',{allow_google_signals:false,allow_ad_personalization_signals:false});`}</Script></>)}

      <header className="relative overflow-hidden">
        {won && <Confetti />}
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(184,121,18,.35),transparent)]" />
        <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-6 sm:px-6">
          <a href={home} className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mkb-monogram.webp" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-lg" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/85">MKB Financial Group</span>
          </a>
          <div className="mt-10 text-center">
            <p className="foil-text text-[12.5px] font-bold uppercase tracking-[0.24em]">Black Friday · Cyber Monday · VIP only</p>
            <h1 className="mt-3 font-serif text-[38px] font-medium leading-[1.06] tracking-tight sm:text-[56px]">Scratch your <span className="foil-text">Golden Ticket.</span></h1>
            <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/80">Every ticket wins. Reveal your prize, join the MKB VIP waitlist, and unlock the kind of dispute system credit repair companies charge for, free.</p>
          </div>
          <div className="mt-9"><GoldenTicket onReveal={onReveal} /></div>
          {d && (
            <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-3 text-center" aria-label="Time left to join the VIP waitlist">
              <CalendarClock size={18} className="shrink-0 text-[#f6d37a]" />
              {left ? (<>{[["d", d.d], ["h", d.h], ["m", d.m], ["s", d.s]].map(([k, v]) => <span key={k as string} className="min-w-[52px] rounded-xl border border-white/15 bg-white/5 px-2 py-1.5"><b className="block font-serif text-[22px] leading-none">{String(v).padStart(2, "0")}</b><span className="text-[10.5px] uppercase tracking-wider text-white/60">{k === "d" ? "days" : k === "h" ? "hrs" : k === "m" ? "min" : "sec"}</span></span>)}</>) : <span className="text-[14px] text-white/80">The VIP waitlist is closing — claim yours now.</span>}
            </div>
          )}
          <p className="mt-3 text-center text-[12.5px] text-white/55">VIP waitlist closes at the end of Cyber Monday, Nov 30.</p>
        </div>
      </header>

      <section className="border-t border-white/10 bg-[#100e0b]">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <p className="foil-text text-center text-[12px] font-bold uppercase tracking-[0.22em]">Inside the Vault</p>
          <h2 className="mt-2 text-center font-serif text-[30px] font-medium tracking-tight sm:text-[38px]">Not basic letters. A complete comeback system.</h2>
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INSIDE.map((x) => (
              <div key={x.title} className="foil-border rounded-2xl p-5">
                <x.icon size={22} className="text-[#f6d37a]" />
                <p className="mt-3 text-[16px] font-semibold">{x.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-white/70">{x.text}</p>
              </div>
            ))}
            <div className="flex flex-col justify-center rounded-2xl bg-[radial-gradient(120%_120%_at_0%_0%,rgba(247,215,127,.18),transparent)] p-5">
              <p className="text-[14px] text-white/80">Plus <b className="text-white">VIP-only</b> Black Friday and Cyber Monday offers from MKB, before anyone else.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="claim" className="scroll-mt-4 border-t border-white/10 bg-[#f7f4ee] text-ink">
        <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
          {kit ? (
            <div className="text-center">
              <CheckCircle2 size={44} className="mx-auto text-[#8a5d0f]" />
              <h2 className="mt-3 font-serif text-[32px] font-medium tracking-tight">Your Vault is unlocked.</h2>
              <p className="mt-2 text-[15.5px] text-ink-2">You&rsquo;re on the VIP list. We also emailed your private link so you can come back any time.</p>
              <a href={kit} className="foil-btn mt-6 inline-flex h-12 items-center gap-2 rounded-xl px-7 text-[15px]">Open my Vault <ArrowRight size={17} /></a>
            </div>
          ) : (
            <>
              <p className="text-center text-[12px] font-bold uppercase tracking-[0.22em] text-[#8a5d0f]">{won ? "You won" : "Claim your prize"}</p>
              <h2 className="mt-2 text-center font-serif text-[30px] font-medium tracking-tight sm:text-[36px]">Join the VIP waitlist and unlock your Vault</h2>
              <p className="mx-auto mt-2 max-w-md text-center text-[14.5px] text-ink-2">Takes 30 seconds. No Social Security number, no credit pull, no card.</p>
              <div className="mt-7">
                <FormRenderer form={form} mode="live" hideHeader doneTitle="Your Vault is unlocked" onSubmit={submit} onEvent={track} />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#100e0b]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h2 className="font-serif text-[26px] font-medium">Questions</h2>
          {[
            ["Is it really free?", "Yes. The Vault is a free gift for joining the MKB VIP waitlist. No card, no credit pull, no obligation."],
            ["Do I mail the letters myself?", "Yes. The Vault is a do-it-yourself system: the Letter Builder fills in your letters, and you print, sign and mail them by certified mail. Disputing errors on your own credit reports is free, and it's your legal right."],
            ["Will this remove everything negative?", "No one can legally remove accurate, timely information. The Vault helps you find and challenge errors, outdated items and things that aren't yours, and build positive credit while you do."],
            ["What is the VIP waitlist?", "First access to MKB Financial Group's Black Friday and Cyber Monday offers and tax-season announcements. You can unsubscribe any time."],
          ].map(([q, a]) => (
            <details key={q} className="group border-b border-white/10 py-4">
              <summary className="cursor-pointer list-none text-[16px] font-semibold marker:hidden">{q}</summary>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/75">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-[12px] text-white/50 sm:px-6">
        <p className="mx-auto max-w-3xl">{CREDIT_DISCLAIMER}</p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1"><ShieldCheck size={13} className="inline" /> MKB Financial Group · 888-379-9372 · info@mkbfinancialgroup.com{privacyHref && <a href={privacyHref} className="underline">Privacy Policy</a>}</p>
      </footer>
    </div>
  );
}
