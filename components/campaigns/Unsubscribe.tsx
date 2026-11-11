"use client";

import { useEffect, useState } from "react";

/** Confirms and records an unsubscribe. Plain page, no login. */
export function Unsubscribe({ token }: { token: string }) {
  const url = `/api/public/unsubscribe/${encodeURIComponent(token)}`;
  const [info, setInfo] = useState<{ brand: string; brandName: string; email: string; unsubscribed: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(url, { cache: "no-store" }).then(async (r) => { const d = (await r.json().catch(() => ({}))) as { error?: string; brand: string; brandName: string; email: string; unsubscribed: boolean }; if (!r.ok) setErr(d.error ?? "This link isn't valid."); else { setInfo(d); setDone(!!d.unsubscribed); } }).catch(() => setErr("Couldn't connect. Please try again."));
  }, [url]);
  const go = async () => {
    setBusy(true);
    try { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); if (!r.ok) throw new Error(); setDone(true); }
    catch { setErr("Something went wrong. Please try again, or call 833-379-3320."); }
    setBusy(false);
  };
  const logo = info?.brand === "monarch" ? "/brand/monarch-email.png" : "/brand/mkb-seal-192.png";
  return (
    <main style={{ minHeight: "100vh", background: "#0b0b0b", color: "#f4efe4", fontFamily: "Arial, Helvetica, sans-serif", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#151413", border: "1px solid #3a3122", borderRadius: 14, padding: "30px 26px", textAlign: "center" }}>
        {info && <img src={logo} alt={info.brandName} style={{ height: info.brand === "monarch" ? 44 : 64, margin: "0 auto 18px", display: "block" }} />}
        {err ? <><h1 style={{ font: "500 26px Georgia, serif", margin: "0 0 10px" }}>We couldn&rsquo;t open this link</h1><p style={{ color: "#bdb5a6" }}>{err}</p></>
          : !info ? <p style={{ color: "#bdb5a6" }}>Loading…</p>
          : done ? <><h1 style={{ font: "500 26px Georgia, serif", margin: "0 0 10px" }}>You&rsquo;re unsubscribed</h1><p style={{ color: "#bdb5a6", lineHeight: 1.6 }}><b>{info.email}</b> won&rsquo;t receive marketing emails from {info.brandName} anymore. You&rsquo;ll still get emails about services you use, like receipts and document requests.</p></>
          : <><h1 style={{ font: "500 26px Georgia, serif", margin: "0 0 10px" }}>Unsubscribe?</h1><p style={{ color: "#bdb5a6", lineHeight: 1.6 }}>Stop marketing emails from {info.brandName} to <b>{info.email}</b>.</p>
            <button onClick={go} disabled={busy} style={{ marginTop: 18, minHeight: 48, padding: "12px 26px", border: "1px solid #8a5f1d", borderRadius: 6, fontWeight: 700, fontSize: 14, color: "#1b1306", background: "linear-gradient(115deg,#9b6b20,#f2dc98,#c49a43,#f8e7a9,#b88932)", cursor: "pointer" }}>{busy ? "Unsubscribing…" : "Unsubscribe"}</button></>}
      </div>
    </main>
  );
}
