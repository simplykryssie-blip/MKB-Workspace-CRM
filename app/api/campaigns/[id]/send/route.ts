import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { sendCampaign } from "@/lib/server/campaigns";

/** { at? } — send now, or schedule for `at` (ISO time). Needs Campaigns "Approve". */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await sendCampaign(env, await authenticate(env, req), id, await body(req))));
