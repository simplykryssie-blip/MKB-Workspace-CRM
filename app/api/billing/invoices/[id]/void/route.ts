import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { voidInvoice } from "@/lib/server/billing";

/** { reason } — only invoices with no payments. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await voidInvoice(env, await authenticate(env, req), id, await body(req))));
