/**
 * Document reminders for any service: emails the client the names of the
 * documents MKB is still waiting on (never their contents), with a link to the
 * secure portal. Needs Documents "edit" and access to the client. Server-only.
 */
import type { ClientDocument } from "@/lib/types";
import { all, badRequest, HttpError, json, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { sendTemplate } from "./email";
import { clientInboundEmails } from "./email-inbound";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";

export async function remindDocuments(env: AppEnv, a: Actor, clientId: string, b: { docIds?: unknown }) {
  requirePermission(a, "documents", "edit");
  requireStaff(a);
  const c = await one<ClientRow & { module_data: string | null }>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
  if (!c || !(await canOpen(env, a, c))) throw notFound("Client not found.");
  const ids = new Set((Array.isArray(b.docIds) ? b.docIds : []).map(String).slice(0, 60));
  const docs = (json<{ documents?: ClientDocument[] }>(c.module_data, {}).documents ?? []).filter((d) => ids.has(d.id) && (d.status === "requested" || d.status === "rejected") && !d.internal);
  if (!docs.length) throw badRequest("Those documents aren't outstanding anymore.");
  if (!c.email) throw badRequest("This client has no email address on file.");
  if (!(await rateLimit(env.DB, `docremind:${clientId}`, 6, 60))) throw new HttpError(429, "Too many reminders for this client in the last hour.", "rate_limited");
  const names = [...new Set(docs.map((d) => d.name))];
  const first = (c.contact_name || c.name).trim().split(/\s+/)[0];
  const out = await sendTemplate(env, "document_reminder", { to: c.email, vars: { firstName: first, count: `${names.length} document${names.length > 1 ? "s" : ""}` }, documents: names });
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'staff', ?, ?)", randomId("x"), clientId, `Emailed a reminder for ${names.length} document${names.length > 1 ? "s" : ""}: ${names.slice(0, 5).join(", ")}${names.length > 5 ? "…" : ""}`, a.member.id, now());
  await audit(env.DB, a, { action: "Record update", resource: `Client ${clientId}`, meta: `Document reminder emailed (${names.length})${out.sent ? "" : " — queued"}` });
  return { count: names.length, sent: out.sent };
}

/**
 * Emails the CRM sent this client (subject and date — production keeps no
 * bodies, since they can hold one-time links). For the combined Messages inbox.
 */
export async function clientEmails(env: AppEnv, a: Actor, clientId: string) {
  requirePermission(a, "communication", "view");
  requireStaff(a);
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
  if (!c || !(await canOpen(env, a, c))) throw notFound("Client not found.");
  if (!c.email) return { emails: [] };
  const rows = await all<{ id: string; template: string; subject: string; created_at: string; sent_at: string | null; error: string | null }>(env.DB, "SELECT id, template, subject, created_at, sent_at, error FROM email_outbox WHERE lower(to_email) = lower(?) ORDER BY created_at DESC LIMIT 200", c.email);
  const received = await clientInboundEmails(env, a, clientId).catch(() => []);
  return { emails: rows.map((r) => ({ id: r.id, template: r.template, subject: r.subject, at: r.created_at, status: r.error ? "failed" : r.sent_at ? "sent" : "queued" })), received };
}
