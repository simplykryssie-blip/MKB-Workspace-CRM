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
import { BUSINESS_FORMS, INDIVIDUAL_FORMS, baseChecklist, defaultPricing, dueDates, type TaxForm, type TaxReturn } from "@/lib/tax/config";
import { STAGES } from "@/lib/sample/clients";
import { createReturn, toReturn, type TaxRow } from "./tax";
import { latestLink } from "./secure-links";
import { sendTaxInterviewLink } from "./tax-link";
import { ensure8821 } from "./f8821";
import { buildIntakePdf } from "./intake-pdf";
import type { Answers } from "@/lib/tax/interview/engine";

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
  if (!p) return { prospect: null, intakes: [], taxReturns: [] };
  const rows = await all<TaxRow>(env.DB, "SELECT * FROM tax_returns WHERE client_id = ? ORDER BY tax_year DESC", p.id);
  const files = await all<{ id: string; name: string }>(env.DB, "SELECT id, name FROM client_files WHERE client_id = ? AND name LIKE 'MKB-Tax-Interview-%' ORDER BY created_at DESC", p.id);
  const taxReturns = [];
  for (const row of rows) {
    const r = toReturn(row);
    taxReturns.push({ id: r.id, taxYear: r.taxYear, form: r.form, status: r.organizer.status, submittedAt: r.organizer.submittedAt, updatedAt: r.organizer.interview?.updatedAt, link: await latestLink(env, "tax_interview", r.id), pdfFileId: files.find((f) => f.name.includes(`-${r.taxYear}-`))?.id });
  }
  return { prospect: { clientId: p.id, status: p.status, leadStatus: l.status }, intakes: await intakesForClient(env, a, p.id).catch(() => []), taxReturns };
}

/** { kind: "books", email } — sends the lead an intake by private link (creating their prospect record if needed). */
export async function sendLeadIntake(env: AppEnv, a: Actor, leadId: string, b: { kind?: unknown; email?: unknown; taxYear?: unknown; form?: unknown }) {
  requirePermission(a, "leads", "edit");
  requireStaff(a);
  if (b.kind !== "books" && b.kind !== "tax") throw badRequest("Choose which intake to send.");
  const service = b.kind;
  requirePermission(a, service, "edit");
  if (service === "tax") requirePermission(a, "tax", "create");
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
      env.DB.prepare("INSERT OR IGNORE INTO client_services (client_id, service) VALUES (?, ?)").bind(id, service),
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
  await run(env.DB, "INSERT OR IGNORE INTO client_services (client_id, service) VALUES (?, ?)", p.id, service);
  if (service === "tax") {
    const ret = await prospectReturn(env, a, p.id, l, b);
    const sent = await sendTaxInterviewLink(env, a, ret.id, { email });
    await leadLog(env, leadId, `${ret.taxYear} tax interview emailed to ${email} (private link)${sent.emailed ? "" : " — email queued"}`, a.member.id);
    return { returnId: ret.id, link: sent.link, url: sent.url, emailed: sent.emailed };
  }
  const { intake } = await createIntake(env, a, { clientId: p.id });
  if (intake.status !== "in_progress") throw badRequest("This lead already submitted their intake.");
  const sent = await sendIntakeLink(env, a, intake.id, { email });
  await leadLog(env, leadId, `Bookkeeping intake emailed to ${email} (private link)${sent.emailed ? "" : " — email queued"}`, a.member.id);
  return { intakeId: intake.id, link: sent.link, url: sent.url, emailed: sent.emailed };
}

const SCH_C = "1040 + Sch C";
/**
 * Schedule C for a business lead: the prospect record becomes the owner (an individual
 * client), keeping the business — its name, type and industry — on the record.
 */
async function ownerProspect(env: AppEnv, clientId: string, l: LeadRow) {
  const c = await one<{ type: string; business: string | null }>(env.DB, "SELECT type, business FROM clients WHERE id = ?", clientId);
  if (!c || c.type === "individual") return;
  if (await one(env.DB, "SELECT 1 FROM tax_returns WHERE client_id = ? AND kind = 'business'", clientId)) throw badRequest("This lead already has a business return. Schedule C goes on the owner's personal return — add the owner as a separate individual lead.");
  const biz = json<Record<string, unknown>>(c.business ?? l.business, {});
  const owner = (l.contact_name ?? "").trim() || l.name;
  await run(env.DB, "UPDATE clients SET type = 'individual', name = ?, contact_name = NULL, business = ?, rev = rev + 1, updated_at = ? WHERE id = ?", owner, JSON.stringify({ ...biz, legalName: (biz.legalName as string) || l.name, entityType: biz.entityType === "LLC" || !biz.entityType ? "Sole Prop" : biz.entityType }), now(), clientId);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', ?, 'system', NULL, ?)", randomId("x"), clientId, `Set up as the owner (${owner}) — ${l.name} is reported on Schedule C of their personal return`, now());
}

/** The lead's return for that tax year (created the first time; priced from the fee schedule like any new return). */
async function prospectReturn(env: AppEnv, a: Extract<Actor, { kind: "staff" }>, clientId: string, l: LeadRow, b: { taxYear?: unknown; form?: unknown }) {
  const year = Number(b.taxYear);
  if (!Number.isInteger(year) || year < 2015 || year > new Date().getFullYear()) throw badRequest("Choose the tax year.");
  // A business lead that's a sole proprietor / single-member LLC files Schedule C on the owner's 1040.
  const forms = (l.type === "business" ? [...BUSINESS_FORMS, SCH_C] : INDIVIDUAL_FORMS) as readonly string[];
  const form = (typeof b.form === "string" && forms.includes(b.form) ? b.form : forms[0]) as TaxForm;
  if (form === "990") throw badRequest("The nonprofit (990) interview isn't built yet.");
  const kind: TaxReturn["kind"] = (INDIVIDUAL_FORMS as readonly string[]).includes(form) ? "individual" : "business";
  const existing = await one<TaxRow>(env.DB, "SELECT * FROM tax_returns WHERE client_id = ? AND tax_year = ? LIMIT 1", clientId, year);
  if (existing) {
    const r = toReturn(existing);
    if (r.organizer.status === "submitted" || r.organizer.status === "reviewed") throw badRequest(`This lead already submitted their ${year} tax interview.`);
    if (r.form === form) return r;
    // Wrong return type sent: replace it, unless they've already started answering.
    if (r.organizer.interview?.updatedAt || Object.keys(r.organizer.answers ?? {}).length) throw badRequest(`They already started the ${year} ${r.form} interview — cancel it with them before switching to ${form}.`);
    await cancelLinks(env, "tax_interview", r.id, a.member.id);
    await run(env.DB, "DELETE FROM tax_returns WHERE id = ?", r.id);
    await leadLog(env, l.id, `${year} ${r.form} interview replaced with ${form} (not started)`, a.member.id);
  }
  if (kind === "individual" && l.type === "business") await ownerProspect(env, clientId, l);
  const fees = await all<{ code: string; label: string; price: number }>(env.DB, "SELECT code, label, price FROM tax_fee_schedule");
  const lines = defaultPricing(form).flatMap((p) => { const f = fees.find((x) => x.code === p.code); return f ? [{ id: randomId("p"), code: p.code, description: f.label, qty: p.qty, unit: f.price }] : []; });
  const t = now();
  const r: TaxReturn = {
    id: `TR-${clientId}-${year}`, clientId, taxYear: year, kind, form, states: [], status: "Intake",
    preparerId: a.member.id, reviewerId: a.member.id, dueAt: dueDates(form, year).due,
    organizer: { status: "not_sent", answers: {} },
    checklist: baseChecklist(kind, { hasEin: false, form }).map((d) => ({ id: randomId("ci"), ...d, required: true, source: "standard" as const })),
    efile: [], pricing: { lines, discount: 0 }, statusHistory: [{ status: "Intake", at: t, by: a.member.id }], notes: [],
    activity: [{ id: randomId("x"), kind: "intake", text: `Return created for lead ${l.name} — TY ${year} ${form} (not a client yet)`, at: t, actor: "staff" }], createdAt: t,
  };
  return createReturn(env, a, r);
}

/** The lead's tax interview as a PDF: the signed copy once submitted, otherwise the answers saved so far. */
export async function leadTaxAnswersPdf(env: AppEnv, a: Actor, leadId: string, returnId: string) {
  requirePermission(a, "leads", "view");
  requirePermission(a, "tax", "view");
  requireStaff(a);
  const p = await prospectOf(env, leadId);
  const row = p ? await one<TaxRow>(env.DB, "SELECT * FROM tax_returns WHERE id = ? AND client_id = ?", returnId, p.id) : null;
  if (!p || !row) throw notFound("Interview not found.");
  const r = toReturn(row);
  const c = await one<{ name: string }>(env.DB, "SELECT name FROM clients WHERE id = ?", p.id);
  const answers = (r.organizer.interview?.answers ?? {}) as Answers;
  const bytes = await buildIntakePdf({ clientName: c?.name ?? "", taxYear: r.taxYear, form: r.form, returnId: r.id, answers, submittedAt: r.organizer.interview?.updatedAt ?? now(), enteredBy: "client", documents: [], draft: true });
  await audit(env.DB, a, { action: "Client record access", resource: `Tax return ${r.id}`, department: "tax", meta: `Viewed the lead's interview answers so far (PDF)` });
  return new Response(bytes as unknown as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="MKB-Tax-Interview-${r.taxYear}-in-progress.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
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
  // Each tax return gets its Tax Preparation engagement on the client profile.
  const returns = (await all<TaxRow>(env.DB, "SELECT * FROM tax_returns WHERE client_id = ? AND enrollment_id IS NULL", p.id)).map(toReturn);
  for (const r of returns) {
    const eid = `e-${randomToken(6).replace(/[^A-Za-z0-9]/g, "x")}`;
    const stage = (STAGES.tax as readonly string[]).includes(r.status) ? r.status : "Intake";
    const waiting = r.status === "Awaiting Documents" || r.status === "Awaiting Client Approval";
    stmts.push(env.DB.prepare("INSERT INTO client_enrollments (id, client_id, service, title, stage, progress, status, staff_id, started_at, due_at, fee) VALUES (?, ?, 'tax', ?, ?, ?, ?, ?, ?, ?, ?)").bind(eid, p.id, `${r.taxYear} ${r.kind === "business" ? "Business" : "Individual"} return (${r.form})`, stage, Math.round((STAGES.tax.indexOf(stage) / (STAGES.tax.length - 1)) * 100), waiting ? "waiting_on_client" : "active", r.preparerId, t, r.dueAt ?? null, r.pricing.lines.reduce((x, li) => x + li.qty * li.unit, 0) - (r.pricing.discount ?? 0)));
    stmts.push(env.DB.prepare("UPDATE tax_returns SET enrollment_id = ?, rev = rev + 1 WHERE id = ?").bind(eid, r.id));
  }
  // The lead's notes carry over, as with a normal conversion.
  stmts.push(env.DB.prepare("INSERT INTO client_notes (id, client_id, author_id, body, service, pinned, at) SELECT 'n_' || id, ?, author_id, body, NULL, pinned, at FROM lead_notes WHERE lead_id = ? AND deleted_at IS NULL").bind(p.id, leadId));
  stmts.push(env.DB.prepare("INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', 'Accepted as a client (from lead, after intake)', 'staff', ?, ?)").bind(randomId("x"), p.id, a.member.id, t));
  await env.DB.batch(stmts);
  await markConverted(env, a, leadId, p.id, false);
  if (returns.length) await ensure8821(env, a, p.id);
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
    for (const r of await all<{ id: string }>(env.DB, "SELECT id FROM tax_returns WHERE client_id = ?", p.id)) await cancelLinks(env, "tax_interview", r.id, a.member.id);
    await run(env.DB, "UPDATE clients SET status = 'declined', updated_at = ? WHERE id = ?", t, p.id);
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE leads SET status = 'lost', lost_reason = ?, last_activity_at = ?, rev = rev + 1 WHERE id = ?").bind(reason, t, leadId),
    env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, 'lead', ?, 'staff', ?, ?)").bind(randomId("x"), leadId, `Declined after intake: ${reason}`, a.member.id, t),
  ]);
  await audit(env.DB, a, { action: "Record update", resource: `Lead ${leadId}`, meta: `Declined: ${reason}` });
  return { declined: true };
}
