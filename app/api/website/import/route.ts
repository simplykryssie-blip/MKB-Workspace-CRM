import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { importMkb, siteParam, startMonarch } from "@/lib/server/website";

export const POST = handle(async (req, env) => {
  const a = await authenticate(env, req);
  if (siteParam(req) === "monarch") await startMonarch(env, a);
  else await importMkb(env, a);
  return jsonResponse({ ok: true }, 201);
});
