"use client";

import { useEffect, useState } from "react";

/**
 * The Money Vault intro: a closed, round gold vault door fills the screen. "Open the vault"
 * spins the wheel, pulls the locking bolts, swings the door open on its hinge, floods the
 * room with light and pushes in through the doorway into the page. Drawn in SVG/CSS (no
 * video), about 3.5 seconds. Skipped for people who ask for reduced motion, and shown once
 * per browser session.
 */
const SEEN = "mkb_mv_intro_seen";
/** Rounded so the server and the browser draw identical numbers. */
const pt = (deg: number, r: number) => ({ x: Math.round(Math.cos((deg * Math.PI) / 180) * r * 100) / 100, y: Math.round(Math.sin((deg * Math.PI) / 180) * r * 100) / 100 });
const FOIL = [["0", "#6e4105"], ["0.18", "#b87912"], ["0.36", "#f7d77f"], ["0.54", "#a96808"], ["0.72", "#ffe7a1"], ["0.86", "#b87912"], ["1", "#6e4105"]] as const;

function Foil({ id, x1 = "0", y1 = "0", x2 = "1", y2 = "0.6" }: { id: string; x1?: string; y1?: string; x2?: string; y2?: string }) {
  return <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>{FOIL.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}</linearGradient>;
}
function BoltGrad({ id }: { id: string }) {
  return (
    <radialGradient id={id} cx="0.5" cy="0.5" r="0.5" fx="0.35" fy="0.3">
      <stop offset="0" stopColor="#fff6cf" /><stop offset="0.35" stopColor="#efc560" /><stop offset="0.75" stopColor="#8a5a0e" /><stop offset="1" stopColor="#2e1c03" />
    </radialGradient>
  );
}

/** The doorway frame: a thick foil ring studded with bolts. */
function Frame() {
  const bolts = Array.from({ length: 28 }, (_, i) => (i * 360) / 28);
  return (
    <svg viewBox="-300 -300 600 600" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs><Foil id="vf-ring" /><Foil id="vf-ring2" x1="1" y1="0" x2="0" y2="1" /><BoltGrad id="vf-bolt" />
        <radialGradient id="vf-lip" r="0.5"><stop offset="0.86" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.85" /></radialGradient>
      </defs>
      <circle r="292" fill="none" stroke="url(#vf-ring2)" strokeWidth="6" />
      <circle r="268" fill="none" stroke="url(#vf-ring)" strokeWidth="42" />
      <circle r="268" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="42" strokeDasharray="1 5" />
      <circle r="248" fill="none" stroke="#120c04" strokeWidth="6" />
      <circle r="289" fill="none" stroke="#fff3c4" strokeOpacity="0.5" strokeWidth="1" />
      {bolts.map((a) => { const q = pt(a, 268); return <circle key={a} cx={q.x} cy={q.y} r="8.5" fill="url(#vf-bolt)" />; })}
    </svg>
  );
}

/** The door itself: brushed dark metal, foil rings, locking bolts and the spoked wheel. */
function Door() {
  const bolts = Array.from({ length: 12 }, (_, i) => i * 30);
  const spokes = Array.from({ length: 6 }, (_, i) => i * 60);
  return (
    <svg viewBox="-270 -270 540 540" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <Foil id="vd-foil" /><Foil id="vd-foil2" x1="0" y1="1" x2="1" y2="0" /><BoltGrad id="vd-bolt" />
        <radialGradient id="vd-face" cx="0.42" cy="0.38" r="0.7"><stop offset="0" stopColor="#4a3c2a" /><stop offset="0.45" stopColor="#221b13" /><stop offset="1" stopColor="#0b0907" /></radialGradient>
        <linearGradient id="vd-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.16" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      {/* Locking bolts (behind the door's edge, sticking out into the frame). */}
      {bolts.map((a) => <g key={a} transform={`rotate(${a})`}><rect className="mv-bolt" x="-10" y="-266" width="20" height="44" rx="5" fill="url(#vd-foil)" stroke="#3d2604" strokeWidth="1.5" /></g>)}
      <circle r="244" fill="url(#vd-face)" />
      {/* Brushed metal: fine concentric lines. */}
      {Array.from({ length: 34 }, (_, i) => <circle key={i} r={18 + i * 6.6} fill="none" stroke="#ffe7a1" strokeOpacity={i % 2 ? 0.035 : 0.06} strokeWidth="1.2" />)}
      <circle r="238" fill="none" stroke="url(#vd-foil)" strokeWidth="12" />
      <circle r="229" fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="3" />
      <circle r="196" fill="none" stroke="url(#vd-foil2)" strokeWidth="4" />
      <circle r="150" fill="none" stroke="url(#vd-foil)" strokeWidth="2" strokeOpacity="0.75" />
      {Array.from({ length: 16 }, (_, i) => i * 22.5).map((a) => { const q = pt(a, 213); return <circle key={a} cx={q.x} cy={q.y} r="6" fill="url(#vd-bolt)" />; })}
      {/* The wheel. */}
      <g className="mv-wheel">
        {spokes.map((a) => <g key={a} transform={`rotate(${a})`}><rect x="-7" y="-118" width="14" height="118" rx="4" fill="url(#vd-foil)" /><circle cy="-124" r="14" fill="url(#vd-bolt)" /></g>)}
        <circle r="100" fill="none" stroke="url(#vd-foil2)" strokeWidth="14" />
        <circle r="100" fill="none" stroke="#fff3c4" strokeOpacity="0.35" strokeWidth="1" />
        <circle r="40" fill="url(#vd-foil)" />
        <circle r="22" fill="#1a130a" />
        <circle r="12" fill="url(#vd-bolt)" />
      </g>
      <circle r="244" fill="url(#vd-sheen)" />
    </svg>
  );
}

export function VaultIntro({ taxYear }: { taxYear: number }) {
  const [phase, setPhase] = useState<"closed" | "opening" | "leaving" | "gone">("closed");
  useEffect(() => {
    let skip = false;
    try { skip = sessionStorage.getItem(SEEN) === "1"; } catch { /* storage blocked */ }
    if (skip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPhase("gone");
  }, []);
  useEffect(() => {
    if (phase === "gone") { document.documentElement.style.overflow = ""; return; }
    document.documentElement.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const remember = () => { try { sessionStorage.setItem(SEEN, "1"); } catch { /* storage blocked */ } };
  const finish = () => { remember(); setPhase("leaving"); window.setTimeout(() => setPhase("gone"), 650); };
  const open = () => {
    if (phase !== "closed") return;
    remember();
    setPhase("opening");
    window.setTimeout(() => setPhase("leaving"), 3300);
    window.setTimeout(() => setPhase("gone"), 3950);
  };
  if (phase === "gone") return null;

  return (
    <div className={`mv-intro ${phase !== "closed" ? "is-open" : ""} ${phase === "leaving" ? "is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Unlock your tax return">
      <style>{INTRO_CSS}</style>
      {/* Runs before the page paints: already seen this session, or reduced motion → no flash of the closed vault. */}
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("${SEEN}")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("mv-no-intro")}catch(e){}` }} />
      <div className="mv-room" aria-hidden />
      <button type="button" onClick={finish} className="mv-skip">Skip intro</button>
      <div className="mv-scene">
        <div className="mv-stage">
          <div className="mv-light"><div className="mv-rays" /></div>
          <Frame />
          <div className="mv-hinge"><div className="mv-door"><Door /></div></div>
        </div>
        <div className="mv-copy">
          <p className="mv-eyebrow">2027 tax season · Tax year {taxYear}</p>
          <h2 className="mv-title">Unlock your <span className="mv-foiltext">{taxYear} tax return.</span></h2>
          <button type="button" onClick={open} className="mv-open" autoFocus>Open the vault</button>
        </div>
      </div>
      <div className="mv-flash" aria-hidden />
    </div>
  );
}

const INTRO_CSS = `
.mv-no-intro .mv-intro{display:none}
.mv-intro{position:fixed;inset:0;z-index:60;overflow:hidden;background:#060504;color:#fff;transition:opacity .6s ease}
.mv-intro.is-leaving{opacity:0}
.mv-room{position:absolute;inset:0;background:
  radial-gradient(ellipse 55% 45% at 50% 42%,rgba(184,121,18,.20),transparent 70%),
  repeating-linear-gradient(90deg,rgba(255,231,161,.025) 0 2px,transparent 2px 120px),
  linear-gradient(#0b0907,#050403 70%,#0d0a06)}
.mv-room::after{content:"";position:absolute;left:0;right:0;bottom:0;height:22%;background:linear-gradient(transparent,rgba(184,121,18,.10));}
.mv-skip{position:absolute;top:18px;right:18px;z-index:3;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.6);padding:8px 10px}
.mv-skip:hover{color:#fff}
.mv-scene{position:relative;z-index:1;display:flex;height:100%;flex-direction:column;align-items:center;justify-content:center;gap:clamp(14px,3vh,30px);padding:24px 16px}
.mv-stage{position:relative;width:min(86vw,62vh,640px);aspect-ratio:1;flex-shrink:0;transition:transform 1.5s cubic-bezier(.7,0,.25,1) 1.95s;filter:drop-shadow(0 0 40px rgba(184,121,18,.35))}
.is-open .mv-stage{transform:scale(3.4)}
.mv-light{position:absolute;inset:9%;border-radius:50%;overflow:hidden;opacity:0;transition:opacity 1.1s ease 1.05s;box-shadow:inset 0 0 0 5px rgba(46,24,2,.75),inset 0 0 70px 26px rgba(38,19,0,.8);
  background:radial-gradient(circle,#fffbea 0%,#ffe7a1 22%,#f7d77f 38%,#b87912 62%,#3a2203 100%)}
.is-open .mv-light{opacity:1}
.mv-stage::after{content:"";position:absolute;left:8%;right:8%;bottom:-13%;height:12%;border-radius:50%;background:radial-gradient(ellipse,rgba(247,215,127,.30),transparent 70%);filter:blur(8px);transition:opacity 1.2s ease 1.1s,transform 1.2s ease 1.1s;opacity:.6}
.is-open .mv-stage::after{opacity:1;transform:scaleX(1.4)}
.mv-light::after{content:"";position:absolute;inset:16%;border-radius:50%;box-shadow:0 0 0 2px rgba(110,65,5,.35),inset 0 0 40px 6px rgba(110,65,5,.35)}
.mv-rays{position:absolute;inset:-40%;filter:blur(1.5px);background:repeating-conic-gradient(from 0deg,rgba(255,250,225,.38) 0deg 2.5deg,transparent 2.5deg 11deg);
  -webkit-mask:radial-gradient(circle,#000 10%,transparent 62%);mask:radial-gradient(circle,#000 10%,transparent 62%);animation:mv-spin 18s linear infinite}
.mv-hinge{position:absolute;inset:5%;perspective:1100px}
.mv-door{width:100%;height:100%;transform-origin:96% 50%;transition:transform 1.45s cubic-bezier(.55,0,.2,1) 1.05s,filter 1.45s ease 1.05s;filter:drop-shadow(0 18px 30px rgba(0,0,0,.6))}
.is-open .mv-door{transform:rotateY(-112deg);filter:drop-shadow(-30px 10px 40px rgba(0,0,0,.8)) brightness(.8)}
.mv-wheel{transform-box:fill-box;transform-origin:center;transition:transform 1.05s cubic-bezier(.6,0,.3,1)}
.is-open .mv-wheel{transform:rotate(-320deg)}
.mv-bolt{transition:transform .45s cubic-bezier(.6,0,.3,1) .55s}
.is-open .mv-bolt{transform:translateY(30px)}
.mv-copy{text-align:center;max-width:640px;transition:opacity .35s ease,transform .35s ease}
.is-open .mv-copy{opacity:0;transform:translateY(14px);pointer-events:none}
.mv-eyebrow{font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;background:linear-gradient(115deg,#b87912,#f7d77f,#ffe7a1,#b87912);-webkit-background-clip:text;background-clip:text;color:transparent}
.mv-title{margin-top:8px;font-family:Georgia,'Times New Roman',serif;font-weight:500;font-size:clamp(30px,5.4vw,54px);line-height:1.06;letter-spacing:-.01em}
.mv-foiltext{background:linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:mv-shine 6s ease-in-out infinite}
.mv-open{margin-top:clamp(14px,2.6vh,24px);height:52px;padding:0 34px;border-radius:999px;font-size:13px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#1a1206;
  background:linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105);background-size:200% 100%;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 0 1px rgba(255,231,161,.35),0 10px 34px -8px rgba(247,215,127,.65);animation:mv-shine 4s ease-in-out infinite,mv-pulse 2.4s ease-in-out infinite}
.mv-open:hover{filter:brightness(1.08)}
.mv-flash{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%,#fffdf3 0%,#ffe7a1 45%,#f7d77f 100%);transition:opacity .75s ease 2.55s}
.is-open .mv-flash{opacity:1}
@keyframes mv-spin{to{transform:rotate(360deg)}}
@keyframes mv-shine{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes mv-pulse{0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 0 1px rgba(255,231,161,.35),0 10px 34px -8px rgba(247,215,127,.55)}50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 0 1px rgba(255,231,161,.55),0 10px 44px -4px rgba(247,215,127,.9)}}
@media (prefers-reduced-motion: reduce){.mv-intro *{animation:none!important;transition:none!important}}
`;
