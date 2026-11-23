/**
 * Private-link intakes for payroll, Business Solutions and MKB Expungement Relief.
 * Same flow as the bookkeeping intake: staff (or a website "Get Started" form)
 * send the client a private link; the client answers, signs and submits; MKB
 * gets the signed PDF in Documents, the documents to upload are requested in
 * the portal, the profile is updated and the team is notified. Server-only.
 */
import { askTextOptIn } from "./sms";
import { SERVICE_INTAKES, isServiceIntakeKind, type ServiceIntakeKind } from "@/lib/intakes/service";
import { canDo } from "@/lib/team/policy";
import { docsFor, type Answers } from "@/lib/tax/interview/engine";
import { all, badRequest, HttpError, json, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { decryptField, encryptField, randomId } from "./crypto";
import { CLIENT_SQL, aad as vaultAad, canOpen, vaultKey, type ClientRow } from "./clients";
import { applyBooksIntakeToProfile } from "./books-profile";
import { linkOrigin } from "./books-intake";
import { nextStop, sendTemplate } from "./email";
import { audit, hasSensitivePerm, requirePermission, requireStaff, type Actor, type LinkActor } from "./identity";
import { buildIntakePdf } from "./intake-pdf";
import { notify } from "./notifications";
import { cancelLinks, createLink, latestLink, LINK_DAYS, openLink, useLink } from "./secure-links";
import { sha256Bytes, signatureFrom } from "./signature";
import { storeClientPdfAs } from "./tax";

type Row = { id: string; client_id: string; kind: ServiceIntakeKind; status: "in_progress" | "submitted"; answers: string; step: number; entered_by: string; consent_name: string | null; submitted_at: string | null; pdf_file_id: string | null; history: string; created_at: string; created_by: string | null; updated_at: string; rev: number };
const MAX = 200_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
const hist = (h: string, by: string, text: string) => JSON.stringify([...json<{ at: string; by: string; text: string }[]>(h, []), { at: now(), by, text }].slice(-60));
const cleanAnswers = (v: unknown): Answers => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw badRequest("Invalid answers.");
  if (JSON.stringify(v).length > MAX) throw new HttpError(413, "These answers are too large to save.");
  const out = { ...(v as Answers) };
  // The SSN is saved encrypted on its own; answers may only ever hold the masked last four.
  if (typeof out.ssn === "string" && !/^•••-••-\d{4}$/.test(out.ssn)) delete out.ssn;
  return out;
};
const firstNameOf = (c: { contact_name: string | null; name: string; type?: string }, a: Answers) =>
  ((typeof a.fullName === "string" && a.fullName) || (typeof a.contactName === "string" && a.contactName) || c.contact_name || c.name).trim().split(/\s+/)[0];

async function clientRow(env: AppEnv, id: string) {
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, id);
  if (!c) throw notFound("Client not found.");
  return c;
}
async function staffRow(env: AppEnv, a: Actor, id: string) {
  const r = await one<Row>(env.DB, "SELECT * FROM service_intakes WHERE id = ?", id);
  if (!r) throw notFound("Intake not found.");
  requirePermission(a, SERVICE_INTAKES[r.kind].module, "view");
  const c = await clientRow(env, r.client_id);
  if (!(await canOpen(env, a, c))) throw notFound("Intake not found.");
  return { r, c };
}

/** A submitted intake's answers, for starting the staff work record from it. */
export async function getServiceIntake(env: AppEnv, a: Actor, id: string) {
  requireStaff(a);
  const { r } = await staffRow(env, a, id);
  if (r.status !== "submitted") throw badRequest("This intake hasn't been submitted yet.");
  return { intake: { id: r.id, kind: r.kind, clientId: r.client_id, answers: json<Answers>(r.answers, {}), submittedAt: r.submitted_at ?? undefined } };
}

/** The client's service intakes (newest first) with each one's link status — for the client and lead pages. */
export async function intakesForClientAll(env: AppEnv, clientId: string) {
  const rows = await all<Row>(env.DB, "SELECT * FROM service_intakes WHERE client_id = ? ORDER BY created_at DESC", clientId);
  return Promise.all(rows.map(async (r) => ({ id: r.id, kind: r.kind, label: SERVICE_INTAKES[r.kind].label, status: r.status, submittedAt: r.submitted_at ?? undefined, createdAt: r.created_at, pdfFileId: r.pdf_file_id ?? undefined, link: await latestLink(env, "service_intake", r.id) })));
}
export async function listServiceIntakes(env: AppEnv, a: Actor, clientId: string) {
  requirePermission(a, "crm", "view");
  requireStaff(a);
  const c = await clientRow(env, clientId);
  if (!(await canOpen(env, a, c))) throw notFound("Client not found.");
  return { intakes: await intakesForClientAll(env, clientId) };
}

/**
 * { kind, email } — starts the intake (or reopens the one in progress) and emails
 * the client their private link, replacing any earlier link.
 */
export async function sendServiceIntake(env: AppEnv, a: Actor, clientId: string, b: { kind?: unknown; email?: unknown }) {
  requireStaff(a);
  if (!isServiceIntakeKind(b.kind)) throw badRequest("Choose which intake to send.");
  const kind = b.kind;
  const meta = SERVICE_INTAKES[kind];
  requirePermission(a, meta.module, "edit");
  const c = await clientRow(env, clientId);
  if (!(await canOpen(env, a, c))) throw notFound("Client not found.");
  const email = (typeof b.email === "string" && b.email.trim() ? b.email : c.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) throw badRequest("Enter the client's email address.");
  const t = now();
  let r = await one<Row>(env.DB, "SELECT * FROM service_intakes WHERE client_id = ? AND kind = ? AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1", clientId, kind);
  if (!r) {
    const id = `SI-${randomId("s").slice(2)}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO service_intakes (id, client_id, kind, status, answers, step, history, created_at, created_by, updated_at) VALUES (?, ?, ?, 'in_progress', '{}', 0, ?, ?, ?, ?)").bind(id, clientId, kind, hist("[]", a.member.id, `${meta.label} intake started`), t, a.member.id, t),
      env.DB.prepare("INSERT OR IGNORE INTO client_services (client_id, service) VALUES (?, ?)").bind(clientId, meta.service),
    ]);
    r = (await one<Row>(env.DB, "SELECT * FROM service_intakes WHERE id = ?", id))!;
  }
  if (!(await rateLimit(env.DB, `svclink:${r.id}`, 10, 60))) throw new HttpError(429, "Too many links sent for this intake in the last hour.", "rate_limited");
  const { token, info } = await createLink(env, { purpose: "service_intake", targetId: r.id, clientId, email, memberId: a.member.id });
  const url = `${linkOrigin(env)}/i/s/${token}`;
  const out = await sendTemplate(env, "service_intake_link", { to: email, buttonUrl: url, vars: { firstName: firstNameOf(c, {}), service: meta.label, expires: longDate(info.expiresAt), days: String(LINK_DAYS), staffName: a.member.name } });
  const text = `${meta.label} intake link emailed to ${email} (expires ${longDate(info.expiresAt)})${out.sent ? "" : " — email queued"}`;
  await run(env.DB, "UPDATE service_intakes SET history = ?, updated_at = ? WHERE id = ?", hist(r.history, a.member.id, text), t, r.id);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', ?, 'staff', ?, ?)", randomId("x"), clientId, text, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `${meta.label} intake ${r.id}`, meta: `Secure link sent to ${email}; expires ${info.expiresAt}` });
  return { intakeId: r.id, link: info, url, emailed: out.sent };
}

/** Cancels the intake's link (it stops working at once). */
export async function cancelServiceIntakeLink(env: AppEnv, a: Actor, id: string) {
  const { r } = await staffRow(env, a, id);
  requirePermission(a, SERVICE_INTAKES[r.kind].module, "edit");
  requireStaff(a);
  const n = await cancelLinks(env, "service_intake", id, a.member.id);
  if (n) {
    await run(env.DB, "UPDATE service_intakes SET history = ?, updated_at = ? WHERE id = ?", hist(r.history, a.member.id, "Secure link cancelled"), now(), id);
    await audit(env.DB, a, { action: "Record update", resource: `${SERVICE_INTAKES[r.kind].label} intake ${id}`, meta: "Secure link cancelled" });
  }
  return { link: await latestLink(env, "service_intake", id), cancelled: n > 0 };
}

/* ---------------------------------------------------------------- the client's side (no sign-in) */
async function fromLink(env: AppEnv, token: string, ip: string, touch = false) {
  const l = await openLink(env, "service_intake", token, ip, { touch });
  const r = await one<Row>(env.DB, "SELECT * FROM service_intakes WHERE id = ?", l.targetId);
  if (!r || r.client_id !== l.clientId) throw new HttpError(404, "This link isn't valid.", "not_found");
  if (r.status !== "in_progress") throw new HttpError(410, "This form has already been submitted — thank you. If you need to change something, please contact MKB Financial Group.", "used");
  const actor: LinkActor = { kind: "link", ip, clientId: l.clientId, linkId: l.id };
  return { l, r, actor };
}

/** Pre-fills from the profile (contact details and business), only the first time. */
function prefillFrom(c: ClientRow): Answers {
  const addr = json<Record<string, string>>(c.address, {});
  const biz = json<Record<string, string>>(c.business, {});
  const out: Record<string, string> = {};
  const set = (k: string, v?: string | null) => { if (v) out[k] = v; };
  set("phone", c.phone); set("email", c.email);
  set("street", addr.line1); set("city", addr.city); set("state", addr.state); set("zip", addr.zip);
  if (c.type === "business") { set("legalName", biz.legalName || c.name); set("formState", biz.state); set("contactName", c.contact_name); }
  else set("fullName", c.name);
  return out;
}

export async function publicServiceIntake(env: AppEnv, token: string, ip: string) {
  const { l, r, actor } = await fromLink(env, token, ip, true);
  const c = await clientRow(env, r.client_id);
  const meta = SERVICE_INTAKES[r.kind];
  if (l.firstOpen) {
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'client', NULL, ?)", randomId("x"), c.id, `Client opened their ${meta.label} intake link`, now());
    await audit(env.DB, actor, { action: "Record update", resource: `${meta.label} intake ${r.id}`, meta: "Secure link opened for the first time" });
  }
  const saved = json<Answers>(r.answers, {});
  const answers = Object.keys(saved).length ? saved : prefillFrom(c);
  return { intake: { kind: r.kind, status: r.status, answers, step: r.step, rev: r.rev, name: c.name, firstName: firstNameOf(c, answers) }, expiresAt: l.expiresAt };
}

export async function publicSaveServiceIntake(env: AppEnv, token: string, ip: string, b: { answers?: unknown; step?: unknown; rev?: unknown }) {
  const { r } = await fromLink(env, token, ip);
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Your intake was updated somewhere else. We loaded the latest version.", "conflict");
  const answers = b.answers !== undefined ? cleanAnswers(b.answers) : json<Answers>(r.answers, {});
  const step = Number.isInteger(b.step) ? Math.max(0, Math.min(40, Number(b.step))) : r.step;
  const res = await run(env.DB, "UPDATE service_intakes SET answers = ?, step = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ? AND status = 'in_progress'", JSON.stringify(answers), step, now(), r.id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Your intake was updated somewhere else. We loaded the latest version.", "conflict");
  return { rev: r.rev + 1 };
}

/** Signs and submits: PDF to Documents, documents requested, profile updated, team notified — then the link stops working. */
export async function publicSubmitServiceIntake(env: AppEnv, token: string, ip: string, b: { answers?: unknown; rev?: unknown; consentName?: unknown; signature?: unknown }) {
  const { l, r, actor } = await fromLink(env, token, ip);
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "Your intake was updated somewhere else. We loaded the latest version.", "conflict");
  const c = await clientRow(env, r.client_id);
  const meta = SERVICE_INTAKES[r.kind];
  const answers = cleanAnswers(b.answers);
  const consent = typeof b.consentName === "string" ? b.consentName.trim().slice(0, 120) : "";
  if (consent.length < 2) throw badRequest("Type your full name to sign and submit.");
  const sigPng = signatureFrom(b.signature);
  const t = now();
  const docSpecs = docsFor(meta.sections, answers).slice(0, 60);
  const docs = docSpecs.map((d) => d.name);
  const res = await run(env.DB, "UPDATE service_intakes SET status = 'submitted', answers = ?, consent_name = ?, entered_by = 'client', submitted_at = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ? AND status = 'in_progress'", JSON.stringify(answers), consent, t, hist(r.history, "client (secure link)", `Submitted and signed by ${consent} online`), t, r.id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "Your intake was updated somewhere else. We loaded the latest version.", "conflict");
  await useLink(env, l.id);
  await env.FILES.put(`clients/${c.id}/signatures/${r.id}-intake.png`, sigPng, { httpMetadata: { contentType: "image/png" }, customMetadata: { intake: r.id, signedBy: consent, signedAt: t, sha256: await sha256Bytes(sigPng) } });

  // Profile: business and contact details (payroll / Business Solutions), contact details (Expungement Relief).
  const owners = Array.isArray(answers.owners) ? answers.owners : answers.contactName ? [{ name: answers.contactName as string, title: (answers.contactTitle as string) ?? "" }] : [];
  const forProfile: Record<string, unknown> = r.kind === "relief"
    ? { street: answers.street, city: answers.city, state: answers.state, zip: answers.zip, phone: answers.phone, email: answers.email, dob: answers.dob, fullName: answers.fullName }
    : { legalName: answers.legalName, entity: answers.entity, formState: answers.formState, street: answers.street, city: answers.city, state: answers.state, zip: answers.zip, phone: answers.phone, email: answers.email, owners };
  await applyBooksIntakeToProfile(env, c.id, forProfile, { actor, memberId: null, byClient: true, source: `${meta.label} intake`, module: meta.module }).catch((e) => console.error("service profile sync", e instanceof Error ? e.message : e));

  // Signed PDF to Documents, and the documents they need to upload.
  const name = (typeof answers.legalName === "string" && answers.legalName.trim()) || (typeof answers.fullName === "string" && answers.fullName.trim()) || c.name;
  const pdf = await buildIntakePdf({ clientName: name, taxYear: new Date().getFullYear(), form: "1040", returnId: r.id, answers, submittedAt: t, enteredBy: "client", consentName: consent, documents: docs, sections: meta.sections, title: meta.title, signaturePng: sigPng });
  const safe = name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fileName = `MKB-${meta.title.replace(/\s+/g, "-")}-${safe}.pdf`;
  const fileId = await storeClientPdfAs(env, l.createdBy, c.id, pdf, { name: `${meta.title} (submitted ${longDate(t)})`, fileName, category: "Intake", service: meta.service, activity: `Saved a PDF copy of the signed ${meta.label} intake to Documents` });
  await run(env.DB, "UPDATE service_intakes SET pdf_file_id = ? WHERE id = ?", fileId, r.id);
  if (docSpecs.length) {
    const cur = await one<{ module_data: string | null }>(env.DB, "SELECT module_data FROM clients WHERE id = ?", c.id);
    const md = json<Record<string, { name?: string; service?: string }[]>>(cur?.module_data, {});
    const have = new Set((md.documents ?? []).filter((d) => d.service === meta.service).map((d) => d.name));
    const add = docSpecs.filter((d) => !have.has(d.name)).map((d) => ({ id: randomId("d"), name: d.name, service: meta.service, category: `${meta.label} intake`, status: "requested", sensitive: !!d.sensitive, requestedAt: t, dueAt: new Date(Date.parse(t) + 7 * 86400000).toISOString() }));
    md.documents = [...add, ...(md.documents ?? [])];
    await run(env.DB, "UPDATE clients SET module_data = ?, rev = rev + 1, updated_at = ? WHERE id = ?", JSON.stringify(md), t, c.id);
  }
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'client', NULL, ?)", randomId("x"), c.id, `${meta.label} intake submitted by the client (secure link) — ${docs.length} document${docs.length === 1 ? "" : "s"} requested`, t);
  await audit(env.DB, actor, { action: "Record update", resource: `${meta.label} intake ${r.id}`, meta: `Submitted through secure link; signed (drawn); ${docs.length} documents requested` });
  await notify(env, { module: meta.module }, { kind: "intake", title: `${name} submitted their ${meta.label} intake`, body: "Ready for review — the signed PDF is in their Documents", href: `/clients/${c.id}#documents` });

  let emailed = false;
  const to = (typeof answers.email === "string" && EMAIL_RE.test(answers.email) && answers.email) || c.email;
  if (to) {
    const out = await sendTemplate(env, "service_intake_received", { to, vars: { firstName: firstNameOf(c, answers), service: meta.label, date: longDate(t), next: meta.next }, documents: docs, attachments: [{ filename: fileName, content: pdf }] });
    emailed = out.sent;
  }
  // One invitation to opt in to marketing texts (only recorded if they reply YES).
  await askTextOptIn(env, "mkb", (typeof answers.phone === "string" && answers.phone) || c.phone, { type: "client", id: c.id });
  return { submitted: true, documents: docs, emailed, next: await nextStop(env, c.id) };
}

/* ---------------------------------------------------------------- manual entry (staff) */
/**
 * The client already completed this intake another way (e.g. on paper): staff fill it in
 * themselves. Nothing is emailed to the client; on submit it's marked "Manually entered".
 */
async function manualRow(env: AppEnv, a: Actor, id: string) {
  const { r, c } = await staffRow(env, a, id);
  requirePermission(a, SERVICE_INTAKES[r.kind].module, "edit");
  requireStaff(a);
  return { r, c };
}
/** { kind } — opens (or reopens) the intake for staff to fill in. No email is sent. */
export async function startManualServiceIntake(env: AppEnv, a: Actor, clientId: string, b: { kind?: unknown }) {
  requireStaff(a);
  if (!isServiceIntakeKind(b.kind)) throw badRequest("Choose which intake to enter.");
  const kind = b.kind;
  const meta = SERVICE_INTAKES[kind];
  requirePermission(a, meta.module, "edit");
  const c = await clientRow(env, clientId);
  if (!(await canOpen(env, a, c))) throw notFound("Client not found.");
  let r = await one<Row>(env.DB, "SELECT * FROM service_intakes WHERE client_id = ? AND kind = ? AND status = 'in_progress' ORDER BY created_at DESC LIMIT 1", clientId, kind);
  if (!r) {
    const id = `SI-${randomId("s").slice(2)}`;
    const t = now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO service_intakes (id, client_id, kind, status, answers, step, history, created_at, created_by, updated_at) VALUES (?, ?, ?, 'in_progress', ?, 0, ?, ?, ?, ?)").bind(id, clientId, kind, JSON.stringify(prefillFrom(c)), hist("[]", a.member.id, `${meta.label} intake opened for manual entry`), t, a.member.id, t),
      env.DB.prepare("INSERT OR IGNORE INTO client_services (client_id, service) VALUES (?, ?)").bind(clientId, meta.service),
    ]);
    r = (await one<Row>(env.DB, "SELECT * FROM service_intakes WHERE id = ?", id))!;
    await audit(env.DB, a, { action: "Record update", resource: `${meta.label} intake ${id}`, meta: "Opened for manual entry (nothing sent to the client)" });
  }
  return { intakeId: r.id };
}
export async function manualServiceIntake(env: AppEnv, a: Actor, id: string) {
  const { r, c } = await manualRow(env, a, id);
  if (r.status !== "in_progress") throw new HttpError(410, "This intake has already been submitted.", "used");
  const answers = json<Answers>(r.answers, {});
  return { intake: { kind: r.kind, status: r.status, answers: Object.keys(answers).length ? answers : prefillFrom(c), step: r.step, rev: r.rev, name: c.name, firstName: firstNameOf(c, answers) }, expiresAt: null, clientId: c.id };
}
export async function manualSaveServiceIntake(env: AppEnv, a: Actor, id: string, b: { answers?: unknown; step?: unknown; rev?: unknown }) {
  const { r } = await manualRow(env, a, id);
  if (r.status !== "in_progress") throw new HttpError(410, "This intake has already been submitted.", "used");
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "This intake was updated somewhere else. We loaded the latest version.", "conflict");
  const answers = b.answers !== undefined ? cleanAnswers(b.answers) : json<Answers>(r.answers, {});
  const step = Number.isInteger(b.step) ? Math.max(0, Math.min(40, Number(b.step))) : r.step;
  const res = await run(env.DB, "UPDATE service_intakes SET answers = ?, step = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ? AND status = 'in_progress'", JSON.stringify(answers), step, now(), r.id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "This intake was updated somewhere else. We loaded the latest version.", "conflict");
  return { rev: r.rev + 1 };
}
/** { answers, rev, requestDocs, emailCopy } — saves it as manually entered: PDF to Documents, profile updated. */
export async function manualSubmitServiceIntake(env: AppEnv, a: Actor, id: string, b: { answers?: unknown; rev?: unknown; requestDocs?: unknown; emailCopy?: unknown }) {
  const { r, c } = await manualRow(env, a, id);
  if (r.status !== "in_progress") throw new HttpError(410, "This intake has already been submitted.", "used");
  if (Number(b.rev) !== r.rev) throw new HttpError(409, "This intake was updated somewhere else. We loaded the latest version.", "conflict");
  if (a.kind !== "staff") throw badRequest("Staff only.");
  const meta = SERVICE_INTAKES[r.kind];
  const answers = cleanAnswers(b.answers);
  const t = now();
  const by = `Manually entered by ${a.member.name}`;
  const docSpecs = b.requestDocs === true ? docsFor(meta.sections, answers).slice(0, 60) : [];
  const docs = docSpecs.map((d) => d.name);
  const res = await run(env.DB, "UPDATE service_intakes SET status = 'submitted', answers = ?, consent_name = ?, entered_by = 'staff', submitted_at = ?, history = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ? AND status = 'in_progress'", JSON.stringify(answers), by, t, hist(r.history, a.member.id, "Manually entered"), t, r.id, r.rev);
  if (!res.meta.changes) throw new HttpError(409, "This intake was updated somewhere else. We loaded the latest version.", "conflict");
  await cancelLinks(env, "service_intake", r.id, a.member.id).catch(() => 0);

  const owners = Array.isArray(answers.owners) ? answers.owners : answers.contactName ? [{ name: answers.contactName as string, title: (answers.contactTitle as string) ?? "" }] : [];
  const forProfile: Record<string, unknown> = r.kind === "relief"
    ? { street: answers.street, city: answers.city, state: answers.state, zip: answers.zip, phone: answers.phone, email: answers.email, dob: answers.dob, fullName: answers.fullName }
    : { legalName: answers.legalName, entity: answers.entity, formState: answers.formState, street: answers.street, city: answers.city, state: answers.state, zip: answers.zip, phone: answers.phone, email: answers.email, owners };
  await applyBooksIntakeToProfile(env, c.id, forProfile, { actor: a, memberId: a.member.id, byClient: false, source: `${meta.label} intake`, module: meta.module }).catch((e) => console.error("service profile sync", e instanceof Error ? e.message : e));

  const name = (typeof answers.legalName === "string" && answers.legalName.trim()) || (typeof answers.fullName === "string" && answers.fullName.trim()) || c.name;
  const pdf = await buildIntakePdf({ clientName: name, taxYear: new Date().getFullYear(), form: "1040", returnId: r.id, answers, submittedAt: t, enteredBy: "manual", documents: docs, sections: meta.sections, title: meta.title });
  const safe = name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fileName = `MKB-${meta.title.replace(/\s+/g, "-")}-${safe}.pdf`;
  const fileId = await storeClientPdfAs(env, a.member.id, c.id, pdf, { name: `${meta.title} (manually entered ${longDate(t)})`, fileName, category: "Intake", service: meta.service, activity: `Saved a PDF copy of the manually entered ${meta.label} intake to Documents` });
  await run(env.DB, "UPDATE service_intakes SET pdf_file_id = ? WHERE id = ?", fileId, r.id);
  if (docSpecs.length) {
    const cur = await one<{ module_data: string | null }>(env.DB, "SELECT module_data FROM clients WHERE id = ?", c.id);
    const md = json<Record<string, { name?: string; service?: string }[]>>(cur?.module_data, {});
    const have = new Set((md.documents ?? []).filter((d) => d.service === meta.service).map((d) => d.name));
    const add = docSpecs.filter((d) => !have.has(d.name)).map((d) => ({ id: randomId("d"), name: d.name, service: meta.service, category: `${meta.label} intake`, status: "requested", sensitive: !!d.sensitive, requestedAt: t, dueAt: new Date(Date.parse(t) + 7 * 86400000).toISOString() }));
    md.documents = [...add, ...(md.documents ?? [])];
    await run(env.DB, "UPDATE clients SET module_data = ?, rev = rev + 1, updated_at = ? WHERE id = ?", JSON.stringify(md), t, c.id);
  }
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'intake', ?, 'staff', ?, ?)", randomId("x"), c.id, `${meta.label} intake manually entered by ${a.member.name}${docs.length ? ` — ${docs.length} document${docs.length === 1 ? "" : "s"} requested` : ""}`, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `${meta.label} intake ${r.id}`, meta: `Manually entered${docs.length ? `; ${docs.length} documents requested` : ""}` });

  let emailed = false;
  const to = (typeof answers.email === "string" && EMAIL_RE.test(answers.email) && answers.email) || c.email;
  if (b.emailCopy === true && to) {
    const out = await sendTemplate(env, "service_intake_received", { to, vars: { firstName: firstNameOf(c, answers), service: meta.label, date: longDate(t), next: meta.next }, documents: docs, attachments: [{ filename: fileName, content: pdf }] });
    emailed = out.sent;
  }
  return { submitted: true, documents: docs, emailed, intakeId: r.id, clientId: c.id };
}

/** Every unfinished (and recently submitted) intake of one kind, for clients and leads (a lead's intake sits on its prospect record). Staff with view access to that service. */
export async function openServiceIntakes(env: AppEnv, a: Actor, kind: ServiceIntakeKind) {
  requireStaff(a);
  requirePermission(a, SERVICE_INTAKES[kind].module, "view");
  const rows = await all<ClientRow & { si_id: string; si_created: string; si_updated: string; si_by: string; si_status: string; si_submitted: string | null }>(env.DB,
    `${CLIENT_SQL.replace(/^SELECT /i, "SELECT si.id si_id, si.created_at si_created, si.updated_at si_updated, si.entered_by si_by, si.status si_status, si.submitted_at si_submitted, ")} JOIN service_intakes si ON si.client_id = c.id WHERE si.kind = ? AND (si.status = 'in_progress' OR si.submitted_at > ?) AND c.status != 'declined' ORDER BY si.created_at DESC`, kind, new Date(Date.now() - 365 * 86400000).toISOString());
  const seeLeads = canDo(a.policy, a.member, "leads", "view");
  const out = [];
  for (const r of rows) {
    const prospect = r.status === "prospect";
    if (prospect ? !seeLeads : !(await canOpen(env, a, r))) continue;
    out.push({ id: r.si_id, clientId: r.id, name: r.name, leadId: prospect ? (r as { lead_id?: string | null }).lead_id ?? null : null, isLead: prospect, status: r.si_status, submittedAt: r.si_submitted, createdAt: r.si_created, updatedAt: r.si_updated, link: await latestLink(env, "service_intake", r.si_id) });
  }
  return { intakes: out };
}

/** Staff: copy a submitted Expungement Relief intake's contact details and date of birth onto the client's profile again. */
export async function applyIntakeToProfile(env: AppEnv, a: Actor, id: string) {
  const { r, c } = await manualRow(env, a, id);
  if (r.status !== "submitted") throw badRequest("Only submitted intakes can be copied to the profile.");
  if (a.kind !== "staff") throw badRequest("Staff only.");
  if (r.kind !== "relief") throw badRequest("This intake updates the profile when it's submitted.");
  const answers = json<Record<string, unknown>>(r.answers, {});
  const meta = SERVICE_INTAKES[r.kind];
  const res = await applyBooksIntakeToProfile(env, c.id, { street: answers.street, city: answers.city, state: answers.state, zip: answers.zip, phone: answers.phone, email: answers.email, dob: answers.dob, fullName: answers.fullName }, { actor: a, memberId: a.member.id, byClient: false, source: `${meta.label} intake`, module: meta.module });
  return { changed: res.changed.map((x) => x.label) };
}

/* ---------------------------------------------------------------- SSN (Expungement Relief) */
const SSN_KEY = "about.ssn";
/** Saves the full SSN/ITIN straight to the client's profile, encrypted. Answers keep only the last four; nothing here reads it back. */
async function saveSsn(env: AppEnv, r: Row, value: unknown, o: { by: string; actor: Actor | LinkActor; byClient: boolean }) {
  if (r.kind !== "relief") throw badRequest("Unknown answer.");
  const d = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (d.length !== 9) throw badRequest("Enter all 9 digits of the Social Security number.");
  if (/^(000|666)/.test(d) || d.slice(3, 5) === "00" || d.slice(5) === "0000") throw badRequest("That isn't a valid Social Security number — please check it.");
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  const { key, version } = vaultKey(env);
  const formatted = `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  const cur = await one<{ ciphertext: string; iv: string }>(env.DB, "SELECT ciphertext, iv FROM vault WHERE owner_type = 'client' AND owner_id = ? AND field = 'tax_id'", r.client_id);
  const old = cur ? await decryptField(key, cur, vaultAad(r.client_id, "tax_id")).catch(() => null) : null;
  const t = now();
  if (!old || old.replace(/\D/g, "") !== d) {
    const e = await encryptField(key, formatted, vaultAad(r.client_id, "tax_id"));
    await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, 'tax_id', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, last4 = excluded.last4, kind = excluded.kind, updated_at = excluded.updated_at, updated_by = excluded.updated_by", r.client_id, e.ciphertext, e.iv, version, d.slice(-4), d.startsWith("9") ? "ITIN" : "SSN", t, o.by);
    const what = `${old ? "changed" : "added"} SSN ending ${d.slice(-4)} (stored encrypted)`;
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', ?, ?, ?, ?)", randomId("x"), r.client_id, `Expungement Relief intake ${what}${o.byClient ? " — entered by the client" : ""}`, o.byClient ? "client" : "staff", o.byClient ? null : o.by, t);
    await audit(env.DB, o.actor, { action: "Permission change", resource: `Client ${r.client_id} — SSN saved from Expungement Relief intake`, department: "exp", meta: "Value not logged" });
    if (o.byClient && old) {
      const c = await one<{ name: string }>(env.DB, "SELECT name FROM clients WHERE id = ?", r.client_id);
      await notify(env, { module: "exp" }, { kind: "intake", title: `${c?.name ?? "A client"} entered a different SSN`, body: `In the Expungement Relief intake (now ending ${d.slice(-4)}). Check it before using it.`, href: `/clients/${r.client_id}` });
    }
  }
  return { last4: d.slice(-4) };
}
export async function publicSecureServiceIntake(env: AppEnv, token: string, ip: string, b: { key?: unknown; value?: unknown }) {
  const { r, actor } = await fromLink(env, token, ip);
  if (!(await rateLimit(env.DB, `linksecure:${actor.linkId}`, 30, 60))) throw new HttpError(429, "Too many changes in the last hour. Please try again later.", "rate_limited");
  if (b.key !== SSN_KEY) throw badRequest("Unknown answer.");
  return saveSsn(env, r, b.value, { by: `link:${actor.linkId}`, actor, byClient: true });
}
export async function manualSecureServiceIntake(env: AppEnv, a: Actor, id: string, b: { key?: unknown; value?: unknown }) {
  const { r } = await manualRow(env, a, id);
  if (a.kind !== "staff") throw badRequest("Staff only.");
  if (r.status !== "in_progress") throw new HttpError(410, "This intake has already been submitted.", "used");
  if (!hasSensitivePerm(a, "exp.editSsn") && !hasSensitivePerm(a, "tax.editSsn")) {
    await audit(env.DB, a, { action: "Sensitive reveal", resource: `Service intake ${id} — SSN`, meta: "Denied: needs the identifiers permission", success: false });
    throw new HttpError(403, "Entering Social Security numbers needs the edit-SSN permission.", "forbidden");
  }
  if (b.key !== SSN_KEY) throw badRequest("Unknown answer.");
  return saveSsn(env, r, b.value, { by: a.member.id, actor: a, byClient: false });
}
