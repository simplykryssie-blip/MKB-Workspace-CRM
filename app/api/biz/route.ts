import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listBiz } from "@/lib/server/biz";

export const GET = handle(async (req, env) => jsonResponse(await listBiz(env, await authenticate(env, req))));
