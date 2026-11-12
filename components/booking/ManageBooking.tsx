"use client";

import { useCallback, useEffect, useState } from "react";
import { S, SlotPicker, fmtWhen } from "./BookingWidget";

type View = { title: string; when: string; startsAt: string; where: string; staff: string; brand: string; meetingUrl: string; status: string; payment: string; price: number; canChange: boolean; lateNote: string };

/** The client's private link: see the appointment, reschedule or cancel. */
export function ManageBooking({ token, paid, unpaid }: { token: string; paid?: boolean; unpaid?: boolean }) {
  const [v, setV] = useState<View | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"" | "move" | "cancel">("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const url = `/api/public/booking/manage/${encodeURIComponent(token)}`;
  const post = useCallback(async (b: Record<string, unknown>) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    const j = (await r.json().catch(() => ({}))) as View & { error?: string };
    if (!r.ok) throw new Error(j.error ?? "Something went wrong. Please call us.");
    return j;
  }, [url]);
  const load = useCallback(() => fetch(url).then(async (r) => (r.ok ? ((await r.json()) as View) : null)).catch(() => null), [url]);
  useEffect(() => {
    let stop = false;
    (async () => {
      if (unpaid) { try { setV(await post({ action: "release" })); } catch { setV(await load()); } return; }
      let x = await load();
      // Coming back from Stripe: wait a moment for the payment to be confirmed.
      for (let i = 0; paid && x?.payment === "pending" && i < 10 && !stop; i++) { await new Promise((r) => setTimeout(r, 3000)); x = await load(); }
      if (!stop) setV(x);
    })();
    return () => { stop = true; };
  }, [load, post, paid, unpaid]);
  useEffect(() => { if (mode === "move") { setSlots(null); fetch(`${url}/slots`).then(async (r) => setSlots(r.ok ? ((await r.json()) as { slots: string[] }).slots : [])).catch(() => setSlots([])); } }, [mode, url]);

  if (v === undefined) return <div style={S.card}><p style={S.sub}>{paid ? "Confirming your payment…" : "Loading…"}</p></div>;
  if (!v) return <div style={S.card}><h2 style={S.h}>This link isn&rsquo;t valid any more</h2><p style={S.sub}>If you rescheduled, use the link in your newest email. Otherwise please call us.</p></div>;
  if (unpaid && v.status === "cancelled" && v.payment === "pending") return <div style={S.card}><h2 style={S.h}>Payment not completed</h2><p style={S.sub}>Your appointment wasn&rsquo;t booked and the time was released. You can choose a time again whenever you&rsquo;re ready.</p><a href={`/w/book${v.brand === "monarch" ? "?brand=monarch" : ""}`} style={{ ...S.btn, display: "inline-block", textDecoration: "none" }}>Book again</a></div>;

  const act = async (b: Record<string, unknown>, ok: string) => {
    setBusy(true); setErr("");
    try { const r = await post(b); setV(r); setMsg(ok); setMode(""); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    setBusy(false);
  };
  const heading = msg ? msg : v.status === "cancelled" ? "This appointment is cancelled" : v.payment === "pending" ? "Waiting for your payment" : v.status === "scheduled" ? "You're booked" : "Your appointment";
  return (
    <div style={S.card}>
      <h2 style={S.h}>{heading}</h2>
      <p style={{ ...S.sub, margin: "0 0 4px" }}><b>{v.title}</b> with {v.staff}</p>
      <p style={{ ...S.sub, margin: "0 0 4px" }}>{v.status === "moved" ? v.when : fmtWhen(v.startsAt)}</p>
      {v.status !== "cancelled" && <p style={{ ...S.sub, margin: "0 0 14px" }}>{v.meetingUrl ? <>Video call: <a href={v.meetingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#6e4105", fontWeight: 700 }}>Join the Zoom meeting</a></> : v.where}</p>}
      {v.status === "moved" && <p style={S.sub}>We emailed you the new time with a new link (this one no longer works).</p>}
      {v.payment === "pending" && v.status === "scheduled" && <p style={S.sub}>We haven&rsquo;t received your payment yet. If you just paid, refresh this page in a minute — you&rsquo;ll also get a confirmation email.</p>}
      {v.lateNote && <p style={S.sub}>{v.lateNote}</p>}
      {v.canChange && !mode && <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}><button type="button" onClick={() => setMode("move")} style={S.btn}>Reschedule</button><button type="button" onClick={() => setMode("cancel")} style={S.ghost}>Cancel appointment</button></div>}
      {mode === "move" && <div style={{ marginTop: 8 }}>
        <span style={S.label}>Choose a new day and time</span>
        <SlotPicker slots={slots} value={at} onPick={setAt} />
        <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}><button type="button" disabled={!at || busy} onClick={() => void act({ action: "reschedule", at }, "Rescheduled")} style={{ ...S.btn, opacity: !at || busy ? 0.6 : 1 }}>{busy ? "Saving…" : at ? `Move to ${new Date(at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "Choose a time"}</button><button type="button" onClick={() => setMode("")} style={S.ghost}>Keep my time</button></div>
      </div>}
      {mode === "cancel" && <div style={{ marginTop: 8 }}>
        <p style={S.sub}>Cancel this appointment?{v.payment === "paid" ? " We'll contact you about your refund." : ""}</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}><button type="button" disabled={busy} onClick={() => void act({ action: "cancel" }, "Your appointment is cancelled")} style={S.btn}>{busy ? "Cancelling…" : "Yes, cancel it"}</button><button type="button" onClick={() => setMode("")} style={S.ghost}>Keep it</button></div>
      </div>}
      {err && <p style={S.err} role="alert">{err}</p>}
    </div>
  );
}
