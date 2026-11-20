/**
 * Live CRM: service deadlines become tasks on the assigned staff member's calendar
 * (they show in Calendar and in Today on the dashboard). Best effort — a failure is
 * reported but never blocks the work itself. Client-side helper.
 */
import { BACKEND, call, notify } from "@/lib/sync/remote";
import type { ServiceKey } from "@/lib/types";

export type DeadlineTask = { title: string; dueAt: string; service: ServiceKey; clientId?: string; assigneeId?: string; notes?: string; priority?: "normal" | "high" };

/** Creates the task (replacing `replaceId` if given). Returns its id, or undefined. */
export async function putDeadline(t: DeadlineTask, replaceId?: string): Promise<string | undefined> {
  if (!BACKEND || !t.dueAt) return undefined;
  try {
    if (replaceId) await call("DELETE", `/api/calendar/tasks/${encodeURIComponent(replaceId)}`).catch(() => {});
    const due = /^\d{4}-\d{2}-\d{2}$/.test(t.dueAt) ? t.dueAt : t.dueAt.slice(0, 10);
    const r = await call<{ task: { id: string } }>("POST", "/api/calendar/tasks", {
      title: t.title.slice(0, 200), dueAt: due, priority: t.priority ?? "normal", service: t.service, assigneeId: t.assigneeId || undefined,
      contact: t.clientId ? { type: "client", id: t.clientId } : undefined, notes: (t.notes ?? "").slice(0, 4000),
    });
    return r.task.id;
  } catch (e) {
    notify(`Saved, but the deadline couldn't be added to the calendar — ${e instanceof Error ? e.message : "add it there by hand"}.`);
    return undefined;
  }
}

/** Ticks the calendar task off (or back on). */
export function markDeadline(id: string | undefined, done: boolean) {
  if (!BACKEND || !id) return;
  void call("POST", `/api/calendar/tasks/${encodeURIComponent(id)}/done`, { done }).catch(() => {});
}
