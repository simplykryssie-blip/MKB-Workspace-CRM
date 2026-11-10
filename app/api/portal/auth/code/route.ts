import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { verifyLoginCode } from "@/lib/server/auth";

/** { code } — the 6-digit code we emailed; finishes signing in. */
export const POST = handle(async (req, env) => { await verifyLoginCode(env, req, str((await body(req)).code, 10)); return jsonResponse({ ok: true }); });
