import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { importIdentifiers } from "@/lib/server/import-identifiers";

/** Owner-only CSV upload (raw body). ?apply=1 saves (otherwise a preview); ?overwrite=1 replaces numbers already on file. */
export const POST = handle(async (req, env) => {
  const q = new URL(req.url).searchParams;
  return jsonResponse(await importIdentifiers(env, await authenticate(env, req), req, { apply: q.get("apply") === "1", overwrite: q.get("overwrite") === "1" }));
}, { rawBody: true });
