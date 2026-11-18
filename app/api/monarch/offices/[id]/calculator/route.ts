import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { calcAction, getCalc } from "@/lib/server/calculator";

/** Staff: an office's tax calculator license(s) — status, websites, lead delivery. */
export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await getCalc(env, await authenticate(env, req), id)));
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await calcAction(env, await authenticate(env, req), id, await body(req))));
