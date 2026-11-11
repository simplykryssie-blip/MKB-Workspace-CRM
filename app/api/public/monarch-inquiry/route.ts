import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { websiteInquiry } from "@/lib/server/monarch";

/** Public: Monarch website contact form → a new "Interested" office. */
export const POST = handle(async (req, env) => jsonResponse(await websiteInquiry(env, clientIp(req), await body(req, 16_000)), 201));
