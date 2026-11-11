import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/campaigns";

/** Sender details for both brands, and today's email usage. */
export const GET = handle(async (req, env) => jsonResponse(await getSettings(env, await authenticate(env, req))));
