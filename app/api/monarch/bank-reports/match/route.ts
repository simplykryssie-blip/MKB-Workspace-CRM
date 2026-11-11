import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { matchEfin } from "@/lib/server/monarch-bank";

/** { efin, officeId } — ties a bank report EFIN to an office. */
export const POST = handle(async (req, env) => jsonResponse(await matchEfin(env, await authenticate(env, req), await body(req))));
