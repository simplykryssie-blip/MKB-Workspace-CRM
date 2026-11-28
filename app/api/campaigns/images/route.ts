import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { campaignImages, uploadCampaignImage } from "@/lib/server/campaigns";

/** ?brand= — photos to pick for an email (the brand's media library). */
export const GET = handle(async (req, env) => jsonResponse(await campaignImages(env, await authenticate(env, req), new URL(req.url).searchParams.get("brand") ?? "")));
/** ?brand= — upload a photo (raw image body, x-file-name header). */
export const POST = handle(async (req, env) => jsonResponse(await uploadCampaignImage(env, await authenticate(env, req), req, new URL(req.url).searchParams.get("brand") ?? "")), { rawBody: true });
