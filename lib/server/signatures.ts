/**
 * Online signature requests: staff send a client a document by private link (no login);
 * the client reads it, types their name and signs. The exact text is kept with the
 * request, the signed PDF goes to the client's Documents and a copy is emailed to them.
 *
 * Kinds: the service's engagement letter (+ standard terms), the records release
 * authorization (Expungement Relief), a custom document staff write, or a manually
 * entered intake for the client to review and sign. Server-only.
 */
import { SERVICE_INTAKES } from "@/lib/intakes/service";
import { fillLetter } from "@/lib/engagement/letters";
import { RECORDS_RELEASE, fillDoc } from "@/lib/engagement/release";
import { feeWords } from "@/lib/fees/config";
import { display, qVisible, rowsOf, sectionVisible, type Answers } from "@/lib/tax/interview/engine";
import { canDo } from "@/lib/team/policy";
import type { ServiceKey } from "@/lib/types";
import { all, badRequest, HttpError, json, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { currentLetters } from "./engagement";
import { linkOrigin } from "./books-intake";
import { sendTemplate } from "./email";
import { audit, requirePermission, requireStaff, type Actor, type LinkActor } from "./identity";
import { buildLetterPdf } from "./intake-pdf";
import { notify } from "./notifications";
import { cancelLinks, createLink, latestLink, LINK_DAYS, openLink, useLink } from "./secure-links";
import { sha256Bytes, signatureFrom } from "./signature";
import { loadFees } from "./settings";
import { storeClientPdfAs } from "./tax";

type Kind = "engagement" | "records_release" | "custom" | "intake";
type Part = { title: string; body: string; version: number };
type Row = { id: string; client_id: string; service: ServiceKey; kind: Kind; title: string; parts: string; ref_id: string | null; letter_key: string | null; message: string | null; email: string | null; status: "sent" | "signed" | "cancelled"; signed_name: string | null; signed_at: string | null; pdf_file_id: string | null; history: string; created_at: string; created_by: string | null; updated_at: string };

const SERVICES: ServiceKey[] = ["tax", "books", "biz", "expunge"];
const MODULE = { tax: "tax", books: "books", biz: "biz", expunge: "exp" } as const;
const SERVICE_NAME: Record<ServiceKey, string> = { tax: "Tax Preparation", books: "Bookkeeping", biz: "Business Solutions", expunge: "Expungement Relief" };
const KIND_LABEL: Record<Kind, string> = { engagement: "Engagement letter", records_release: "Records release authorization", custom: "Document", intake: "Intake review" };
const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
const hist = (h: string, by: string, text: string) => JSON.stringify([...json<{ at: string; by: string; text: string }[]>(h, []), { at: now(), by, text }].slice(-60));
const firstName = (c: { name: string; contact_name: string | null }) => (c.contact_name || c.name).trim().split(/\s+/)[0];

const toItem = async (env: AppEnv, r: Row) => ({
  id: r.id, service: r.service, kind: r.kind, kindLabel: KIND_LABEL[r.kind], title: r.title, status: r.status, email: r.email ?? undefined,
  sentAt: r.created_at, signedAt: r.signed_at ?? undefined, signedName: r.signed_name ?? undefined, pdfFileId: r.pdf_file_id ?? undefined, refId: r.ref_id ?? undefined,
  letter: r.letter_key ?? undefined, link: r.status === "sent" ? await latestLink(env, "signature", r.id) : null,
});

async function clientFor(env: AppEnv, a: Actor, clientId: string) {
  requireStaff(a);
  requirePermission(a, "crm", "view");
  const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
  if (!c || !(await canOpen(env, a, c))) throw notFound("Client not found.");
  return c;
}

/** Staff: the client's signature requests, plus manually entered intakes that can be sent for review. */
export async function listSignatures(env: AppEnv, a: Actor, clientId: string) {
  await clientFor(env, a, clientId);
  const rows = await all<Row>(env.DB, "SELECT * FROM signature_requests WHERE client_id = ? ORDER BY created_at DESC", clientId);
  const intakes = await all<{ id: string; kind: keyof typeof SERVICE_INTAKES; submitted_at: string | null }>(env.DB, "SELECT id, kind, submitted_at FROM service_intakes WHERE client_id = ? AND status = 'submitted' AND entered_by = 'staff' ORDER BY submitted_at DESC", clientId);
  return {
    requests: await Promise.all(rows.map((r) => toItem(env, r))),
    intakes: intakes.map((i) => ({ id: i.id, label: `${SERVICE_INTAKES[i.kind].title} (manually entered${i.submitted_at ? ` ${longDate(i.submitted_at)}` : ""})`, service: SERVICE_INTAKES[i.kind].service })),
  };
}

/** The intake's answers as signable text: one heading per section, one line per answer. */
function intakeText(kind: keyof typeof SERVICE_INTAKES, answers: Answers) {
  const meta = SERVICE_INTAKES[kind];
  const out: string[] = ["Please check every answer below. If anything is wrong or missing, don't sign — call MKB at 888-379-9372 and we'll correct it."];
  const line = (label: string, v: string) => out.push(`- ${label}${/[?:]$/.test(label) ? "" : ":"} ${v.replace(/\n+/g, "; ")}`);
  for (const sec of meta.sections.filter((x) => sectionVisible(x, answers))) {
    if (sec.repeat) {
      rowsOf(answers, sec.id).forEach((row, i) => {
        out.push("", `## ${sec.title} — ${sec.repeat!.rowTitle?.(row, i) ?? `${sec.repeat!.noun} ${i + 1}`}`);
        sec.questions.filter((q) => qVisible(q, answers, row)).forEach((q) => line(q.label, display(q, row[q.id])));
      });
    } else {
      const qs = sec.questions.filter((q) => qVisible(q, answers));
      if (!qs.length) continue;
      out.push("", `## ${sec.title}`);
      qs.forEach((q) => line(q.label, display(q, typeof answers[q.id] === "string" ? (answers[q.id] as string) : undefined)));
    }
  }
  return out.join("\n");
}

/** { kind, service, title?, body?, intakeId?, message?, email? } — creates the request and emails the private link. */
export async function createSignature(env: AppEnv, a: Actor, clientId: string, b: Record<string, unknown>) {
  const c = await clientFor(env, a, clientId);
  if (a.kind !== "staff") throw badRequest("Staff only.");
  const kind = (["engagement", "records_release", "custom", "intake"] as Kind[]).find((k) => k === b.kind);
  if (!kind) throw badRequest("Choose what to send.");
  let service = SERVICES.find((x) => x === b.service) ?? "tax";
  const email = s(b.email, 200).toLowerCase() || (c.email ?? "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest("Add the client's email address first.");
  const t = now();
  const vars: Record<string, string> = { ...feeWords(await loadFees(env)), clientName: c.contact_name || c.name, service: SERVICE_NAME[service], fee: "", taxYear: String(new Date().getFullYear() - 1), date: longDate(t) };
  let title = "", parts: Part[] = [], refId: string | null = null, letterKey: string | null = null;
  if (kind === "engagement") {
    const L = await currentLetters(env);
    const key = service === "tax" ? (c.type === "business" ? "tax_business" : "tax_individual") : service === "expunge" ? "exp" : service;
    const l = L[key], tm = L.terms;
    parts = [{ title: fillLetter(l.title, vars), body: fillLetter(l.body, vars), version: l.version }, { title: fillLetter(tm.title, vars), body: fillLetter(tm.body, vars), version: tm.version }];
    title = parts[0].title;
    letterKey = `${key}:${l.version}:${tm.version}`;
  } else if (kind === "records_release") {
    service = "expunge";
    parts = [{ title: RECORDS_RELEASE.title, body: fillDoc(RECORDS_RELEASE.body, vars), version: RECORDS_RELEASE.version }];
    title = RECORDS_RELEASE.title;
  } else if (kind === "custom") {
    title = s(b.title, 140);
    const body = s(b.body, 20_000);
    if (!title || body.length < 10) throw badRequest("Give the document a title and its text.");
    parts = [{ title, body, version: 1 }];
  } else {
    const it = await one<{ id: string; kind: keyof typeof SERVICE_INTAKES; status: string; entered_by: string; answers: string; client_id: string }>(env.DB, "SELECT id, kind, status, entered_by, answers, client_id FROM service_intakes WHERE id = ?", s(b.intakeId, 60));
    if (!it || it.client_id !== clientId || it.status !== "submitted") throw badRequest("Choose a submitted intake.");
    const meta = SERVICE_INTAKES[it.kind];
    service = meta.service;
    title = `${meta.title} — review and sign`;
    parts = [{ title, body: intakeText(it.kind, json<Answers>(it.answers, {})), version: 1 }];
    refId = it.id;
  }
  requirePermission(a, MODULE[service], "edit");
  const open = await one<{ id: string }>(env.DB, "SELECT id FROM signature_requests WHERE client_id = ? AND status = 'sent' AND title = ?", clientId, title);
  if (open) throw new HttpError(409, `"${title}" is already waiting for this client's signature. Resend it instead.`, "duplicate");
  const id = randomId("sig");
  const message = s(b.message, 600);
  await run(env.DB, "INSERT INTO signature_requests (id, client_id, service, kind, title, parts, ref_id, letter_key, message, email, status, history, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?)",
    id, clientId, service, kind, title, JSON.stringify(parts), refId, letterKey, message || null, email, hist("[]", a.member.id, `Sent to ${email}`), t, a.member.id, t);
  const emailed = await sendLink(env, a, id, c, email, title, message);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'signature', ?, 'staff', ?, ?)", randomId("x"), clientId, `Sent "${title}" for signature to ${email}`, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `Signature request ${id}`, department: MODULE[service], meta: `${KIND_LABEL[kind]} sent for signature` });
  return { request: await toItem(env, (await one<Row>(env.DB, "SELECT * FROM signature_requests WHERE id = ?", id))!), emailed };
}

async function sendLink(env: AppEnv, a: Extract<Actor, { kind: "staff" }>, id: string, c: { id: string; name: string; contact_name: string | null }, email: string, title: string, message: string) {
  const { token, info } = await createLink(env, { purpose: "signature", targetId: id, clientId: c.id, email, memberId: a.member.id });
  const out = await sendTemplate(env, "signature_request", { to: email, buttonUrl: `${linkOrigin(env)}/i/sign/${token}`, vars: { firstName: firstName(c), document: title, expires: longDate(info.expiresAt), days: String(LINK_DAYS), staffName: a.member.name, message } });
  return out.sent;
}

async function staffRow(env: AppEnv, a: Actor, id: string) {
  const r = await one<Row>(env.DB, "SELECT * FROM signature_requests WHERE id = ?", id);
  if (!r) throw notFound("Request not found.");
  const c = await clientFor(env, a, r.client_id);
  requirePermission(a, MODULE[r.service], "edit");
  return { r, c };
}

/** Staff: a new link (the old one stops working). */
export async function resendSignature(env: AppEnv, a: Actor, id: string, b: { email?: unknown }) {
  const { r, c } = await staffRow(env, a, id);
  if (a.kind !== "staff") throw badRequest("Staff only.");
  if (r.status !== "sent") throw badRequest("Only requests waiting for a signature can be resent.");
  const email = s(b.email, 200).toLowerCase() || r.email || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest("Enter an email address.");
  await run(env.DB, "UPDATE signature_requests SET email = ?, history = ?, updated_at = ? WHERE id = ?", email, hist(r.history, a.member.id, `Resent to ${email}`), now(), id);
  const emailed = await sendLink(env, a, id, c, email, r.title, r.message ?? "");
  return { request: await toItem(env, (await one<Row>(env.DB, "SELECT * FROM signature_requests WHERE id = ?", id))!), emailed };
}

/** Staff: cancel — the link stops working. */
export async function cancelSignature(env: AppEnv, a: Actor, id: string) {
  const { r } = await staffRow(env, a, id);
  if (a.kind !== "staff") throw badRequest("Staff only.");
  if (r.status !== "sent") throw badRequest("Only requests waiting for a signature can be cancelled.");
  await cancelLinks(env, "signature", id, a.member.id);
  await run(env.DB, "UPDATE signature_requests SET status = 'cancelled', history = ?, updated_at = ? WHERE id = ?", hist(r.history, a.member.id, "Cancelled"), now(), id);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'signature', ?, 'staff', ?, ?)", randomId("x"), r.client_id, `Cancelled the signature request for "${r.title}"`, a.member.id, now());
  return { request: await toItem(env, (await one<Row>(env.DB, "SELECT * FROM signature_requests WHERE id = ?", id))!) };
}

/** Staff: every request waiting for a signature (for dashboards), by service the person can see. */
export async function pendingSignatures(env: AppEnv, a: Actor) {
  requireStaff(a);
  if (a.kind !== "staff") return { requests: [] };
  const rows = await all<Row & { client_name: string }>(env.DB, "SELECT r.*, c.name client_name FROM signature_requests r JOIN clients c ON c.id = r.client_id WHERE r.status = 'sent' ORDER BY r.created_at");
  return { requests: rows.filter((r) => canDo(a.policy, a.member, MODULE[r.service], "view")).map((r) => ({ id: r.id, clientId: r.client_id, clientName: r.client_name, service: r.service, title: r.title, sentAt: r.created_at })) };
}

/* ---------------------------------------------------------------- the client's side (no sign-in) */
async function fromLink(env: AppEnv, token: string, ip: string, touch = false) {
  const l = await openLink(env, "signature", token, ip, { touch });
  const r = await one<Row>(env.DB, "SELECT * FROM signature_requests WHERE id = ?", l.targetId);
  if (!r || r.client_id !== l.clientId) throw new HttpError(404, "This link isn't valid.", "not_found");
  if (r.status === "signed") throw new HttpError(410, "This document has already been signed — thank you. A copy was emailed to you.", "used");
  if (r.status === "cancelled") throw new HttpError(410, "This request was cancelled. Please contact MKB Financial Group if you need a new link.", "used");
  const actor: LinkActor = { kind: "link", ip, clientId: l.clientId, linkId: l.id };
  return { l, r, actor };
}

export async function publicSignature(env: AppEnv, token: string, ip: string) {
  const { r } = await fromLink(env, token, ip, true);
  const c = await one<{ name: string; contact_name: string | null }>(env.DB, "SELECT name, contact_name FROM clients WHERE id = ?", r.client_id);
  return { title: r.title, kind: r.kind, parts: json<Part[]>(r.parts, []), firstName: c ? firstName(c) : "", message: r.message ?? "" };
}

/** { name, signature (PNG data URL), agree: true } */
export async function submitSignature(env: AppEnv, token: string, ip: string, b: { name?: unknown; signature?: unknown; agree?: unknown }) {
  const { l, r, actor } = await fromLink(env, token, ip);
  if (!(await rateLimit(env.DB, `sign:${l.id}`, 10, 60))) throw new HttpError(429, "Too many attempts. Please try again later.", "rate_limited");
  const name = s(b.name, 120);
  if (name.split(/\s+/).length < 2) throw badRequest("Type your full name (first and last).");
  if (b.agree !== true) throw badRequest("Check the box to confirm you read the document.");
  const png = signatureFrom(b.signature);
  if (!(await useLink(env, l.id))) throw new HttpError(410, "This link was already used.", "used");
  const t = now();
  const parts = json<Part[]>(r.parts, []);
  const c = (await one<{ name: string; contact_name: string | null; email: string | null }>(env.DB, "SELECT name, contact_name, email FROM clients WHERE id = ?", r.client_id))!;
  await env.FILES.put(`clients/${r.client_id}/signatures/${r.id}.png`, png, { httpMetadata: { contentType: "image/png" }, customMetadata: { request: r.id, signedBy: name, signedAt: t, sha256: await sha256Bytes(png) } });
  const pdf = await buildLetterPdf({ clientName: c.contact_name || c.name, parts, acceptedName: name, acceptedAt: t, method: "online", signaturePng: png, docTitle: r.kind === "engagement" ? undefined : KIND_LABEL[r.kind], extraRows: [["Sent to", r.email ?? ""], ["Signed from", `IP address ${ip}`]] });
  const safe = (c.contact_name || c.name).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fileName = `MKB-Signed-${r.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${safe}.pdf`;
  const docId = await storeClientPdfAs(env, r.created_by, r.client_id, pdf, { name: `${r.title} (signed ${longDate(t)})`, fileName, category: r.kind === "engagement" ? "Engagement letter" : "Signed documents", service: r.service, activity: `Saved the signed "${r.title}" to Documents` });
  await run(env.DB, "UPDATE signature_requests SET status = 'signed', signed_name = ?, signed_at = ?, pdf_file_id = ?, history = ?, updated_at = ? WHERE id = ? AND status = 'sent'", name, t, docId, hist(r.history, "client (secure link)", `Signed by ${name}`), t, r.id);
  if (r.kind === "intake" && r.ref_id) {
    const it = await one<{ history: string }>(env.DB, "SELECT history FROM service_intakes WHERE id = ?", r.ref_id);
    if (it) await run(env.DB, "UPDATE service_intakes SET history = ? WHERE id = ?", hist(it.history, "client (secure link)", `Client reviewed and signed the manually entered answers (${name})`), r.ref_id);
  }
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'signature', ?, 'client', NULL, ?)", randomId("x"), r.client_id, `Signed "${r.title}" online (${name})`, t);
  await audit(env.DB, actor, { action: "Record update", resource: `Signature request ${r.id}`, department: MODULE[r.service], meta: "Signed online (drawn signature)" });
  await notify(env, { module: MODULE[r.service] }, { kind: "documents", title: `${c.name} signed "${r.title}"`, body: `Signed online by ${name}. The signed copy is in Documents.`, href: `/clients/${r.client_id}#signatures` });
  const to = r.email || c.email;
  if (to) await sendTemplate(env, "signature_signed", { to, vars: { firstName: firstName(c), document: r.title, date: longDate(t) }, attachments: [{ filename: fileName, content: pdf }] }).catch(() => undefined);
  return { ok: true };
}
