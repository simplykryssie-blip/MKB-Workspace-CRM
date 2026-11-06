import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { forgotPassword } from "@/lib/server/auth";

export const POST = handle(async (req, env) => {
  await forgotPassword(env, req, str((await body(req)).email, 200));
  // Same answer whether or not the email exists.
  return jsonResponse({ ok: true, message: "If that email has an account, a reset link is on its way." });
});
