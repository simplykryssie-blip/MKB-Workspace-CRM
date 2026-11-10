import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { revokePortal } from "@/lib/server/portal-access";

/** Turns off the client's portal sign-in and signs them out. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await revokePortal(env, await authenticate(env, req), id)));
