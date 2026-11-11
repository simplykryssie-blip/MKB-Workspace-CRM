/**
 * Staff upload of a client document's file (raw body; x-file-name header).
 * The document record itself is saved with the client as usual; this stores
 * the bytes privately (R2) under the record's id, so it can be opened later.
 * Server-only.
 */
import { badRequest, forbidden, HttpError, notFound, now, one, rateLimit, type AppEnv } from "./core";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { audit, type Actor } from "./identity";

const TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", gif: "image/gif", webp: "image/webp", tif: "image/tiff", tiff: "image/tiff", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain", zip: "application/zip", eml: "message/rfc822", msg: "application/vnd.ms-outlook", qbo: "application/vnd.intu.qbo", ofx: "application/x-ofx" };
const MAX = 50 * 1024 * 1024;

export async function staffUpload(env: AppEnv, a: Actor, req: Request, clientId: string, fileId: string, q: { sensitive: boolean }) {
  if (a.kind !== "staff") throw forbidden();
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(fileId)) throw badRequest("Invalid file id.");
  const row = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
  if (!row) throw notFound("Client not found.");
  if (!(await canOpen(env, a, row))) throw forbidden("This client isn't assigned to you.");
  if (!(await rateLimit(env.DB, `staffup:${a.userId}`, 300, 60))) throw new HttpError(429, "Too many uploads in the last hour.", "rate_limited");
  const name = decodeURIComponent(req.headers.get("x-file-name") ?? "").replace(/[\r\n"\\/]/g, "").trim().slice(0, 150);
  const ext = (name.includes(".") ? name.split(".").pop()! : "").toLowerCase();
  const type = TYPES[ext];
  if (!name || !type) throw badRequest("That file type isn't supported. Use PDF, a photo, Word, Excel, CSV, text, ZIP or email files.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) throw badRequest("That file is empty.");
  if (bytes.length > MAX) throw new HttpError(413, "That file is larger than 50 MB.");
  const other = await one<{ client_id: string; r2_key: string }>(env.DB, "SELECT client_id, r2_key FROM client_files WHERE id = ?", fileId);
  if (other && other.client_id !== clientId) throw new HttpError(409, "That file id belongs to another record.", "conflict");
  const key = `clients/${clientId}/${fileId}.${ext}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { uploadedBy: a.member.id, originalName: name } });
  if (other && other.r2_key !== key) await env.FILES.delete(other.r2_key).catch(() => {});
  await env.DB.prepare("INSERT OR REPLACE INTO client_files (id, client_id, r2_key, name, content_type, size_bytes, sensitive, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(fileId, clientId, key, name, type, bytes.length, q.sensitive ? 1 : 0, now(), a.member.id).run();
  await audit(env.DB, a, { action: "Record update", resource: `Client ${clientId} — document`, meta: `Uploaded ${name} (${Math.round(bytes.length / 1024)} KB)${other ? " — replaced the earlier file" : ""}` });
  return { ok: true, id: fileId, sizeKb: Math.max(1, Math.round(bytes.length / 1024)) };
}
