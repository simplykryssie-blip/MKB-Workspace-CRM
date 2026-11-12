import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listExp } from "@/lib/server/exp";

export const GET = handle(async (req, env) => jsonResponse(await listExp(env, await authenticate(env, req))));
