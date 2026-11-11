import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { audienceOptions, previewAudience } from "@/lib/server/campaigns";

/** Stages and tags for the audience builder. */
export const GET = handle(async (req, env) => jsonResponse(await audienceOptions(env, await authenticate(env, req))));
/** { brand, filters } — how many people it reaches, and who's skipped. */
export const POST = handle(async (req, env) => jsonResponse(await previewAudience(env, await authenticate(env, req), await body(req))));
