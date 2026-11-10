import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { invitePortal, portalStatus } from "@/lib/server/portal-access";

/** The client's portal access (email, invited / active / turned off, last sign-in). */
export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await portalStatus(env, await authenticate(env, req), id)));
/** { email? } — invites the client to the portal (or re-sends the invitation). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await invitePortal(env, await authenticate(env, req), id, await body(req))));
