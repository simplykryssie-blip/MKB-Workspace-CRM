import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { cancelSignature } from "@/lib/server/signatures";

/** Cancels a request waiting for a signature (its link stops working). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await cancelSignature(env, await authenticate(env, req), id)));
