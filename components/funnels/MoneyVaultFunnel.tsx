"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { ArrowDown, BadgeCheck, Briefcase, CalendarCheck, FileSignature, Lock, Mail, MapPin, ShieldCheck, User, Users } from "lucide-react";
import { FormRenderer, type FormEvent } from "@/components/forms/FormRenderer";
import { TOUCH_KEYS, type LeadForm, type Touch } from "@/lib/forms/config";
import { VaultIntro } from "./VaultIntro";

/**
 * The 2027 Money Vault campaign page (/unlock). A landing page with the inquiry form
 * built in (one section at a time). Analytics get event names and step numbers only:
 * never names, emails, phone numbers or answers.
 */
type Tracking = { metaPixelId: string; gaId: string };
type Props = { form: LeadForm; tracking: Tracking; campaignId: string; taxYear: number; home: string; privacyHref: string | null };

declare global {
  interface Window { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] }
}

const FIRST_KEY = "mkb_mv_first_touch";
/** This visit's campaign tags (from the address) — the page address is kept without its query string. */
function thisTouch(): Touch {
  const q = new URLSearchParams(window.location.search);
  const t: Touch = {};
  for (const k of TOUCH_KEYS) { const v = q.get(k); if (v && k !== "landing" && k !== "referrer" && k !== "at") t[k] = v.slice(0, 150); }
  t.landing = window.location.pathname;
  try { const r = document.referrer ? new URL(document.referrer) : null; if (r && r.host !== window.location.host) t.referrer = `${r.origin}${r.pathname}`; } catch { /* no referrer */ }
  t.at = new Date().toISOString();
  return t;
}

function track(e: FormEvent) {
  const fb = window.fbq, ga = window.gtag;
  const p = { step: e.step, total_steps: e.total };
  if (e.name === "form_started") { fb?.("trackCustom", "InquiryStarted"); ga?.("event", "form_start", { form_name: "money_vault" }); }
  if (e.name === "step_completed") { fb?.("trackCustom", "InquiryStep", p); ga?.("event", "form_step", { form_name: "money_vault", ...p }); }
  if (e.name === "form_submitted") ga?.("event", "form_submit", { form_name: "money_vault" });
  if (e.name === "form_success") { fb?.("track", "Lead"); ga?.("event", "generate_lead", { form_name: "money_vault" }); }
  if (e.name === "form_error") ga?.("event", "form_error", { form_name: "money_vault" });
}

const PALETTE = { "--accent": "#8a5d0f", "--accent-hover": "#744e0c", "--accent-soft": "#f7eedc", "--accent-ink": "#6b470a" } as React.CSSProperties;
/** MKB's metallic gold foil (same as the website), for text, buttons, icons and the form. */
const FOIL = "linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)";
const FOIL_CSS = `
.mvf .foil-text{background:${FOIL};background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:mvf-shine 7s ease-in-out infinite}
.mvf .foil-btn,.mvf form button.bg-accent{background:${FOIL};background-size:200% 100%;color:#1a1206;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 0 0 1px rgba(184,121,18,.35),0 8px 22px -10px rgba(184,121,18,.8);transition:background-position .6s ease,filter .2s}
.mvf .foil-btn:hover,.mvf form button.bg-accent:hover{background-position:100% 50%;filter:brightness(1.05)}
.mvf form [role=progressbar]>div{background:${FOIL}}
.mvf .foil-bg{background:${FOIL}}
.mvf .foil-rule{height:2px;width:64px;border-radius:2px;background:${FOIL};margin-top:14px}
@keyframes mvf-shine{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@media (prefers-reduced-motion: reduce){.mvf .foil-text{animation:none}}
`;
/** Lucide icons take this as their stroke colour, so they're drawn in foil too. */
const ICON = "url(#mvf-foil)";

export function MoneyVaultFunnel({ form, tracking, campaignId, taxYear, home, privacyHref }: Props) {
  const first = useRef<Touch | undefined>(undefined);
  const latest = useRef<Touch | undefined>(undefined);
  useEffect(() => {
    latest.current = thisTouch();
    // First visit's tags are remembered on this device (campaign tags only — nothing personal).
    try {
      const saved = localStorage.getItem(FIRST_KEY);
      if (saved) first.current = JSON.parse(saved) as Touch;
      else { first.current = latest.current; localStorage.setItem(FIRST_KEY, JSON.stringify(latest.current)); }
    } catch { first.current = latest.current; }
    // One visit per browser session in the campaign report.
    try {
      if (!sessionStorage.getItem("mkb_mv_visit")) {
        sessionStorage.setItem("mkb_mv_visit", "1");
        fetch("/api/public/funnels/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ funnel: "money-vault" }), keepalive: true }).catch(() => {});
      }
    } catch { /* storage blocked: skip the count */ }
  }, []);

  const submit = async (data: Record<string, string>, honeypot: string, clientKey: string) => {
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      try {
        const r = await fetch(`/api/public/forms/${encodeURIComponent(form.slug)}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ data, honeypot, clientKey, attribution: { campaign: campaignId, first: first.current, latest: latest.current } }),
        });
        if (r.ok) return;
        if (r.status < 500) return ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong. Please try again or call us at 888-379-9372.";
      } catch { /* network hiccup: try once more with the same one-time key */ }
    }
    return "We couldn't send your answers. Please check your connection and try again, or call us at 888-379-9372.";
  };

  const toForm = () => document.getElementById("start")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div style={PALETTE} className="mvf min-h-screen bg-bg text-ink">
      <style>{FOIL_CSS}</style>
      <svg width="0" height="0" className="absolute" aria-hidden><defs><linearGradient id="mvf-foil" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stopColor="#6e4105" /><stop offset=".3" stopColor="#b87912" /><stop offset=".5" stopColor="#e9b949" /><stop offset=".7" stopColor="#a96808" /><stop offset="1" stopColor="#6e4105" /></linearGradient></defs></svg>
      <VaultIntro taxYear={taxYear} />
      {tracking.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tracking.metaPixelId}');fbq('track','PageView');`}</Script>
      )}
      {tracking.gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${tracking.gaId}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${tracking.gaId}');`}</Script>
        </>
      )}

      {/* Hero */}
      <header className="relative overflow-hidden bg-[#0d0c0a] text-white">
        <picture>
          <source type="image/webp" srcSet="/campaigns/money-vault-800.webp 800w, /campaigns/money-vault-1280.webp 1280w, /campaigns/money-vault-1672.webp 1672w" sizes="100vw" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/campaigns/money-vault-1280.jpg" srcSet="/campaigns/money-vault-800.jpg 800w, /campaigns/money-vault-1280.jpg 1280w" sizes="100vw" alt="" fetchPriority="high" className="block aspect-[16/9] w-full object-cover md:absolute md:inset-0 md:h-full md:aspect-auto md:object-[30%_50%]" />
        </picture>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-full bg-gradient-to-l from-black/80 via-black/45 to-transparent md:block" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[calc(56.25vw-6rem)] h-24 bg-gradient-to-b from-transparent to-[#0d0c0a] md:hidden" />
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 md:flex md:min-h-[86vh] md:flex-col md:pb-20">
          <a href={home} className="flex items-center gap-2.5 md:mb-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mkb-monogram.webp" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-lg" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/85">MKB Financial Group</span>
          </a>
          <div className="mt-6 max-w-xl md:mb-auto md:ml-auto md:mr-[2%] md:mt-16 md:max-w-[34rem]">
            <p className="foil-text text-[12.5px] font-bold uppercase tracking-[0.2em]">2027 tax season · Tax year {taxYear}</p>
            <h1 className="mt-3 font-serif text-[38px] font-medium leading-[1.08] tracking-tight sm:text-[52px]">Unlock your <span className="foil-text">{taxYear} tax return.</span></h1>
            <p className="mt-4 text-[17px] leading-relaxed text-white/85">Start from your phone. Answer a few quick questions and we&rsquo;ll email you a private link to begin your tax interview, or book a call if you&rsquo;d rather talk first.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button onClick={toForm} className="foil-btn h-12 rounded-xl px-7 text-[15px]">Start my inquiry</button>
              <a href="#how" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-6 text-[15px] font-semibold text-white hover:border-white/60">How it works <ArrowDown size={16} /></a>
            </div>
            <p className="mt-6 flex items-center gap-2 text-[13.5px] text-white/75"><MapPin size={15} color={ICON} /> Virtual service in Louisiana and Texas</p>
          </div>
        </div>
      </header>

      {/* How it works */}
      <section id="how" className="scroll-mt-4 border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-serif text-[30px] font-medium tracking-tight">How it works</h2><div className="foil-rule" aria-hidden />
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { icon: Users, title: "Tell us about you", text: "A short inquiry, about two minutes: who you're filing for, your contact details and how you found us." },
              { icon: Mail, title: "Check your email", text: "We email you a private link to your tax interview. Prefer to talk first? The same email has a button to book a call." },
              { icon: FileSignature, title: "We prepare, you approve", text: "Upload your documents in our secure portal. We prepare your return and you review and sign before anything is filed." },
            ].map((s, i) => (
              <li key={s.title} className="rounded-2xl bg-bg p-6 ring-1 ring-line">
                <div className="flex items-center gap-3"><span className="foil-bg grid h-9 w-9 place-items-center rounded-full text-[#1a1206] shadow-[inset_0_1px_0_rgba(255,255,255,.5)]"><s.icon size={18} /></span><span className="text-[13px] font-semibold text-muted">Step {i + 1}</span></div>
                <h3 className="mt-4 text-[18px] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who we help */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-[30px] font-medium tracking-tight">Who we help</h2><div className="foil-rule" aria-hidden />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: User, title: "Individuals and families", text: "Personal returns, including new jobs, a new home, a new baby or life changes." },
            { icon: Briefcase, title: "Self-employed and gig workers", text: "Schedule C returns for freelancers, side businesses and single-member LLCs." },
            { icon: CalendarCheck, title: "Small businesses", text: "S corporations, partnerships and C corporations, with bookkeeping help if you need it." },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-surface p-6">
              <c.icon size={24} color={ICON} />
              <h3 className="mt-3 text-[17px] font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Credentials and privacy */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-[28px] font-medium tracking-tight">Who prepares your return</h2><div className="foil-rule" aria-hidden />
            <ul className="mt-6 space-y-3.5 text-[15.5px]">
              {["IRS-registered tax preparer (PTIN)", "IRS Annual Filing Season Program participant", "IRS Authorized e-file Provider", "Virtual service in Louisiana and Texas"].map((c) => (
                <li key={c} className="flex items-start gap-3"><BadgeCheck size={20} color={ICON} className="mt-0.5 shrink-0" />{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-[28px] font-medium tracking-tight">Your information stays protected</h2><div className="foil-rule" aria-hidden />
            <p className="mt-6 flex items-start gap-3 text-[15.5px] leading-relaxed text-ink-2"><ShieldCheck size={20} color={ICON} className="mt-0.5 shrink-0" />This page never asks for Social Security numbers, bank details, dates of birth or documents.</p>
            <p className="mt-3.5 flex items-start gap-3 text-[15.5px] leading-relaxed text-ink-2"><Lock size={20} color={ICON} className="mt-0.5 shrink-0" />Those are collected later, only through your private interview link and our secure client portal.</p>
          </div>
        </div>
      </section>

      {/* The inquiry */}
      <section id="start" className="scroll-mt-4 mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-[32px] font-medium tracking-tight">Start your {taxYear} return</h2><div className="foil-rule" aria-hidden />
        <p className="mb-7 mt-2 text-[15.5px] text-ink-2">{form.intro ?? "A few quick questions, about two minutes."}</p>
        <FormRenderer form={form} mode="live" hideHeader doneTitle="Check your email" onSubmit={submit} onEvent={track} />
      </section>

      {/* Questions */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="font-serif text-[28px] font-medium tracking-tight">Questions</h2><div className="foil-rule" aria-hidden />
          <div className="mt-6 divide-y divide-line">
            {[
              ["Do I need to come into an office?", "No. We work virtually with clients in Louisiana and Texas: the interview, documents, review and signing all happen online. You can also book a call."],
              ["What happens after I send the inquiry?", "We email you a private link to your tax interview. Your answers save as you go, so you can stop and come back. The email also has a button to book a call."],
              ["Do I need my documents now?", "No. Start with the inquiry. After your interview we send you a list of what to upload in your secure client portal."],
              ["How much does it cost?", "It depends on your return. We'll tell you the fee before we start preparing it."],
              ["I didn't get the email.", "Check your spam or promotions folder. Still nothing? Call us at 888-379-9372."],
            ].map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="cursor-pointer list-none text-[16px] font-semibold marker:hidden">{q}</summary>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a}</p>
              </details>
            ))}
          </div>
          <button onClick={toForm} className="foil-btn mt-8 h-12 w-full rounded-xl px-7 text-[15px] sm:w-auto">Start my inquiry</button>
        </div>
      </section>

      <footer className="bg-[#0d0c0a] px-4 py-8 text-center text-[13px] text-white/70">
        <p><a href={home} className="foil-text font-semibold hover:underline">MKB Financial Group</a> · <a href="tel:8883799372" className="hover:underline">888-379-9372</a> · Virtual service in Louisiana and Texas</p>
        <p className="mt-2">© {new Date().getFullYear()} MKB Financial Group{privacyHref ? <> · <a href={privacyHref} className="hover:underline">Privacy policy</a></> : null}</p>
      </footer>
    </div>
  );
}
