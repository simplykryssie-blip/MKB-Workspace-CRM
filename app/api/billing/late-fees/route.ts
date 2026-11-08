import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { applyLateFees, lateFeeCandidates } from "@/lib/server/billing";

/** Invoices with late fees due under the terms in Settings → Fees. */
export const GET = handle(async (req, env) => jsonResponse(await lateFeeCandidates(env, await authenticate(env, req))));
/** { ids } — adds the late fees that are due to those invoices. */
export const POST = handle(async (req, env) => jsonResponse(await applyLateFees(env, await authenticate(env, req), await body(req))));
