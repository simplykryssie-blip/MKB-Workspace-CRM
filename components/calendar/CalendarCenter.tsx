"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, ClipboardCheck, Globe, ListTodo, Lock, Plus, Settings2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Menu } from "@/components/ui/Menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { PRIORITIES, type Appt, type ApptType, type CalMember, type FollowUp, type Task } from "@/lib/calendar/config";
import { ApptDialog, TaskDialog, TypesDialog, localDate, type ApptDraft } from "./CalendarDialogs";
import { BookingSettingsDialog, HoursDialog } from "./BookingDialogs";

type View = "day" | "week" | "month" | "tasks";
type Data = { appointments: Appt[]; tasks: Task[]; followUps: FollowUp[]; types: ApptType[]; members: CalMember[]; selected: string[]; canAll: boolean; meId: string };
const HOUR_PX = 48, START_H = 6, END_H = 21;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtT = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dueDate = (due: string) => (/^\d{4}-\d{2}-\d{2}$/.test(due) ? new Date(`${due}T00:00:00`) : new Date(due));
const PRI_TONE = { low: "neutral", normal: "neutral", high: "warning", urgent: "danger" } as const;

function range(view: View, cur: Date) {
  if (view === "day") return [startOfDay(cur), addDays(startOfDay(cur), 1)];
  if (view === "week" || view === "tasks") { const s = addDays(startOfDay(cur), -cur.getDay()); return [s, addDays(s, 7)]; }
  const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const s = addDays(first, -first.getDay());
  return [s, addDays(s, 42)];
}

/** One calendar for MKB and Monarch: appointments, time blocks, tasks and lead follow-ups, for each staff member. */
export function CalendarCenter() {
  const team = useTeam();
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const [view, setView] = useState<View>((sp.get("view") as View) || "week");
  const [cur, setCur] = useState(() => new Date());
  const [who, setWho] = useState<string>("me");
  const [d, setD] = useState<Data | null>(null);
  const [appt, setAppt] = useState<ApptDraft | null>(null);
  const [task, setTask] = useState<Partial<Task> | null>(null);
  const [settings, setSettings] = useState(false);
  const [hours, setHours] = useState(false);
  const [booking, setBooking] = useState(false);
  const [from, to] = useMemo(() => range(view, cur), [view, cur]);
  const load = useCallback(() => {
    if (!BACKEND) return;
    const members = who === "me" ? "" : who;
    call<Data>("GET", `/api/calendar?from=${from.toISOString()}&to=${to.toISOString()}${members ? `&members=${encodeURIComponent(members)}` : ""}`).then(setD).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load the calendar", "info"));
  }, [from, to, who, toast]);
  useEffect(() => { load(); }, [load]);
  // Phones start on the Day view (the week grid is wide).
  useEffect(() => { if (!sp.get("view") && window.innerWidth < 640) setView("day"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const v = sp.get("view") as View | null; if (v && v !== view) setView(v); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!BACKEND) return <PageHeader title="Calendar" subtitle="The calendar works with the live backend only." />;

  const color = (memberId: string) => d?.members.find((m) => m.id === memberId)?.color ?? "#2563eb";
  const typeColor = (a: Appt) => (a.kind === "block" ? "#64748b" : d?.types.find((t) => t.id === a.typeId)?.color ?? color(a.memberId));
  const step = (n: number) => setCur(view === "day" ? addDays(cur, n) : view === "month" ? new Date(cur.getFullYear(), cur.getMonth() + n, 1) : addDays(cur, 7 * n));
  const title = view === "day" ? cur.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : view === "month" ? cur.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(to, -1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const newAppt = (startsAt?: string, kind: Appt["kind"] = "appointment") => setAppt({ kind, startsAt, memberId: who !== "me" && !who.includes(",") && who !== "all" ? who : d?.meId, status: "scheduled", location: "video" });
  const setViewUrl = (v: View) => { setView(v); router.replace(`?view=${v}`, { scroll: false }); };
  const doneTask = async (t: Task, done: boolean) => {
    // Tick it right away; the reload confirms (and adds the next one for repeating tasks).
    setD((x) => (x ? { ...x, tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, status: done ? "done" : "open" } : y)) } : x));
    try { const r = await call<{ next: Task | null }>("POST", `/api/calendar/tasks/${t.id}/done`, { done }); toast(done ? (r.next ? "Done — next one added" : "Done") : "Reopened"); load(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't update", "info"); }
  };
  const doneFollow = async (f: FollowUp) => {
    setD((x) => (x ? { ...x, followUps: x.followUps.filter((y) => y.id !== f.id) } : x));
    try { await call("POST", `/api/calendar/followups/${f.id}/done`); toast("Follow-up done"); load(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't update", "info"); }
  };

  const days = view === "day" ? [startOfDay(cur)] : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(from, i)) : [];
  const canEdit = team.can("communication", "edit");

  return (
    <>
      <PageHeader title="Calendar" subtitle="Appointments, time blocks and tasks — MKB and Monarch together. Each staff member has their own calendar."
        actions={<div className="flex flex-wrap gap-2">
          <Menu label="Settings" trigger={({ toggle }) => <Button icon={Settings2} onClick={toggle}>Settings</Button>}
            items={[{ label: "My booking hours", icon: CalendarClock, onSelect: () => setHours(true) }, { label: "Online booking & Zoom", icon: Globe, onSelect: () => setBooking(true) }, { label: "Appointment types & colors", icon: Settings2, onSelect: () => setSettings(true) }]} />
          {canEdit && <Menu label="New" trigger={({ toggle }) => <Button variant="primary" icon={Plus} onClick={toggle}>New</Button>}
            items={[{ label: "Appointment", icon: CalendarPlus, onSelect: () => newAppt() }, { label: "Task", icon: ListTodo, onSelect: () => setTask({ priority: "normal", repeat: "none", checklist: [], assigneeId: d?.meId }) }, { label: "Block time", icon: Lock, onSelect: () => newAppt(undefined, "block") }]} />}
        </div>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="View" className="flex rounded-xl border border-line bg-surface p-0.5">
          {(["day", "week", "month", "tasks"] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setViewUrl(v)} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold capitalize ${view === v ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-hover"}`}>{v}</button>)}
        </div>
        {view !== "tasks" && <>
          <Button size="sm" onClick={() => setCur(new Date())}>Today</Button>
          <button aria-label="Previous" onClick={() => step(-1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-hover"><ChevronLeft size={18} /></button>
          <button aria-label="Next" onClick={() => step(1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-hover"><ChevronRight size={18} /></button>
          <span className="text-[15px] font-semibold text-ink">{title}</span>
        </>}
        <span className="flex-1" />
        {d && <label className="flex items-center gap-2 text-[13px] text-ink-2"><UserRound size={15} /><select aria-label="Whose calendar" value={who} onChange={(e) => setWho(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-2 text-[13px]"><option value="me">My calendar</option><option value="all">Everyone</option>{d.members.filter((m) => !m.me).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
      </div>

      {!d ? <Card className="p-10 text-center text-[13.5px] text-muted">Loading…</Card> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {view === "month" ? <MonthGrid d={d} from={from} cur={cur} color={typeColor} onAppt={(a) => setAppt(a)} onDay={(day) => { setCur(day); setViewUrl("day"); }} />
              : view === "tasks" ? <TaskList d={d} onTask={setTask} onDone={doneTask} onFollow={doneFollow} />
              : <TimeGrid d={d} days={days} color={typeColor} onAppt={(a) => setAppt(a)} onSlot={(iso) => canEdit && newAppt(iso)} onTask={setTask} />}
          </div>
          <TodayPanel d={d} color={typeColor} onAppt={(a) => setAppt(a)} onTask={setTask} onDone={doneTask} onFollow={doneFollow} />
        </div>
      )}

      {d && <ApptDialog draft={appt} types={d.types} members={d.members} meId={d.meId} canAll={d.canAll} onClose={() => setAppt(null)} onSaved={() => { setAppt(null); load(); }} />}
      {d && <TaskDialog draft={task} members={d.members} meId={d.meId} canAll={d.canAll} onClose={() => setTask(null)} onSaved={() => { setTask(null); load(); }} />}
      {d && <TypesDialog open={settings} types={d.types} members={d.members} meId={d.meId} canSettings={team.can("communication", "settings")} onClose={() => setSettings(false)} onSaved={load} />}
      <HoursDialog open={hours} onClose={() => setHours(false)} />
      <BookingSettingsDialog open={booking} canSettings={team.can("communication", "settings")} onClose={() => setBooking(false)} />
    </>
  );
}

/* ---------------------------------------------------------------- day / week */
function TimeGrid({ d, days, color, onAppt, onSlot, onTask }: { d: Data; days: Date[]; color: (a: Appt) => string; onAppt: (a: Appt) => void; onSlot: (iso: string) => void; onTask: (t: Task) => void }) {
  // 6 AM–9 PM, stretched to include anything earlier or later on these days.
  const shown = d.appointments.filter((a) => days.some((day) => sameDay(new Date(a.startsAt), day)));
  const startH = Math.min(START_H, ...shown.map((a) => new Date(a.startsAt).getHours()));
  const endH = Math.max(END_H, ...shown.map((a) => { const e = new Date(a.endsAt); return Math.min(24, e.getHours() + (e.getMinutes() ? 1 : 0) || 24); }).filter((h) => h > 0));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const today = new Date();
  const many = d.selected.length > 1;
  const name = (id: string) => d.members.find((m) => m.id === id)?.initials ?? "";
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length > 1 ? 760 : 0 }}>
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
            <div />
            {days.map((day) => {
              const dayTasks = d.tasks.filter((t) => t.status === "open" && t.dueAt && sameDay(dueDate(t.dueAt), day));
              return (
                <div key={day.toISOString()} className="border-l border-line px-1.5 py-2">
                  <p className={`text-center text-[12px] font-semibold ${sameDay(day, today) ? "text-accent" : "text-muted"}`}>{day.toLocaleDateString("en-US", { weekday: "short" })} <span className={`ml-0.5 inline-grid h-6 w-6 place-items-center rounded-full ${sameDay(day, today) ? "bg-accent text-white" : "text-ink"}`}>{day.getDate()}</span></p>
                  {dayTasks.slice(0, 3).map((t) => <button key={t.id} onClick={() => onTask(t)} className="mt-1 block w-full truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-left text-[11.5px] text-ink-2 hover:bg-surface-hover" title={t.title}>☐ {t.title}</button>)}
                  {dayTasks.length > 3 && <p className="mt-0.5 text-center text-[11px] text-muted">+{dayTasks.length - 3} tasks</p>}
                </div>
              );
            })}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
            <div>{hours.map((h) => <div key={h} style={{ height: HOUR_PX }} className="pr-1.5 text-right text-[11px] text-faint">{new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })}</div>)}</div>
            {days.map((day) => {
              const items = d.appointments.filter((a) => sameDay(new Date(a.startsAt), day));
              // Side-by-side lanes for overlapping items.
              const lanes: Appt[][] = [];
              const laneOf = new Map<string, number>();
              for (const a of [...items].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
                let i = lanes.findIndex((l) => l[l.length - 1].endsAt <= a.startsAt);
                if (i < 0) { lanes.push([a]); i = lanes.length - 1; } else lanes[i].push(a);
                laneOf.set(a.id, i);
              }
              return (
                <div key={day.toISOString()} className="relative border-l border-line">
                  {hours.map((h) => <button key={h} aria-label={`Add at ${h}:00`} onClick={() => onSlot(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h).toISOString())} style={{ height: HOUR_PX }} className="block w-full border-b border-line/60 hover:bg-accent-soft/30" />)}
                  {sameDay(day, today) && today.getHours() >= startH && today.getHours() < endH && <div className="pointer-events-none absolute left-0 right-0 h-0.5 bg-danger" style={{ top: (today.getHours() - startH + today.getMinutes() / 60) * HOUR_PX }} />}
                  {items.map((a) => {
                    const s = new Date(a.startsAt), e = new Date(a.endsAt);
                    const top = Math.max(0, (s.getHours() - startH + s.getMinutes() / 60) * HOUR_PX);
                    const h = Math.max(20, ((e.getTime() - s.getTime()) / 3600e3) * HOUR_PX);
                    const n = lanes.length, i = laneOf.get(a.id) ?? 0;
                    const c = color(a);
                    return (
                      <button key={a.id} onClick={() => onAppt(a)} className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[11.5px] leading-tight shadow-sm ${a.status === "cancelled" ? "opacity-50 line-through" : ""}`}
                        style={{ top, height: h, left: `calc(${(i / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, borderColor: c, background: a.kind === "block" ? "repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 6px, var(--surface) 6px, var(--surface) 12px)" : `${c}1f` }}>
                        <span className="block truncate font-semibold text-ink">{a.kind === "block" ? "🔒 " : ""}{a.title}</span>
                        <span className="block truncate text-muted">{fmtT(a.startsAt)}{many ? ` · ${name(a.memberId)}` : ""}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- month */
function MonthGrid({ d, from, cur, color, onAppt, onDay }: { d: Data; from: Date; cur: Date; color: (a: Appt) => string; onAppt: (a: Appt) => void; onDay: (d: Date) => void }) {
  const cells = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const today = new Date();
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <p key={w} className="py-2 text-center text-[12px] font-semibold text-muted">{w}</p>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const items = d.appointments.filter((a) => sameDay(new Date(a.startsAt), day) && a.status !== "cancelled");
          const tasks = d.tasks.filter((t) => t.status === "open" && t.dueAt && sameDay(dueDate(t.dueAt), day)).length;
          return (
            <div key={day.toISOString()} className={`min-h-[96px] border-b border-l border-line p-1 ${day.getMonth() !== cur.getMonth() ? "bg-surface-2/60" : ""}`}>
              <button onClick={() => onDay(day)} className={`mb-0.5 grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold ${sameDay(day, today) ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-hover"}`}>{day.getDate()}</button>
              {items.slice(0, 3).map((a) => <button key={a.id} onClick={() => onAppt(a)} className="mb-0.5 flex w-full items-center gap-1 truncate rounded px-1 text-left text-[11px] text-ink hover:bg-surface-hover"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(a) }} /><span className="truncate">{fmtT(a.startsAt)} {a.title}</span></button>)}
              {items.length > 3 && <button onClick={() => onDay(day)} className="text-[11px] text-muted">+{items.length - 3} more</button>}
              {tasks > 0 && <p className="text-[11px] text-muted">☐ {tasks} task{tasks > 1 ? "s" : ""}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- tasks */
function TaskRow({ t, onTask, onDone, owner }: { t: Task; onTask: (t: Task) => void; onDone: (t: Task, done: boolean) => void; owner?: string }) {
  const overdue = t.status === "open" && t.dueAt && dueDate(t.dueAt) < startOfDay(new Date());
  const steps = t.checklist.length ? ` · ${t.checklist.filter((c) => c.done).length}/${t.checklist.length} steps` : "";
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <input type="checkbox" aria-label={`Done: ${t.title}`} checked={t.status === "done"} onChange={(e) => onDone(t, e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
      <button onClick={() => onTask(t)} className="min-w-0 flex-1 text-left">
        <span className={`block text-[14px] ${t.status === "done" ? "text-muted line-through" : "text-ink"}`}>{t.title}</span>
        <span className={`block text-[12px] ${overdue ? "font-semibold text-danger-ink" : "text-muted"}`}>{t.dueAt ? (overdue ? "Overdue · " : "") + (/^\d{4}-\d{2}-\d{2}$/.test(t.dueAt) ? dueDate(t.dueAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : new Date(t.dueAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) : "No due date"}{t.repeat !== "none" ? " · repeats" : ""}{steps}{t.contact ? ` · ${t.contact.name}` : ""}{owner ? ` · ${owner}` : ""}</span>
      </button>
      {(t.priority === "high" || t.priority === "urgent") && <Badge tone={PRI_TONE[t.priority]}>{PRIORITIES[t.priority]}</Badge>}
    </li>
  );
}
function FollowRow({ f, onFollow }: { f: FollowUp; onFollow: (f: FollowUp) => void }) {
  const overdue = new Date(f.dueAt) < new Date();
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <input type="checkbox" aria-label={`Done: ${f.title}`} onChange={() => onFollow(f)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
      <a href={f.href} className="min-w-0 flex-1"><span className="block text-[14px] text-ink">{f.title}</span><span className={`block text-[12px] ${overdue ? "font-semibold text-danger-ink" : "text-muted"}`}>Lead follow-up · {f.contact.name} · {new Date(f.dueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></a>
    </li>
  );
}
function TaskList({ d, onTask, onDone, onFollow }: { d: Data; onTask: (t: Task) => void; onDone: (t: Task, done: boolean) => void; onFollow: (f: FollowUp) => void }) {
  const today = startOfDay(new Date()), tomorrow = addDays(today, 1);
  const open = d.tasks.filter((t) => t.status === "open");
  const groups: [string, Task[]][] = [
    ["Overdue", open.filter((t) => t.dueAt && dueDate(t.dueAt) < today)],
    ["Today", open.filter((t) => t.dueAt && dueDate(t.dueAt) >= today && dueDate(t.dueAt) < tomorrow)],
    ["Coming up", open.filter((t) => t.dueAt && dueDate(t.dueAt) >= tomorrow)],
    ["No due date", open.filter((t) => !t.dueAt)],
    ["Done", d.tasks.filter((t) => t.status === "done")],
  ];
  const owner = (id: string) => (d.selected.length > 1 ? d.members.find((m) => m.id === id)?.name : undefined);
  return (
    <div className="space-y-4">
      {d.followUps.length > 0 && <Card><CardHeader icon={CalendarClock} title="Lead follow-ups" subtitle="From your leads — checking one off marks it done on the lead too" /><ul className="divide-y divide-line border-t border-line">{d.followUps.map((f) => <FollowRow key={f.id} f={f} onFollow={onFollow} />)}</ul></Card>}
      {groups.filter(([, l]) => l.length).map(([g, l]) => <Card key={g}><CardHeader title={`${g} (${l.length})`} /><ul className="divide-y divide-line border-t border-line">{l.map((t) => <TaskRow key={t.id} t={t} onTask={onTask} onDone={onDone} owner={owner(t.assigneeId)} />)}</ul></Card>)}
      {!d.tasks.length && !d.followUps.length && <Card className="p-8 text-center"><ClipboardCheck className="mx-auto text-faint" size={28} /><p className="mt-2 text-[15px] font-semibold text-ink">No tasks</p><p className="text-[13px] text-muted">Use New → Task. Tasks can repeat, have a checklist, and be linked to a client or lead.</p></Card>}
    </div>
  );
}

/* ---------------------------------------------------------------- today */
function TodayPanel({ d, color, onAppt, onTask, onDone, onFollow }: { d: Data; color: (a: Appt) => string; onAppt: (a: Appt) => void; onTask: (t: Task) => void; onDone: (t: Task, done: boolean) => void; onFollow: (f: FollowUp) => void }) {
  const today = startOfDay(new Date()), tomorrow = addDays(today, 1);
  const appts = d.appointments.filter((a) => sameDay(new Date(a.startsAt), today) && a.status !== "cancelled");
  const due = d.tasks.filter((t) => t.status === "open" && t.dueAt && dueDate(t.dueAt) < tomorrow);
  const follows = d.followUps.filter((f) => new Date(f.dueAt) < tomorrow);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Today" subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} />
        <ul className="divide-y divide-line border-t border-line">
          {appts.length ? appts.map((a) => <li key={a.id}><button onClick={() => onAppt(a)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover"><span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color(a) }} /><span className="min-w-0 flex-1"><span className="block truncate text-[14px] text-ink">{a.title}</span><span className="block text-[12px] text-muted">{fmtT(a.startsAt)} – {fmtT(a.endsAt)}{a.status !== "scheduled" ? ` · ${a.status.replace("_", "-")}` : ""}</span></span></button></li>)
            : <li className="px-4 py-3 text-[13px] text-muted">No appointments today.</li>}
        </ul>
      </Card>
      <Card>
        <CardHeader title="To do" subtitle={`${due.length + follows.length} due today or overdue`} />
        <ul className="divide-y divide-line border-t border-line">
          {follows.map((f) => <FollowRow key={f.id} f={f} onFollow={onFollow} />)}
          {due.map((t) => <TaskRow key={t.id} t={t} onTask={onTask} onDone={onDone} />)}
          {!due.length && !follows.length && <li className="px-4 py-3 text-[13px] text-muted">All caught up.</li>}
        </ul>
      </Card>
      <p className="px-1 text-[12px] text-muted">{localDate(new Date())} · Times show in your computer&rsquo;s time zone.</p>
    </div>
  );
}
