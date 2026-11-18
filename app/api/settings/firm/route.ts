import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getFirm, saveFirm } from "@/lib/server/firm";

/** The firm's own details and office closed days (staff read; settings permission to change). */
export const GET = handle(async (req, env) => jsonResponse(await getFirm(env, await authenticate(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveFirm(env, await authenticate(env, req), await body(req))));
