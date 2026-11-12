"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Appointments } from "@/components/dashboard/Appointments";
import { Tasks } from "@/components/dashboard/Tasks";
import { BACKEND, call } from "@/lib/sync/remote";
import type { Appt, FollowUp, Task } from "@/lib/calendar/config";

type Data = { appointments: Appt[]; tasks: Task[]; followUps: FollowUp[] };
const fmtT = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Dashboard: today's appointments and what's due, from the Calendar (one card instead of two). */
export function TodayCard() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    if (!BACKEND) return;
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(e.getDate() + 1);
    call<Data>("GET", `/api/calendar?from=${s.toISOString()}&to=${e.toISOString()}`).then(setD).catch(() => setD({ appointments: [], tasks: [], followUps: [] }));
  }, []);
  if (!BACKEND) return <><Appointments /><Tasks /></>;
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const appts = (d?.appointments ?? []).filter((a) => a.status !== "cancelled");
  const due = (d?.tasks ?? []).filter((t) => t.status === "open" && t.dueAt && new Date(/^\d{4}-\d{2}-\d{2}$/.test(t.dueAt) ? `${t.dueAt}T00:00:00` : t.dueAt) <= end);
  const follows = (d?.followUps ?? []).filter((f) => new Date(f.dueAt) <= end);
  return (
    <Card>
      <CardHeader icon={CalendarDays} title="Today" subtitle={d ? `${appts.length} appointment${appts.length === 1 ? "" : "s"} · ${due.length + follows.length} to do` : "Loading…"} href="/calendar" hrefLabel="Calendar" />
      <ul className="divide-y divide-line border-t border-line">
        {appts.map((a) => <li key={a.id}><a href="/calendar?view=day" className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-hover"><span className="w-16 shrink-0 text-[13px] font-semibold tabular-nums text-ink">{fmtT(a.startsAt)}</span><span className="min-w-0 flex-1 truncate text-[14px] text-ink">{a.title}</span></a></li>)}
        {follows.map((f) => <li key={f.id}><a href={f.href} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-hover"><span className="w-16 shrink-0 text-[12px] text-muted">Follow-up</span><span className="min-w-0 flex-1 truncate text-[14px] text-ink">{f.contact.name}: {f.title}</span></a></li>)}
        {due.map((t) => <li key={t.id}><a href="/calendar?view=tasks" className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-hover"><span className="w-16 shrink-0 text-[12px] text-muted">Task</span><span className="min-w-0 flex-1 truncate text-[14px] text-ink">{t.title}</span></a></li>)}
        {d && !appts.length && !due.length && !follows.length && <li className="px-5 py-3 text-[13.5px] text-muted">Nothing on today&rsquo;s calendar.</li>}
      </ul>
    </Card>
  );
}
