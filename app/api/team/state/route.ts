import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { teamState } from "@/lib/server/team-admin";

export const GET = handle(async (req, env) => jsonResponse(await teamState(env, await authenticate(env, req))));
