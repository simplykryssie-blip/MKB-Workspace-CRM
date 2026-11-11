import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { payCommissions } from "@/lib/server/monarch-sales";

/** { resellerId, ids? } — marks owed commissions as paid out. */
export const POST = handle(async (req, env) => jsonResponse(await payCommissions(env, await authenticate(env, req), await body(req))));
