import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalHome } from "@/lib/server/portal";

/** The client's services and to-do list. */
export const GET = handle(async (req, env) => jsonResponse(await portalHome(env, await authenticate(env, req))));
