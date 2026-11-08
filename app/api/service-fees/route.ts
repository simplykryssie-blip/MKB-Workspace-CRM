import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getFees, saveFees } from "@/lib/server/settings";

/** Service prices (bookkeeping plans, expungement, late terms). */
export const GET = handle(async (req, env) => jsonResponse(await getFees(env, await authenticate(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveFees(env, await authenticate(env, req), await body(req))));
