import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { acceptLead } from "@/lib/server/prospects";

/** Accept as client — the lead's prospect record (with their intake) becomes a client. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await acceptLead(env, await authenticate(env, req), id)));
