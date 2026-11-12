import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { appOrigin } from "@/lib/server/identity";
import { inboundSettings, saveInboundSettings } from "@/lib/server/email-inbound";

export const GET = handle(async (req, env) => jsonResponse(await inboundSettings(env, await authenticate(env, req), appOrigin(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveInboundSettings(env, await authenticate(env, req), appOrigin(env, req), await body(req))));
