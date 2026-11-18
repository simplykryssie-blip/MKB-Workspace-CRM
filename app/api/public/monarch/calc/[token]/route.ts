import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { setupAction, setupView } from "@/lib/server/calculator";

/** A customer's private calculator setup page (the token is the only key). */
export const GET = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await setupView(env, token, clientIp(req)), 200, { "cache-control": "no-store" }));
export const POST = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await setupAction(env, token, clientIp(req), await body(req)), 200, { "cache-control": "no-store" }));
