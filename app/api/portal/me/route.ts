import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalMe } from "@/lib/server/portal";

/** The signed-in client: name and unread messages. */
export const GET = handle(async (req, env) => jsonResponse(await portalMe(env, await authenticate(env, req))));
