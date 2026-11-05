"use client";

import { AlertCircle, Check, ListChecks } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { tasks } from "@/lib/sample-data";

const dueStyle = {
  overdue: "bg-danger-soft text-danger-ink",
  today: "bg-warning-soft text-warning-ink",
  soon: "bg-accent-soft text-accent-ink",
  later: "bg-surface-2 text-muted ring-1 ring-line",
} as const;

export function Tasks() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const open = tasks.filter((t) => !done[t.id]).length;
  return (
    <Card>
      <CardHeader icon={ListChecks} title="Tasks & deadlines" subtitle={`${open} open · 1 overdue`} href="/tasks" hrefLabel="All tasks" />
      <ul className="px-3 pb-3 sm:px-4">
        {tasks.map((t) => {
          const isDone = !!done[t.id];
          return (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                <input type="checkbox" className="peer sr-only" checked={isDone} onChange={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))} />
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${isDone ? "border-success bg-success text-white" : "border-line-strong bg-surface"}`}>
                  {isDone && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14px] ${isDone ? "text-faint line-through" : "font-medium text-ink"}`}>{t.title}</span>
                  {t.service && (
                    <span className="mt-1 block sm:hidden">
                      <ServiceTag service={t.service} short />
                    </span>
                  )}
                </span>
                {t.service && (
                  <span className="hidden sm:block">
                    <ServiceTag service={t.service} short />
                  </span>
                )}
                <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] font-semibold ${dueStyle[t.urgency]}`}>
                  {t.urgency === "overdue" && <AlertCircle size={12} strokeWidth={2.5} />}
                  {t.due}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
