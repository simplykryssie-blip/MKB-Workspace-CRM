import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createInvoice, listInvoices } from "@/lib/server/billing";

/** All invoices the signed-in person may see (?clientId= for one client). */
export const GET = handle(async (req, env) => jsonResponse(await listInvoices(env, await authenticate(env, req), new URL(req.url).searchParams.get("clientId") ?? undefined)));
/** Creates an invoice; the server totals the lines and assigns the number. */
export const POST = handle(async (req, env) => jsonResponse(await createInvoice(env, await authenticate(env, req), await body(req))));
