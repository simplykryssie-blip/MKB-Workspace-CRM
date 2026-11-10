import { handle, jsonResponse } from "@/lib/server/core";
import { resendLoginCode } from "@/lib/server/auth";

/** Emails a new sign-in code (rate-limited). */
export const POST = handle(async (req, env) => { await resendLoginCode(env, req); return jsonResponse({ ok: true }); });
