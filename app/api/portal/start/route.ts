import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalStart } from "@/lib/server/portal";

/** { kind, id } — opens the client's tax interview, bookkeeping intake or proposal. */
export const POST = handle(async (req, env) => jsonResponse(await portalStart(env, await authenticate(env, req), await body(req))));
