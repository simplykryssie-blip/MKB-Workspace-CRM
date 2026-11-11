/**
 * Bookkeeping emails to the client: items needed for a month, reminders, and
 * "your reports are ready". The email lists titles only; everything else is in
 * the client portal. Server-only.
 */
import { periodLabel } from "@/lib/books/config";
import { badRequest, forbidden, HttpError, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { requirePermission, type Actor } from "./identity";
import { portalUrl, sendTemplate } from "./email";

const KINDS = { items: "books_items", reminder: "books_reminder", reports: "books_reports_ready" } as const;

export async function notifyBooks(env: AppEnv, a: Actor, wsId: string, b: { kind?: unknown; period?: unknown; items?: unknown }) {
  requirePermission(a, "books", "edit");
  if (a.kind !== "staff") throw forbidden();
  const kind = b.kind as keyof typeof KINDS;
  if (!(kind in KINDS)) throw badRequest("Unknown email.");
  const period = typeof b.period === "string" && /^\d{4}-\d{2}$/.test(b.period) ? b.period : "";
  if (!period) throw badRequest("Missing month.");
  const items = (Array.isArray(b.items) ? b.items : []).filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 200)).slice(0, 30);
  if (!items.length) return { emailed: false, reason: "nothing" as const };
  const w = await one<{ client_id: string; business_name: string }>(env.DB, "SELECT client_id, business_name FROM books_workspaces WHERE id = ?", wsId);
  if (!w) throw notFound("Workspace not found.");
  const c = await one<{ id: string; name: string; contact_name: string | null; email: string; portal: string; status: string }>(env.DB, "SELECT id, name, contact_name, email, portal, status FROM clients WHERE id = ?", w.client_id);
  if (!c?.email) return { emailed: false, reason: "no_email" as const };
  // The email points to the portal: only clients who have (or were invited to) a portal account.
  if (c.portal !== "active" && c.portal !== "invited") return { emailed: false, reason: "no_portal" as const };
  if (!(await rateLimit(env.DB, `booksmail:${wsId}:${kind}:${period}`, kind === "reports" ? 3 : 4, 30))) throw new HttpError(429, "That email was just sent — wait a little before sending it again.", "rate_limited");
  const label = periodLabel(period);
  const first = (c.contact_name || c.name).trim().split(/\s+/)[0];
  const out = await sendTemplate(env, KINDS[kind], { to: c.email, vars: { firstName: first, business: w.business_name, period: label }, documents: items, buttonUrl: `${portalUrl(env)}${kind === "reports" ? "#documents" : ""}` });
  const what = kind === "reports" ? `${label} reports ready` : kind === "reminder" ? `reminder for ${label} items` : `${items.length} item${items.length === 1 ? "" : "s"} needed for ${label}`;
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'staff', ?, ?)", randomId("x"), c.id, `Bookkeeping email to ${c.email}: ${what}${out.sent ? "" : " (queued)"}`, a.member.id, now());
  return { emailed: out.sent, reason: out.sent ? undefined : ("queued" as const) };
}
