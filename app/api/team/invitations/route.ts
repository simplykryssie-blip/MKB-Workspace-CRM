import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { invite } from "@/lib/server/team";

export const POST = handle(async (req, env) => jsonResponse(await invite(env, req, await authenticate(env, req), await body(req)), 201));
