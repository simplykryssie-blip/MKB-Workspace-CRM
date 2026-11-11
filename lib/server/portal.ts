/**
 * Client portal (the client's side). Every function takes the signed-in client
 * and only ever touches that client's own record: services and to-dos, their
 * documents (upload what MKB asked for, download what's shared), invoices and
 * online payment, and secure messages with the MKB team. Server-only.
 */
import { MONTH_STAGES, periodLabel, type BooksWorkspace, type ClientTask } from "@/lib/books/config";
import type { TaxReturn } from "@/lib/tax/config";
import type { ClientDocument, Message, ServiceKey } from "@/lib/types";
import { badRequest, forbidden, HttpError, json, notFound, now, one, all, rateLimit, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { audit, type Actor } from "./identity";
import { createLink } from "./secure-links";
import { notify } from "./notifications";
import { openClientFile } from "./files";
import { toReturn, type TaxRow } from "./tax";
import { dollarsOf, type InvoiceRow } from "./billing";
import { pdfFor, stripeCheckout, stripeReady } from "./billing-docs";
import { portalOrigin } from "./email";

type ClientActor = Extract<Actor, { kind: "client" }>;
export function requireClient(a: Actor): asserts a is ClientActor {
  if (a.kind !== "client") throw forbidden("This is the client portal — staff use the CRM.");
}
type ClientBits = { id: string; type: "individual" | "business"; name: string; contact_name: string | null; email: string; status: string; module_data: string; rev: number };
async function me(env: AppEnv, a: ClientActor) {
  const c = await one<ClientBits>(env.DB, "SELECT id, type, name, contact_name, email, status, module_data, rev FROM clients WHERE id = ?", a.clientId);
  if (!c || c.status === "inactive" || c.status === "declined") throw new HttpError(403, "Your portal isn't available right now. Please call MKB Financial Group.", "forbidden");
  return c;
}
type MD = { documents?: ClientDocument[]; messages?: Message[]; [k: string]: unknown };
/** Requests that are answered through a secure form (SSN, EIN…), never by uploading a file. */
const secureForm = (d: Pick<ClientDocument, "name">) => /\(secure form\)/i.test(d.name);
const firstName = (c: Pick<ClientBits, "name" | "contact_name">) => (c.contact_name || c.name).trim().split(/\s+/)[0];
const SERVICE_NAME: Record<string, string> = { tax: "Tax preparation", books: "Bookkeeping", biz: "Business services", expunge: "Record expungement" };
const MODULE: Record<string, "tax" | "books" | "biz" | "exp" | "crm"> = { tax: "tax", books: "books", biz: "biz", expunge: "exp" };

/** Where a tax return stands, in plain words for the client. */
const TAX_STATUS: Record<string, string> = {
  Intake: "Getting started", "Awaiting Documents": "Waiting on your documents", "Ready for Review": "Being prepared", "In Preparation": "Being prepared",
  "Awaiting Client Approval": "Ready for your review and signature", "Awaiting Final Approval": "Final review at MKB", "Ready to E-file": "Final review at MKB",
  Submitted: "Filed — waiting on the IRS", Accepted: "Accepted by the IRS", Completed: "Complete", Rejected: "Needs attention — MKB will contact you",
};
const monthStatus = (stage: string) => (stage === "Waiting on Client Items" ? "We need your items" : stage === "Client Follow-up Needed" ? "We have questions for you" : stage === "Reports Ready" ? "Reports ready" : stage === "Month Closed" ? "Closed" : "MKB is working on it");

/* ---------------------------------------------------------------- who am I */
export async function portalMe(env: AppEnv, a: Actor) {
  requireClient(a);
  const c = await me(env, a);
  const md = json<MD>(c.module_data, {});
  const readAt = (await one<{ messages_read_at: string | null }>(env.DB, "SELECT messages_read_at FROM users WHERE id = ?", a.userId))?.messages_read_at ?? "";
  const unread = (md.messages ?? []).filter((m) => m.from === "staff" && m.at > readAt).length;
  return { client: { name: c.name, firstName: firstName(c), type: c.type, email: c.email }, unread };
}

/* ---------------------------------------------------------------- home: services and to-dos */
type Todo = { id: string; kind: "tax_interview" | "books_intake" | "proposal" | "upload" | "books_task" | "pay"; title: string; detail?: string; service: string; ref: string; extra?: Record<string, string | number | undefined> };

export async function portalHome(env: AppEnv, a: Actor) {
  requireClient(a);
  const c = await me(env, a);
  const md = json<MD>(c.module_data, {});
  const todos: Todo[] = [];
  const services: { service: string; name: string; title: string; status: string; detail?: string }[] = [];

  // Tax returns
  const returns = (await all<TaxRow>(env.DB, "SELECT * FROM tax_returns WHERE client_id = ? ORDER BY tax_year DESC", c.id)).map(toReturn) as TaxReturn[];
  for (const r of returns) {
    services.push({ service: "tax", name: SERVICE_NAME.tax, title: `${r.taxYear} tax return (${r.form})`, status: TAX_STATUS[r.status] ?? r.status, detail: r.dueAt && !["Submitted", "Accepted", "Completed"].includes(r.status) ? `Due ${new Date(r.dueAt).toLocaleDateString("en-US", { dateStyle: "medium" })}` : undefined });
    const open = !["submitted", "reviewed"].includes(r.organizer.status) && r.form !== "990" && !["Submitted", "Accepted", "Completed"].includes(r.status);
    if (open) todos.push({ id: `tax-${r.id}`, kind: "tax_interview", title: `Complete your ${r.taxYear} tax interview`, detail: r.organizer.interview ? "You've started — pick up where you left off." : "About 20–30 minutes. Your answers save as you go.", service: "tax", ref: r.id });
  }
  // Bookkeeping onboarding (intake → proposal)
  const intakes = await all<{ id: string; status: string; workspace_id: string | null; proposal: string | null; answers: string }>(env.DB, "SELECT id, status, workspace_id, proposal, answers FROM books_intakes WHERE client_id = ? ORDER BY created_at DESC", c.id);
  for (const i of intakes) {
    if (i.workspace_id) continue;
    const p = json<{ status?: string; plan?: string } | null>(i.proposal, null);
    if (i.status === "in_progress") { todos.push({ id: `bi-${i.id}`, kind: "books_intake", title: "Complete your bookkeeping intake", detail: "Tell us about your business so we can set up your books.", service: "books", ref: i.id }); services.push({ service: "books", name: SERVICE_NAME.books, title: "Bookkeeping setup", status: "Waiting on your intake" }); }
    else if (p?.status === "sent") { todos.push({ id: `bp-${i.id}`, kind: "proposal", title: "Review and sign your bookkeeping proposal", detail: `Your ${p.plan ?? ""} plan and engagement letter.`, service: "books", ref: i.id }); services.push({ service: "books", name: SERVICE_NAME.books, title: "Bookkeeping setup", status: "Proposal ready for your signature" }); }
    else if (p?.status === "signed") services.push({ service: "books", name: SERVICE_NAME.books, title: "Bookkeeping setup", status: "Signed — MKB is setting up your books" });
    else services.push({ service: "books", name: SERVICE_NAME.books, title: "Bookkeeping setup", status: "MKB is reviewing your intake" });
  }
  // Bookkeeping workspaces: this month's status and the client's tasks
  const wss = (await all<{ id: string; business_name: string; months: string; tasks: string }>(env.DB, "SELECT id, business_name, months, tasks FROM books_workspaces WHERE client_id = ?", c.id));
  for (const w of wss) {
    const months = json<BooksWorkspace["months"]>(w.months, []).filter((m) => (MONTH_STAGES as readonly string[]).includes(m.stage));
    const cur = [...months].sort((x, y) => y.period.localeCompare(x.period)).find((m) => m.stage !== "Month Closed") ?? months[months.length - 1];
    services.push({ service: "books", name: SERVICE_NAME.books, title: `Bookkeeping — ${w.business_name}`, status: cur ? `${periodLabel(cur.period)}: ${monthStatus(cur.stage)}` : "Active" });
    for (const t of json<ClientTask[]>(w.tasks, []).filter((x) => x.status === "open")) todos.push({ id: `bt-${t.id}`, kind: "books_task", title: t.title, detail: t.detail, service: "books", ref: w.id, extra: { taskId: t.id, type: t.type, period: t.period } });
  }
  // Other services on the record (business services, expungement)
  for (const e of await all<{ service: string; title: string; stage: string; status: string }>(env.DB, "SELECT service, title, stage, status FROM client_enrollments WHERE client_id = ? AND service IN ('biz', 'expunge') AND status != 'cancelled'", c.id))
    services.push({ service: e.service, name: SERVICE_NAME[e.service] ?? e.service, title: e.title, status: e.status === "complete" ? "Complete" : e.stage });
  // Documents MKB asked for
  for (const d of (md.documents ?? []).filter((x) => x.status === "requested" && !secureForm(x))) todos.push({ id: `doc-${d.id}`, kind: "upload", title: `Upload: ${d.name}`, detail: d.taxYear ? `For your ${d.taxYear} tax return` : SERVICE_NAME[d.service], service: d.service, ref: d.id });
  // Invoices to pay
  for (const r of await all<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE client_id = ? AND status IN ('open', 'partial') AND payment_mode = 'upfront'", c.id)) {
    const owed = r.amount_cents - r.paid_cents;
    if (owed > 0) todos.push({ id: `inv-${r.id}`, kind: "pay", title: `Pay invoice ${r.number} — $${dollarsOf(owed).toFixed(2)}`, detail: `Due ${new Date(r.due_at).toLocaleDateString("en-US", { dateStyle: "medium" })}`, service: r.service, ref: r.id });
  }
  return { services, todos, ...(await portalMe(env, a)) };
}

/* ---------------------------------------------------------------- open an interview / intake / proposal from the portal */
/** { kind, id } — a fresh private link for the client's own form (they're already signed in). */
export async function portalStart(env: AppEnv, a: Actor, b: { kind?: unknown; id?: unknown }) {
  requireClient(a);
  const c = await me(env, a);
  const id = typeof b.id === "string" ? b.id : "";
  if (!(await rateLimit(env.DB, `portalstart:${a.userId}`, 30, 60))) throw new HttpError(429, "Too many requests. Please wait a few minutes.", "rate_limited");
  const link = (purpose: "tax_interview" | "books_intake" | "books_proposal", prefix: string) => createLink(env, { purpose, targetId: id, clientId: c.id, email: c.email, memberId: "portal" }).then((x) => `${prefix}${x.token}`);
  if (b.kind === "tax_interview") {
    const row = await one<TaxRow>(env.DB, "SELECT * FROM tax_returns WHERE id = ? AND client_id = ?", id, c.id);
    if (!row) throw notFound("Return not found.");
    const r = toReturn(row);
    if (["submitted", "reviewed"].includes(r.organizer.status)) throw badRequest("You already submitted this interview — thank you!");
    return { url: await link("tax_interview", "/i/t/") };
  }
  if (b.kind === "books_intake" || b.kind === "proposal") {
    const i = await one<{ status: string; proposal: string | null }>(env.DB, "SELECT status, proposal FROM books_intakes WHERE id = ? AND client_id = ?", id, c.id);
    if (!i) throw notFound("Not found.");
    if (b.kind === "books_intake") { if (i.status !== "in_progress") throw badRequest("You already submitted your intake — thank you!"); return { url: await link("books_intake", "/i/") }; }
    if (json<{ status?: string } | null>(i.proposal, null)?.status !== "sent") throw badRequest("There's no proposal waiting for your signature.");
    return { url: await link("books_proposal", "/i/p/") };
  }
  throw badRequest("Unknown item.");
}

/* ---------------------------------------------------------------- bookkeeping tasks */
/** { response? } — the client marks a monthly bookkeeping task done (with an optional note). */
export async function portalCompleteTask(env: AppEnv, a: Actor, wsId: string, taskId: string, b: { response?: unknown }) {
  requireClient(a);
  const c = await me(env, a);
  const w = await one<{ id: string; business_name: string; months: string; tasks: string; activity: string; rev: number }>(env.DB, "SELECT id, business_name, months, tasks, activity, rev FROM books_workspaces WHERE id = ? AND client_id = ?", wsId, c.id);
  if (!w) throw notFound("Not found.");
  const tasks = json<ClientTask[]>(w.tasks, []);
  const task = tasks.find((x) => x.id === taskId);
  if (!task || task.status !== "open") throw badRequest("This item is already done.");
  const response = typeof b.response === "string" ? b.response.trim().slice(0, 2000) : "";
  if (task.type === "confirm" && !response) throw badRequest("Tell us what happened — or write “nothing this month.”");
  const t = now();
  let next = tasks.map((x) => (x.id === taskId ? { ...x, status: "done" as const, completedAt: t, completedBy: "client" as const, response: response || x.response } : x));
  let months = json<BooksWorkspace["months"]>(w.months, []);
  const activity = json<{ id: string; kind: string; text: string; at: string; actor: string }[]>(w.activity, []);
  activity.unshift({ id: randomId("x"), kind: "intake", text: `Client completed in the portal: ${task.title}${response ? ` — “${response.slice(0, 200)}”` : ""}`, at: t, actor: "client" });
  // "Month is ready": close the month's other standard tasks and move it to MKB's review.
  if (task.type === "submit") {
    next = next.map((x) => (x.period === task.period && (x.standard || ["entry", "categorize", "submit"].includes(x.type)) && x.status === "open" ? { ...x, status: "done" as const, completedAt: t, completedBy: "client" as const } : x));
    months = months.map((m) => (m.period === task.period && m.stage === "Waiting on Client Items" ? { ...m, stage: "Ready for MKB Review" as const, submittedAt: t, history: [...m.history, { stage: "Ready for MKB Review" as const, at: t, by: "client", note: "client confirmed their items are in (portal)" }] } : m));
    activity.unshift({ id: randomId("x"), kind: "intake", text: `${periodLabel(task.period)} → Ready for MKB Review — client confirmed their items are in`, at: t, actor: "client" });
  }
  const res = await run(env.DB, "UPDATE books_workspaces SET tasks = ?, months = ?, activity = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND rev = ?", JSON.stringify(next), JSON.stringify(months), JSON.stringify(activity.slice(0, 500)), t, wsId, w.rev);
  if (!res.meta.changes) throw new HttpError(409, "Something changed — please try again.", "conflict");
  if (response) await appendMessage(env, c, { body: `Re: ${task.title} — ${response}`, service: "books" });
  await notify(env, { module: "books" }, { kind: "documents", title: `${c.name} completed a bookkeeping item`, body: task.title, href: `/services/bookkeeping/${wsId}` });
  return { ok: true };
}

/* ---------------------------------------------------------------- documents */
export async function portalDocuments(env: AppEnv, a: Actor) {
  requireClient(a);
  const c = await me(env, a);
  const stored = new Set((await all<{ id: string }>(env.DB, "SELECT id FROM client_files WHERE client_id = ?", c.id)).map((f) => f.id));
  const docs = (json<MD>(c.module_data, {}).documents ?? []).map((d) => (stored.has(d.id) ? { ...d, hasFile: true } : d));
  const shape = (d: ClientDocument & { hasFile?: boolean; fileName?: string }) => ({ id: d.id, name: d.name, fileName: d.fileName, secureForm: secureForm(d), service: d.service, serviceName: SERVICE_NAME[d.service] ?? "", category: d.category, taxYear: d.taxYear, requestedAt: d.requestedAt, uploadedAt: d.uploadedAt, uploadedBy: d.uploadedBy, status: d.status, hasFile: !!d.hasFile });
  return {
    requested: docs.filter((d) => d.status === "requested").map(shape),
    files: (docs as (ClientDocument & { hasFile?: boolean })[]).filter((d) => d.hasFile && d.status !== "requested" && d.status !== "rejected").map(shape),
  };
}

const TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", gif: "image/gif", webp: "image/webp", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain" };
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Upload (raw file body; x-file-name header). `doc` = the requested document it
 * answers (checks it off), or none for an extra document. Files are private
 * (R2) and marked sensitive; staff are notified.
 */
export async function portalUpload(env: AppEnv, a: Actor, req: Request, q: { doc?: string | null; service?: string | null; note?: string | null }) {
  requireClient(a);
  if (!(await rateLimit(env.DB, `portalup:${a.userId}`, 60, 60))) throw new HttpError(429, "Too many uploads in the last hour. Please wait a bit.", "rate_limited");
  const rawName = decodeURIComponent(req.headers.get("x-file-name") ?? "").replace(/[\r\n"]/g, "").trim().slice(0, 150);
  const ext = (rawName.split(".").pop() ?? "").toLowerCase();
  const type = TYPES[ext];
  if (!rawName || !type) throw badRequest("Upload a PDF, photo (JPG, PNG, HEIC), Word, Excel, CSV or text file.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) throw badRequest("That file is empty.");
  if (bytes.length > MAX_BYTES) throw new HttpError(413, "That file is larger than 20 MB. Try a smaller scan or photo.");
  const c = await me(env, a);
  const md = json<MD>(c.module_data, {});
  const docs = md.documents ?? [];
  const t = now();
  let doc = q.doc ? docs.find((d) => d.id === q.doc) : undefined;
  if (q.doc && (!doc || doc.status !== "requested")) throw badRequest("That request was already completed — upload it as an extra document instead.");
  if (doc && secureForm(doc)) throw badRequest("That information is collected through a secure form, not an upload. Upload this file as an extra document instead.");
  const service = (doc?.service ?? (["tax", "books", "biz", "expunge"].includes(q.service ?? "") ? q.service : "tax")) as ServiceKey;
  const fileId = doc?.id ?? randomId("d");
  const key = `clients/${c.id}/${fileId}.${ext}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { uploadedBy: "client", originalName: rawName } });
  const entry = { ...(doc ?? { id: fileId, name: (q.note?.trim().slice(0, 120) || rawName.replace(/\.[^.]+$/, "")), service, category: "Uploaded by client", sensitive: true, requestedAt: t }), status: "received" as const, uploadedAt: t, uploadedBy: "client" as const, sizeKb: Math.max(1, Math.round(bytes.length / 1024)), fileName: rawName, hasFile: true };
  md.documents = doc ? docs.map((d) => (d.id === fileId ? entry : d)) : [entry as ClientDocument, ...docs];
  doc = entry as ClientDocument;
  const res = await run(env.DB, "UPDATE clients SET module_data = ?, rev = rev + 1, updated_at = ?, last_activity_at = ? WHERE id = ? AND rev = ?", JSON.stringify(md), t, t, c.id, c.rev);
  if (!res.meta.changes) { await env.FILES.delete(key); throw new HttpError(409, "Your documents changed while uploading — please try again.", "conflict"); }
  await env.DB.batch([
    env.DB.prepare("INSERT OR REPLACE INTO client_files (id, client_id, r2_key, name, content_type, size_bytes, sensitive, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL)").bind(fileId, c.id, key, rawName, type, bytes.length, t),
    env.DB.prepare("INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'upload', ?, 'client', NULL, ?)").bind(randomId("x"), c.id, `Uploaded “${doc.name}” in the client portal${q.doc ? " (requested document)" : ""}`, t),
  ]);
  await notify(env, { module: MODULE[service] ?? "crm" }, { kind: "documents", title: `${c.name} uploaded a document`, body: doc.name, href: `/clients/${c.id}#documents` });
  await audit(env.DB, { kind: "client", userId: a.userId, clientId: c.id, ip: a.ip }, { action: "Record update", resource: `Client ${c.id} — document`, meta: `Uploaded ${rawName} (${Math.round(bytes.length / 1024)} KB)` });
  return { ok: true, id: fileId };
}

export async function portalFile(env: AppEnv, a: Actor, fileId: string, inline: boolean) {
  requireClient(a);
  const c = await me(env, a);
  // Only documents listed on their record (not, for example, staff-only working files).
  const d = (json<MD>(c.module_data, {}).documents ?? []).find((x) => x.id === fileId);
  if (!d) throw notFound("File not found.");
  return openClientFile(env, a, c.id, fileId, inline);
}

/* ---------------------------------------------------------------- invoices */
export async function portalInvoices(env: AppEnv, a: Actor) {
  requireClient(a);
  const c = await me(env, a);
  const rows = await all<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE client_id = ? AND status != 'draft' ORDER BY issued_at DESC", c.id);
  return {
    stripe: stripeReady(env),
    invoices: rows.map((r) => ({ id: r.id, number: r.number, description: r.description, service: SERVICE_NAME[r.service] ?? r.service, issuedAt: r.issued_at, dueAt: r.due_at, amount: dollarsOf(r.amount_cents), paid: dollarsOf(r.paid_cents), owed: dollarsOf(Math.max(0, r.amount_cents - r.paid_cents)), status: r.status, bankProduct: r.payment_mode === "bank_product" })),
  };
}

export async function portalPay(env: AppEnv, a: Actor, id: string) {
  requireClient(a);
  const c = await me(env, a);
  const r = await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ? AND client_id = ?", id, c.id);
  if (!r || r.status === "draft") throw notFound("Invoice not found.");
  if (r.status === "void") throw badRequest("This invoice was cancelled.");
  if (r.payment_mode !== "upfront") throw badRequest("These fees come out of your refund — nothing to pay now.");
  const owed = r.amount_cents - r.paid_cents;
  if (owed <= 0) throw badRequest("This invoice is paid in full. Thank you!");
  if (!stripeReady(env)) throw new HttpError(503, "Online payment isn't available yet — please pay at our office or call us.");
  if (!(await rateLimit(env.DB, `portalpay:${a.userId}`, 20, 60))) throw new HttpError(429, "Too many attempts. Please wait a few minutes.", "rate_limited");
  const base = `${portalOrigin(env)}/portal`;
  const url = await stripeCheckout(env, r, owed, `${base}?paid=${encodeURIComponent(r.number)}#invoices`, `${base}#invoices`);
  if (!url) throw new HttpError(502, "We couldn't open the payment page right now. Please try again later or call us.");
  await audit(env.DB, { kind: "client", userId: a.userId, clientId: c.id, ip: a.ip }, { action: "Record update", resource: `Invoice ${r.number}`, meta: "Opened online payment from the portal" });
  return { url };
}

export async function portalInvoicePdf(env: AppEnv, a: Actor, id: string) {
  requireClient(a);
  const c = await me(env, a);
  const r = await one<InvoiceRow>(env.DB, "SELECT * FROM invoices WHERE id = ? AND client_id = ?", id, c.id);
  if (!r || r.status === "draft") throw notFound("Invoice not found.");
  const bytes = await pdfFor(env, r);
  return new Response(bytes as unknown as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="MKB-Invoice-${r.number}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}

/* ---------------------------------------------------------------- messages */
async function appendMessage(env: AppEnv, c: Pick<ClientBits, "id" | "name" | "contact_name">, m: { body: string; service?: ServiceKey }) {
  // Re-read so a message never overwrites a change made a moment ago.
  for (let i = 0; i < 3; i++) {
    const cur = await one<{ module_data: string; rev: number }>(env.DB, "SELECT module_data, rev FROM clients WHERE id = ?", c.id);
    const md = json<MD>(cur?.module_data, {});
    const t = now();
    md.messages = [...(md.messages ?? []), { id: randomId("m"), from: "client", author: c.contact_name || c.name, body: m.body, at: t, read: false, service: m.service }];
    const res = await run(env.DB, "UPDATE clients SET module_data = ?, rev = rev + 1, updated_at = ?, last_activity_at = ? WHERE id = ? AND rev = ?", JSON.stringify(md), t, t, c.id, cur?.rev ?? 0);
    if (res.meta.changes) return;
  }
  throw new HttpError(409, "Please try sending again.", "conflict");
}

export async function portalMessages(env: AppEnv, a: Actor) {
  requireClient(a);
  const c = await me(env, a);
  const msgs = (json<MD>(c.module_data, {}).messages ?? []).map((m) => ({ id: m.id, from: m.from, author: m.from === "staff" ? m.author : "You", body: m.body, at: m.at, service: m.service ? SERVICE_NAME[m.service] : undefined }));
  await run(env.DB, "UPDATE users SET messages_read_at = ? WHERE id = ?", now(), a.userId);
  return { messages: msgs };
}

/** { body, service? } — a secure message to the MKB team. */
export async function portalSend(env: AppEnv, a: Actor, b: { body?: unknown; service?: unknown }) {
  requireClient(a);
  const c = await me(env, a);
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!body) throw badRequest("Write your message first.");
  if (!(await rateLimit(env.DB, `portalmsg:${a.userId}`, 30, 60))) throw new HttpError(429, "Too many messages in the last hour. Please call us if it's urgent.", "rate_limited");
  const service = (["tax", "books", "biz", "expunge"].includes(b.service as string) ? b.service : undefined) as ServiceKey | undefined;
  await appendMessage(env, c, { body, service });
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'message', 'Client sent a message in the portal', 'client', NULL, ?)", randomId("x"), c.id, now());
  await notify(env, { module: service ? MODULE[service] : "crm" }, { kind: "documents", title: `New message from ${c.name}`, body: body.slice(0, 140), href: `/clients/${c.id}#messages` });
  return portalMessages(env, a);
}
