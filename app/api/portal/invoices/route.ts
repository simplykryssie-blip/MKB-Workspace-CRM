import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalInvoices } from "@/lib/server/portal";

/** The client's invoices. */
export const GET = handle(async (req, env) => jsonResponse(await portalInvoices(env, await authenticate(env, req))));
