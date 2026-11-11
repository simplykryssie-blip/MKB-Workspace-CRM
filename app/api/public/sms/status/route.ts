import { handle } from "@/lib/server/core";
import { textStatus } from "@/lib/server/sms";

/** Twilio: delivery updates for texts we sent (checked with Twilio's signature). */
export const POST = handle(async (req, env) => textStatus(env, req), { signedExternal: true, rawBody: true });
