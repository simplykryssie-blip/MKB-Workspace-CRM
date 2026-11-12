"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { call } from "@/lib/sync/remote";
import { DAYS, TIMEZONES, type BookingSettings, type DayKey, type Hours, type MyHours } from "@/lib/calendar/config";

const box = "h-4 w-4 accent-[var(--accent)]";
const copy = async (text: string, toast: (m: string) => void) => { try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Couldn't copy — select it and copy"); } };

/** A staff member's weekly hours for online booking, days off and Zoom user. */
export function HoursDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<{ hours: MyHours; canAll: boolean; members: { id: string; name: string }[] } | null>(null);
  const [v, setV] = useState<MyHours | null>(null);
  const [off, setOff] = useState("");
  const [busy, setBusy] = useState(false);
  const load = (member?: string) => call<{ hours: MyHours; canAll: boolean; members: { id: string; name: string }[] }>("GET", `/api/calendar/hours${member ? `?member=${encodeURIComponent(member)}` : ""}`).then((r) => { setD(r); setV(r.hours); }).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load", "info"));
  useEffect(() => { if (open) void load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const setDay = (k: DayKey, list: [string, string][]) => v && setV({ ...v, hours: { ...v.hours, [k]: list } as Hours });
  const save = async () => {
    if (!v) return;
    setBusy(true);
    try { const r = await call<{ hours: MyHours }>("PUT", "/api/calendar/hours", v); setV(r.hours); toast(r.hours.bookingOn ? "Saved — you're taking online bookings" : "Saved"); onClose(); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} size="lg" title="Booking hours" description="When people can book you online. Times are in the time zone below; visitors see them in their own."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || !v} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button></>}>
      {!v ? <p className="text-[13px] text-muted">Loading…</p> : (
        <div className="space-y-4">
          {d?.canAll && d.members.length > 1 && <SelectField label="Whose hours" value={v.memberId} onChange={(e) => void load(e.target.value)} options={d.members.map((m) => [m.id, m.name] as [string, string])} />}
          <label className="flex items-center gap-2 text-[14px] font-medium text-ink"><input type="checkbox" checked={v.bookingOn} onChange={(e) => setV({ ...v, bookingOn: e.target.checked })} className={box} />{d?.canAll && v.memberId !== d.hours.memberId ? `${v.name} takes` : "Take"} online bookings</label>
          <SelectField label="Time zone" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} options={[...new Set([v.timezone, ...TIMEZONES])].map((z) => [z, z.replace("America/", "").replace("Pacific/", "").replace(/_/g, " ")] as [string, string])} />
          <div className="divide-y divide-line rounded-xl border border-line">
            {DAYS.map(([k, label]) => {
              const list = v.hours[k] ?? [];
              return (
                <div key={k} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <label className="flex w-32 items-center gap-2 text-[14px] text-ink"><input type="checkbox" checked={list.length > 0} onChange={(e) => setDay(k, e.target.checked ? [["09:00", "17:00"]] : [])} className={box} />{label}</label>
                  {list.length === 0 ? <span className="text-[13px] text-muted">Not available</span> : (
                    <div className="flex flex-1 flex-col gap-1.5">
                      {list.map(([a, b], i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="time" aria-label={`${label} from`} value={a} onChange={(e) => setDay(k, list.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} className="rounded-lg border border-line bg-surface px-2 py-1 text-[14px] text-ink" />
                          <span className="text-[13px] text-muted">to</span>
                          <input type="time" aria-label={`${label} until`} value={b} onChange={(e) => setDay(k, list.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="rounded-lg border border-line bg-surface px-2 py-1 text-[14px] text-ink" />
                          {i > 0 && <button type="button" aria-label="Remove" onClick={() => setDay(k, list.filter((_, j) => j !== i))} className="text-muted hover:text-ink"><Trash2 className="h-4 w-4" /></button>}
                          {i === list.length - 1 && list.length < 3 && <button type="button" onClick={() => setDay(k, [...list, [b < "13:00" ? "13:00" : b, b < "13:00" ? "17:00" : "20:00"]])} className="text-[12.5px] font-semibold text-accent">+ split</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[12.5px] text-muted">Use “+ split” for a break (e.g. 9–12 and 1–5). Anything already on your calendar — appointments and blocked time — is never offered.</p>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Days off</p>
            <div className="flex flex-wrap items-center gap-2">
              {v.daysOff.map((x) => <span key={x} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[13px] text-ink">{new Date(`${x}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}<button type="button" aria-label="Remove day off" onClick={() => setV({ ...v, daysOff: v.daysOff.filter((y) => y !== x) })}><Trash2 className="h-3.5 w-3.5 text-muted" /></button></span>)}
              <input type="date" aria-label="Add a day off" value={off} onChange={(e) => setOff(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-[14px] text-ink" />
              <Button size="sm" icon={Plus} disabled={!off} onClick={() => { setV({ ...v, daysOff: [...new Set([...v.daysOff, off])].sort() }); setOff(""); }}>Add</Button>
            </div>
          </div>
          <TextField label="Zoom user email (optional)" value={v.zoomUser} onChange={(e) => setV({ ...v, zoomUser: e.target.value })} placeholder="Leave blank to use the main Zoom account" />
        </div>
      )}
    </Modal>
  );
}

/** Booking rules, Zoom keys and the booking links (Settings permission). */
export function BookingSettingsDialog({ open, canSettings, onClose }: { open: boolean; canSettings: boolean; onClose: () => void }) {
  const toast = useToast();
  const [v, setV] = useState<BookingSettings | null>(null);
  const [secret, setSecret] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => { if (open) { setTest(null); setSecret(""); call<BookingSettings>("GET", "/api/calendar/booking").then(setV).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load", "info")); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const save = async (extra: Record<string, unknown> = {}, quiet = false) => {
    if (!v) return;
    setBusy(true);
    try {
      const r = await call<BookingSettings>("PUT", "/api/calendar/booking", { minNoticeHours: v.minNoticeHours, windowDays: v.windowDays, slotStepMin: v.slotStepMin, changeNoticeHours: v.changeNoticeHours, reminders: v.reminders, zoomAccountId: v.zoom.accountId, zoomClientId: v.zoom.clientId, ...(secret ? { zoomClientSecret: secret } : {}), ...extra });
      setV(r); setSecret("");
      if (!quiet) toast("Saved");
      return r;
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    finally { setBusy(false); }
  };
  const testZoom = async () => {
    const saved = await save({}, true);
    if (!saved) return;
    try { setTest(await call<{ ok: boolean; message: string }>("POST", "/api/calendar/booking/zoom-test")); } catch (e) { setTest({ ok: false, message: e instanceof Error ? e.message : "Couldn't reach Zoom" }); }
  };
  const num = (label: string, key: "minNoticeHours" | "windowDays" | "changeNoticeHours", hint: string) => v && <TextField label={label} type="number" value={String(v[key])} onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })} hint={hint} />;
  const embed = (brand: string) => `<div data-mkb-widget="booking" data-brand="${brand}"></div>`;
  return (
    <Modal open onClose={onClose} size="lg" title="Online booking & Zoom" description="Rules for every booking page, MKB and Monarch alike. Each staff member sets their own hours in “Booking hours”."
      footer={<><Button onClick={onClose}>Close</Button>{canSettings && <Button variant="primary" disabled={busy || !v} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>}</>}>
      {!v ? <p className="text-[13px] text-muted">Loading…</p> : (
        <fieldset disabled={!canSettings} className="min-w-0 space-y-5">
          <section>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Booking links</p>
            {(["mkb", "monarch"] as const).map((b) => (
              <div key={b} className="mb-2 rounded-xl border border-line px-3 py-2.5">
                <p className="text-[13px] font-medium text-ink">{b === "mkb" ? "MKB Financial Group" : "Monarch Tax Suite"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2"><a href={v.links[b]} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-[13px] text-accent">{v.links[b]}</a>
                  <Button size="sm" variant="ghost" icon={Copy} onClick={() => void copy(v.links[b], toast)}>Link</Button><Button size="sm" variant="ghost" icon={Copy} onClick={() => void copy(embed(b), toast)}>Website code</Button></div>
              </div>
            ))}
            <p className="text-[12.5px] text-muted">The “Book a Consultation” page on your website already uses the MKB booking calendar. The website code puts it on any other page (paste it into an HTML section).</p>
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted sm:col-span-2">Rules</p>
            {num("Minimum notice (hours)", "minNoticeHours", "No bookings sooner than this")}
            {num("Book up to (days ahead)", "windowDays", "How far ahead people can book")}
            <SelectField label="Start times every" value={String(v.slotStepMin)} onChange={(e) => setV({ ...v, slotStepMin: Number(e.target.value) })} options={[15, 20, 30, 45, 60].map((m) => [String(m), `${m} minutes`] as [string, string])} />
            {num("Online changes close (hours before)", "changeNoticeHours", "After this, clients must call to reschedule or cancel")}
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium text-ink-2">Reminders (email, and text if they ask)</p>
              <div className="flex flex-wrap items-center gap-2">
                {v.reminders.map((h) => <span key={h} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[13px] text-ink">{h >= 24 && h % 24 === 0 ? `${h / 24} day${h > 24 ? "s" : ""}` : `${h} hour${h > 1 ? "s" : ""}`} before<button type="button" aria-label="Remove reminder" onClick={() => setV({ ...v, reminders: v.reminders.filter((x) => x !== h) })}><Trash2 className="h-3.5 w-3.5 text-muted" /></button></span>)}
                {v.reminders.length < 3 && <><input type="number" min={1} max={168} aria-label="Hours before" placeholder="Hours" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-[14px] text-ink" /><Button size="sm" icon={Plus} disabled={!(Number(custom) > 0)} onClick={() => { setV({ ...v, reminders: [...new Set([...v.reminders, Math.round(Number(custom))])].sort((a, b) => b - a) }); setCustom(""); }}>Add</Button></>}
              </div>
              <p className="mt-1 text-[12.5px] text-muted">Wording of the confirmation, reminder, moved and cancelled emails: Settings → Email templates.</p>
            </div>
          </section>
          <section className="space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Payments</p>
            <p className="text-[13.5px] text-ink-2">{v.stripe ? "Appointment types with a price are paid by card when booking (Stripe). The time is held for 35 minutes while they pay." : "Stripe isn't connected on this server, so paid appointment types can't be booked online yet."} Set prices in Calendar → Settings → Appointment types &amp; colors.</p>
          </section>
          <section className="space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Zoom</p>
            <p className="text-[13.5px] text-ink-2">Video appointments get their own Zoom link automatically, in the confirmation email and on the calendar. In the Zoom App Marketplace, create a <b>Server-to-Server OAuth</b> app (scopes: meeting:write:meeting:admin, meeting:update:meeting:admin, meeting:delete:meeting:admin, user:read:user:admin), activate it, then paste its keys here.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Account ID" value={v.zoom.accountId} onChange={(e) => setV({ ...v, zoom: { ...v.zoom, accountId: e.target.value.trim() } })} />
              <TextField label="Client ID" value={v.zoom.clientId} onChange={(e) => setV({ ...v, zoom: { ...v.zoom, clientId: e.target.value.trim() } })} />
              <div className="sm:col-span-2"><TextField label="Client Secret" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={v.zoom.secretSaved ? `Saved (ends in ${v.zoom.secretSaved.last4}) — type to replace` : "Paste the Client Secret"} hint="Stored encrypted and never shown again." /></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={busy || !v.zoom.accountId || !v.zoom.clientId || (!secret && !v.zoom.secretSaved)} onClick={() => void testZoom()}>Save & test Zoom</Button>
              {v.zoom.secretSaved && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Disconnect Zoom? New video appointments won't get a link.")) void save({ zoomDisconnect: true }); }}>Disconnect</Button>}
              {test && <span className={`text-[13px] ${test.ok ? "text-success-ink" : "text-danger-ink"}`}>{test.message}</span>}
            </div>
          </section>
        </fieldset>
      )}
    </Modal>
  );
}
