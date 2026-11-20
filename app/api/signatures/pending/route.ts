import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { pendingSignatures } from "@/lib/server/signatures";

/** Every document still waiting for a client's signature (services the person can see). */
export const GET = handle(async (req, env) => jsonResponse(await pendingSignatures(env, await authenticate(env, req))));
