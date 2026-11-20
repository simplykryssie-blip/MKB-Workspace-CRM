"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { ArrowRight, Briefcase, CalendarCheck, Check, Copy, FileText, Gift, Home, Laptop, MessageSquareText, ShieldCheck, Sparkles, X } from "lucide-react";
import { TOUCH_KEYS, type LeadForm, type Touch } from "@/lib/forms/config";
import { BIZ_TYPES, FILER, IND_TYPES, OFFICIAL_RULES, SMS_DISCLOSURE, TAX_PRIZE, usd0 } from "@/lib/funnels/tax-prize";
import { copyText } from "@/lib/clipboard";

/**
 * Black Friday Tax Prize (/black-friday): scratch a printed golden ticket; partway through,
 * the foil "jams" and a sheet asks where to send the prize; then it's revealed. Analytics
 * get event names only — never names, emails, phone numbers or answers.
 */
type Tracking = { metaPixelId: string; gaId: string };
type Props = { form: LeadForm; tracking: Tracking; home: string; privacyHref: string | null; claimed: number };
type Result = { prizeCents: number; code: string; vip: boolean; kit?: string | null; again?: boolean };

declare global {
  interface Window { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] }
}

const INK = "#0d0c0a";
const PAPER = "#f3ead3";
const GOLD = "#b8862b";
const RED = "#b3261e";
const FOIL = "linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)";
const COIN = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><defs><radialGradient id="g" cx="35%" cy="30%"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#e2b04a"/><stop offset="1" stop-color="#8a5a12"/></radialGradient></defs><circle cx="22" cy="22" r="19" fill="url(#g)" stroke="#6e4105" stroke-width="2"/><circle cx="22" cy="22" r="14" fill="none" stroke="#8a5a12" stroke-width="1.2" stroke-dasharray="2 2"/><text x="22" y="27" font-family="Georgia" font-size="14" font-weight="700" text-anchor="middle" fill="#6e4105">$</text></svg>')}`;
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>')}")`;
const GUILLOCHE = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><path d="M0 20 Q15 0 30 20 T60 20 T90 20 T120 20" fill="none" stroke="#b8862b" stroke-opacity=".22" stroke-width=".8"/><path d="M0 26 Q15 6 30 26 T60 26 T90 26 T120 26" fill="none" stroke="#b8862b" stroke-opacity=".14" stroke-width=".8"/><path d="M0 14 Q15 34 30 14 T60 14 T90 14 T120 14" fill="none" stroke="#b8862b" stroke-opacity=".14" stroke-width=".8"/></svg>')}")`;

const CSS = `
.tpf{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
.tpf .anton{font-family:Anton,Impact,"Arial Narrow Bold",sans-serif;letter-spacing:.01em}
.tpf .serif{font-family:"DM Serif Display",Georgia,serif}
.tpf .hand{font-family:Caveat,"Bradley Hand","Segoe Print",cursive}
.tpf .foil-text{background:${FOIL};background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:tpf-shine 6s ease-in-out infinite}
.tpf .foil-btn{background:${FOIL};background-size:200% 100%;color:#1a1206;font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 2px 0 #6e4105,0 12px 24px -12px rgba(110,65,5,.9);transition:transform .08s,background-position .4s}
.tpf .foil-btn:active{transform:translateY(2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 0 0 #6e4105}
.tpf .foil-btn:hover{background-position:100% 50%}
.tpf .ticket{background:${PAPER};background-image:${GUILLOCHE};color:${INK};box-shadow:0 1px 0 #fff inset,0 30px 60px -28px rgba(0,0,0,.9),0 8px 18px -8px rgba(0,0,0,.6);transition:transform .25s ease-out;transform-style:preserve-3d}
.tpf .perf{background-image:radial-gradient(circle at 50% 50%,${INK} 4px,transparent 4.5px);background-size:12px 12px;background-repeat:repeat-y;width:12px}
.tpf .stamp{color:${RED};border:3px solid ${RED};border-radius:6px;padding:2px 10px;transform:rotate(-12deg) scale(1);opacity:.88;mix-blend-mode:multiply;animation:tpf-stamp .45s cubic-bezier(.2,1.8,.4,1) both;box-shadow:0 0 0 1px rgba(179,38,30,.2) inset}
.tpf .prize-in{animation:tpf-rise .7s cubic-bezier(.2,1.4,.4,1) both}
.tpf .coin{position:absolute;top:-60px;width:30px;height:30px;background:url('${COIN}') center/contain no-repeat;opacity:0;animation-name:tpf-coin;animation-timing-function:cubic-bezier(.35,.05,.65,1);animation-fill-mode:forwards}
.tpf .flake{position:absolute;width:6px;height:4px;border-radius:1px;pointer-events:none;animation:tpf-flake .9s ease-in forwards}
.tpf .sheet{animation:tpf-sheet .38s cubic-bezier(.2,1,.3,1) both}
.tpf .bonus{background:linear-gradient(180deg,#1b150b,#0f0c07);border:1.5px solid transparent;background-clip:padding-box;position:relative}
.tpf .bonus:before{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;background:${FOIL};background-size:200% 100%;animation:tpf-shine 3s linear infinite;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.tpf .wiggle{animation:tpf-wiggle .5s ease-in-out 2}
@keyframes tpf-shine{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes tpf-stamp{0%{transform:rotate(-12deg) scale(2.4);opacity:0}100%{transform:rotate(-12deg) scale(1);opacity:.88}}
@keyframes tpf-rise{0%{transform:translateY(18px) scale(.9);opacity:0}100%{transform:none;opacity:1}}
@keyframes tpf-coin{0%{opacity:0;transform:translate(0,0) rotate(0)}8%{opacity:1}70%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--fall)) rotate(var(--spin))}}
@keyframes tpf-flake{to{transform:translateY(70px) rotate(220deg);opacity:0}}
@keyframes tpf-sheet{from{transform:translateY(100%)}to{transform:none}}
@keyframes tpf-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-2deg)}75%{transform:rotate(2deg)}}
@media (prefers-reduced-motion: reduce){.tpf .foil-text,.tpf .stamp,.tpf .prize-in,.tpf .coin,.tpf .flake,.tpf .sheet,.tpf .wiggle,.tpf .bonus:before{animation:none}}
`;

const FIRST_KEY = "mkb_tp_first_touch";
function thisTouch(): Touch {
  const q = new URLSearchParams(window.location.search);
  const t: Touch = {};
  for (const k of TOUCH_KEYS) { const v = q.get(k); if (v && k !== "landing" && k !== "referrer" && k !== "at") t[k] = v.slice(0, 150); }
  t.landing = window.location.pathname;
  try { const r = document.referrer ? new URL(document.referrer) : null; if (r && r.host !== window.location.host) t.referrer = `${r.origin}${r.pathname}`; } catch { /* none */ }
  t.at = new Date().toISOString();
  return t;
}
const track = (name: "scratch_started" | "info_requested" | "prize_revealed" | "lead", extra?: Record<string, unknown>) => {
  try {
    const fb = window.fbq, ga = window.gtag;
    if (name === "lead") { fb?.("track", "Lead"); ga?.("event", "generate_lead", { form_name: "bf_tax_prize" }); return; }
    fb?.("trackCustom", name === "scratch_started" ? "ScratchStarted" : name === "info_requested" ? "PrizeInfoRequested" : "PrizeRevealed", extra);
    ga?.("event", name, { funnel: "bf_tax_prize", ...extra });
  } catch { /* analytics never break the page */ }
};
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };

/* ------------------------------------------------------------------ the ticket */
function Ticket({ phase, prize, onStart, onJam, sweep }: { phase: "fresh" | "scratching" | "jammed" | "revealed"; prize: number | null; onStart: () => void; onJam: () => void; sweep: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flakes = useRef<HTMLDivElement>(null);
  const coin = useRef<HTMLDivElement>(null);
  const down = useRef(false);
  const moves = useRef(0);
  const started = useRef(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const locked = phase === "jammed" || phase === "revealed";

  const paint = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = "source-over";
    const grad = g.createLinearGradient(0, 0, r.width, r.height);
    [["#7a4a08", 0], ["#c08a22", .22], ["#f6d98a", .42], ["#a8700f", .58], ["#ffe9ad", .76], ["#b8862b", 1]].forEach(([col, o]) => grad.addColorStop(o as number, col as string));
    g.fillStyle = grad; g.fillRect(0, 0, r.width, r.height);
    // brushed lines + glitter, so it reads as real foil
    for (let y = 0; y < r.height; y += 2) { g.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.05})`; g.fillRect(0, y, r.width, 1); }
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,250,220,${Math.random() * 0.5})`; g.fillRect(Math.random() * r.width, Math.random() * r.height, 1.1, 1.1); }
    g.save(); g.translate(r.width / 2, r.height / 2); g.rotate(-0.12);
    g.fillStyle = "rgba(70,40,4,.55)"; g.font = "400 22px Anton, Impact, sans-serif"; g.textAlign = "center";
    for (let row = -3; row <= 3; row++) g.fillText("SCRATCH  ✦  TO  ✦  WIN  ✦  SCRATCH  ✦  TO  ✦  WIN", (row % 2) * 40, row * 30 + 8);
    g.restore();
    // From here on, drawing erases the foil completely.
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "#000";
  }, []);
  useEffect(() => { paint(); const on = () => paint(); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, [paint]);

  // After the details are in: the coin sweeps the rest of the foil away.
  useEffect(() => {
    if (!sweep) return;
    const c = canvas.current; if (!c) return;
    const g = c.getContext("2d")!; const r = c.getBoundingClientRect();
    let i = 0; const rows = 7, steps = 18;
    const id = setInterval(() => {
      const row = Math.floor(i / steps), k = i % steps;
      const x = row % 2 ? r.width - (k / steps) * r.width : (k / steps) * r.width;
      const y = 10 + row * ((r.height - 20) / (rows - 1));
      g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fill();
      if (coin.current) { coin.current.style.opacity = "1"; coin.current.style.transform = `translate(${x - 22}px, ${y - 22}px)`; }
      if (++i >= rows * steps) { clearInterval(id); g.clearRect(0, 0, c.width, c.height); if (coin.current) coin.current.style.opacity = "0"; }
    }, 14);
    return () => clearInterval(id);
  }, [sweep]);

  const flake = (x: number, y: number) => {
    const host = flakes.current; if (!host) return;
    for (let n = 0; n < 2; n++) {
      const el = document.createElement("span");
      el.className = "flake";
      el.style.left = `${x + (Math.random() * 16 - 8)}px`; el.style.top = `${y + (Math.random() * 10 - 5)}px`;
      el.style.background = ["#f6d98a", "#c08a22", "#ffe9ad", "#8a5a12"][Math.floor(Math.random() * 4)];
      host.appendChild(el); setTimeout(() => el.remove(), 950);
    }
  };
  const scratch = (e: React.PointerEvent) => {
    const c = canvas.current!; const r = c.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (coin.current) { coin.current.style.opacity = down.current || e.pointerType === "mouse" ? "1" : "0"; coin.current.style.transform = `translate(${x - 22}px, ${y - 22}px)`; }
    if (!down.current || locked) return;
    if (!started.current) { started.current = true; onStart(); track("scratch_started"); }
    const g = c.getContext("2d")!;
    g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fill();
    if (moves.current % 2 === 0) flake(x, y);
    if (++moves.current % 8 === 0) buzz(4);
    if (moves.current % 10 === 0) {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let clear = 0, n = 0;
      for (let i = 3; i < d.length; i += 4 * 50) { n++; if (d[i] < 40) clear++; }
      // The foil "jams" at 80% scratched: where should we send your prize?
      if (clear / n > 0.8) { down.current = false; buzz([20, 50, 20]); onJam(); }
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const w = wrap.current; if (!w || e.pointerType !== "mouse") return;
    const r = w.getBoundingClientRect();
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -5, y: ((e.clientX - r.left) / r.width - 0.5) * 7 });
  };

  return (
    <div className="mx-auto w-full max-w-[600px] [perspective:1200px]" onPointerMove={onMove} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
      <div ref={wrap} className={`ticket relative flex overflow-hidden rounded-[6px] ${phase === "jammed" ? "wiggle" : ""}`} style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        {/* stub */}
        <div className="relative hidden w-[118px] shrink-0 flex-col justify-between border-r-2 border-dashed border-[#0d0c0a]/30 p-3 sm:flex">
          <div>
            <p className="anton text-[13px] leading-none tracking-wider">ADMIT ONE</p>
            <p className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#0d0c0a]/60">Black Friday</p>
          </div>
          <div className="flex h-[54px] items-end gap-[2px]" aria-hidden>{[3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1].map((w, i) => <span key={i} className="block bg-[#0d0c0a]" style={{ width: w, height: `${60 + ((i * 37) % 40)}%` }} />)}</div>
          <p className="font-mono text-[10px] tracking-wider text-[#0d0c0a]/70">№ 2026-BF-11</p>
        </div>
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="anton text-[22px] leading-none sm:text-[26px]">BLACK FRIDAY <span style={{ color: GOLD }}>TAX PRIZE</span></p>
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-[#0d0c0a]/55 sm:block">Every ticket wins</p>
          </div>
          <p className="mt-1 text-[11.5px] text-[#0d0c0a]/65">Valid toward your 2026 tax return prepared by MKB Financial Group</p>
          <div className="relative mt-3 overflow-hidden rounded-[4px] border-2 border-[#0d0c0a]/80 bg-[#fbf6e8]" style={{ height: 170 }}>
            {/* what's under the foil */}
            <div className="absolute inset-0 flex items-center justify-center gap-3 px-3">
              {prize ? (
                <div className="prize-in text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#0d0c0a]/60">You won</p>
                  <p className="anton text-[64px] leading-[0.95] sm:text-[78px]" style={{ color: INK }}>{usd0(prize)} <span style={{ color: GOLD }}>OFF</span></p>
                  <p className="text-[12.5px] font-semibold text-[#0d0c0a]/75">your 2026 tax prep</p>
                </div>
              ) : (
                <div className="text-center"><p className="anton text-[56px] leading-none text-[#0d0c0a]/10">$ ? ? OFF</p></div>
              )}
              {prize && <span className="stamp anton absolute right-3 top-3 text-[20px] sm:text-[24px]">WINNER</span>}
            </div>
            <canvas ref={canvas} aria-hidden className={`absolute inset-0 h-full w-full touch-none ${locked ? "" : "cursor-none"}`}
              onPointerDown={(e) => { if (locked) return; down.current = true; (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); scratch(e); }}
              onPointerMove={scratch}
              onPointerUp={() => { down.current = false; if (coin.current) coin.current.style.opacity = "0"; }}
              onPointerLeave={() => { if (coin.current) coin.current.style.opacity = "0"; }}
              onPointerCancel={() => { down.current = false; }} />
            <div ref={coin} aria-hidden className="pointer-events-none absolute left-0 top-0 h-11 w-11 opacity-0 transition-opacity" style={{ background: `url('${COIN}') center/contain no-repeat` }} />
            <div ref={flakes} aria-hidden className="pointer-events-none absolute inset-0" />
            {phase === "jammed" && !prize && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#0d0c0a]/85 py-1.5 text-center text-[12px] font-bold uppercase tracking-[0.18em] text-[#f6d98a]">Almost there…</div>}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10.5px] text-[#0d0c0a]/55">
            <span>{phase === "fresh" ? "Scratch with your finger or mouse" : phase === "revealed" ? "Prize locked to your name" : "Keep going"}</span>
            <span className="font-mono">MKB · {TAX_PRIZE.redeemBy.replace(", 2027", " '27")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Gold coins that tumble down at different speeds, fade out, and are gone after a few seconds. */
function CoinRain() {
  const [on, setOn] = useState(true);
  const coins = useRef(Array.from({ length: 28 }, () => ({
    left: Math.random() * 100, size: 20 + Math.random() * 18, delay: Math.random() * 0.9, dur: 1.8 + Math.random() * 1.4,
    fall: 45 + Math.random() * 55, dx: (Math.random() - 0.5) * 120, spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
  }))).current;
  useEffect(() => { const t = setTimeout(() => setOn(false), 4500); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">{coins.map((c, i) => <span key={i} className="coin" style={{ left: `${c.left}%`, width: c.size, height: c.size, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, ["--fall" as string]: `${c.fall}vh`, ["--dx" as string]: `${c.dx}px`, ["--spin" as string]: `${c.spin}deg` } as React.CSSProperties} />)}</div>;
}

/* ------------------------------------------------------------------ the details sheet */
type Data = { who: string; ind: string; bizName: string; biz: string; name: string; phone: string; email: string; state: string; consent: boolean };
const EMPTY: Data = { who: "", ind: "", bizName: "", biz: "", name: "", phone: "", email: "", state: "", consent: false };
const field = "h-12 w-full rounded-xl border border-[#d9cfb8] bg-white px-3.5 text-[16px] text-[#0d0c0a] placeholder:text-[#9a8f78] focus:border-[#b8862b] focus:outline-none focus:ring-4 focus:ring-[#b8862b]/20";
const fmtPhone = (v: string) => { const d = v.replace(/\D/g, "").slice(-10); return d.length < 4 ? d : d.length < 7 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; };

function Choice({ options, value, onChange, icons }: { options: readonly string[]; value: string; onChange: (v: string) => void; icons?: React.ComponentType<{ size?: number }>[] }) {
  return (
    <div className="grid gap-2" role="radiogroup">
      {options.map((o, i) => { const I = icons?.[i]; return (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3.5 text-left text-[15px] font-semibold ${value === o ? "border-[#b8862b] bg-[#fbf3df] text-[#0d0c0a] ring-2 ring-[#b8862b]/30" : "border-[#d9cfb8] bg-white text-[#3a352b]"}`}>
          {I && <I size={18} />}<span className="flex-1">{o}</span>{value === o && <Check size={18} className="text-[#8a5d0f]" />}
        </button>
      ); })}
    </div>
  );
}

function Sheet({ onSubmit, busy, err, emailOpt, setEmailOpt, smsOpt, setSmsOpt, privacyHref, onRules }: { onSubmit: (d: Data) => void; busy: boolean; err: string | null; emailOpt: boolean; setEmailOpt: (v: boolean) => void; smsOpt: boolean; setSmsOpt: (v: boolean) => void; privacyHref: string | null; onRules: () => void }) {
  const [d, setD] = useState<Data>(EMPTY);
  const [tried, setTried] = useState(false);
  const set = (k: keyof Data, v: string | boolean) => setD((x) => ({ ...x, [k]: v }));
  const missing = [!d.who && "who's filing", d.who === FILER.me && !d.ind && "which return", d.who === FILER.biz && !d.bizName.trim() && "business name", d.who === FILER.biz && !d.biz && "business type", !d.name.trim() && "name", d.phone.replace(/\D/g, "").length !== 10 && "mobile number", !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim()) && "email", !d.state && "state", !d.consent && "the Official Rules box"].filter(Boolean) as string[];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label="Where should we send your prize?">
      <div className="sheet max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-[22px] bg-[#f7f2e6] text-[#0d0c0a] sm:rounded-[22px]">
        <div className="sticky top-0 z-10 border-b border-[#e6dcc4] bg-[#f7f2e6]/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#0d0c0a]/15 sm:hidden" />
          <p className="hand text-[22px] leading-none text-[#8a5d0f]">so close!</p>
          <h2 className="serif mt-1 text-[26px] leading-tight">Your prize is under the last of the foil.</h2>
          <p className="mt-1 text-[14px] text-[#5b5444]">Tell us where to send it and we&rsquo;ll reveal it. 30 seconds.</p>
        </div>
        <form className="space-y-5 px-5 pb-6 pt-4" onSubmit={(e) => { e.preventDefault(); setTried(true); if (!missing.length) onSubmit(d); }} noValidate>
          <div><p className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[#5b5444]">Who&rsquo;s filing?</p><Choice options={[FILER.me, FILER.biz]} value={d.who} onChange={(v) => set("who", v)} icons={[Home, Briefcase]} /></div>
          {d.who === FILER.me && <div><p className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[#5b5444]">Which return?</p><Choice options={IND_TYPES} value={d.ind} onChange={(v) => set("ind", v)} /></div>}
          {d.who === FILER.biz && (
            <div className="space-y-3">
              <input aria-label="Business name" placeholder="Business name" className={field} value={d.bizName} onChange={(e) => set("bizName", e.target.value)} />
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#5b5444]">Business type</p>
              <Choice options={BIZ_TYPES} value={d.biz} onChange={(v) => set("biz", v)} />
            </div>
          )}
          <div className="grid gap-2.5">
            <input aria-label="Full name" autoComplete="name" placeholder="Full name" className={field} value={d.name} onChange={(e) => set("name", e.target.value)} />
            <input aria-label="Mobile phone" autoComplete="tel" inputMode="tel" placeholder="Mobile phone" className={field} value={d.phone} onChange={(e) => set("phone", fmtPhone(e.target.value))} />
            <input aria-label="Email" autoComplete="email" inputMode="email" type="email" placeholder="Email" className={field} value={d.email} onChange={(e) => set("email", e.target.value)} />
            <div className="grid grid-cols-3 gap-2">{["Louisiana", "Texas", "Another state"].map((s) => <button key={s} type="button" aria-pressed={d.state === s} onClick={() => set("state", s)} className={`h-11 rounded-xl border text-[13.5px] font-semibold ${d.state === s ? "border-[#b8862b] bg-[#fbf3df] ring-2 ring-[#b8862b]/30" : "border-[#d9cfb8] bg-white text-[#3a352b]"}`}>{s}</button>)}</div>
          </div>

          {/* The VIP bonus: texts (never pre-checked) */}
          <label className="bonus block cursor-pointer rounded-2xl p-4 text-white">
            <span className="flex items-start gap-3">
              <input type="checkbox" checked={smsOpt} onChange={(e) => setSmsOpt(e.target.checked)} className="mt-0.5 h-7 w-7 shrink-0 cursor-pointer rounded-md accent-[#d9a441]" aria-describedby="sms-terms" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#f6d98a]"><Gift size={14} /> VIP bonus · free</span>
                <span className="mt-1 block text-[17px] font-bold leading-snug">Text me my prize code + unlock my VIP bonus</span>
                <span className="mt-2 grid gap-1 text-[13.5px] text-white/85">
                  <span className="flex gap-2"><Sparkles size={15} className="mt-0.5 shrink-0 text-[#f6d98a]" />The Credit Comeback Vault: credit dispute system + Letter Builder</span>
                  <span className="flex gap-2"><CalendarCheck size={15} className="mt-0.5 shrink-0 text-[#f6d98a]" />Priority filing: first pick of appointments when the IRS opens</span>
                  <span className="flex gap-2"><MessageSquareText size={15} className="mt-0.5 shrink-0 text-[#f6d98a]" />VIP-only deals and deadline reminders</span>
                </span>
              </span>
            </span>
            <span id="sms-terms" className="mt-3 block text-[11px] leading-snug text-white/55">{SMS_DISCLOSURE} {privacyHref && <a href={privacyHref} target="_blank" rel="noreferrer" className="underline">Privacy</a>}</span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-[14px] text-[#3a352b]">
            <input type="checkbox" checked={emailOpt} onChange={(e) => setEmailOpt(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#8a5d0f]" />
            <span>Email me tax tips and MKB offers (unsubscribe any time)</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-[14px] text-[#3a352b]">
            <input type="checkbox" checked={d.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#8a5d0f]" />
            <span>I agree to the <button type="button" onClick={onRules} className="font-semibold underline">Official Rules</button> and that MKB Financial Group may contact me about my prize and my tax return.</span>
          </label>
          {(err || (tried && missing.length > 0)) && <p role="alert" className="rounded-xl bg-[#fbe9e7] px-3.5 py-2.5 text-[13.5px] text-[#8c1d18]">{err ?? `Still needed: ${missing.join(", ")}.`}</p>}
          <button type="submit" disabled={busy} className="foil-btn flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] disabled:opacity-60">{busy ? "Revealing…" : "Reveal my prize"} {!busy && <ArrowRight size={19} />}</button>
          <p className="text-center text-[12px] text-[#7a715c]"><ShieldCheck size={12} className="mr-1 inline" />No Social Security number, no card, no credit check.</p>
        </form>
      </div>
    </div>
  );
}

function BonusNudge({ onAdd, onSkip }: { onAdd: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Don't miss your VIP bonus">
      <div className="prize-in w-full max-w-[420px] rounded-[22px] bg-[#0f0c07] p-6 text-center text-white ring-1 ring-[#b8862b]/50">
        <Gift size={40} className="mx-auto text-[#f6d98a]" />
        <p className="hand mt-2 text-[24px] leading-none text-[#f6d98a]">wait!</p>
        <h3 className="serif mt-1 text-[26px] leading-tight">You&rsquo;re about to leave your VIP bonus behind</h3>
        <p className="mt-2 text-[14.5px] text-white/80">Tick one box and you also get the <b>Credit Comeback Vault</b>, <b>priority filing</b> and your prize code by text. It&rsquo;s free, and you can reply STOP any time.</p>
        <button type="button" onClick={onAdd} className="foil-btn mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px]"><Gift size={18} /> Yes, add my VIP bonus</button>
        <button type="button" onClick={onSkip} className="mt-3 text-[13.5px] text-white/60 underline underline-offset-2">No thanks, just reveal my prize</button>
        <p className="mt-4 text-[10.5px] leading-snug text-white/45">{SMS_DISCLOSURE}</p>
      </div>
    </div>
  );
}

function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Official Rules">
      <div className="max-h-[86vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-white p-6 text-[14px] leading-relaxed text-[#222]">
        <div className="mb-2 flex justify-end"><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-black/5"><X size={20} /></button></div>
        {OFFICIAL_RULES.split("\n").map((ln, i) => ln.startsWith("## ") ? <h3 key={i} className="mt-4 text-[15px] font-bold first:mt-0">{ln.slice(3)}</h3> : <p key={i} className="mt-1">{ln}</p>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the page */
function useLeft() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { const t = () => setLeft(Math.max(0, Date.parse(TAX_PRIZE.closesAt) - Date.now())); t(); const i = setInterval(t, 1000); return () => clearInterval(i); }, []);
  return left;
}

export function TaxPrizeFunnel({ form, tracking, home, privacyHref, claimed }: Props) {
  void form;
  const first = useRef<Touch | undefined>(undefined);
  const latest = useRef<Touch | undefined>(undefined);
  const [phase, setPhase] = useState<"fresh" | "scratching" | "jammed" | "revealed">("fresh");
  const [sheet, setSheet] = useState(false);
  const [nudge, setNudge] = useState<Data | null>(null);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailOpt, setEmailOpt] = useState(true);
  const [smsOpt, setSmsOpt] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [sweep, setSweep] = useState(false);
  const [copied, setCopied] = useState(false);
  const last = useRef<{ d: Data; key: string } | null>(null);
  const left = useLeft();

  useEffect(() => {
    latest.current = thisTouch();
    try { const s = localStorage.getItem(FIRST_KEY); if (s) first.current = JSON.parse(s) as Touch; else { first.current = latest.current; localStorage.setItem(FIRST_KEY, JSON.stringify(latest.current)); } } catch { first.current = latest.current; }
    try { if (!sessionStorage.getItem("mkb_tp_visit")) { sessionStorage.setItem("mkb_tp_visit", "1"); fetch("/api/public/funnels/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ funnel: "credit-vault" }), keepalive: true }).catch(() => {}); } } catch { /* storage blocked */ }
  }, []);

  const send = async (d: Data, sms: boolean) => {
    setBusy(true); setErr(null);
    const key = last.current?.key ?? crypto.randomUUID();
    last.current = { d, key };
    const data: Record<string, string> = { "tp-who": d.who, "tp-name": d.name.trim(), "tp-phone": d.phone, "tp-email": d.email.trim(), "tp-state": d.state, "tp-consent": "Yes", ...(d.who === FILER.me ? { "tp-ind": d.ind } : { "tp-biz-name": d.bizName.trim(), "tp-biz": d.biz }) };
    try {
      const r = await fetch("/api/public/funnels/credit-vault/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, honeypot: "", clientKey: key, emailOptIn: emailOpt, smsOptIn: sms, attribution: { campaign: TAX_PRIZE.campaign, first: first.current, latest: latest.current } }) });
      const j = (await r.json().catch(() => ({}))) as Result & { error?: string };
      if (!r.ok) { setErr(j.error ?? "Something went wrong. Please try again or call 888-379-9372."); setBusy(false); return; }
      track("lead");
      setSheet(false); setNudge(null); setRes(j); setSweep(true);
      setTimeout(() => { setPhase("revealed"); buzz([40, 60, 120]); track("prize_revealed", { prize: j.prizeCents / 100 }); }, 1500);
    } catch { setErr("We couldn't reach the server. Check your connection and try again."); }
    setBusy(false);
  };
  const submit = (d: Data) => { if (!smsOpt) { setNudge(d); return; } void send(d, true); };
  const addBonusLater = async () => { if (last.current) { setSmsOpt(true); await send(last.current.d, true); } };
  const d = left === null ? null : { d: Math.floor(left / 864e5), h: Math.floor((left % 864e5) / 36e5), m: Math.floor((left % 36e5) / 6e4), s: Math.floor((left % 6e4) / 1e3) };
  const ended = left === 0;

  return (
    <div className="tpf min-h-screen text-white" style={{ background: `${GRAIN}, radial-gradient(90% 60% at 80% 0%, #2a2013 0%, ${INK} 55%)`, backgroundColor: INK }}>
      <style>{CSS}</style>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@600&family=DM+Serif+Display&family=Inter:wght@400;600;700;800&display=swap" />
      {tracking.metaPixelId && <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,'${tracking.metaPixelId}');fbq('init','${tracking.metaPixelId}');fbq('track','PageView');`}</Script>}
      {tracking.gaId && (<><Script src={`https://www.googletagmanager.com/gtag/js?id=${tracking.gaId}`} strategy="afterInteractive" /><Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${tracking.gaId}',{allow_google_signals:false,allow_ad_personalization_signals:false});`}</Script></>)}
      {phase === "revealed" && <CoinRain />}

      <header className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6">
        <div className="flex items-center justify-between">
          <a href={home} className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mkb-monogram.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-md" />
            <span className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-white/85">MKB Financial Group</span>
          </a>
          {d && !ended && <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[12px] text-white/80">{d.d}d {String(d.h).padStart(2, "0")}h {String(d.m).padStart(2, "0")}m {String(d.s).padStart(2, "0")}s left</span>}
        </div>

        <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <p className="anton text-[15px] tracking-[0.12em] text-[#f6d98a]">Black Friday · Cyber Monday</p>
            <h1 className="anton mt-1 text-[62px] uppercase leading-[0.9] sm:text-[86px]">Scratch.<br />Win.<br /><span className="foil-text">File for less.</span></h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/80">Every ticket wins <b className="text-white">$25, $50 or $75 off</b> your 2026 tax return with MKB, for you or your business. Claim it by Cyber Monday, use it when you file.</p>
            <p className="hand mt-4 -rotate-2 text-[24px] text-[#f6d98a]">Every ticket wins. I promise. — Krystal</p>
          </div>
          <div>
            <Ticket phase={phase} prize={phase === "revealed" && res ? res.prizeCents : null} sweep={sweep}
              onStart={() => setPhase("scratching")}
              onJam={() => { setPhase("jammed"); track("info_requested"); setTimeout(() => setSheet(true), 450); }} />
            {phase === "fresh" && !ended && <p className="mt-3 text-center text-[13px] text-white/60">Scratch the gold. Or <button type="button" className="font-semibold text-[#f6d98a] underline underline-offset-2" onClick={() => { setPhase("jammed"); setSheet(true); }}>skip to claim</button>.</p>}
            {phase === "jammed" && !sheet && !res && <p className="mt-3 text-center"><button type="button" className="foil-btn h-12 rounded-xl px-6 text-[15px]" onClick={() => setSheet(true)}>Reveal my prize</button></p>}
            {ended && phase === "fresh" && <p className="mt-3 text-center text-[14px] text-white/75">The Black Friday Tax Prize has ended. Thanks for stopping by!</p>}
          </div>
        </div>
      </header>

      {res && phase === "revealed" && (
        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <div className="prize-in rounded-[20px] bg-[#f7f2e6] p-5 text-[#0d0c0a] sm:p-7">
            <p className="hand text-[24px] leading-none text-[#8a5d0f]">{res.again ? "welcome back!" : "congratulations!"}</p>
            <h2 className="serif mt-1 text-[30px] leading-tight sm:text-[36px]">{usd0(res.prizeCents)} off your 2026 tax return is yours.</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-xl border-2 border-dashed border-[#b8862b] bg-white px-4 py-2 font-mono text-[18px] font-bold tracking-wider">{res.code}</span>
              <button type="button" onClick={() => void copyText(res.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#d9cfb8] bg-white px-3.5 text-[14px] font-semibold">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy code"}</button>
              <span className="text-[13px] text-[#5b5444]">Use by {TAX_PRIZE.redeemBy}</span>
            </div>
            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                [Laptop, "Start your return", "Your private 2026 tax interview link is in your inbox now. Start from your phone, even before the IRS opens filing."],
                [FileText, "Mention your code", `When MKB prepares your return, your ${usd0(res.prizeCents)} comes off the fee.`],
                [CalendarCheck, "Rather talk first?", "Book a free call and we'll walk you through it."],
              ].map(([I, t, x], i) => { const Icon = I as React.ComponentType<{ size?: number; className?: string }>; return (
                <li key={i} className="rounded-2xl bg-white p-4"><Icon size={20} className="text-[#8a5d0f]" /><p className="mt-2 text-[15px] font-bold">{t as string}</p><p className="mt-1 text-[13.5px] leading-snug text-[#5b5444]">{x as string}</p></li>
              ); })}
            </ol>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <a href="/book-consultation" className="foil-btn inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px]"><CalendarCheck size={18} /> Book a call</a>
              {res.vip && res.kit ? (
                <a href={res.kit} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0d0c0a] px-6 text-[15px] font-semibold text-white"><Gift size={18} className="text-[#f6d98a]" /> Open my VIP bonus</a>
              ) : (
                <button type="button" disabled={busy} onClick={() => void addBonusLater()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0d0c0a] px-6 text-[15px] font-semibold text-white"><Gift size={18} className="text-[#f6d98a]" /> {busy ? "Adding…" : "Add my VIP bonus (text me)"}</button>
              )}
            </div>
            {!res.vip && <p className="mt-2 text-[11px] leading-snug text-[#7a715c]">{SMS_DISCLOSURE}</p>}
          </div>
        </section>
      )}

      <section className="border-t border-white/10">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="anton text-[14px] tracking-[0.14em] text-[#f6d98a]">Why file with MKB</p>
            <h2 className="serif mt-2 text-[32px] leading-tight">Real tax pros, from your phone.</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-white/75">MKB Financial Group prepares individual and business returns virtually for clients in Louisiana and Texas. Upload documents to your secure portal, answer your interview at your own pace, and talk to a real person whenever you want.</p>
          </div>
          <ul className="grid gap-3 text-[15px]">
            {[
              ["Individuals & families", "W-2s, self-employment, rentals, credits you might be missing."],
              ["Businesses", "S corporations (1120-S), C corporations (1120), partnerships and LLCs (1065), Schedule C."],
              ["IRS-credentialed", "PTIN, AFSP and an IRS e-file provider (EFIN)."],
              ["Secure by design", "Encrypted client portal; we never ask for your SSN by text or email."],
            ].map(([t, x]) => <li key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="font-bold">{t}</p><p className="mt-0.5 text-[14px] text-white/70">{x}</p></li>)}
          </ul>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h2 className="serif text-[28px]">Questions</h2>
          {[
            ["Does every ticket really win?", "Yes. Every valid entry wins $25, $50 or $75 off MKB's fee to prepare your 2026 tax return. One prize per person and household."],
            ["The IRS isn't open yet. When do I use it?", `Claim it by Cyber Monday (Nov 30), then use it when MKB prepares your 2026 return, by ${TAX_PRIZE.redeemBy}. You can start your tax interview right away.`],
            ["Does it work for my business?", "Yes. Choose \"My business\" and your business type, and you'll get the right interview: 1120-S, 1120, 1065 or Schedule C."],
            ["What's the VIP bonus?", "Opt in to texts and you also get the Credit Comeback Vault (a credit dispute system with a Letter Builder), priority filing appointments and VIP-only deals. It's optional; you win either way."],
          ].map(([q, a]) => (
            <details key={q} className="border-b border-white/10 py-4"><summary className="cursor-pointer list-none text-[16px] font-semibold">{q}</summary><p className="mt-2 text-[14.5px] leading-relaxed text-white/75">{a}</p></details>
          ))}
          <p className="mt-6 text-[13px] text-white/60"><button type="button" onClick={() => setRules(true)} className="underline">Official Rules</button>{privacyHref && <> · <a href={privacyHref} className="underline">Privacy Policy</a></>} · No purchase necessary.{claimed >= 25 ? ` ${claimed.toLocaleString()} tickets claimed.` : ""}</p>
        </div>
      </section>
      <footer className="border-t border-white/10 px-4 py-8 text-center text-[12px] text-white/45 sm:px-6">MKB Financial Group · 888-379-9372 · info@mkbfinancialgroup.com · Lake Charles, Louisiana</footer>

      {sheet && <Sheet onSubmit={submit} busy={busy} err={err} emailOpt={emailOpt} setEmailOpt={setEmailOpt} smsOpt={smsOpt} setSmsOpt={setSmsOpt} privacyHref={privacyHref} onRules={() => setRules(true)} />}
      {nudge && <BonusNudge onAdd={() => { setSmsOpt(true); void send(nudge, true); }} onSkip={() => void send(nudge, false)} />}
      {rules && <Rules onClose={() => setRules(false)} />}
    </div>
  );
}
