import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { emailInboxSummary } from "@/lib/server/email-inbound";

export const GET = handle(async (req, env) => jsonResponse(await emailInboxSummary(env, await authenticate(env, req))));
