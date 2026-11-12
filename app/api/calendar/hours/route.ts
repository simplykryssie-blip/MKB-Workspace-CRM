import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getMyHours, saveMyHours } from "@/lib/server/booking";

/** A staff member's booking hours (?member= for managers). */
export const GET = handle(async (req, env) => jsonResponse(await getMyHours(env, await authenticate(env, req), new URL(req.url).searchParams.get("member") ?? undefined)));
export const PUT = handle(async (req, env) => jsonResponse(await saveMyHours(env, await authenticate(env, req), await body(req))));
