import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { declineLead } from "@/lib/server/prospects";

/** { reason } — declines the lead after their intake (links stop; lead marked lost). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await declineLead(env, await authenticate(env, req), id, await body(req))));
