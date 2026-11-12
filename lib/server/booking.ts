/**
 * Online booking for the one shared Calendar (MKB and Monarch).
 *
 * - Open times come from each staff member's weekly hours (in their time
 *   zone), minus days off, minimum notice, the booking window, and what is
 *   already on their calendar (with the type's buffer around it).
 * - A booking matches an existing client / open lead by email or phone, or
 *   creates a lead (MKB) or an interested firm (Monarch).
 * - Paid types hold the time for 35 minutes while the visitor pays through
 *   Stripe; the Stripe webhook confirms it.
 * - Confirming makes a Zoom meeting (video types, when Zoom is connected),
 *   emails the confirmation with a calendar invite and a private link to
 *   reschedule or cancel, and texts when they asked for text reminders.
 * - Every 15 minutes the cron frees unpaid holds and sends reminders.
 * Server-only.
 */
import { DAYS, LOCATIONS, usd, type BookingSettings, type DayKey, type Hours, type MyHours } from "@/lib/calendar/config";
import { FIRM, type TemplateKey, renderEmail } from "@/lib/email/templates";
import { canDo } from "@/lib/team/policy";
import { all, badRequest, HttpError, isDev, json, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { decryptField, encryptField, randomId, sha256 } from "./crypto";
import { loadWording, publicAssetOrigin } from "./email";
import { audit, requirePermission, requireStaff, sendEmail, type Actor } from "./identity";
import { linkOrigin } from "./books-intake";
import { notify } from "./notifications";
const stripeReady = (env: AppEnv) => !!env.STRIPE_SECRET_KEY;
import { sendText } from "./sms";
import { loadSettings as monarchSettings } from "./monarch";
import { renderMonarch } from "./monarch-email";

type Staff = Extract<Actor, { kind: "staff" }>;
type Brand = "mkb" | "monarch";
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const HOLD_MIN = 35;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits = (p: string) => p.replace(/\D/g, "").slice(-10);
const NORM = "replace(replace(replace(replace(replace(replace(phone, '(', ''), ')', ''), '-', ''), ' ', ''), '+1', ''), '.', '')";

/* ================================================================ time zones */
function offsetMs(ms: number, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - Math.floor(ms / 1000) * 1000;
}
/** "2026-11-20" + "09:30" in a time zone → epoch ms. */
function zoned(day: string, hm: string, tz: string) {
  const [y, m, d] = day.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}
const dayIn = (ms: number, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const addDay = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekday = (day: string) => DAYS[new Date(`${day}T12:00:00Z`).getUTCDay()][0] as DayKey;
const validTz = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };
/** "Thursday, November 20 at 10:30 AM CST" in a time zone. */
export const longWhen = (iso: string, tz = "America/Chicago") => new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).replace(/, (\d{1,2}:\d{2})/, " at $1").replace(/ at (\d{1,2}:\d{2} [AP]M) /, " at $1 ");

/* ================================================================ settings */
type SettingsRow = { min_notice_hours: number; window_days: number; slot_step_min: number; change_notice_hours: number; reminders: string; zoom_account_id: string; zoom_client_id: string };
async function rules(env: AppEnv) {
  const r = await one<SettingsRow>(env.DB, "SELECT * FROM booking_settings WHERE id = 'main'");
  return { minNotice: r?.min_notice_hours ?? 24, windowDays: r?.window_days ?? 30, step: r?.slot_step_min ?? 30, changeNotice: r?.change_notice_hours ?? 24, reminders: json<number[]>(r?.reminders ?? "[24,1]", [24, 1]), zoomAccount: r?.zoom_account_id ?? "", zoomClient: r?.zoom_client_id ?? "" };
}
export const bookingLinks = (env: AppEnv) => ({ mkb: `${linkOrigin(env)}/w/book`, monarch: `${linkOrigin(env)}/w/book?brand=monarch` });

export async function getBookingSettings(env: AppEnv, a: Actor): Promise<BookingSettings> {
  requirePermission(a, "communication", "view");
  requireStaff(a);
  const r = await rules(env);
  const sec = await one<{ last4: string | null; updated_at: string }>(env.DB, "SELECT last4, updated_at FROM integration_secrets WHERE key = 'zoom.client_secret'");
  return { minNoticeHours: r.minNotice, windowDays: r.windowDays, slotStepMin: r.step, changeNoticeHours: r.changeNotice, reminders: r.reminders, zoom: { accountId: r.zoomAccount, clientId: r.zoomClient, secretSaved: sec ? { last4: sec.last4 ?? "", at: sec.updated_at } : null }, stripe: stripeReady(env) || isDev(env), links: bookingLinks(env) };
}
const int = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export async function saveBookingSettings(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  requirePermission(a, "communication", "settings");
  requireStaff(a);
  const r = await rules(env);
  const reminders = (Array.isArray(b.reminders) ? b.reminders : r.reminders).map(Number).filter((h) => h > 0 && h <= 168).slice(0, 3);
  const accountId = b.zoomAccountId === undefined ? r.zoomAccount : s(b.zoomAccountId, 100);
  const clientId = b.zoomClientId === undefined ? r.zoomClient : s(b.zoomClientId, 100);
  await run(env.DB, "UPDATE booking_settings SET min_notice_hours = ?, window_days = ?, slot_step_min = ?, change_notice_hours = ?, reminders = ?, zoom_account_id = ?, zoom_client_id = ?, updated_at = ?, updated_by = ? WHERE id = 'main'",
    int(b.minNoticeHours, 0, 336, r.minNotice), int(b.windowDays, 1, 180, r.windowDays), [15, 20, 30, 45, 60].includes(Number(b.slotStepMin)) ? Number(b.slotStepMin) : r.step, int(b.changeNoticeHours, 0, 168, r.changeNotice),
    JSON.stringify([...new Set(reminders)].sort((x, y) => y - x)), accountId, clientId, now(), a.member.id);
  const secret = s(b.zoomClientSecret, 200);
  if (secret) {
    if (!env.ENCRYPTION_KEY) throw new HttpError(503, "Encryption isn't set up on the server.");
    const enc = await encryptField(env.ENCRYPTION_KEY, secret, "secret:zoom.client_secret");
    await run(env.DB, "INSERT INTO integration_secrets (key, ciphertext, iv, key_version, last4, updated_at, updated_by) VALUES ('zoom.client_secret', ?, ?, 1, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, last4 = excluded.last4, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
      enc.ciphertext, enc.iv, secret.slice(-4), now(), a.member.id);
  }
  if (b.zoomDisconnect === true) {
    await run(env.DB, "DELETE FROM integration_secrets WHERE key = 'zoom.client_secret'");
    await run(env.DB, "UPDATE booking_settings SET zoom_account_id = '', zoom_client_id = '' WHERE id = 'main'");
  }
  await audit(env.DB, a, { action: "Record update", resource: "Online booking settings", meta: secret ? "Zoom keys updated" : b.zoomDisconnect ? "Zoom disconnected" : "Booking rules" });
  return getBookingSettings(env, a);
}

/* ---------------------------------------------------------------- each person's hours */
type CalRow = { member_id: string; timezone: string; hours: string; booking_on: number; days_off: string; zoom_user: string };
const cleanHours = (v: unknown): Hours => {
  const out: Hours = {};
  if (!v || typeof v !== "object") return out;
  for (const [k] of DAYS) {
    const list = (v as Record<string, unknown>)[k];
    if (!Array.isArray(list)) continue;
    const ok = list.filter((x): x is [string, string] => Array.isArray(x) && /^\d{2}:\d{2}$/.test(String(x[0])) && /^\d{2}:\d{2}$/.test(String(x[1])) && x[0] < x[1]).slice(0, 4).sort((x, y) => x[0].localeCompare(y[0]));
    if (ok.length) out[k] = ok.map(([a, b]) => [a, b]);
  }
  return out;
};
const mayManage = (a: Staff) => canDo(a.policy, a.member, "communication", "assign");
export async function getMyHours(env: AppEnv, a: Actor, memberId?: string): Promise<{ hours: MyHours; canAll: boolean; members: { id: string; name: string }[] }> {
  requirePermission(a, "communication", "view");
  requireStaff(a);
  const id = memberId && mayManage(a) ? memberId : a.member.id;
  const m = await one<{ id: string; name: string }>(env.DB, "SELECT id, name FROM members WHERE id = ? AND status = 'active'", id);
  if (!m) throw notFound("Staff member not found.");
  const r = await one<CalRow>(env.DB, "SELECT * FROM calendar_settings WHERE member_id = ?", id);
  const members = mayManage(a) ? await all<{ id: string; name: string }>(env.DB, "SELECT id, name FROM members WHERE status = 'active' ORDER BY name") : [];
  return { hours: { memberId: id, name: m.name, timezone: r?.timezone ?? "America/Chicago", hours: cleanHours(json(r?.hours ?? "{}", {})), bookingOn: !!r?.booking_on, daysOff: json<string[]>(r?.days_off ?? "[]", []), zoomUser: r?.zoom_user ?? "" }, canAll: mayManage(a), members };
}
export async function saveMyHours(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  requirePermission(a, "communication", "edit");
  requireStaff(a);
  const id = typeof b.memberId === "string" && b.memberId && mayManage(a) ? b.memberId : a.member.id;
  if (!(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", id))) throw notFound("Staff member not found.");
  const tz = s(b.timezone, 60) || "America/Chicago";
  if (!validTz(tz)) throw badRequest("Choose a time zone.");
  const hours = cleanHours(b.hours);
  const daysOff = (Array.isArray(b.daysOff) ? b.daysOff : []).filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-200);
  const zoomUser = s(b.zoomUser, 120);
  if (zoomUser && !EMAIL.test(zoomUser)) throw badRequest("Enter the email address of the Zoom user (or leave it blank).");
  const on = b.bookingOn === true ? 1 : 0;
  if (on && !Object.keys(hours).length) throw badRequest("Add at least one day of hours before taking online bookings.");
  await run(env.DB, "INSERT INTO calendar_settings (member_id, timezone, hours, booking_on, days_off, zoom_user, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(member_id) DO UPDATE SET timezone = excluded.timezone, hours = excluded.hours, booking_on = excluded.booking_on, days_off = excluded.days_off, zoom_user = excluded.zoom_user, updated_at = excluded.updated_at",
    id, tz, JSON.stringify(hours), on, JSON.stringify([...new Set(daysOff)]), zoomUser, now());
  return getMyHours(env, a, id);
}

/* ================================================================ open times */
type TypeRow = { id: string; name: string; brand: string; service: string; duration_min: number; location: string; location_note: string; price_cents: number; buffer_min: number; description: string; bookable: number; active: number; member_ids: string };
type Booker = { id: string; name: string; tz: string; hours: Hours; daysOff: string[]; zoomUser: string };
async function bookableType(env: AppEnv, id: string) {
  const t = await one<TypeRow>(env.DB, "SELECT * FROM appointment_types WHERE id = ? AND active = 1 AND bookable = 1", id);
  if (!t) throw notFound("That appointment type isn't available for online booking.");
  return t;
}
async function bookers(env: AppEnv, t: TypeRow): Promise<Booker[]> {
  const only = json<string[]>(t.member_ids, []);
  const rows = await all<CalRow & { name: string }>(env.DB, "SELECT cs.*, m.name FROM calendar_settings cs JOIN members m ON m.id = cs.member_id WHERE cs.booking_on = 1 AND m.status = 'active' ORDER BY m.name");
  return rows.filter((r) => !only.length || only.includes(r.member_id)).map((r) => ({ id: r.member_id, name: r.name, tz: validTz(r.timezone) ? r.timezone : "America/Chicago", hours: cleanHours(json(r.hours, {})), daysOff: json<string[]>(r.days_off, []), zoomUser: r.zoom_user })).filter((b) => Object.keys(b.hours).length);
}
/** Busy times on these calendars (scheduled items and unexpired payment holds). */
async function busy(env: AppEnv, ids: string[], from: number, to: number, exceptId = "") {
  if (!ids.length) return new Map<string, [number, number][]>();
  const rows = await all<{ member_id: string; starts_at: string; ends_at: string }>(env.DB,
    `SELECT member_id, starts_at, ends_at FROM appointments WHERE member_id IN (${ids.map(() => "?").join(",")}) AND status = 'scheduled' AND id != ? AND starts_at < ? AND ends_at > ? AND NOT (payment_status = 'pending' AND hold_until < ?)`,
    ...ids, exceptId, new Date(to).toISOString(), new Date(from).toISOString(), now());
  const m = new Map<string, [number, number][]>();
  for (const r of rows) m.set(r.member_id, [...(m.get(r.member_id) ?? []), [Date.parse(r.starts_at), Date.parse(r.ends_at)]]);
  return m;
}
/** Every open start time (epoch ms) per staff member. */
async function openTimes(env: AppEnv, t: TypeRow, people: Booker[], exceptId = "") {
  const r = await rules(env);
  const start = Date.now() + r.minNotice * 3600e3, end = Date.now() + r.windowDays * 864e5;
  const dur = t.duration_min * 60e3, buf = t.buffer_min * 60e3, step = r.step * 60e3;
  const taken = await busy(env, people.map((p) => p.id), start - 864e5, end + 864e5, exceptId);
  const out = new Map<string, number[]>();
  for (const p of people) {
    const list: number[] = [];
    const b = taken.get(p.id) ?? [];
    for (let day = dayIn(start, p.tz); day <= dayIn(end, p.tz); day = addDay(day, 1)) {
      if (p.daysOff.includes(day)) continue;
      for (const [from, to] of p.hours[weekday(day)] ?? []) {
        const close = zoned(day, to, p.tz);
        for (let at = zoned(day, from, p.tz); at + dur <= close; at += step) {
          if (at < start || at > end) continue;
          if (b.some(([bs, be]) => at - buf < be && at + dur + buf > bs)) continue;
          list.push(at);
        }
      }
    }
    out.set(p.id, list);
  }
  return out;
}

/* ================================================================ public booking page */
const publicType = (t: TypeRow) => ({ id: t.id, name: t.name, durationMin: t.duration_min, location: t.location, locationLabel: LOCATIONS[t.location as keyof typeof LOCATIONS] ?? "", priceCents: t.price_cents, description: t.description, service: t.service });
/** What a visitor can book (never internal settings). */
export async function bookingPage(env: AppEnv, q: { brand?: string }) {
  const brand: Brand = q.brand === "monarch" ? "monarch" : "mkb";
  const types = await all<TypeRow>(env.DB, "SELECT * FROM appointment_types WHERE active = 1 AND bookable = 1 AND brand = ? ORDER BY position, name", brand);
  const list = [];
  for (const t of types) {
    const people = await bookers(env, t);
    if (people.length) list.push({ ...publicType(t), staff: people.map((p) => ({ id: p.id, name: p.name })) });
  }
  const r = await rules(env);
  return { brand, types: list, payOnline: stripeReady(env) || isDev(env), windowDays: r.windowDays };
}
export async function bookingSlots(env: AppEnv, q: { type?: string; member?: string }) {
  const t = await bookableType(env, s(q.type, 80));
  let people = await bookers(env, t);
  if (q.member && q.member !== "any") people = people.filter((p) => p.id === q.member);
  const times = await openTimes(env, t, people);
  const all = [...new Set([...times.values()].flat())].sort((a, b) => a - b);
  return { slots: all.map((ms) => new Date(ms).toISOString()), timezone: people[0]?.tz ?? "America/Chicago" };
}

/* ---------------------------------------------------------------- matching the person */
type Guest = { name: string; email: string; phone: string; business: string };
async function contactFor(env: AppEnv, brand: Brand, g: Guest, t: TypeRow, ownerId: string) {
  const d = digits(g.phone), ts = now();
  if (brand === "monarch") {
    const o = await one<{ id: string; name: string }>(env.DB, `SELECT id, name FROM mon_offices WHERE lower(email) = ? OR (length(?) = 10 AND ${NORM} LIKE ?) LIMIT 1`, g.email, d, `%${d}`);
    if (o) return { type: "office" as const, id: o.id, name: o.name };
    const id = randomId("mo");
    const name = g.business || g.name;
    await run(env.DB, "INSERT INTO mon_offices (id, name, contact_name, email, phone, city, state, stage, notes, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, '', '', 'interested', ?, ?, NULL, ?)", id, name, g.name, g.email, g.phone, `Booked a “${t.name}” online.`, ts, ts);
    return { type: "office" as const, id, name };
  }
  const c = await one<{ id: string; name: string }>(env.DB, `SELECT id, name FROM clients WHERE status NOT IN ('prospect', 'declined') AND (lower(email) = ? OR (length(?) = 10 AND ${NORM} LIKE ?)) LIMIT 1`, g.email, d, `%${d}`);
  if (c) return { type: "client" as const, id: c.id, name: c.name };
  const l = await one<{ id: string; name: string; phone: string; interests: string }>(env.DB, `SELECT id, name, phone, interests FROM leads WHERE status = 'open' AND (lower(email) = ? OR (length(?) = 10 AND ${NORM} LIKE ?)) ORDER BY last_activity_at DESC LIMIT 1`, g.email, d, `%${d}`);
  const svc = ["tax", "books", "biz", "expunge"].includes(t.service) ? [t.service] : [];
  if (l) {
    const interests = [...new Set([...json<string[]>(l.interests, []), ...svc])];
    await run(env.DB, "UPDATE leads SET interests = ?, phone = CASE WHEN phone = '' THEN ? ELSE phone END, last_activity_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(interests), g.phone, ts, l.id);
    return { type: "lead" as const, id: l.id, name: l.name };
  }
  const stage = await one<{ id: string }>(env.DB, "SELECT id FROM lead_stages ORDER BY position LIMIT 1");
  if (!stage) throw new HttpError(503, "Online booking isn't set up yet. Please call us.");
  const id = `L-${randomId("b").slice(2)}`;
  const name = g.business || g.name;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO leads (id, type, name, contact_name, email, phone, address, business, source, source_detail, interests, est_value, owner_id, stage_id, status, priority, tags, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'Website', 'Online booking', ?, 0, ?, ?, 'open', 'medium', '[\"Online booking\"]', ?, ?)")
      .bind(id, g.business ? "business" : "individual", name, g.business ? g.name : null, g.email, g.phone, g.business ? JSON.stringify({ entityType: "LLC", industry: "" }) : null, JSON.stringify(svc), ownerId, stage.id, ts, ts),
    env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', ?, 'system', ?)").bind(randomId("x"), id, `Lead created from an online booking (${t.name})`, ts),
  ]);
  return { type: "lead" as const, id, name };
}
async function timeline(env: AppEnv, c: { type: string; id: string } | null, text: string, actor: "client" | "system" | "staff" = "client") {
  if (!c) return;
  const ts = now();
  if (c.type === "lead") await env.DB.batch([env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', ?, ?, ?)").bind(randomId("x"), c.id, text, actor, ts), env.DB.prepare("UPDATE leads SET last_activity_at = ? WHERE id = ?").bind(ts, c.id)]);
  else if (c.type === "client") await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, at) VALUES (?, ?, 'appointment', ?, ?, ?)", randomId("x"), c.id, text, actor, ts);
}
const href = (c: { type: string | null; id: string | null }) => (c.type === "lead" ? `/leads/${c.id}` : c.type === "client" ? `/clients/${c.id}` : c.type === "office" ? `/monarch/offices/${c.id}` : "/calendar");

/** A visitor books a time. Paid types return a payment page to go to next. */
export async function book(env: AppEnv, b: Record<string, unknown>, ip: string) {
  if (s(b.honeypot, 200)) return { status: "confirmed" as const };
  if (!(await rateLimit(env.DB, `book-ip:${ip}`, 6, 30))) throw new HttpError(429, "Too many bookings from here. Please call us instead.", "rate_limited");
  const t = await bookableType(env, s(b.typeId, 80));
  const g: Guest = { name: s(b.name, 120), email: s(b.email, 160).toLowerCase(), phone: s(b.phone, 30), business: s(b.business, 160) };
  if (!g.name) throw badRequest("Enter your name.");
  if (!EMAIL.test(g.email)) throw badRequest("Enter a valid email address.");
  if (digits(g.phone).length !== 10) throw badRequest("Enter a 10-digit phone number.");
  const at = Date.parse(s(b.at, 40));
  if (!at) throw badRequest("Choose a time.");
  let people = await bookers(env, t);
  const want = s(b.memberId, 60);
  if (want && want !== "any") people = people.filter((p) => p.id === want);
  const times = await openTimes(env, t, people);
  const free = people.filter((p) => times.get(p.id)?.includes(at));
  if (!free.length) throw new HttpError(409, "Sorry — that time was just taken. Please choose another.", "conflict");
  // "Anyone": whoever has the fewest appointments that day.
  let who = free[0];
  if (free.length > 1) {
    const day = new Date(at).toISOString().slice(0, 10);
    const counts = await all<{ member_id: string; n: number }>(env.DB, `SELECT member_id, count(*) AS n FROM appointments WHERE status = 'scheduled' AND substr(starts_at, 1, 10) = ? AND member_id IN (${free.map(() => "?").join(",")}) GROUP BY member_id`, day, ...free.map((p) => p.id));
    who = [...free].sort((x, y) => (counts.find((c) => c.member_id === x.id)?.n ?? 0) - (counts.find((c) => c.member_id === y.id)?.n ?? 0))[0];
  }
  const brand = (t.brand === "monarch" ? "monarch" : "mkb") as Brand;
  const contact = await contactFor(env, brand, g, t, who.id);
  const notes = s(b.notes, 2000);
  const id = randomId("apt"), ts = now();
  const paid = t.price_cents > 0;
  await run(env.DB, `INSERT INTO appointments (id, kind, type_id, title, brand, service, member_id, starts_at, ends_at, location, location_note, contact_type, contact_id, contact_name, status, notes, source, created_at, updated_at, guest_name, guest_email, guest_phone, text_ok, price_cents, payment_status, hold_until, manage_hash)
    VALUES (?, 'appointment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, 'booking', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, t.id, `${t.name} — ${contact.name}`, brand, t.service, who.id, new Date(at).toISOString(), new Date(at + t.duration_min * 60e3).toISOString(), t.location, t.location_note, contact.type, contact.id, contact.name,
    [notes && `They wrote: ${notes}`, g.business && `Business: ${g.business}`].filter(Boolean).join("\n"), ts, ts, g.name, g.email, g.phone, b.textOk === true ? 1 : 0, t.price_cents, paid ? "pending" : "none", paid ? new Date(Date.now() + HOLD_MIN * 60e3).toISOString() : null, null);
  const token = await newToken(env, id);
  await audit(env.DB, { kind: "anonymous", ip }, { action: "Record update", resource: `Calendar appointment ${id}`, meta: `Booked online (${t.name})` });
  if (paid) {
    if (!stripeReady(env)) {
      if (!isDev(env)) { await run(env.DB, "UPDATE appointments SET status = 'cancelled' WHERE id = ?", id); throw new HttpError(503, "Online payment isn't available right now. Please call us to book."); }
      await markPaid(env, id, t.price_cents, `dev_${id}`); // local development: treated as paid
      return { status: "confirmed" as const, token };
    }
    const url = await checkout(env, id, t, contact.name, g.email, token, brand);
    if (!url) { await run(env.DB, "UPDATE appointments SET status = 'cancelled' WHERE id = ?", id); throw new HttpError(502, "We couldn't open the payment page. Please try again or call us."); }
    await timeline(env, contact, `Started booking a “${t.name}” for ${longWhen(new Date(at).toISOString(), who.tz)} (waiting for payment)`);
    return { status: "pay" as const, payUrl: url, token };
  }
  await confirm(env, id, "booked");
  return { status: "confirmed" as const, token };
}

/* ---------------------------------------------------------------- payment */
async function checkout(env: AppEnv, id: string, t: TypeRow, name: string, email: string, token: string, brand: Brand) {
  const back = `${linkOrigin(env)}/w/book/manage/${token}`;
  const form = new URLSearchParams({
    mode: "payment",
    customer_email: email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(t.price_cents),
    "line_items[0][price_data][product_data][name]": `${t.name} — ${brand === "monarch" ? "Monarch Tax Suite" : FIRM.name}`,
    "metadata[appointment_id]": id,
    "payment_intent_data[metadata][appointment_id]": id,
    "payment_intent_data[description]": `${t.name} for ${name}`,
    client_reference_id: id,
    expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
    success_url: `${back}?paid=1${brand === "monarch" ? "&b=monarch" : ""}`,
    cancel_url: `${back}?unpaid=1${brand === "monarch" ? "&b=monarch" : ""}`,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" }, body: form });
  const out = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !out.url) { console.error("stripe booking checkout", res.status, out.error?.message); return null; }
  return out.url;
}
/** From the Stripe webhook (once per payment). */
export async function bookingPaid(env: AppEnv, id: string, amount: number, ref: string) {
  const r = await one<{ payment_status: string }>(env.DB, "SELECT payment_status FROM appointments WHERE id = ?", id);
  if (!r) throw notFound("Appointment not found.");
  if (r.payment_status === "paid") return { received: true, duplicate: true };
  await markPaid(env, id, amount, ref);
  return { received: true };
}
async function markPaid(env: AppEnv, id: string, amount: number, ref: string) {
  const r = await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id);
  if (!r) return;
  // Paid after the hold ran out: put it back, and warn staff if the time was taken meanwhile.
  const clash = await one<{ title: string }>(env.DB, "SELECT title FROM appointments WHERE member_id = ? AND status = 'scheduled' AND id != ? AND starts_at < ? AND ends_at > ? LIMIT 1", r.member_id, id, r.ends_at, r.starts_at);
  await run(env.DB, "UPDATE appointments SET status = 'scheduled', payment_status = 'paid', payment_ref = ?, hold_until = NULL, updated_at = ?, rev = rev + 1 WHERE id = ?", ref, now(), id);
  await notify(env, { module: "communication", memberIds: [r.member_id] }, { kind: "payment", title: `Booking paid: ${r.title} (${usd(amount)})`, body: clash ? `Heads up: it overlaps “${clash.title}” — the payment came in after the hold ended.` : "Paid online through Stripe.", href: href({ type: r.contact_type, id: r.contact_id }) });
  await confirm(env, id, "booked");
}

/* ================================================================ Zoom */
async function zoomToken(env: AppEnv) {
  const r = await rules(env);
  const sec = await one<{ ciphertext: string; iv: string }>(env.DB, "SELECT ciphertext, iv FROM integration_secrets WHERE key = 'zoom.client_secret'");
  if (!r.zoomAccount || !r.zoomClient || !sec || !env.ENCRYPTION_KEY) return null;
  const secret = await decryptField(env.ENCRYPTION_KEY, sec, "secret:zoom.client_secret");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(r.zoomAccount)}`, { method: "POST", headers: { authorization: `Basic ${btoa(`${r.zoomClient}:${secret}`)}` } });
  const out = (await res.json().catch(() => ({}))) as { access_token?: string; reason?: string };
  if (!res.ok || !out.access_token) { console.error("zoom token", res.status, out.reason); return null; }
  return out.access_token;
}
/** Checks the saved Zoom keys (Calendar → Booking settings → Test). */
export async function testZoom(env: AppEnv, a: Actor) {
  requirePermission(a, "communication", "settings");
  requireStaff(a);
  const tok = await zoomToken(env);
  if (!tok) return { ok: false, message: "Zoom didn't accept these keys. Check the Account ID, Client ID and Client Secret, and that the app is activated." };
  const res = await fetch("https://api.zoom.us/v2/users/me", { headers: { authorization: `Bearer ${tok}` } });
  const me = (await res.json().catch(() => ({}))) as { email?: string; message?: string };
  return res.ok ? { ok: true, message: `Connected to Zoom (${me.email ?? "account owner"}).` } : { ok: false, message: `Zoom connected, but couldn't read the account: ${me.message ?? res.status}. Make sure the app has the user:read:user:admin and meeting:write:meeting:admin scopes.` };
}
async function zoomMeeting(env: AppEnv, r: ApptRow): Promise<{ id: string; url: string } | null> {
  const tok = await zoomToken(env);
  if (!tok) return null;
  const user = (await one<{ zoom_user: string }>(env.DB, "SELECT zoom_user FROM calendar_settings WHERE member_id = ?", r.member_id))?.zoom_user || "me";
  const body = { topic: r.title.slice(0, 190), type: 2, start_time: r.starts_at.replace(/\.\d+Z$/, "Z"), duration: Math.round((Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 60e3), timezone: "UTC", settings: { join_before_host: false, waiting_room: true, meeting_authentication: false } };
  if (r.meeting_id) {
    const res = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(r.meeting_id)}`, { method: "PATCH", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return { id: r.meeting_id, url: r.meeting_url };
  }
  const res = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(user)}/meetings`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = (await res.json().catch(() => ({}))) as { id?: number; join_url?: string; message?: string };
  if (!res.ok || !out.join_url) { console.error("zoom meeting", res.status, out.message); return null; }
  return { id: String(out.id), url: out.join_url };
}
async function zoomDelete(env: AppEnv, meetingId: string) {
  if (!meetingId) return;
  const tok = await zoomToken(env).catch(() => null);
  if (tok) await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, { method: "DELETE", headers: { authorization: `Bearer ${tok}` } }).catch(() => null);
}

/* ================================================================ emails, invites, texts */
type ApptRow = { id: string; guest_name: string; type_id: string | null; title: string; brand: string; service: string; member_id: string; starts_at: string; ends_at: string; location: string; location_note: string; contact_type: string | null; contact_id: string | null; contact_name: string; status: string; notes: string; source: string; guest_email: string; guest_phone: string; text_ok: number; meeting_url: string; meeting_id: string; price_cents: number; payment_status: string; manage_hash: string | null; manage_seq: number; reminders_sent: string; confirmed_at: string | null };
async function details(env: AppEnv, r: ApptRow) {
  const m = await one<{ name: string; timezone: string | null }>(env.DB, "SELECT m.name, cs.timezone FROM members m LEFT JOIN calendar_settings cs ON cs.member_id = m.id WHERE m.id = ?", r.member_id);
  const type = r.type_id ? await one<{ name: string }>(env.DB, "SELECT name FROM appointment_types WHERE id = ?", r.type_id) : null;
  const tz = m?.timezone && validTz(m.timezone) ? m.timezone : "America/Chicago";
  const where = r.location === "video" ? (r.meeting_url ? `Zoom video call: ${r.meeting_url}` : r.location_note ? `Video call: ${r.location_note}` : "Video call — we'll email you the link before we meet.")
    : r.location === "phone" ? `Phone call${r.location_note ? ` — ${r.location_note}` : ""}${r.guest_phone ? ` (${r.guest_phone})` : ""}` : `In person${r.location_note ? ` — ${r.location_note}` : ""}`;
  return { staff: m?.name ?? "our team", tz, typeName: type?.name ?? r.title.split(" — ")[0], when: longWhen(r.starts_at, tz), where, first: (r.guest_name || r.contact_name).split(/\s+/)[0] || "there" };
}
const icsDate = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+/, "");
const icsText = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function ics(r: ApptRow, d: { typeName: string; staff: string; where: string }, brandName: string, cancel = false) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MKB Financial Group//Calendar//EN", `METHOD:${cancel ? "CANCEL" : "REQUEST"}`, "BEGIN:VEVENT",
    `UID:${r.id}@mkbfinancialgroup.com`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(r.starts_at)}`, `DTEND:${icsDate(r.ends_at)}`,
    `SUMMARY:${icsText(`${d.typeName} with ${brandName}`)}`, `DESCRIPTION:${icsText(`With ${d.staff}. ${d.where}`)}`, `LOCATION:${icsText(r.meeting_url || (r.location === "in_person" ? r.location_note : LOCATIONS[r.location as keyof typeof LOCATIONS] ?? ""))}`,
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`, `SEQUENCE:${Math.floor(Date.now() / 1000)}`, "END:VEVENT", "END:VCALENDAR"];
  return new TextEncoder().encode(lines.join("\r\n"));
}
async function mail(env: AppEnv, key: TemplateKey, r: ApptRow, token: string | null) {
  if (!r.guest_email) return;
  const d = await details(env, r);
  const brand = r.brand === "monarch" ? "monarch" : "mkb";
  const vars = { firstName: d.first, typeName: d.typeName, when: d.when, where: d.where, staffName: d.staff, paid: r.payment_status === "paid" ? `Your payment of ${usd(r.price_cents)} was received.` : "" };
  const lines = key === "booking_cancelled" ? [] : [`When: ${d.when}`, `Where: ${d.where}`, `With: ${d.staff}`];
  const button = key === "booking_cancelled" ? bookingLinks(env)[brand] : token ? `${linkOrigin(env)}/w/book/manage/${token}${brand === "monarch" ? "?b=monarch" : ""}` : bookingLinks(env)[brand];
  const cancel = key === "booking_cancelled";
  const brandName = brand === "monarch" ? "Monarch Tax Suite" : FIRM.name;
  const attachments = [{ filename: cancel ? "cancelled.ics" : "appointment.ics", content: ics(r, d, brandName, cancel) }];
  const { wording } = await loadWording(env, key);
  if (brand === "monarch") {
    const fill = (x: string) => x.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? "");
    const e = renderMonarch(env, await monarchSettings(env), { to: r.guest_email, template: key, subject: fill(wording.subject), heading: fill(wording.heading), paragraphs: [fill(wording.intro)], list: lines.length ? { title: "Appointment details", items: lines } : undefined, button: { label: fill(wording.button), url: button }, after: [fill(wording.docsNote), fill(wording.closing).replace(/833-379-3320/g, "us")].filter(Boolean) });
    await sendEmail(env, { to: r.guest_email, template: key, subject: e.subject, text: e.text, html: e.html, attachments });
    return;
  }
  const e = renderEmail({ wording, docsTitle: "Appointment details", vars, documents: lines, buttonUrl: button, logoUrl: `${publicAssetOrigin(env)}/brand/mkb-seal-192.png` });
  await sendEmail(env, { to: r.guest_email, template: key, subject: e.subject, text: e.text, html: e.html, attachments });
}
async function text(env: AppEnv, r: ApptRow, body: string) {
  if (!r.text_ok || digits(r.guest_phone).length !== 10) return;
  const brand = r.brand === "monarch" ? "monarch" : "mkb";
  const stopped = await one(env.DB, "SELECT 1 FROM marketing_consent WHERE brand = ? AND channel = 'sms' AND address = ? AND status = 'unsubscribed'", brand, digits(r.guest_phone));
  if (stopped) return;
  await sendText(env, { brand, to: r.guest_phone, body: `${brand === "monarch" ? "Monarch Tax Suite" : "MKB Financial Group"}: ${body} Reply STOP to opt out.`, contact: r.contact_type && r.contact_id ? { type: r.contact_type, id: r.contact_id } : null }).catch(() => null);
}
/**
 * The client's reschedule/cancel link. It is derived from the server key, the
 * appointment and a counter, so the same link can be emailed again (reminders,
 * after payment); only its hash is stored. Moving the appointment bumps the
 * counter, which retires every earlier link.
 */
async function linkToken(env: AppEnv, id: string, seq: number) {
  if (!env.ENCRYPTION_KEY) throw new HttpError(503, "Encryption isn't set up on the server.");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.ENCRYPTION_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`appt-manage:${id}:${seq}`)));
  return btoa(String.fromCharCode(...mac.slice(0, 24))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function newToken(env: AppEnv, id: string) {
  await run(env.DB, "UPDATE appointments SET manage_seq = manage_seq + 1 WHERE id = ?", id);
  const seq = (await one<{ manage_seq: number }>(env.DB, "SELECT manage_seq FROM appointments WHERE id = ?", id))?.manage_seq ?? 1;
  const token = await linkToken(env, id, seq);
  await run(env.DB, "UPDATE appointments SET manage_hash = ? WHERE id = ?", await sha256(token), id);
  return token;
}
/** The link already given out (or a first one). */
async function currentToken(env: AppEnv, r: { id: string; manage_hash: string | null; manage_seq: number }) {
  return r.manage_hash && r.manage_seq ? linkToken(env, r.id, r.manage_seq) : newToken(env, r.id);
}

/**
 * Makes the Zoom meeting (video), emails the confirmation and invite (with a
 * new reschedule/cancel link) and texts if they asked. `why` picks the wording.
 */
export async function confirm(env: AppEnv, id: string, why: "booked" | "moved" | "staff") {
  let r = await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id);
  if (!r || r.status !== "scheduled") return;
  if (r.location === "video") {
    const z = await zoomMeeting(env, r).catch(() => null);
    if (z) await run(env.DB, "UPDATE appointments SET meeting_id = ?, meeting_url = ? WHERE id = ?", z.id, z.url, id);
  }
  await run(env.DB, "UPDATE appointments SET confirmed_at = ?, reminders_sent = '[]' WHERE id = ?", now(), id);
  r = (await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id))!;
  const token = r.guest_email ? (why === "moved" ? await newToken(env, id) : await currentToken(env, r)) : null;
  await mail(env, why === "moved" ? "booking_changed" : "booking_confirmed", r, token).catch((e) => console.error("booking email", e));
  const d = await details(env, r);
  await text(env, r, why === "moved" ? `Your ${d.typeName} is now ${d.when}.` : `You're booked: ${d.typeName} on ${d.when}. Details are in your email.`);
  const c = r.contact_type && r.contact_id ? { type: r.contact_type, id: r.contact_id } : null;
  if (why === "booked") {
    await timeline(env, c, `Booked online: “${d.typeName}” on ${d.when}${r.payment_status === "paid" ? ` (paid ${usd(r.price_cents)})` : ""}`);
    await notify(env, { module: "communication", memberIds: [r.member_id] }, { kind: "lead", title: `New booking: ${r.contact_name} — ${d.typeName}`, body: d.when, href: href({ type: r.contact_type, id: r.contact_id }) });
  }
  return { meetingUrl: r.meeting_url };
}

/* ================================================================ staff changes */
/** After staff save an appointment: email / Zoom as needed. */
export async function afterStaffSave(env: AppEnv, id: string, o: { isNew: boolean; moved: boolean; notify: boolean }) {
  const r = await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id);
  if (!r || r.status !== "scheduled") return;
  // Fill in who to email from the linked record.
  if (o.notify && !r.guest_email && r.contact_type && r.contact_id) {
    const table = r.contact_type === "lead" ? "leads" : r.contact_type === "client" ? "clients" : r.contact_type === "office" ? "mon_offices" : null;
    const c = table ? await one<{ name: string; contact_name: string | null; email: string | null; phone: string | null }>(env.DB, `SELECT name, contact_name, email, phone FROM ${table} WHERE id = ?`, r.contact_id) : null;
    if (c?.email) await run(env.DB, "UPDATE appointments SET guest_email = ?, guest_name = CASE WHEN guest_name = '' THEN ? ELSE guest_name END, guest_phone = CASE WHEN guest_phone = '' THEN ? ELSE guest_phone END WHERE id = ?", c.email.toLowerCase(), c.contact_name || c.name, c.phone ?? "", id);
  }
  if (o.isNew || o.moved) {
    if (o.notify) await confirm(env, id, o.isNew ? "staff" : "moved");
    else if (r.location === "video" && (r.meeting_id || o.isNew)) {
      const z = await zoomMeeting(env, r).catch(() => null);
      if (z) await run(env.DB, "UPDATE appointments SET meeting_id = ?, meeting_url = ? WHERE id = ?", z.id, z.url, id);
    }
    if (o.moved) await run(env.DB, "UPDATE appointments SET reminders_sent = '[]' WHERE id = ?", id);
  }
}
/** After staff cancel: remove the Zoom meeting and (optionally) email them. */
export async function afterStaffCancel(env: AppEnv, id: string, notifyThem: boolean) {
  const r = await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id);
  if (!r) return;
  await zoomDelete(env, r.meeting_id);
  await run(env.DB, "UPDATE appointments SET meeting_id = '', meeting_url = '', manage_hash = NULL WHERE id = ?", id);
  if (notifyThem) await mail(env, "booking_cancelled", r, null).catch(() => null);
}
/** Staff: email the confirmation (with a fresh link) again. */
export async function resendConfirmation(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "communication", "edit");
  requireStaff(a);
  const r = await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id);
  if (!r) throw notFound("Appointment not found.");
  if (r.status !== "scheduled") throw badRequest("Only scheduled appointments can be confirmed.");
  await afterStaffSave(env, id, { isNew: false, moved: false, notify: true });
  const fresh = (await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id))!;
  if (!fresh.guest_email) throw badRequest("There's no email address for this person — add one to their record first.");
  await confirm(env, id, "staff");
  return { ok: true, to: fresh.guest_email };
}

/* ================================================================ the client's link */
async function byToken(env: AppEnv, token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) throw notFound("This link isn't valid.");
  const r = await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE manage_hash = ?", await sha256(token));
  if (!r) throw notFound("This link isn't valid any more. Check your latest email, or call us.");
  return r;
}
export async function manageView(env: AppEnv, token: string) {
  const r = await byToken(env, token);
  const d = await details(env, r);
  const rl = await rules(env);
  const past = Date.parse(r.starts_at) < Date.now();
  const late = Date.parse(r.starts_at) - Date.now() < rl.changeNotice * 3600e3;
  const pending = r.payment_status === "pending";
  return {
    title: d.typeName, when: d.when, startsAt: r.starts_at, endsAt: r.ends_at, where: d.where, staff: d.staff, brand: r.brand, meetingUrl: r.meeting_url,
    status: r.status, payment: r.payment_status, price: r.price_cents, typeId: r.type_id,
    canChange: r.status === "scheduled" && !past && !late && !pending, lateNote: late && !past ? `Online changes close ${rl.changeNotice} hours before the appointment — please call us.` : "",
  };
}
export async function manageSlots(env: AppEnv, token: string) {
  const r = await byToken(env, token);
  if (!r.type_id) return { slots: [] };
  const t = await one<TypeRow>(env.DB, "SELECT * FROM appointment_types WHERE id = ?", r.type_id);
  if (!t) return { slots: [] };
  const people = (await bookers(env, t)).filter((p) => p.id === r.member_id);
  const times = await openTimes(env, t, people, r.id);
  return { slots: (times.get(r.member_id) ?? []).map((ms) => new Date(ms).toISOString()) };
}
export async function manageAction(env: AppEnv, token: string, b: { action?: unknown; at?: unknown }, ip: string) {
  if (!(await rateLimit(env.DB, `book-manage:${ip}`, 20, 30))) throw new HttpError(429, "Too many changes. Please call us.", "rate_limited");
  const r = await byToken(env, token);
  const c = r.contact_type && r.contact_id ? { type: r.contact_type, id: r.contact_id } : null;
  // Left the payment page without paying: free the time now.
  if (b.action === "release") {
    if (r.payment_status === "pending" && r.status === "scheduled") await run(env.DB, "UPDATE appointments SET status = 'cancelled', hold_until = NULL, updated_at = ?, rev = rev + 1 WHERE id = ?", now(), r.id);
    return manageView(env, token);
  }
  const v = await manageView(env, token);
  if (!v.canChange) throw badRequest(v.lateNote || "This appointment can't be changed online. Please call us.");
  const d = await details(env, r);
  if (b.action === "cancel") {
    await run(env.DB, "UPDATE appointments SET status = 'cancelled', updated_at = ?, rev = rev + 1 WHERE id = ?", now(), r.id);
    await zoomDelete(env, r.meeting_id);
    await mail(env, "booking_cancelled", r, null).catch(() => null);
    await timeline(env, c, `Cancelled online: “${d.typeName}” on ${d.when}`);
    await notify(env, { module: "communication", memberIds: [r.member_id] }, { kind: "lead", title: `Cancelled: ${r.contact_name} — ${d.typeName}`, body: `${d.when}${r.payment_status === "paid" ? ` · Paid ${usd(r.price_cents)} — refund in Stripe if due` : ""}`, href: href({ type: r.contact_type, id: r.contact_id }) });
    await run(env.DB, "UPDATE appointments SET manage_hash = NULL WHERE id = ?", r.id);
    return { ...v, status: "cancelled", canChange: false };
  }
  if (b.action === "reschedule") {
    const at = Date.parse(s(b.at, 40));
    const { slots } = await manageSlots(env, token);
    if (!at || !slots.includes(new Date(at).toISOString())) throw new HttpError(409, "Sorry — that time isn't available. Please choose another.", "conflict");
    const len = Date.parse(r.ends_at) - Date.parse(r.starts_at);
    await run(env.DB, "UPDATE appointments SET starts_at = ?, ends_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", new Date(at).toISOString(), new Date(at + len).toISOString(), now(), r.id);
    const moved = await details(env, (await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", r.id))!);
    await timeline(env, c, `Rescheduled online: “${d.typeName}” moved from ${d.when} to ${moved.when}`);
    await notify(env, { module: "communication", memberIds: [r.member_id] }, { kind: "lead", title: `Rescheduled: ${r.contact_name} — ${d.typeName}`, body: `Now ${moved.when}`, href: href({ type: r.contact_type, id: r.contact_id }) });
    await confirm(env, r.id, "moved"); // new link emailed; this one stops working
    return { ...v, status: "moved", when: moved.when, canChange: false };
  }
  throw badRequest("Choose cancel or reschedule.");
}

/* ================================================================ every 15 minutes */
export async function processBookings(env: AppEnv) {
  const t = now();
  // Unpaid holds that ran out.
  await run(env.DB, "UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE status = 'scheduled' AND payment_status = 'pending' AND hold_until < ?", t, t);
  const rl = await rules(env);
  if (!rl.reminders.length) return { reminded: 0 };
  const max = Math.max(...rl.reminders);
  const due = await all<ApptRow>(env.DB, "SELECT * FROM appointments WHERE status = 'scheduled' AND kind = 'appointment' AND guest_email != '' AND confirmed_at IS NOT NULL AND payment_status != 'pending' AND starts_at > ? AND starts_at <= ? LIMIT 50",
    t, new Date(Date.now() + max * 3600e3).toISOString());
  let n = 0;
  for (const r of due) {
    const left = Date.parse(r.starts_at) - Date.now();
    const lead = Date.parse(r.starts_at) - Date.parse(r.confirmed_at!);
    const sent = json<number[]>(r.reminders_sent, []);
    const fits = rl.reminders.filter((h) => left <= h * 3600e3 && !sent.includes(h));
    if (!fits.length) continue;
    const h = Math.min(...fits);
    // Mark every reminder at or above this one as done (one email, never a burst).
    await run(env.DB, "UPDATE appointments SET reminders_sent = ? WHERE id = ?", JSON.stringify([...new Set([...sent, ...rl.reminders.filter((x) => x >= h)])]), r.id);
    if (lead <= h * 3600e3 + 30 * 60e3) continue; // booked inside this window — the confirmation was enough
    const token = await currentToken(env, r);
    await mail(env, "booking_reminder", r, token).catch((e) => console.error("reminder email", e));
    const d = await details(env, r);
    await text(env, r, `Reminder: ${d.typeName} on ${d.when}.${r.meeting_url ? ` Join: ${r.meeting_url}` : ""}`);
    n++;
  }
  return { reminded: n };
}
