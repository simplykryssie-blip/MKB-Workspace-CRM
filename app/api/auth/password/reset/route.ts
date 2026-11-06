import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { resetPassword } from "@/lib/server/auth";

export const POST = handle(async (req, env) => {
  const b = await body(req);
  await resetPassword(env, req, str(b.token, 100), typeof b.password === "string" ? b.password : "");
  return jsonResponse({ ok: true });
});
