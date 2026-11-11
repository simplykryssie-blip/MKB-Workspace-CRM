import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { previewCampaign } from "@/lib/server/campaigns";

/** { brand, content } — the email as it will look (sample person, no tracking). */
export const POST = handle(async (req, env) => jsonResponse(await previewCampaign(env, await authenticate(env, req), await body(req, 100_000))));
