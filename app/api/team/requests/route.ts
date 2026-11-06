import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { requestAccess } from "@/lib/server/team-admin";

export const POST = handle(async (req, env) => jsonResponse(await requestAccess(env, await authenticate(env, req), await body(req)), 201));
