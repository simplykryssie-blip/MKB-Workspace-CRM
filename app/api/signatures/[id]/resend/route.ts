import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { resendSignature } from "@/lib/server/signatures";

/** { email? } — emails a new link; the old one stops working. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await resendSignature(env, await authenticate(env, req), id, await body(req))));
