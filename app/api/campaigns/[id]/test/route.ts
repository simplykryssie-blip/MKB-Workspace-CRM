import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { testCampaign } from "@/lib/server/campaigns";

/** { to? } — a test copy (to you by default). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await testCampaign(env, await authenticate(env, req), id, await body(req))));
