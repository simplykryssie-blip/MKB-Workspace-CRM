import { clientIp, handle, jsonResponse } from "@/lib/server/core";
import { forwardLead } from "@/lib/server/calculator";

/** The lead form inside a licensed calculator: forwarded to the customer's own webhook, never stored. */
export const POST = handle(async (req, env) => jsonResponse(await forwardLead(env, req, clientIp(req)), 200, { "cache-control": "no-store" }), { signedExternal: true, rawBody: true });
