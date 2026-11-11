import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { loadAll, saveSettings } from "@/lib/server/monarch";

/** Everything the Monarch workspace shows (staff with the Monarch permission). */
export const GET = handle(async (req, env) => jsonResponse(await loadAll(env, await authenticate(env, req))));
/** Monarch settings: { linkDays?, closeOnActive?, phone?, email?, agreement? }. */
export const PUT = handle(async (req, env) => jsonResponse(await saveSettings(env, await authenticate(env, req), await body(req, 100_000))));
