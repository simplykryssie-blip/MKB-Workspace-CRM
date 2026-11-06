import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listAudit } from "@/lib/server/team";

export const GET = handle(async (req, env) => jsonResponse({ events: await listAudit(env, await authenticate(env, req), new URL(req.url).searchParams) }));
