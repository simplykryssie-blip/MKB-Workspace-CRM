import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { emailExtension } from "@/lib/server/tax";

/** Emails the client that their extension was filed. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await emailExtension(env, await authenticate(env, req), id)));
