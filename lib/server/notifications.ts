/**
 * Staff bell notifications. Recipients are chosen on the server from each
 * person's permissions; a notification is only a pointer (title + link) —
 * opening the link still goes through the normal permission checks.
 * Server-only.
 */
import { canDo, roleOf } from "@/lib/team/policy";
import type { ModuleKey } from "@/lib/team/config";
import { all, badRequest, now, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { loadMembers, loadPolicy, requireStaff, type Actor } from "./identity";

export type NotificationKind = "lead" | "form" | "intake" | "followup" | "documents" | "signoff" | "approval";
export type Notice = { id: string; kind: NotificationKind; title: string; body: string; href: string; createdAt: string; readAt?: string };

type Target = { module: ModuleKey; ownersOnly?: boolean; memberIds?: string[]; exceptId?: string };

/** Sends a notification to everyone who should see it. Never throws — a failed bell must not undo the real work. */
export async function notify(env: AppEnv, to: Target, n: { kind: NotificationKind; title: string; body?: string; href?: string }) {
  try {
    const [members, policy] = await Promise.all([loadMembers(env.DB), loadPolicy(env.DB)]);
    const ids = members
      .filter((m) => m.status === "active" && m.id !== to.exceptId)
      .filter((m) => (to.memberIds ? to.memberIds.includes(m.id) : true))
      .filter((m) => (to.ownersOnly ? !!roleOf(policy.roles, m)?.isOwner : canDo(policy, m, to.module, "view")))
      .map((m) => m.id);
    if (!ids.length) return;
    const t = now();
    await env.DB.batch(ids.map((mid) => env.DB.prepare("INSERT INTO notifications (id, member_id, kind, title, body, href, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(randomId("ntf"), mid, n.kind, n.title.slice(0, 200), (n.body ?? "").slice(0, 400), n.href ?? "", t)));
  } catch (e) {
    console.error("notify failed", e instanceof Error ? e.message : e);
  }
}

type Row = { id: string; kind: NotificationKind; title: string; body: string; href: string; created_at: string; read_at: string | null };
export async function listNotifications(env: AppEnv, a: Actor) {
  requireStaff(a);
  const rows = await all<Row>(env.DB, "SELECT id, kind, title, body, href, created_at, read_at FROM notifications WHERE member_id = ? ORDER BY created_at DESC LIMIT 40", a.member.id);
  const unread = (await all<{ n: number }>(env.DB, "SELECT count(*) AS n FROM notifications WHERE member_id = ? AND read_at IS NULL", a.member.id))[0]?.n ?? 0;
  return { unread, items: rows.map((r): Notice => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, createdAt: r.created_at, readAt: r.read_at ?? undefined })) };
}

export async function markRead(env: AppEnv, a: Actor, b: { ids?: unknown; all?: unknown }) {
  requireStaff(a);
  const t = now();
  if (b.all === true) await run(env.DB, "UPDATE notifications SET read_at = ? WHERE member_id = ? AND read_at IS NULL", t, a.member.id);
  else {
    const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 100) : [];
    if (!ids.length) throw badRequest("Nothing to mark.");
    await env.DB.batch(ids.map((id) => env.DB.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND member_id = ? AND read_at IS NULL").bind(t, id, a.member.id)));
  }
  return listNotifications(env, a);
}
