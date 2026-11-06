import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { mfaVerify } from "@/lib/server/auth";

export const POST = handle(async (req, env) => {
  await mfaVerify(env, req, str((await body(req)).code, 10));
  return jsonResponse({ ok: true });
});
