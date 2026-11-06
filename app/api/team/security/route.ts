import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getSecurity, saveSecurity } from "@/lib/server/team";

export const GET = handle(async (req, env) => jsonResponse(await getSecurity(env, await authenticate(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveSecurity(env, await authenticate(env, req), await body(req))));
