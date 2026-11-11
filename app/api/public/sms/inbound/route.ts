import { handle } from "@/lib/server/core";
import { inboundText } from "@/lib/server/sms";

/** Twilio: a text came in to one of our numbers (checked with Twilio's signature). */
export const POST = handle(async (req, env) => inboundText(env, req), { signedExternal: true, rawBody: true });
