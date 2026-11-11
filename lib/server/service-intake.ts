/**
 * Private-link intakes for payroll, Business Solutions and MKB Record Relief.
 * Same flow as the bookkeeping intake: staff (or a website "Get Started" form)
 * send the client a private link; the client answers, signs and submits; MKB
 * gets the signed PDF in Documents, the documents to upload are requested in
 * the portal, the profile is updated and the team is notified. Server-only.
 */
import { SERVICE_INTAKES, isServiceIntakeKind, type ServiceIntakeKind } from "@/lib/intakes/service";
import { docsFor, type Answers } from "@/lib/tax/interview/engine";
import { all, badRequest, HttpError, json, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { applyBooksIntakeToProfile } from "./books-profile";
import { linkOrigin } from "./books-intake";
import { nextStop, sendTemplate } from "./email";
import { audit, requirePermission, requireStaff, type Actor, type LinkActor } from "./identity";
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
  return v as Answers;
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

  // Profile: business and contact details (payroll / Business Solutions), contact details (Record Relief).
  const owners = Array.isArray(answers.owners) ? answers.owners : answers.contactName ? [{ name: answers.contactName as string, title: (answers.contactTitle as string) ?? "" }] : [];
  const forProfile: Record<string, unknown> = r.kind === "relief"
    ? { street: answers.street, city: answers.city, state: answers.state, zip: answers.zip, phone: answers.phone, email: answers.email }
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
    const add = docSpecs.filter((d) => !have.has(d.name)).map((d) => ({ id: randomId("d"), name: d.name, service: meta.service, category: `${meta.label} intake`, status: "requested", sensitive: !!d.sensitive, requestedAt: t }));
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
  return { submitted: true, documents: docs, emailed, next: await nextStop(env, c.id) };
}
