import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalMessages, portalSend } from "@/lib/server/portal";

/** The client's secure messages with MKB (marks them read). */
export const GET = handle(async (req, env) => jsonResponse(await portalMessages(env, await authenticate(env, req))));
/** { body, service? } — sends a secure message to the MKB team. */
export const POST = handle(async (req, env) => jsonResponse(await portalSend(env, await authenticate(env, req), await body(req))));
