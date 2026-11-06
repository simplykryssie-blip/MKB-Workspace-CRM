import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { mfaSetupConfirm, mfaSetupStart } from "@/lib/server/auth";

/** Start: returns the secret for the authenticator app. */
export const POST = handle(async (req, env) => jsonResponse(await mfaSetupStart(env, req)));
/** Confirm with the first 6-digit code. */
export const PUT = handle(async (req, env) => {
  await mfaSetupConfirm(env, req, str((await body(req)).code, 10));
  return jsonResponse({ ok: true });
});
