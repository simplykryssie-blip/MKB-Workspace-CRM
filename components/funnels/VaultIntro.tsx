"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/**
 * The Money Vault intro, made from MKB's two vault photos (door closed, door open). It starts on
 * the closed photo; "Open the vault" spins the wheel, swings the real door open on its hinge
 * (the open room shows behind it), lands on the open photo, lights the doorway, pushes in and
 * flashes into the page. About 4 seconds. Skip intro / Esc; once per browser session;
 * skipped for reduced motion.
 *
 * Scene coordinates are the photos' own pixels (1672 x 941; both photos line up): door centre
 * (1092, 438), door radius ~420, hinge axis at x 615 on the left.
 */
const SEEN = "mkb_mv_intro_seen";
const PW = 1672, PH = 941, CX = 1092, CY = 438, DOOR_R = 420;
/** The door cut from the closed photo: left edge = hinge axis (x 615), from y 16; 901 x 844. */
const DX = 615, DY = 16, DW = 901, DH = 844, HUBX = 1095 - DX, HUBY = 437 - DY, WR = 292;

type Fit = { s: number; tx: number; ty: number; portrait: boolean };
function fit(): Fit {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vw / vh < 1.05;
  if (portrait) {
    // Phones: the door fills the width, centred a little above the middle; the words sit underneath.
    // Centred on the whole door including its hinge (x 580..1516).
    const s = Math.min(vw / 960, (vh * 0.6) / 960);
    return { s, tx: vw / 2 - 1048 * s, ty: vh * 0.39 - CY * s, portrait };
  }
  const s = Math.min(Math.max(vw / PW, vh / PH), (vh * 0.8) / (2 * DOOR_R));
  return { s, tx: vw / 2 - CX * s, ty: vh * 0.035 + DOOR_R * s - CY * s, portrait };
}

export function VaultIntro({ taxYear }: { taxYear: number }) {
  const [phase, setPhase] = useState<"closed" | "opening" | "leaving" | "gone">("closed");
  const [f, setF] = useState<Fit | null>(null);
  useEffect(() => {
    let skip = false;
    try { skip = sessionStorage.getItem(SEEN) === "1"; } catch { /* storage blocked */ }
    if (skip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPhase("gone");
  }, []);
  useLayoutEffect(() => {
    const on = () => setF(fit());
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
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
    window.setTimeout(() => setPhase("leaving"), 4000);
    window.setTimeout(() => setPhase("gone"), 4650);
  };
  if (phase === "gone") return null;

  return (
    <div className={`vi ${phase !== "closed" ? "is-open" : ""} ${phase === "leaving" ? "is-leaving" : ""} ${f?.portrait ? "is-portrait" : ""}`} role="dialog" aria-modal="true" aria-label="Unlock your tax return">
      <style>{CSS}</style>
      {/* Runs before the page paints: already seen this session, or reduced motion → no flash of the closed vault. */}
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("${SEEN}")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("mv-no-intro")}catch(e){}` }} />
      <div className="vi-scene" style={f ? { transform: `translate(${f.tx}px, ${f.ty}px) scale(${f.s})`, opacity: 1 } : undefined} aria-hidden>
        <div className="vi-zoom">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="vi-plate" src="/campaigns/vault-plate.webp" srcSet="/campaigns/vault-plate-1100.webp 1100w, /campaigns/vault-plate.webp 1672w" sizes="100vw" alt="" width={PW} height={PH} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="vi-plate" src="/campaigns/vault-room.webp" srcSet="/campaigns/vault-room-1100.webp 1100w, /campaigns/vault-room.webp 1672w" sizes="100vw" alt="" width={PW} height={PH} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="vi-photo" src="/campaigns/money-vault-1672.webp" alt="" width={PW} height={PH} />
          <div className="vi-glow"><div className="vi-rays" /></div>
          <div className="vi-door">
            <div className="vi-face vi-front">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="vi-door-img" src="/campaigns/vault-door-closed.webp" alt="" width={DW} height={DH} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="vi-wheel" src="/campaigns/vault-wheel-closed.webp" alt="" width={WR * 2} height={WR * 2} />
              <div className="vi-glint" />
            </div>
            <div className="vi-face vi-back">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="vi-inner" src="/campaigns/vault-inner.webp" alt="" width={DOOR_R * 2} height={DOOR_R * 2} />
            </div>
          </div>
        </div>
      </div>
      <div className="vi-shade" aria-hidden />
      <button type="button" onClick={finish} className="vi-skip">Skip intro</button>
      <div className="vi-copy">
        <p className="vi-eyebrow">2027 tax season · Tax year {taxYear}</p>
        <h2 className="vi-title">Unlock your <span className="vi-foil">{taxYear} tax return.</span></h2>
        <button type="button" onClick={open} className="vi-open" autoFocus>Open the vault</button>
      </div>
      <div className="vi-flash" aria-hidden />
    </div>
  );
}

const FOIL = "linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)";
const CSS = `
.mv-no-intro .vi{display:none}
.vi{position:fixed;inset:0;z-index:60;overflow:hidden;background:#050403;color:#fff;transition:opacity .6s ease}
.vi.is-leaving{opacity:0}
.vi-scene{position:absolute;left:0;top:0;width:${PW}px;height:${PH}px;transform-origin:0 0;opacity:0;transition:opacity .4s ease;
  -webkit-mask:radial-gradient(ellipse 880px 640px at ${CX}px ${CY}px,#000 62%,transparent 100%);mask:radial-gradient(ellipse 880px 640px at ${CX}px ${CY}px,#000 62%,transparent 100%)}
.vi-zoom{position:absolute;inset:0;transform-origin:${CX}px ${CY}px;perspective:3200px;perspective-origin:${CX}px ${CY}px;transition:transform 1.5s cubic-bezier(.7,0,.25,1) 2.45s}
.is-open .vi-zoom{transform:scale(3.3)}
.vi-plate,.vi-photo{position:absolute;inset:0;width:100%;height:100%;display:block}
.vi-photo{opacity:0;transition:opacity .45s ease 2.1s}
.is-open .vi-photo{opacity:1}
.vi-glow{position:absolute;left:${CX - 395}px;top:${CY - 395}px;width:790px;height:790px;border-radius:50%;overflow:hidden;opacity:0;mix-blend-mode:screen;
  background:radial-gradient(circle,rgba(255,250,228,1) 0%,rgba(255,231,161,.9) 22%,rgba(247,215,127,.55) 45%,rgba(184,121,18,.25) 70%,transparent 100%);transition:opacity 1.3s ease 1.25s}
.is-open .vi-glow{opacity:1}
.vi-rays{position:absolute;inset:-35%;background:repeating-conic-gradient(from 0deg,rgba(255,246,214,.45) 0deg 2deg,transparent 2deg 9deg);filter:blur(2px);
  -webkit-mask:radial-gradient(circle,#000 8%,transparent 60%);mask:radial-gradient(circle,#000 8%,transparent 60%);animation:vi-spin 20s linear infinite}
.vi-door{position:absolute;left:${DX}px;top:${DY}px;width:${DW}px;height:${DH}px;transform-style:preserve-3d;transform-origin:0 50%;
  transition:transform 1.7s cubic-bezier(.5,0,.2,1) 1.0s,opacity .4s ease 2.15s}
.is-open .vi-door{transform:rotateY(-112deg);opacity:0}
.vi-face{position:absolute;inset:0;-webkit-backface-visibility:hidden;backface-visibility:hidden}
.vi-door-img{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 26px 40px rgba(0,0,0,.55))}
.vi-inner{position:absolute;left:${DW - (CX - DX) - DOOR_R}px;top:${CY - DY - DOOR_R}px;width:${DOOR_R * 2}px;height:${DOOR_R * 2}px;border-radius:50%}
.vi-back{transform:rotateY(180deg)}
.vi-front{transition:filter 1.7s ease 1.0s}
.is-open .vi-front{filter:brightness(.7)}
.vi-front .vi-wheel{position:absolute;left:${HUBX - WR}px;top:${HUBY - WR}px;width:${WR * 2}px;height:${WR * 2}px;transition:transform 1.15s cubic-bezier(.6,0,.3,1)}
.is-open .vi-wheel{transform:rotate(-405deg)}
.vi-glint{position:absolute;inset:0;-webkit-mask:url(/campaigns/vault-door-closed.webp) 0 0/100% 100%;mask:url(/campaigns/vault-door-closed.webp) 0 0/100% 100%;background:linear-gradient(105deg,transparent 35%,rgba(255,244,210,.0) 40%,rgba(255,244,210,.38) 50%,rgba(255,244,210,0) 60%,transparent 65%);background-size:300% 100%;background-position:100% 0;mix-blend-mode:screen}
.is-open .vi-glint{background-position:0% 0;transition:background-position 1s ease .05s}
.vi-shade{position:absolute;left:0;right:0;bottom:0;height:46%;background:linear-gradient(transparent,rgba(5,4,3,.82) 55%,#050403);pointer-events:none;transition:opacity .4s}
.is-portrait .vi-shade{height:52%}
.is-open .vi-shade{opacity:0}
.vi-skip{position:absolute;top:16px;right:16px;z-index:3;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.7);padding:8px 10px;text-shadow:0 1px 6px #000}
.vi-skip:hover{color:#fff}
.vi-copy{position:absolute;left:16px;right:16px;bottom:max(5vh,28px);z-index:2;text-align:center;transition:opacity .35s ease,transform .35s ease}
.is-open .vi-copy{opacity:0;transform:translateY(14px);pointer-events:none}
.vi-eyebrow{font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;background:${FOIL};-webkit-background-clip:text;background-clip:text;color:transparent}
.vi-title{margin-top:8px;font-family:Georgia,'Times New Roman',serif;font-weight:500;font-size:clamp(30px,5vw,54px);line-height:1.06;letter-spacing:-.01em;text-shadow:0 2px 18px rgba(0,0,0,.6)}
.vi-foil{background:${FOIL};background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:vi-shine 6s ease-in-out infinite}
.vi-open{margin-top:clamp(14px,2.4vh,22px);height:52px;padding:0 34px;border-radius:999px;font-size:13px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#1a1206;
  background:${FOIL};background-size:200% 100%;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 0 1px rgba(255,231,161,.35),0 10px 34px -8px rgba(247,215,127,.65);
  animation:vi-shine 4s ease-in-out infinite,vi-pulse 2.4s ease-in-out infinite}
.vi-open:hover{filter:brightness(1.08)}
.vi-flash{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%,#fffdf3 0%,#ffe7a1 45%,#f7d77f 100%);transition:opacity .75s ease 3.15s}
.is-open .vi-flash{opacity:1}
@keyframes vi-spin{to{transform:rotate(360deg)}}
@keyframes vi-shine{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes vi-pulse{0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 0 1px rgba(255,231,161,.35),0 10px 34px -8px rgba(247,215,127,.55)}50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 0 1px rgba(255,231,161,.6),0 10px 44px -4px rgba(247,215,127,.9)}}
@media (prefers-reduced-motion: reduce){.vi *{animation:none!important;transition:none!important}}
`;
