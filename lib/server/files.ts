/**
 * Client document files in the private R2 bucket. Every download is checked
 * against the client record and the sensitive-document permissions, and audited.
 * Server-only.
 */
import { forbidden, notFound, one, type AppEnv } from "./core";
import { CLIENT_SQL, canOpen, type ClientRow } from "./clients";
import { audit, hasSensitivePerm, type Actor } from "./identity";

export async function openClientFile(env: AppEnv, a: Actor, clientId: string, fileId: string, inline: boolean) {
  const row = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
  const f = await one<{ r2_key: string; name: string; content_type: string; sensitive: number }>(env.DB, "SELECT r2_key, name, content_type, sensitive FROM client_files WHERE id = ? AND client_id = ?", fileId, clientId);
  if (!row || !f) throw notFound("File not found.");
  const allowed = (await canOpen(env, a, row)) && (a.kind === "client" || !f.sensitive || hasSensitivePerm(a, "tax.taxDocs") || hasSensitivePerm(a, "tax.downloadSensitive"));
  if (!allowed) {
    await audit(env.DB, a, { action: "Sensitive reveal", resource: `Client ${clientId} — file ${fileId}`, meta: "Download denied", success: false });
    throw forbidden("You don't have permission to open this file.");
  }
  const obj = await env.FILES.get(f.r2_key);
  if (!obj) throw notFound("File not found.");
  await audit(env.DB, a, { action: "Sensitive reveal", resource: `Client ${clientId} — ${f.name}`, meta: inline ? "Viewed" : "Downloaded" });
  const safeName = f.name.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(obj.body, {
    headers: {
      "content-type": f.content_type,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
