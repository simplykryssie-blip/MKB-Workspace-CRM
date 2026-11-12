/**
 * The Calendar: appointments, time blocks and tasks for every staff member,
 * shared by MKB and Monarch, plus lead follow-ups shown as tasks.
 *
 * Access (Communication permission): View sees the calendars; Edit adds and
 * changes items on your own calendar (and ones you created); Assign manages
 * everyone's calendar and assigns tasks to others. Server-only.
 */
import { COLORS, nextDue, type Appt, type ApptType, type CalMember, type Contact, type FollowUp, type Task } from "@/lib/calendar/config";
import { all, badRequest, HttpError, json, notFound, now, one, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";
import { canDo } from "@/lib/team/policy";
import { afterStaffCancel, afterStaffSave } from "./booking";

type Staff = Extract<Actor, { kind: "staff" }>;
const canAll = (a: Staff) => canDo(a.policy, a.member, "communication", "assign");
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BRANDS = ["mkb", "monarch"], LOCS = ["video", "phone", "in_person"], SVCS = ["other", "tax", "books", "biz", "expunge", "monarch"];
const pick = <T extends string>(v: unknown, list: readonly string[], d: T) => (typeof v === "string" && list.includes(v) ? (v as T) : d);

/* ================================================================ rows */
type TypeRow = { id: string; name: string; brand: string; service: string; duration_min: number; location: string; location_note: string; color: string; price_cents: number; buffer_min: number; description: string; bookable: number; active: number; position: number; member_ids: string };
const toType = (r: TypeRow): ApptType => ({ id: r.id, name: r.name, brand: r.brand as ApptType["brand"], service: r.service, durationMin: r.duration_min, location: r.location as ApptType["location"], locationNote: r.location_note, color: r.color, priceCents: r.price_cents, bufferMin: r.buffer_min, description: r.description, bookable: !!r.bookable, active: !!r.active, position: r.position, memberIds: json<string[]>(r.member_ids ?? "[]", []) });
type ApptRow = { id: string; kind: string; type_id: string | null; title: string; brand: string; service: string; member_id: string; starts_at: string; ends_at: string; location: string; location_note: string; contact_type: string | null; contact_id: string | null; contact_name: string; status: string; notes: string; source: string; created_by: string | null; rev: number; guest_email: string; guest_phone: string; meeting_url: string; price_cents: number; payment_status: string; hold_until: string | null };
const contactOf = (t: string | null, id: string | null, name: string): Contact | null => (t && id ? { type: t as Contact["type"], id, name } : null);
const toAppt = (r: ApptRow): Appt => ({ id: r.id, kind: r.kind as Appt["kind"], typeId: r.type_id ?? undefined, title: r.title, brand: r.brand as Appt["brand"], service: r.service, memberId: r.member_id, startsAt: r.starts_at, endsAt: r.ends_at, location: r.location as Appt["location"], locationNote: r.location_note, contact: contactOf(r.contact_type, r.contact_id, r.contact_name), status: r.status as Appt["status"], notes: r.notes, source: r.source, rev: r.rev, guestEmail: r.guest_email ?? "", guestPhone: r.guest_phone ?? "", meetingUrl: r.meeting_url ?? "", priceCents: r.price_cents ?? 0, paymentStatus: (r.payment_status ?? "none") as Appt["paymentStatus"] });
type TaskRow = { id: string; title: string; notes: string; due_at: string | null; all_day: number; priority: string; status: string; done_at: string | null; assignee_id: string; brand: string; service: string; contact_type: string | null; contact_id: string | null; contact_name: string; checklist: string; repeat: string; created_by: string | null; rev: number };
const toTask = (r: TaskRow): Task => ({ id: r.id, title: r.title, notes: r.notes, dueAt: r.due_at ?? undefined, allDay: !!r.all_day, priority: r.priority as Task["priority"], status: r.status as Task["status"], doneAt: r.done_at ?? undefined, assigneeId: r.assignee_id, brand: r.brand as Task["brand"], service: r.service, contact: contactOf(r.contact_type, r.contact_id, r.contact_name), checklist: json(r.checklist, []), repeat: r.repeat as Task["repeat"], rev: r.rev });

async function members(env: AppEnv, a: Staff): Promise<CalMember[]> {
  const rows = await all<{ id: string; name: string; initials: string; color: string | null }>(env.DB, "SELECT m.id, m.name, m.initials, cs.color FROM members m LEFT JOIN calendar_settings cs ON cs.member_id = m.id WHERE m.status = 'active' ORDER BY m.name");
  return rows.map((r, i) => ({ id: r.id, name: r.name, initials: r.initials, color: r.color ?? COLORS[(i + 1) % COLORS.length], me: r.id === a.member.id }));
}
async function contactFrom(env: AppEnv, v: unknown): Promise<Contact | null> {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = s(o.id, 80), type = o.type;
  if (!id) return null;
  if (type === "lead") { const r = await one<{ name: string }>(env.DB, "SELECT name FROM leads WHERE id = ?", id); if (r) return { type, id, name: r.name }; }
  if (type === "client") { const r = await one<{ name: string }>(env.DB, "SELECT name FROM clients WHERE id = ?", id); if (r) return { type, id, name: r.name }; }
  if (type === "office") { const r = await one<{ name: string }>(env.DB, "SELECT name FROM mon_offices WHERE id = ?", id); if (r) return { type, id, name: r.name }; }
  throw badRequest("That client or lead wasn't found.");
}
async function timeline(env: AppEnv, c: Contact | null, text: string, a: Staff) {
  if (!c) return;
  const t = now();
  if (c.type === "lead") await run(env.DB, "INSERT INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, 'lead', ?, 'staff', ?, ?)", randomId("x"), c.id, text, a.member.id, t);
  else if (c.type === "client") await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'appointment', ?, 'staff', ?, ?)", randomId("x"), c.id, text, a.member.id, t);
}
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

/* ================================================================ the calendar */
/** Everything between `from` and `to` for the chosen calendars, plus open tasks and follow-ups that are overdue. */
export async function getCalendar(env: AppEnv, a: Actor, q: { from?: string; to?: string; members?: string }) {
  requirePermission(a, "communication", "view");
  requireStaff(a);
  const from = ISO.test(q.from ?? "") || DAY.test(q.from ?? "") ? q.from! : new Date(Date.now() - 7 * 864e5).toISOString();
  const to = ISO.test(q.to ?? "") || DAY.test(q.to ?? "") ? q.to! : new Date(Date.now() + 35 * 864e5).toISOString();
  const team = await members(env, a);
  const ids = (q.members === "all" ? team.map((m) => m.id) : (q.members ?? a.member.id).split(",")).filter((id) => team.some((m) => m.id === id)).slice(0, 50);
  if (!ids.length) ids.push(a.member.id);
  const ph = ids.map(() => "?").join(",");
  const appts = await all<ApptRow>(env.DB, `SELECT * FROM appointments WHERE member_id IN (${ph}) AND starts_at < ? AND ends_at > ? ORDER BY starts_at`, ...ids, to, from);
  const tasks = await all<TaskRow>(env.DB, `SELECT * FROM tasks WHERE assignee_id IN (${ph}) AND ((due_at >= ? AND due_at < ?) OR (status = 'open' AND (due_at IS NULL OR due_at < ?))) ORDER BY due_at IS NULL, due_at`, ...ids, from.slice(0, 10), to, to);
  const follow = await all<{ id: string; lead_id: string; at: string; note: string; owner_id: string; name: string }>(env.DB, `SELECT r.id, r.lead_id, r.at, r.note, r.owner_id, l.name FROM lead_reminders r JOIN leads l ON l.id = r.lead_id WHERE r.done = 0 AND l.status = 'open' AND r.owner_id IN (${ph}) AND r.at < ? ORDER BY r.at`, ...ids, to);
  const types = await all<TypeRow>(env.DB, "SELECT * FROM appointment_types ORDER BY active DESC, position, name");
  const followUps: FollowUp[] = follow.map((r) => ({ id: r.id, kind: "lead_followup", title: r.note || "Follow up", dueAt: r.at, memberId: r.owner_id, contact: { type: "lead", id: r.lead_id, name: r.name }, href: `/leads/${r.lead_id}` }));
  return { appointments: appts.map(toAppt), tasks: tasks.map(toTask), followUps, types: types.map(toType), members: team, selected: ids, canAll: canAll(a), meId: a.member.id };
}
/** A lead's or client's appointments (their profile). */
export async function contactCalendar(env: AppEnv, a: Actor, q: { type?: string; id?: string }) {
  requirePermission(a, "communication", "view");
  requireStaff(a);
  if (!q.type || !q.id) throw badRequest("Choose a client or lead.");
  const appts = await all<ApptRow>(env.DB, "SELECT * FROM appointments WHERE contact_type = ? AND contact_id = ? ORDER BY starts_at DESC LIMIT 200", q.type, q.id);
  const tasks = await all<TaskRow>(env.DB, "SELECT * FROM tasks WHERE contact_type = ? AND contact_id = ? ORDER BY status, due_at LIMIT 200", q.type, q.id);
  const types = await all<TypeRow>(env.DB, "SELECT * FROM appointment_types WHERE active = 1 ORDER BY position, name");
  return { appointments: appts.map(toAppt), tasks: tasks.map(toTask), types: types.map(toType), members: await members(env, a), canAll: canAll(a), meId: a.member.id };
}
/** Leads, clients and Monarch firms matching a search, for linking. */
export async function searchContacts(env: AppEnv, a: Actor, q: string) {
  requireStaff(a);
  const t = `%${q.trim().slice(0, 60)}%`;
  if (q.trim().length < 2) return { contacts: [] };
  const [c, l, o] = await Promise.all([
    all<{ id: string; name: string; email: string | null }>(env.DB, "SELECT id, name, email FROM clients WHERE status NOT IN ('prospect', 'declined') AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR contact_name LIKE ?) LIMIT 8", t, t, t, t),
    all<{ id: string; name: string; email: string }>(env.DB, "SELECT id, name, email FROM leads WHERE status = 'open' AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR contact_name LIKE ?) LIMIT 8", t, t, t, t),
    all<{ id: string; name: string; email: string }>(env.DB, "SELECT id, name, email FROM mon_offices WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR contact_name LIKE ? LIMIT 6", t, t, t, t),
  ]);
  return { contacts: [...c.map((x) => ({ type: "client", id: x.id, name: x.name, detail: x.email ?? "" })), ...l.map((x) => ({ type: "lead", id: x.id, name: x.name, detail: x.email })), ...o.map((x) => ({ type: "office", id: x.id, name: x.name, detail: `Monarch · ${x.email}` }))] };
}

/* ================================================================ appointments & time blocks */
async function apptRow(env: AppEnv, id: string) {
  const r = await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id);
  if (!r) throw notFound("Appointment not found.");
  return r;
}
const mayEdit = (a: Staff, memberId: string, createdBy: string | null) => canAll(a) || memberId === a.member.id || createdBy === a.member.id;

export async function saveAppointment(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  requirePermission(a, "communication", "edit");
  requireStaff(a);
  const existing = typeof b.id === "string" && b.id ? await apptRow(env, b.id) : null;
  if (existing && !mayEdit(a, existing.member_id, existing.created_by)) throw new HttpError(403, "You can only change appointments on your own calendar.", "forbidden");
  if (existing && Number(b.rev) !== existing.rev) throw new HttpError(409, "This appointment was changed somewhere else. Reloading the latest version.", "conflict");
  const kind = b.kind === "block" ? "block" : "appointment";
  const memberId = s(b.memberId, 60) || a.member.id;
  if (memberId !== a.member.id && !canAll(a) && !(existing && existing.member_id === memberId)) throw new HttpError(403, "You can only add to your own calendar.", "forbidden");
  if (!(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", memberId))) throw badRequest("Choose whose calendar.");
  const startsAt = s(b.startsAt, 40), endsAt = s(b.endsAt, 40);
  if (!ISO.test(startsAt) || !ISO.test(endsAt) || isNaN(Date.parse(startsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)) throw badRequest("Choose a start and an end time after it.");
  if (Date.parse(endsAt) - Date.parse(startsAt) > 24 * 3600e3) throw badRequest("An appointment can't be longer than a day.");
  const type = typeof b.typeId === "string" && b.typeId ? await one<TypeRow>(env.DB, "SELECT * FROM appointment_types WHERE id = ?", b.typeId) : null;
  const contact = kind === "appointment" ? await contactFrom(env, b.contact) : null;
  const title = s(b.title, 140) || (kind === "block" ? "Busy" : type ? `${type.name}${contact ? ` — ${contact.name}` : ""}` : contact?.name ?? "");
  if (!title) throw badRequest("Give it a title.");
  const v = {
    kind, typeId: type?.id ?? null, title, brand: pick(b.brand, BRANDS, type?.brand ?? "mkb"), service: pick(b.service, SVCS, type?.service ?? "other"),
    memberId, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), location: pick(b.location, LOCS, type?.location ?? "video"), locationNote: s(b.locationNote, 300),
    contact, notes: s(b.notes, 4000), status: pick(b.status, ["scheduled", "completed", "cancelled", "no_show"], existing?.status ?? "scheduled"),
  };
  const t = now();
  // Overlaps on that calendar are allowed (staff decide), but reported back.
  const clash = await all<{ title: string; starts_at: string }>(env.DB, "SELECT title, starts_at FROM appointments WHERE member_id = ? AND status = 'scheduled' AND starts_at < ? AND ends_at > ? AND id != ?", v.memberId, v.endsAt, v.startsAt, existing?.id ?? "");
  let id = existing?.id;
  if (existing) {
    const res = await run(env.DB, "UPDATE appointments SET kind = ?, type_id = ?, title = ?, brand = ?, service = ?, member_id = ?, starts_at = ?, ends_at = ?, location = ?, location_note = ?, contact_type = ?, contact_id = ?, contact_name = ?, notes = ?, status = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?",
      v.kind, v.typeId, v.title, v.brand, v.service, v.memberId, v.startsAt, v.endsAt, v.location, v.locationNote, v.contact?.type ?? null, v.contact?.id ?? null, v.contact?.name ?? "", v.notes, v.status, t, existing.id, existing.rev);
    if (!res.meta.changes) throw new HttpError(409, "This appointment was changed somewhere else. Reloading the latest version.", "conflict");
    if (existing.starts_at !== v.startsAt && v.kind === "appointment") await timeline(env, v.contact, `Appointment moved to ${when(v.startsAt)}: “${v.title}”`, a);
  } else {
    id = randomId("apt");
    await run(env.DB, "INSERT INTO appointments (id, kind, type_id, title, brand, service, member_id, starts_at, ends_at, location, location_note, contact_type, contact_id, contact_name, status, notes, source, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, 'staff', ?, ?, ?)",
      id, v.kind, v.typeId, v.title, v.brand, v.service, v.memberId, v.startsAt, v.endsAt, v.location, v.locationNote, v.contact?.type ?? null, v.contact?.id ?? null, v.contact?.name ?? "", v.notes, a.member.id, t, t);
    if (v.kind === "appointment") await timeline(env, v.contact, `Appointment scheduled for ${when(v.startsAt)}: “${v.title}”`, a);
  }
  await audit(env.DB, a, { action: "Record update", resource: `Calendar ${v.kind} ${id}`, meta: existing ? "Updated" : "Created" });
  // Zoom link, confirmation email and invite (when "Email them" is ticked).
  if (v.kind === "appointment" && v.status === "scheduled") await afterStaffSave(env, id!, { isNew: !existing, moved: !!existing && (existing.starts_at !== v.startsAt || existing.ends_at !== v.endsAt), notify: b.notify === true }).catch((e) => console.error("after save", e));
  return { appointment: toAppt((await one<ApptRow>(env.DB, "SELECT * FROM appointments WHERE id = ?", id))!), clashes: clash.map((c) => `${c.title} at ${when(c.starts_at)}`) };
}
export async function setAppointmentStatus(env: AppEnv, a: Actor, id: string, b: { status?: unknown; notify?: unknown }) {
  requirePermission(a, "communication", "edit");
  requireStaff(a);
  const r = await apptRow(env, id);
  if (!mayEdit(a, r.member_id, r.created_by)) throw new HttpError(403, "You can only change appointments on your own calendar.", "forbidden");
  const status = pick<Appt["status"]>(b.status, ["scheduled", "completed", "cancelled", "no_show"], "scheduled");
  await run(env.DB, "UPDATE appointments SET status = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", status, now(), id);
  if (status === "cancelled" && r.status === "scheduled") await afterStaffCancel(env, id, b.notify === true).catch((e) => console.error("after cancel", e));
  const word = { scheduled: "Back on the calendar", completed: "Completed", cancelled: "Cancelled", no_show: "Marked no-show" }[status];
  await timeline(env, contactOf(r.contact_type, r.contact_id, r.contact_name), `${word}: “${r.title}” (${when(r.starts_at)})`, a);
  return { appointment: toAppt((await apptRow(env, id))) };
}
export async function deleteAppointment(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "communication", "edit");
  requireStaff(a);
  const r = await apptRow(env, id);
  if (!mayEdit(a, r.member_id, r.created_by)) throw new HttpError(403, "You can only change appointments on your own calendar.", "forbidden");
  if (r.kind === "appointment" && r.contact_id && r.status !== "cancelled") throw badRequest("Cancel the appointment instead, so it stays on their record.");
  await run(env.DB, "DELETE FROM appointments WHERE id = ?", id);
  return { ok: true };
}

/* ================================================================ tasks */
async function taskRow(env: AppEnv, id: string) {
  const r = await one<TaskRow>(env.DB, "SELECT * FROM tasks WHERE id = ?", id);
  if (!r) throw notFound("Task not found.");
  return r;
}
export async function saveTask(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  requirePermission(a, "communication", "edit");
  requireStaff(a);
  const existing = typeof b.id === "string" && b.id ? await taskRow(env, b.id) : null;
  if (existing && !mayEdit(a, existing.assignee_id, existing.created_by)) throw new HttpError(403, "You can only change your own tasks.", "forbidden");
  if (existing && Number(b.rev) !== existing.rev) throw new HttpError(409, "This task was changed somewhere else. Reloading the latest version.", "conflict");
  const title = s(b.title, 200);
  if (!title) throw badRequest("Give the task a title.");
  const assigneeId = s(b.assigneeId, 60) || a.member.id;
  if (assigneeId !== a.member.id && !canAll(a) && assigneeId !== existing?.assignee_id) throw new HttpError(403, "Assigning tasks to others needs the Communication “Assign” permission.", "forbidden");
  if (!(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", assigneeId))) throw badRequest("Choose who the task is for.");
  const due = s(b.dueAt, 40);
  const allDay = DAY.test(due);
  if (due && !allDay && (!ISO.test(due) || isNaN(Date.parse(due)))) throw badRequest("Choose a valid due date.");
  const checklist = (Array.isArray(b.checklist) ? b.checklist : []).slice(0, 50).map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { id: s(o.id, 30) || randomId("ck"), text: s(o.text, 200), done: o.done === true }; }).filter((x) => x.text);
  const repeat = pick(b.repeat, ["none", "daily", "weekly", "monthly", "quarterly", "yearly"], "none");
  if (repeat !== "none" && !due) throw badRequest("A repeating task needs a due date.");
  const contact = await contactFrom(env, b.contact);
  const v = [title, s(b.notes, 4000), due ? (allDay ? due : new Date(due).toISOString()) : null, allDay || !due ? 1 : 0, pick(b.priority, ["low", "normal", "high", "urgent"], "normal"), assigneeId, pick(b.brand, BRANDS, "mkb"), pick(b.service, SVCS, "other"), contact?.type ?? null, contact?.id ?? null, contact?.name ?? "", JSON.stringify(checklist), repeat];
  const t = now();
  let id = existing?.id;
  if (existing) {
    const res = await run(env.DB, "UPDATE tasks SET title = ?, notes = ?, due_at = ?, all_day = ?, priority = ?, assignee_id = ?, brand = ?, service = ?, contact_type = ?, contact_id = ?, contact_name = ?, checklist = ?, repeat = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", ...v, t, existing.id, existing.rev);
    if (!res.meta.changes) throw new HttpError(409, "This task was changed somewhere else. Reloading the latest version.", "conflict");
  } else {
    id = randomId("tsk");
    await run(env.DB, "INSERT INTO tasks (id, title, notes, due_at, all_day, priority, assignee_id, brand, service, contact_type, contact_id, contact_name, checklist, repeat, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, ...v, a.member.id, t, t);
    if (assigneeId !== a.member.id) await run(env.DB, "INSERT INTO notifications (id, member_id, kind, title, body, href, created_at) VALUES (?, ?, 'followup', ?, ?, '/calendar?view=tasks', ?)", randomId("n"), assigneeId, `${a.member.name} gave you a task`, title, t).catch(() => {});
  }
  return { task: toTask(await taskRow(env, id!)) };
}
/** Done / not done. Finishing a repeating task adds the next one. */
export async function toggleTask(env: AppEnv, a: Actor, id: string, b: { done?: unknown }) {
  requirePermission(a, "communication", "edit");
  requireStaff(a);
  const r = await taskRow(env, id);
  if (!mayEdit(a, r.assignee_id, r.created_by)) throw new HttpError(403, "You can only change your own tasks.", "forbidden");
  const done = b.done === true;
  const t = now();
  await run(env.DB, "UPDATE tasks SET status = ?, done_at = ?, done_by = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", done ? "done" : "open", done ? t : null, done ? a.member.id : null, t, id);
  let next: Task | null = null;
  if (done && r.status === "open" && r.repeat !== "none" && r.due_at) {
    const nid = randomId("tsk");
    const checklist = json<{ id: string; text: string; done: boolean }[]>(r.checklist, []).map((c) => ({ ...c, done: false }));
    await run(env.DB, "INSERT INTO tasks (id, title, notes, due_at, all_day, priority, assignee_id, brand, service, contact_type, contact_id, contact_name, checklist, repeat, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      nid, r.title, r.notes, nextDue(r.due_at, r.repeat as Task["repeat"]), r.all_day, r.priority, r.assignee_id, r.brand, r.service, r.contact_type, r.contact_id, r.contact_name, JSON.stringify(checklist), r.repeat, r.created_by, t, t);
    next = toTask(await taskRow(env, nid));
  }
  if (done) await timeline(env, contactOf(r.contact_type, r.contact_id, r.contact_name), `Task done: “${r.title}”`, a);
  return { task: toTask(await taskRow(env, id)), next };
}
export async function deleteTask(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "communication", "edit");
  requireStaff(a);
  const r = await taskRow(env, id);
  if (!mayEdit(a, r.assignee_id, r.created_by)) throw new HttpError(403, "You can only change your own tasks.", "forbidden");
  await run(env.DB, "DELETE FROM tasks WHERE id = ?", id);
  return { ok: true };
}
/** A lead follow-up shown in the planner: mark it done (same as on the lead page). */
export async function doneFollowUp(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "leads", "edit");
  requireStaff(a);
  const r = await one<{ lead_id: string; note: string; owner_id: string }>(env.DB, "SELECT lead_id, note, owner_id FROM lead_reminders WHERE id = ?", id);
  if (!r) throw notFound("Follow-up not found.");
  if (r.owner_id !== a.member.id && !canAll(a)) throw new HttpError(403, "That follow-up belongs to someone else.", "forbidden");
  await run(env.DB, "UPDATE lead_reminders SET done = 1 WHERE id = ?", id);
  await run(env.DB, "INSERT INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, 'lead', ?, 'staff', ?, ?)", randomId("x"), r.lead_id, `Follow-up done: “${r.note}”`, a.member.id, now());
  return { ok: true };
}

/* ================================================================ settings */
export async function saveType(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  requirePermission(a, "communication", "settings");
  requireStaff(a);
  const name = s(b.name, 80);
  if (!name) throw badRequest("Name the appointment type.");
  const dur = Math.round(Number(b.durationMin));
  if (!(dur >= 5 && dur <= 480)) throw badRequest("Length must be between 5 minutes and 8 hours.");
  const price = Math.round(Number(b.priceCents) || 0);
  if (price < 0 || price > 10_000_00) throw badRequest("Enter a price between $0 and $10,000.");
  const color = /^#[0-9a-f]{6}$/i.test(s(b.color, 7)) ? s(b.color, 7) : "#b87912";
  const t = now();
  const id = typeof b.id === "string" && b.id ? b.id : randomId("apt");
  await run(env.DB, `INSERT INTO appointment_types (id, name, brand, service, duration_min, location, location_note, color, price_cents, buffer_min, description, bookable, active, member_ids, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, coalesce((SELECT max(position) + 1 FROM appointment_types), 0), ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, brand = excluded.brand, service = excluded.service, duration_min = excluded.duration_min, location = excluded.location, location_note = excluded.location_note, color = excluded.color, price_cents = excluded.price_cents, buffer_min = excluded.buffer_min, description = excluded.description, bookable = excluded.bookable, active = excluded.active, member_ids = excluded.member_ids, updated_at = excluded.updated_at`,
    id, name, pick(b.brand, BRANDS, "mkb"), pick(b.service, SVCS, "other"), dur, pick(b.location, LOCS, "video"), s(b.locationNote, 300), color, price, Math.max(0, Math.min(120, Math.round(Number(b.bufferMin) || 0))), s(b.description, 600), b.bookable === false ? 0 : 1, b.active === false ? 0 : 1, JSON.stringify((Array.isArray(b.memberIds) ? b.memberIds : []).filter((x): x is string => typeof x === "string").slice(0, 50)), t, t);
  await audit(env.DB, a, { action: "Record update", resource: `Appointment type ${name}` });
  return { types: (await all<TypeRow>(env.DB, "SELECT * FROM appointment_types ORDER BY active DESC, position, name")).map(toType) };
}
export async function saveMyCalendar(env: AppEnv, a: Actor, b: { color?: unknown; memberId?: unknown }) {
  requireStaff(a);
  const memberId = typeof b.memberId === "string" && b.memberId && canAll(a) ? b.memberId : a.member.id;
  const color = /^#[0-9a-f]{6}$/i.test(s(b.color, 7)) ? s(b.color, 7) : null;
  if (!color) throw badRequest("Choose a color.");
  await run(env.DB, "INSERT INTO calendar_settings (member_id, color, updated_at) VALUES (?, ?, ?) ON CONFLICT(member_id) DO UPDATE SET color = excluded.color, updated_at = excluded.updated_at", memberId, color, now());
  return { members: await members(env, a) };
}
