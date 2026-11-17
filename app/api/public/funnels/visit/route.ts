import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { countVisit } from "@/lib/server/funnels";

/** Public (no sign-in): adds one to a funnel page's daily visit count. Nothing about the visitor is stored. */
export const POST = handle(async (req, env) => jsonResponse(await countVisit(env, ((await body(req)) as { funnel?: unknown }).funnel, clientIp(req))));
