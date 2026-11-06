import { handle, jsonResponse } from "@/lib/server/core";
import { clearCookie, logout } from "@/lib/server/auth";

export const POST = handle(async (req, env) => {
  await logout(env, req);
  return jsonResponse({ ok: true }, 200, { "set-cookie": clearCookie(env, req) });
});
