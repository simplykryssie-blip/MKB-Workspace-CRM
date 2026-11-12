"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { LOCATIONS, STATUS_LABEL, type Appt, type ApptType, type CalMember, type Contact, type Task } from "@/lib/calendar/config";
import { ApptDialog, TaskDialog, type ApptDraft } from "./CalendarDialogs";

type Data = { appointments: Appt[]; tasks: Task[]; types: ApptType[]; members: CalMember[]; canAll: boolean; meId: string };
const TONE = { scheduled: "info", completed: "success", cancelled: "neutral", no_show: "danger" } as const;

/** A client's or lead's appointments and tasks — the same items as the Calendar. */
export function ContactCalendar({ contact, compact }: { contact: Contact; compact?: boolean }) {
  const team = useTeam();
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [appt, setAppt] = useState<ApptDraft | null>(null);
  const [task, setTask] = useState<Partial<Task> | null>(null);
  const load = useCallback(() => { if (BACKEND) call<Data>("GET", `/api/calendar/contact?type=${contact.type}&id=${encodeURIComponent(contact.id)}`).then(setD).catch(() => setD(null)); }, [contact.type, contact.id]);
  useEffect(() => { load(); }, [load]);
  if (!BACKEND) return null;
  const can = team.can("communication", "edit");
  const now = new Date().toISOString();
  const upcoming = (d?.appointments ?? []).filter((a) => a.kind === "appointment" && a.status === "scheduled" && a.endsAt >= now).reverse();
  const needs = (d?.appointments ?? []).filter((a) => a.kind === "appointment" && a.status === "scheduled" && a.endsAt < now);
  const past = (d?.appointments ?? []).filter((a) => a.kind === "appointment" && a.status !== "scheduled");
  const openTasks = (d?.tasks ?? []).filter((t) => t.status === "open");
  const done = async (t: Task) => { try { await call("POST", `/api/calendar/tasks/${t.id}/done`, { done: true }); toast("Done"); load(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't update", "info"); } };
  const row = (a: Appt) => (
    <li key={a.id}><button onClick={() => setAppt(a)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover sm:px-5">
      <span className="w-12 shrink-0 rounded-lg border border-line bg-surface-2 py-1 text-center"><span className="block text-[10px] font-semibold uppercase text-muted">{new Date(a.startsAt).toLocaleDateString("en-US", { month: "short" })}</span><span className="block text-[16px] font-bold leading-none text-ink">{new Date(a.startsAt).getDate()}</span></span>
      <span className="min-w-0 flex-1"><span className={`block truncate text-[14px] ${a.status === "cancelled" ? "text-muted line-through" : "text-ink"}`}>{a.title}</span><span className="block text-[12px] text-muted">{new Date(a.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {LOCATIONS[a.location]} · with {d?.members.find((m) => m.id === a.memberId)?.name ?? "staff"}</span></span>
      <Badge tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
    </button></li>
  );
  const body = !d ? <p className="border-t border-line px-5 py-3 text-[13px] text-muted">Loading…</p> : (
    <div className="border-t border-line">
      {needs.length > 0 && <p className="mx-4 mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink sm:mx-5">{needs.length} past appointment{needs.length > 1 ? "s" : ""} still need an outcome — open {needs.length > 1 ? "them" : "it"} to mark completed or no-show.</p>}
      <p className="px-4 pt-3 text-[12px] font-semibold uppercase tracking-wide text-muted sm:px-5">Upcoming</p>
      <ul className="divide-y divide-line">{[...needs, ...upcoming].length ? [...needs, ...upcoming].map(row) : <li className="px-4 py-2.5 text-[13.5px] text-muted sm:px-5">Nothing scheduled.</li>}</ul>
      {openTasks.length > 0 && <><p className="px-4 pt-3 text-[12px] font-semibold uppercase tracking-wide text-muted sm:px-5">Open tasks</p>
        <ul className="divide-y divide-line">{openTasks.map((t) => <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5"><input type="checkbox" aria-label={`Done: ${t.title}`} onChange={() => void done(t)} className="h-4 w-4 accent-[var(--accent)]" /><button onClick={() => setTask(t)} className="min-w-0 flex-1 text-left"><span className="block truncate text-[14px] text-ink">{t.title}</span><span className="block text-[12px] text-muted">{t.dueAt ? `Due ${new Date(/^\d{4}-\d{2}-\d{2}$/.test(t.dueAt) ? `${t.dueAt}T00:00:00` : t.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"} · {d.members.find((m) => m.id === t.assigneeId)?.name ?? ""}</span></button></li>)}</ul></>}
      {!compact && past.length > 0 && <><p className="px-4 pt-3 text-[12px] font-semibold uppercase tracking-wide text-muted sm:px-5">History</p><ul className="divide-y divide-line">{past.map(row)}</ul></>}
      <div className="h-2" />
    </div>
  );
  return (
    <Card>
      <CardHeader title="Appointments & tasks" subtitle="Same as the Calendar" action={can && d ? <div className="flex gap-2"><Button size="sm" icon={ListTodo} onClick={() => setTask({ priority: "normal", repeat: "none", checklist: [], contact, assigneeId: d.meId })}>Task</Button><Button size="sm" variant="primary" icon={CalendarPlus} onClick={() => setAppt({ kind: "appointment", contact, memberId: d.meId, status: "scheduled", location: "video" })}>Schedule</Button></div> : undefined} />
      {body}
      {d && <ApptDialog draft={appt} types={d.types} members={d.members} meId={d.meId} canAll={d.canAll} onClose={() => setAppt(null)} onSaved={() => { setAppt(null); load(); }} />}
      {d && <TaskDialog draft={task} members={d.members} meId={d.meId} canAll={d.canAll} onClose={() => setTask(null)} onSaved={() => { setTask(null); load(); }} />}
    </Card>
  );
}

/** Opens the scheduling dialog for a contact from anywhere (e.g. a profile's Schedule button). */
export function ScheduleFor({ contact, open, onClose }: { contact: Contact; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<{ types: ApptType[]; members: CalMember[]; canAll: boolean; meId: string } | null>(null);
  useEffect(() => { if (open && BACKEND && !d) call<Data>("GET", `/api/calendar/contact?type=${contact.type}&id=${encodeURIComponent(contact.id)}`).then(setD).catch(() => {}); }, [open, contact.type, contact.id, d]);
  if (!open || !d) return null;
  return <ApptDialog draft={{ kind: "appointment", contact, memberId: d.meId, status: "scheduled", location: "video" }} types={d.types} members={d.members} meId={d.meId} canAll={d.canAll} onClose={onClose} onSaved={() => { toast("Scheduled — it's on the Calendar"); onClose(); window.dispatchEvent(new Event("mkb:calendar")); }} />;
}
