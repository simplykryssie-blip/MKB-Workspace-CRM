import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listMembers } from "@/lib/server/team";

export const GET = handle(async (req, env) => jsonResponse({ members: await listMembers(env, await authenticate(env, req)) }));
