/**
 * Intakes for leads (before they're clients). Sending a lead an intake creates a
 * hidden "prospect" record for them — never listed in Clients — so the intake,
 * private link, encrypted numbers, signed PDF, document requests and proposal
 * work exactly as for clients. "Accept as client" turns the prospect into a
 * client (everything is already on the record) and marks the lead converted;
 * "Decline" closes the links and marks the lead lost. Server-only.
 */
import { badRequest, HttpError, json, notFound, now, one, all, run, type AppEnv } from "./core";
import { randomId, randomToken } from "./crypto";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";
import { cancelLinks } from "./secure-links";
import { createIntake, intakesForClient, sendIntakeLink } from "./books-intake";
import { markConverted } from "./leads";
import { proposalTotals, type Proposal } from "@/lib/books/proposal";

/** Client statuses that are not (yet) clients — hidden from every client list. */
export const HIDDEN_CLIENT_STATUSES = ["prospect", "declined"] as const;
export const NOT_HIDDEN = "c.status NOT IN ('prospect', 'declined')";

type LeadRow = { id: string; type: "individual" | "business"; name: string; contact_name: string | null; email: string; phone: string; address: string | null; business: string | null; source: string; owner_id: string; status: "open" | "converted" | "lost"; converted_client_id: string | null };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function lead(env: AppEnv, id: string) {
  const l = await one<LeadRow>(env.DB, "SELECT id, type, name, contact_name, email, phone, address, business, source, owner_id, status, converted_client_id FROM leads WHERE id = ?", id);
  if (!l) throw notFound("Lead not found.");
  return l;
}
const prospectOf = (env: AppEnv, leadId: string) => one<{ id: string; status: string }>(env.DB, "SELECT id, status FROM clients WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1", leadId);
const leadLog = (env: AppEnv, leadId: string, text: string, memberId: string | null, t = now()) =>
  env.DB.batch([
    env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, 'lead', ?, ?, ?, ?)").bind(randomId("x"), leadId, text, memberId ? "staff" : "client", memberId, t),
    env.DB.prepare("UPDATE leads SET last_activity_at = ?, rev = rev + 1 WHERE id = ?").bind(t, leadId),
  ]);

/** The lead's prospect record and intakes (for the lead page). */
export async function leadIntakes(env: AppEnv, a: Actor, leadId: string) {
  requirePermission(a, "leads", "view");
  requireStaff(a);
  const l = await lead(env, leadId);
  const p = await prospectOf(env, leadId);
  if (!p) return { prospect: null, intakes: [] };
  return { prospect: { clientId: p.id, status: p.status, leadStatus: l.status }, intakes: await intakesForClient(env, a, p.id).catch(() => []) };
}

/** { kind: "books", email } — sends the lead an intake by private link (creating their prospect record if needed). */
export async function sendLeadIntake(env: AppEnv, a: Actor, leadId: string, b: { kind?: unknown; email?: unknown }) {
  requirePermission(a, "leads", "edit");
  requirePermission(a, "books", "edit");
  requireStaff(a);
  if (b.kind !== "books") throw badRequest("Choose which intake to send.");
  const l = await lead(env, leadId);
  if (l.status !== "open") throw badRequest(l.status === "converted" ? "This lead is already a client — send the intake from their client profile." : "Reopen this lead first.");
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().toLowerCase().slice(0, 200) : l.email.toLowerCase();
  if (!EMAIL_RE.test(email)) throw badRequest("Enter the lead's email address.");
  let p = await prospectOf(env, leadId);
  const t = now();
  if (!p) {
    const existing = await one<{ name: string }>(env.DB, `SELECT c.name FROM clients c WHERE c.email = ? AND ${NOT_HIDDEN} LIMIT 1`, email);
    if (existing) throw new HttpError(409, `${existing.name} is already a client with this email — send the intake from their client profile, or merge the lead into that client.`, "duplicate");
    const id = `c-${randomToken(9).replace(/[^A-Za-z0-9]/g, "x")}`;
    const address = json<Record<string, string>>(l.address, {});
    await env.DB.batch([
      env.DB.prepare("INSERT INTO clients (id, type, name, contact_name, email, phone, preferred_contact, address, business, status, portal, tags, source, lead_id, since, last_activity_at, created_at, updated_at, module_data) VALUES (?, ?, ?, ?, ?, ?, 'Email', ?, ?, 'prospect', 'not_invited', '[]', ?, ?, ?, ?, ?, ?, '{}')")
        .bind(id, l.type, l.name, l.contact_name, email, l.phone, JSON.stringify({ line1: address.line1 ?? "", line2: address.line2 ?? "", city: address.city ?? "", state: address.state ?? "", zip: address.zip ?? "" }), l.business, l.source, l.id, t.slice(0, 10), t, t, t),
      env.DB.prepare("INSERT OR IGNORE INTO client_services (client_id, service) VALUES (?, 'books')").bind(id),
      env.DB.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) VALUES (?, ?, 'client_team', '')").bind(id, l.owner_id),
      env.DB.prepare("INSERT OR IGNORE INTO record_assignments (client_id, member_id, source, record_id) VALUES (?, ?, 'client_team', '')").bind(id, a.member.id),
      env.DB.prepare("INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', ?, 'staff', ?, ?)").bind(randomId("x"), id, `Prospect record created from lead ${l.name} to send intake forms (not a client yet)`, a.member.id, t),
    ]);
    await audit(env.DB, a, { action: "Record update", resource: `Lead ${leadId}`, meta: `Prospect ${id} created for intake forms` });
    p = { id, status: "prospect" };
  } else if (p.status !== "prospect") {
    if (p.status !== "declined") throw badRequest("This lead is already a client.");
    await run(env.DB, "UPDATE clients SET status = 'prospect', updated_at = ? WHERE id = ?", t, p.id);
  }
  const { intake } = await createIntake(env, a, { clientId: p.id });
  if (intake.status !== "in_progress") throw badRequest("This lead already submitted their intake.");
  const sent = await sendIntakeLink(env, a, intake.id, { email });
  await leadLog(env, leadId, `Bookkeeping intake emailed to ${email} (private link)${sent.emailed ? "" : " — email queued"}`, a.member.id);
  return { intakeId: intake.id, link: sent.link, url: sent.url, emailed: sent.emailed };
}

/** Accept as client: the prospect becomes a client (answers, signed PDF, documents, EIN stay on the record). */
export async function acceptLead(env: AppEnv, a: Actor, leadId: string) {
  requirePermission(a, "leads", "edit");
  requirePermission(a, "crm", "create");
  requireStaff(a);
  const l = await lead(env, leadId);
  if (l.status !== "open") throw badRequest("This lead is already closed.");
  const p = await prospectOf(env, leadId);
  if (!p || p.status !== "prospect") throw badRequest("Send this lead an intake first, or use Convert to client.");
  const t = now();
  const intakes = await all<{ id: string; status: string; proposal: string | null }>(env.DB, "SELECT id, status, proposal FROM books_intakes WHERE client_id = ?", p.id);
  const stmts: D1PreparedStatement[] = [env.DB.prepare("UPDATE clients SET status = 'onboarding', since = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND status = 'prospect'").bind(t.slice(0, 10), t, p.id)];
  if (intakes.length && !(await one(env.DB, "SELECT 1 FROM client_enrollments WHERE client_id = ? AND service = 'books'", p.id))) {
    const signed = intakes.map((i) => json<Proposal | null>(i.proposal, null)).find((x) => x?.status === "signed");
    stmts.push(env.DB.prepare("INSERT INTO client_enrollments (id, client_id, service, title, stage, progress, status, staff_id, started_at, due_at, fee) VALUES (?, ?, 'books', 'Monthly bookkeeping', 'Waiting on Client Items', 0, 'active', ?, ?, NULL, ?)").bind(`e-${randomToken(6).replace(/[^A-Za-z0-9]/g, "x")}`, p.id, l.owner_id, t, signed ? proposalTotals(signed).monthly : 0));
  }
  // The lead's notes carry over, as with a normal conversion.
  stmts.push(env.DB.prepare("INSERT INTO client_notes (id, client_id, author_id, body, service, pinned, at) SELECT 'n_' || id, ?, author_id, body, NULL, pinned, at FROM lead_notes WHERE lead_id = ? AND deleted_at IS NULL").bind(p.id, leadId));
  stmts.push(env.DB.prepare("INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', 'Accepted as a client (from lead, after intake)', 'staff', ?, ?)").bind(randomId("x"), p.id, a.member.id, t));
  await env.DB.batch(stmts);
  await markConverted(env, a, leadId, p.id, false);
  await audit(env.DB, a, { action: "Record update", resource: `Lead ${leadId}`, meta: `Accepted as client ${p.id}` });
  return { clientId: p.id };
}

/** { reason } — declines the lead: intake/proposal links stop, the lead is marked lost. Nothing appears in Clients. */
export async function declineLead(env: AppEnv, a: Actor, leadId: string, b: { reason?: unknown }) {
  requirePermission(a, "leads", "edit");
  requireStaff(a);
  const l = await lead(env, leadId);
  if (l.status !== "open") throw badRequest("This lead is already closed.");
  const reason = (typeof b.reason === "string" && b.reason.trim().slice(0, 200)) || "Declined after intake";
  const p = await prospectOf(env, leadId);
  const t = now();
  if (p?.status === "prospect") {
    for (const i of await all<{ id: string }>(env.DB, "SELECT id FROM books_intakes WHERE client_id = ?", p.id)) {
      await cancelLinks(env, "books_intake", i.id, a.member.id);
      await cancelLinks(env, "books_proposal", i.id, a.member.id);
    }
    await run(env.DB, "UPDATE clients SET status = 'declined', updated_at = ? WHERE id = ?", t, p.id);
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE leads SET status = 'lost', lost_reason = ?, last_activity_at = ?, rev = rev + 1 WHERE id = ?").bind(reason, t, leadId),
    env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, 'lead', ?, 'staff', ?, ?)").bind(randomId("x"), leadId, `Declined after intake: ${reason}`, a.member.id, t),
  ]);
  await audit(env.DB, a, { action: "Record update", resource: `Lead ${leadId}`, meta: `Declined: ${reason}` });
  return { declined: true };
}
