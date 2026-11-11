import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createCampaign, listCampaigns } from "@/lib/server/campaigns";

/** ?brand=mkb|monarch — campaigns, newest first. */
export const GET = handle(async (req, env) => jsonResponse(await listCampaigns(env, await authenticate(env, req), new URL(req.url).searchParams.get("brand") ?? "")));
/** { brand, name?, templateId?, copyOf? } — a new draft. */
export const POST = handle(async (req, env) => jsonResponse(await createCampaign(env, await authenticate(env, req), await body(req))));
