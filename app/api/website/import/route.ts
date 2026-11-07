import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { importMkb } from "@/lib/server/website";

export const POST = handle(async (req, env) => {
  await importMkb(env, await authenticate(env, req));
  return jsonResponse({ ok: true }, 201);
});
