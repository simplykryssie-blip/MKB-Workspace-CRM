/**
 * Staff onboarding: the documents every team member signs (or uploads) and the Owner's identity
 * confirmation. Until both are done, `authenticate` lets that person reach only their own
 * onboarding screen — the server blocks everything else (the interface can't skip it).
 * The Owner role never has to onboard. Server-only.
 */
import { DEFAULT_STAFF_DOCS, fillStaffDoc, type StaffDoc, type StaffDocKind, type StaffOnboarding } from "@/lib/staff/onboarding-docs";
import { canManage, roleOf } from "@/lib/team/policy";
import type { PolicyState } from "@/lib/team/policy";
import { all, badRequest, clientIp, forbidden, HttpError, notFound, now, one, run, type AppEnv } from "./core";
import { randomId, sha256 } from "./crypto";
import { audit, loadMember, requirePermission, requireStaff, type Actor, type ServerMember } from "./identity";
import { signatureFrom } from "./signature";
import { buildStaffDocPdf } from "./intake-pdf";
import { notify } from "./notifications";

type DocRow = { key: string; version: number; title: string; kind: StaffDocKind; body: string; required: number; active: number; position: number; note: string | null; created_at: string; created_by: string | null };
type SigRow = { id: string; member_id: string; doc_key: string; version: number; kind: StaffDocKind; signed_name: string; r2_key: string; file_name: string; content_type: string; signed_at: string };

const fromRow = (r: DocRow): StaffDoc => ({ key: r.key, version: r.version, title: r.title, kind: r.kind, body: r.body, required: !!r.required, active: !!r.active, position: r.position, updatedAt: r.created_at, updatedBy: r.created_by ?? undefined });

/** The current version of every document (built-in drafts until the Owner edits them). */
export async function currentDocs(env: AppEnv): Promise<StaffDoc[]> {
  const rows = await all<DocRow>(env.DB, "SELECT d.* FROM staff_docs d JOIN (SELECT key, max(version) v FROM staff_docs GROUP BY key) m ON m.key = d.key AND m.v = d.version");
  const byKey = new Map(rows.map((r) => [r.key, fromRow(r)]));
  const out: StaffDoc[] = DEFAULT_STAFF_DOCS.map((d) => byKey.get(d.key) ?? { ...d, version: 1 });
  for (const r of rows) if (!DEFAULT_STAFF_DOCS.some((d) => d.key === r.key)) out.push(fromRow(r));
  return out.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
}
async function docVersion(env: AppEnv, key: string, version: number): Promise<StaffDoc | null> {
  const r = await one<DocRow>(env.DB, "SELECT * FROM staff_docs WHERE key = ? AND version = ?", key, version);
  if (r) return fromRow(r);
  const d = version === 1 ? DEFAULT_STAFF_DOCS.find((x) => x.key === key) : undefined;
  return d ? { ...d, version: 1 } : null;
}

const isOwnerMember = (policy: PolicyState, m: ServerMember) => !!roleOf(policy.roles, m)?.isOwner;

/** Where one member stands. */
export async function statusFor(env: AppEnv, policy: PolicyState, m: ServerMember): Promise<StaffOnboarding> {
  const [docs, sigs, idr] = await Promise.all([
    currentDocs(env),
    all<SigRow>(env.DB, "SELECT * FROM staff_doc_signatures WHERE member_id = ? ORDER BY signed_at DESC", m.id),
    one<{ identity_verified_at: string | null; identity_verified_by: string | null; identity_note: string }>(env.DB, "SELECT identity_verified_at, identity_verified_by, identity_note FROM members WHERE id = ?", m.id),
  ]);
  const required = !isOwnerMember(policy, m);
  const list = docs.filter((d) => d.active).map((d) => {
    const s = sigs.find((x) => x.doc_key === d.key);
    return { ...d, done: s ? { id: s.id, at: s.signed_at, version: s.version, name: s.signed_name, fileName: s.kind === "upload" ? s.file_name : undefined } : null };
  });
  const identity = { verifiedAt: idr?.identity_verified_at ?? null, verifiedBy: idr?.identity_verified_by ?? null, note: idr?.identity_note ?? "" };
  const complete = !required || (list.every((d) => !d.required || d.done) && !!identity.verifiedAt);
  return { required, docs: list, identity, complete };
}

/** Used on every staff request: true while this person still has to finish onboarding. */
export async function onboardingPending(env: AppEnv, policy: PolicyState, m: ServerMember) {
  if (isOwnerMember(policy, m)) return false;
  return !(await statusFor(env, policy, m)).complete;
}
/** API paths a person still onboarding may use. */
export const ONBOARDING_PATHS = /^\/api\/(auth\/|staff-onboarding(\/|$))/;

/* ---------------------------------------------------------------- the member's own screen */
export async function myOnboarding(env: AppEnv, a: Actor) {
  requireStaff(a);
  const s = await statusFor(env, a.policy, a.member);
  const date = new Date().toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });
  return { ...s, name: a.member.name, docs: s.docs.map((d) => ({ ...d, body: fillStaffDoc(d.body, { name: a.member.name, date }) })) };
}

async function afterStep(env: AppEnv, a: Extract<Actor, { kind: "staff" }>) {
  const s = await statusFor(env, a.policy, a.member);
  if (s.docs.every((d) => !d.required || d.done)) {
    await notify(env, { module: "team" }, { kind: "documents", title: `${a.member.name} signed all onboarding documents`, body: s.identity.verifiedAt ? "Their access is now open." : "Confirm their identity (video call + photo ID) on their team page to open their access.", href: `/team/members/${a.member.id}` }).catch(() => undefined);
  }
  return myOnboarding(env, a);
}

/** { key, version, name, signature (PNG data URL), agree } */
export async function signDoc(env: AppEnv, req: Request, a: Actor, b: Record<string, unknown>) {
  requireStaff(a);
  const key = String(b.key ?? "");
  const cur = (await currentDocs(env)).find((d) => d.key === key && d.active);
  if (!cur || cur.kind !== "sign") throw notFound("That document isn't available.");
  if (Number(b.version) !== cur.version) throw new HttpError(409, "This document was just updated. Please read the new version and sign again.", "conflict");
  if (b.agree !== true) throw badRequest("Check the box to confirm you read and agree.");
  const name = String(b.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (name.length < 3) throw badRequest("Type your full legal name.");
  const png = signatureFrom(b.signature);
  if (await one(env.DB, "SELECT 1 FROM staff_doc_signatures WHERE member_id = ? AND doc_key = ? AND version = ?", a.member.id, key, cur.version)) throw new HttpError(409, "You already signed this document.", "conflict");
  const t = now();
  const ip = clientIp(req);
  const date = new Date(t).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });
  const text = fillStaffDoc(cur.body, { name: a.member.name, date });
  const hash = await sha256(text);
  const pdf = await buildStaffDocPdf({ title: cur.title, version: cur.version, text, memberName: a.member.name, memberEmail: a.member.email, signedName: name, signedAt: t, ip, textSha256: hash, signaturePng: png });
  const id = randomId("sds");
  const r2 = `staff/${a.member.id}/${id}.pdf`;
  const fileName = `${cur.title} - ${a.member.name}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  await env.FILES.put(r2, pdf, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { uploadedBy: a.member.id } });
  await run(env.DB, "INSERT INTO staff_doc_signatures (id, member_id, doc_key, version, kind, signed_name, r2_key, file_name, content_type, text_sha256, ip, user_agent, signed_at) VALUES (?, ?, ?, ?, 'sign', ?, ?, ?, 'application/pdf', ?, ?, ?, ?)",
    id, a.member.id, key, cur.version, name, r2, fileName, hash, ip, (req.headers.get("user-agent") ?? "").slice(0, 300), t);
  await audit(env.DB, a, { action: "Record update", resource: `${a.member.name}: signed "${cur.title}" (version ${cur.version})` });
  return afterStep(env, a);
}

const TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp" };
const MAX = 15 * 1024 * 1024;

/** Raw file body, header x-file-name. */
export async function uploadDoc(env: AppEnv, req: Request, a: Actor, key: string) {
  requireStaff(a);
  const cur = (await currentDocs(env)).find((d) => d.key === key && d.active);
  if (!cur || cur.kind !== "upload") throw notFound("That document isn't available.");
  const name = decodeURIComponent(req.headers.get("x-file-name") ?? "").replace(/[\r\n"\\/]/g, "").trim().slice(0, 150);
  const ext = (name.includes(".") ? name.split(".").pop()! : "").toLowerCase();
  const type = TYPES[ext];
  if (!name || !type) throw badRequest("Upload a PDF or a photo (JPG, PNG or HEIC).");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) throw badRequest("That file is empty.");
  if (bytes.length > MAX) throw new HttpError(413, "That file is larger than 15 MB.");
  const t = now();
  const id = randomId("sds");
  const r2 = `staff/${a.member.id}/${id}.${ext}`;
  await env.FILES.put(r2, bytes, { httpMetadata: { contentType: type }, customMetadata: { uploadedBy: a.member.id, originalName: name } });
  await run(env.DB, "INSERT INTO staff_doc_signatures (id, member_id, doc_key, version, kind, signed_name, r2_key, file_name, content_type, text_sha256, ip, user_agent, signed_at) VALUES (?, ?, ?, ?, 'upload', ?, ?, ?, ?, NULL, ?, ?, ?)",
    id, a.member.id, key, cur.version, a.member.name, r2, name, type, clientIp(req), (req.headers.get("user-agent") ?? "").slice(0, 300), t);
  await audit(env.DB, a, { action: "Record update", resource: `${a.member.name}: uploaded "${cur.title}"` });
  return afterStep(env, a);
}

/** A signed PDF or uploaded file: the person themself, or someone who manages them. */
export async function docFile(env: AppEnv, a: Actor, id: string) {
  requireStaff(a);
  const s = await one<SigRow>(env.DB, "SELECT * FROM staff_doc_signatures WHERE id = ?", id);
  if (!s) throw notFound("File not found.");
  if (s.member_id !== a.member.id) {
    const target = await loadMember(env.DB, s.member_id);
    if (!target || !(isOwnerMember(a.policy, a.member) || canManage(a.policy, a.member, target, "view"))) throw forbidden();
    await audit(env.DB, a, { action: "Client record access", resource: `Staff document: ${s.file_name} (${target.name})` });
  }
  const obj = await env.FILES.get(s.r2_key);
  if (!obj) throw notFound("File not found.");
  return new Response(obj.body, { headers: { "content-type": s.content_type, "content-disposition": `inline; filename="${s.file_name.replace(/[^\w .()-]/g, "_")}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}

/* ---------------------------------------------------------------- managers: one member */
async function managed(env: AppEnv, a: Actor, id: string) {
  requireStaff(a);
  const t = await loadMember(env.DB, id);
  if (!t) throw notFound("Team member not found.");
  if (!(isOwnerMember(a.policy, a.member) || canManage(a.policy, a.member, t, "view"))) throw forbidden();
  return t;
}
export async function memberOnboarding(env: AppEnv, a: Actor, id: string) {
  const t = await managed(env, a, id);
  requireStaff(a);
  return statusFor(env, a.policy, t);
}
/** { verified: boolean, note } — confirmed on a live video call against a government photo ID. */
export async function confirmIdentity(env: AppEnv, a: Actor, id: string, b: Record<string, unknown>) {
  const t = await managed(env, a, id);
  requireStaff(a);
  if (t.id === a.member.id) throw forbidden("Someone else must confirm your identity.");
  if (!(isOwnerMember(a.policy, a.member) || canManage(a.policy, a.member, t, "edit"))) throw forbidden();
  const on = b.verified !== false;
  const note = String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (on && note.length < 5) throw badRequest("Add a short note: how you confirmed it (for example, video call with passport).");
  await run(env.DB, "UPDATE members SET identity_verified_at = ?, identity_verified_by = ?, identity_note = ? WHERE id = ?", on ? now() : null, on ? a.member.name : null, on ? note : "", t.id);
  await audit(env.DB, a, { action: "Permission change", resource: `${t.name}: identity ${on ? "confirmed" : "confirmation removed"}`, meta: note || undefined });
  return statusFor(env, a.policy, t);
}

/* ---------------------------------------------------------------- Settings: the documents */
export async function listDocs(env: AppEnv, a: Actor) {
  requirePermission(a, "settings", "settings");
  const [docs, hist] = await Promise.all([currentDocs(env), all<{ key: string; version: number; note: string | null; created_at: string; created_by: string | null }>(env.DB, "SELECT key, version, note, created_at, created_by FROM staff_docs ORDER BY key, version DESC")]);
  return { docs, history: hist.map((h) => ({ key: h.key, version: h.version, note: h.note ?? undefined, at: h.created_at, by: h.created_by ?? undefined })) };
}
/** Saves an edit (or a new document) as a new version. { key?, title, kind, body, required, active, position, note } */
export async function saveDoc(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const title = String(b.title ?? "").trim().slice(0, 120);
  const body = String(b.body ?? "").replace(/\r/g, "").trim().slice(0, 30_000);
  if (title.length < 3) throw badRequest("Give the document a title.");
  if (body.length < 20) throw badRequest("Add the document's text.");
  const kind: StaffDocKind = b.kind === "upload" ? "upload" : "sign";
  const docs = await currentDocs(env);
  let key = String(b.key ?? "").trim();
  const cur = key ? docs.find((d) => d.key === key) : undefined;
  if (key && !cur) throw notFound("That document doesn't exist.");
  if (!key) key = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) + "_" + randomId("d").slice(2, 7);
  const version = (cur?.version ?? 0) + 1;
  const position = Math.max(0, Math.min(999, Math.round(Number(b.position ?? cur?.position ?? docs.length + 1)) || 0));
  await run(env.DB, "INSERT INTO staff_docs (key, version, title, kind, body, required, active, position, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    key, version, title, cur?.kind ?? kind, body, b.required === false ? 0 : 1, b.active === false ? 0 : 1, position, String(b.note ?? "").trim().slice(0, 200) || null, now(), a.member.name);
  await audit(env.DB, a, { action: "Record update", resource: `Staff onboarding document "${title}" (version ${version})` });
  return listDocs(env, a);
}
export async function getDocVersion(env: AppEnv, a: Actor, key: string, version: number) {
  requirePermission(a, "settings", "settings");
  const d = await docVersion(env, key, version);
  if (!d) throw notFound("That version doesn't exist.");
  return { doc: d };
}
