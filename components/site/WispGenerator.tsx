"use client";

import { useMemo, useState } from "react";
import { LOCATION_OPTIONS, PEOPLE_OPTIONS, SAFEGUARDS, WISP_DISCLAIMER, type Answer } from "@/lib/monarch/wisp";

/**
 * WISP Generator (Monarch funnel step 2). The visitor answers about their
 * practice and safeguards; the server builds the plan as a PDF (downloaded
 * here and emailed) and saves them as a Monarch lead. Nothing is sent in the
 * editor preview.
 */
type Result = { score: number; yes: number; total: number; gaps: string[]; emailed: boolean; fileName: string; pdf: string };
const AREAS = [...new Set(SAFEGUARDS.map((s) => s.area))];

export function WispGenerator({ preview, nextHref }: { preview?: boolean; nextHref: string }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState({ businessName: "", ownerName: "", email: "", phone: "", city: "", state: "", qualifiedIndividual: "", people: "", locations: "", software: "" });
  const [ans, setAns] = useState<Record<string, Answer>>({});
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const steps = useMemo(() => ["Your practice", ...AREAS], []);
  const area = step > 0 ? AREAS[step - 1] : null;
  const qs = area ? SAFEGUARDS.filter((s) => s.area === area) : [];
  const set = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setP((x) => ({ ...x, [k]: e.target.value }));
  const practiceOk = p.businessName.trim() && p.ownerName.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email);
  const last = step === steps.length - 1;
  const stepOk = step === 0 ? !!practiceOk : qs.every((q) => ans[q.key]);

  const download = (r: Result) => {
    const bytes = Uint8Array.from(atob(r.pdf), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url; a.download = r.fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const submit = async () => {
    if (preview) { setErr("Preview — nothing is sent from here."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/public/monarch-wisp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ practice: p, safeguards: ans, consent, website: hp }) });
      const d = (await r.json().catch(() => ({}))) as Result & { error?: string };
      if (!r.ok) { setErr(d.error ?? "Something went wrong. Please try again."); return; }
      setRes(d);
      download(d);
    } catch { setErr("Couldn't connect — check your internet and try again."); }
    finally { setBusy(false); }
  };

  if (res)
    return (
      <div className="mform done wisp">
        <p className="wisp-step">Your plan is ready</p>
        <h3>{res.score}% of safeguards in place</h3>
        <p>{res.yes} of {res.total} safeguards are in place. Your plan downloaded{res.emailed ? ` and a copy was emailed to ${p.email}` : ""}.</p>
        {res.gaps.length > 0 && (<><p style={{ fontWeight: 700, marginTop: 14 }}>What to work on next</p><ul>{res.gaps.slice(0, 6).map((g, i) => <li key={i}>{g}</li>)}</ul>{res.gaps.length > 6 && <p>…and {res.gaps.length - 6} more in your plan&rsquo;s action list.</p>}</>)}
        <div className="wisp-actions">
          <button type="button" className="btn outline-dark" onClick={() => download(res)}>Download again</button>
          <a className="btn gold" href={nextHref}>See your next steps →</a>
        </div>
      </div>
    );

  return (
    <div className="mform wisp">
      <p className="wisp-step">Step {step + 1} of {steps.length} · {steps[step]}</p>
      <div className="wisp-bar" aria-hidden="true"><span style={{ width: `${Math.round(((step + 1) / steps.length) * 100)}%` }} /></div>
      {step === 0 ? (
        <>
          <div className="grid2">
            <label><span>Business name *</span><input value={p.businessName} onChange={set("businessName")} autoComplete="organization" /></label>
            <label><span>Your name *</span><input value={p.ownerName} onChange={set("ownerName")} autoComplete="name" /></label>
            <label><span>Email (we&rsquo;ll send your plan) *</span><input type="email" value={p.email} onChange={set("email")} autoComplete="email" /></label>
            <label><span>Phone</span><input type="tel" value={p.phone} onChange={set("phone")} autoComplete="tel" /></label>
            <label><span>City</span><input value={p.city} onChange={set("city")} /></label>
            <label><span>State</span><input value={p.state} maxLength={2} onChange={set("state")} /></label>
            <label><span>Who is responsible for security? (your &ldquo;Qualified Individual&rdquo;)</span><input value={p.qualifiedIndividual} onChange={set("qualifiedIndividual")} placeholder="Leave blank if it's you" /></label>
            <label><span>Tax software you use</span><input value={p.software} onChange={set("software")} /></label>
            <label><span>People who handle client data</span><select value={p.people} onChange={set("people")}><option value="">Choose…</option>{PEOPLE_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label><span>Office locations</span><select value={p.locations} onChange={set("locations")}><option value="">Choose…</option>{LOCATION_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
          </div>
          <label className="hp" aria-hidden="true"><span>Website</span><input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label>
        </>
      ) : (
        <div className="wisp-qs">
          {qs.map((q) => (
            <fieldset key={q.key}>
              <legend>{q.question}</legend>
              <div className="wisp-opts">
                {(["yes", "no", "unsure"] as Answer[]).map((v) => (
                  <label key={v} className={ans[q.key] === v ? "on" : ""}><input type="radio" name={q.key} checked={ans[q.key] === v} onChange={() => setAns((x) => ({ ...x, [q.key]: v }))} /> {v === "yes" ? "Yes" : v === "no" ? "No" : "Not sure"}</label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      {last && <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> <span>Email me my plan. I agree that Monarch Tax Suite may contact me by phone, text or email about it. Message and data rates may apply; I can opt out anytime.</span></label>}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="wisp-actions">
        {step > 0 && <button type="button" className="btn outline-dark" onClick={() => { setErr(null); setStep(step - 1); }}>Back</button>}
        {!last
          ? <button type="button" className="btn gold" disabled={!stepOk} onClick={() => { setErr(null); setStep(step + 1); }}>Next</button>
          : <button type="button" className="btn gold" disabled={!stepOk || !consent || busy} onClick={() => void submit()}>{busy ? "Building your plan…" : "Generate my WISP"}</button>}
      </div>
      <p className="wisp-note">{WISP_DISCLAIMER}</p>
    </div>
  );
}
