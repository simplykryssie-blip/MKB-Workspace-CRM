"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * The public booking calendar (MKB or Monarch). Shown inside a website page
 * (a frame) or on its own at /w/book. Times are shown in the visitor's own
 * time zone. Paid appointment types go on to Stripe to pay.
 */
type PubType = { id: string; name: string; durationMin: number; location: string; locationLabel: string; priceCents: number; description: string; staff: { id: string; name: string }[] };
type Page = { brand: "mkb" | "monarch"; types: PubType[]; payOnline: boolean };

const GOLD = "#b87912";
export const S = {
  card: { background: "#fff", border: "1px solid #e5e1d8", borderRadius: 14, padding: "22px 20px", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", textAlign: "left" } as React.CSSProperties,
  h: { font: "500 22px/1.25 Georgia, serif", margin: "0 0 6px", color: "#111" } as React.CSSProperties,
  sub: { fontSize: 14, color: "#555", margin: "0 0 16px", lineHeight: 1.5 } as React.CSSProperties,
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#333", margin: "0 0 6px" } as React.CSSProperties,
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cfc9bc", borderRadius: 8, padding: "11px 12px", fontSize: 15, color: "#111", background: "#fff" } as React.CSSProperties,
  btn: { background: "#0b0b0b", color: "#f6d37a", border: 0, borderRadius: 6, padding: "13px 20px", fontWeight: 700, fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer" } as React.CSSProperties,
  ghost: { background: "transparent", color: "#6e4105", border: 0, padding: "6px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer" } as React.CSSProperties,
  err: { background: "#fdecec", color: "#8a1c1c", borderRadius: 8, padding: "10px 12px", fontSize: 14, margin: "12px 0 0" } as React.CSSProperties,
};
const chip = (on: boolean): React.CSSProperties => ({ border: `1.5px solid ${on ? GOLD : "#d9d3c6"}`, background: on ? "#fbf4e4" : "#fff", color: "#111", borderRadius: 10, padding: "10px 12px", fontSize: 14, cursor: "pointer", textAlign: "left", fontWeight: on ? 700 : 500 });
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const tzName = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " "); } catch { return ""; } };
const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? "Something went wrong. Please try again or call us.");
  return j;
}

/** Days with open times, then the times on the chosen day. */
export function SlotPicker({ slots, value, onPick }: { slots: string[] | null; value: string; onPick: (iso: string) => void }) {
  const days = useMemo(() => { const m = new Map<string, string[]>(); for (const s of slots ?? []) m.set(dayKey(s), [...(m.get(dayKey(s)) ?? []), s]); return [...m.entries()]; }, [slots]);
  const [day, setDay] = useState("");
  useEffect(() => { if (days.length && !days.some(([k]) => k === day)) setDay(value ? dayKey(value) : days[0][0]); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!slots) return <p style={S.sub}>Finding open times…</p>;
  if (!days.length) return <p style={S.sub}>No open times right now. Please call us and we&rsquo;ll find a time.</p>;
  const times = days.find(([k]) => k === day)?.[1] ?? [];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }} role="listbox" aria-label="Day">
        {days.map(([k, list]) => { const d = new Date(list[0]); const on = k === day; return (
          <button key={k} type="button" role="option" aria-selected={on} onClick={() => setDay(k)} style={{ ...chip(on), minWidth: 74, textAlign: "center", flex: "0 0 auto", padding: "8px 6px" }}>
            <span style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#8a6a2a" }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
            <span style={{ display: "block", fontSize: 20, fontWeight: 700 }}>{d.getDate()}</span>
            <span style={{ display: "block", fontSize: 11, color: "#666" }}>{d.toLocaleDateString("en-US", { month: "short" })}</span>
          </button>); })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }} role="listbox" aria-label="Time">
        {times.map((t) => <button key={t} type="button" role="option" aria-selected={value === t} onClick={() => onPick(t)} style={{ ...chip(value === t), textAlign: "center" }}>{new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</button>)}
      </div>
      <p style={{ fontSize: 12.5, color: "#777", margin: "10px 0 0" }}>Times are in your time zone{tzName() ? ` (${tzName()})` : ""}.</p>
    </div>
  );
}

export function BookingWidget({ brand, typeId, preview }: { brand: "mkb" | "monarch"; typeId?: string; preview?: boolean }) {
  const [page, setPage] = useState<Page | null | undefined>(undefined);
  const [type, setType] = useState<PubType | null>(null);
  const [member, setMember] = useState("any");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [at, setAt] = useState("");
  const [f, setF] = useState({ name: "", email: "", phone: "", business: "", notes: "", textOk: false, honeypot: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ when: string; payUrl?: string } | null>(null);
  useEffect(() => {
    api<Page>(`/api/public/booking?brand=${brand}`).then((p) => { setPage(p); const t = p.types.find((x) => x.id === typeId) ?? (p.types.length === 1 ? p.types[0] : null); if (t) setType(t); }).catch(() => setPage(null));
  }, [brand, typeId]);
  useEffect(() => {
    if (!type) return;
    setSlots(null); setAt("");
    api<{ slots: string[] }>(`/api/public/booking/slots?type=${encodeURIComponent(type.id)}&member=${encodeURIComponent(member)}`).then((r) => setSlots(r.slots)).catch(() => setSlots([]));
  }, [type, member]);

  if (page === undefined) return <div style={S.card}><p style={S.sub}>Loading the calendar…</p></div>;
  if (!page || !page.types.length) return <div style={S.card}><h2 style={S.h}>Online booking isn&rsquo;t open right now</h2><p style={S.sub}>Please call or email us and we&rsquo;ll set up a time.</p></div>;

  if (done) return (
    <div style={S.card} role="status">
      <h2 style={S.h}>{done.payUrl ? "One more step — payment" : "You're booked!"}</h2>
      <p style={S.sub}>{type?.name} · {fmtWhen(done.when)}</p>
      {done.payUrl ? <><p style={S.sub}>Your time is held for 30 minutes while you pay.</p><a href={done.payUrl} target="_top" style={{ ...S.btn, display: "inline-block", textDecoration: "none" }}>Continue to payment</a></>
        : <p style={S.sub}>We emailed a confirmation to <b>{f.email}</b> with a calendar invite{type?.location === "video" ? " and your video link" : ""}, and a link to reschedule or cancel if you need to.</p>}
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return setErr("Preview — nothing is booked from here.");
    setBusy(true); setErr("");
    try {
      const r = await api<{ status: "confirmed" | "pay"; payUrl?: string }>("/api/public/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ typeId: type!.id, memberId: member, at, ...f }) });
      setDone({ when: at, payUrl: r.payUrl });
      if (r.payUrl) { try { (window.top ?? window).location.assign(r.payUrl); } catch { /* the button above still works */ } }
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Something went wrong.");
      if (x instanceof Error && /taken|available/i.test(x.message)) { setAt(""); api<{ slots: string[] }>(`/api/public/booking/slots?type=${encodeURIComponent(type!.id)}&member=${encodeURIComponent(member)}`).then((r) => setSlots(r.slots)).catch(() => {}); }
    }
    setBusy(false);
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  return (
    <div style={S.card}>
      {/* 1. What */}
      {!type ? (
        <div>
          <h2 style={S.h}>What would you like to book?</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {page.types.map((t) => (
              <button key={t.id} type="button" onClick={() => { setType(t); setMember("any"); }} style={chip(false)}>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 700 }}>{t.name}</span>
                <span style={{ display: "block", fontSize: 13, color: "#555", marginTop: 2 }}>{t.durationMin} min · {t.locationLabel} · {t.priceCents ? money(t.priceCents) : "Free"}</span>
                {t.description && <span style={{ display: "block", fontSize: 13, color: "#666", marginTop: 4, fontWeight: 400 }}>{t.description}</span>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <h2 style={S.h}>{type.name}</h2>
          <p style={{ ...S.sub, margin: 0 }}>{type.durationMin} min · {type.locationLabel} · {type.priceCents ? `${money(type.priceCents)}, paid when you book` : "Free"}</p>
          {type.description && <p style={{ ...S.sub, margin: "6px 0 0" }}>{type.description}</p>}
          {page.types.length > 1 && <button type="button" onClick={() => { setType(null); setAt(""); setErr(""); }} style={S.ghost}>Choose a different appointment</button>}
        </div>
      )}
      {type && type.priceCents > 0 && !page.payOnline && <p style={S.err}>This appointment can&rsquo;t be paid online right now — please call us to book it.</p>}

      {/* 2. With whom + when */}
      {type && !(type.priceCents > 0 && !page.payOnline) && (!at ? (
        <div>
          {type.staff.length > 1 && <div style={{ marginBottom: 14 }}><span style={S.label}>With</span><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[{ id: "any", name: "Anyone available" }, ...type.staff].map((m) => <button key={m.id} type="button" onClick={() => setMember(m.id)} style={chip(member === m.id)} aria-pressed={member === m.id}>{m.name}</button>)}
          </div></div>}
          <span style={S.label}>Choose a day and time</span>
          <SlotPicker slots={slots} value={at} onPick={setAt} />
        </div>
      ) : (
        /* 3. Details */
        <form onSubmit={(e) => void submit(e)}>
          <div style={{ background: "#f7f6f2", border: "1px solid #e5e1d8", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 14.5 }}>
            <b>{fmtWhen(at)}</b> <button type="button" onClick={() => setAt("")} style={{ ...S.ghost, marginLeft: 8 }}>Change time</button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <label><span style={S.label}>Your name *</span><input required autoComplete="name" value={f.name} onChange={set("name")} style={S.input} /></label>
            <label><span style={S.label}>Email *</span><input required type="email" autoComplete="email" value={f.email} onChange={set("email")} style={S.input} /></label>
            <label><span style={S.label}>Phone *</span><input required type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} style={S.input} /></label>
            <label><span style={S.label}>Business name (if any)</span><input autoComplete="organization" value={f.business} onChange={set("business")} style={S.input} /></label>
            <label><span style={S.label}>What would you like to talk about?</span><textarea rows={3} value={f.notes} onChange={set("notes")} style={{ ...S.input, resize: "vertical" }} /></label>
            <p style={{ fontSize: 12.5, color: "#777", margin: 0 }}>Please don&rsquo;t include Social Security numbers, account numbers or case details here.</p>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, color: "#333" }}><input type="checkbox" checked={f.textOk} onChange={set("textOk")} style={{ marginTop: 3 }} /><span>Text me appointment reminders. Message &amp; data rates may apply; reply STOP to opt out.</span></label>
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.honeypot} onChange={set("honeypot")} style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
          </div>
          {err && <p style={S.err} role="alert">{err}</p>}
          <button type="submit" disabled={busy} style={{ ...S.btn, marginTop: 16, opacity: busy ? 0.6 : 1, width: "100%" }}>{busy ? "Booking…" : type.priceCents ? `Continue to payment · ${money(type.priceCents)}` : "Book it"}</button>
        </form>
      ))}
      {err && !at && <p style={S.err} role="alert">{err}</p>}
    </div>
  );
}
