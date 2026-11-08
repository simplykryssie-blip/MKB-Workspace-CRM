import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { completeIntake } from "@/lib/server/tax";

/** { request?: string[], email?: boolean } — saves the PDF copy to Documents and emails the client. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await completeIntake(env, await authenticate(env, req), id, await body(req))));
