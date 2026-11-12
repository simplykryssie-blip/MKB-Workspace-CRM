import { handle, jsonResponse } from "@/lib/server/core";
import { inboundEmail } from "@/lib/server/email-inbound";

/** Resend → MKB: a client's email reply, verified by the webhook signature. */
export const POST = handle(async (req, env) => jsonResponse(await inboundEmail(env, req)), { rawBody: true, signedExternal: true });
