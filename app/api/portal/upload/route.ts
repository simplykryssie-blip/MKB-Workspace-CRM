import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalUpload } from "@/lib/server/portal";

/** Raw file body (x-file-name header); ?doc= answers a requested document, else ?service=&note= for an extra one. */
export const POST = handle(async (req, env) => {
  const q = new URL(req.url).searchParams;
  return jsonResponse(await portalUpload(env, await authenticate(env, req), req, { doc: q.get("doc"), service: q.get("service"), note: q.get("note") }));
}, { rawBody: true });
