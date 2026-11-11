import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { cancelCampaign } from "@/lib/server/campaigns";

/** Cancels a schedule (back to draft) or stops a campaign that's still sending. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await cancelCampaign(env, await authenticate(env, req), id)));
