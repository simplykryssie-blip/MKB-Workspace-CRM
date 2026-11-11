import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getSmsSettings, saveSmsSettings } from "@/lib/server/sms";

/** Twilio account, the two numbers, and the webhook addresses to paste into Twilio. The token is never returned. */
export const GET = handle(async (req, env) => jsonResponse(await getSmsSettings(env, await authenticate(env, req))));
/** { accountSid, authToken?, mkbNumber, monarchNumber } — the token is stored encrypted. */
export const PUT = handle(async (req, env) => jsonResponse(await saveSmsSettings(env, await authenticate(env, req), await body(req))));
