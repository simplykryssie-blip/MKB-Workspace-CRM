import { clientIp, handle, jsonResponse } from "@/lib/server/core";
import { receiveHandoff } from "@/lib/server/calculator";

/** One-time, password-armed hand-off of a customer's lead webhook from the old Monarch app (server to server). */
export const POST = handle(async (req, env) => jsonResponse(await receiveHandoff(env, req, clientIp(req))), { signedExternal: true, rawBody: true });
