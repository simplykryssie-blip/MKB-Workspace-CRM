import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listLetters } from "@/lib/server/engagement";

/** Current engagement letters and their version history. */
export const GET = handle(async (req, env) => jsonResponse(await listLetters(env, await authenticate(env, req))));
