import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalSecureSsn } from "@/lib/server/portal";

/** { doc, value } — the client enters a Social Security number MKB asked for; it's encrypted on arrival and only the last 4 are kept readable. */
export const POST = handle(async (req, env) => jsonResponse(await portalSecureSsn(env, await authenticate(env, req), await body(req, 2048))));
