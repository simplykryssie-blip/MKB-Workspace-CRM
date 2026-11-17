import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getFunnels, saveFunnels } from "@/lib/server/funnels";

/** Campaign funnels: the Money Vault page switch and the Meta Pixel / Google Analytics IDs (Settings access). */
export const GET = handle(async (req, env) => jsonResponse(await getFunnels(env, await authenticate(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveFunnels(env, await authenticate(env, req), await body(req))));
