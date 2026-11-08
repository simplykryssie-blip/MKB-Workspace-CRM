import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { sendInvoice } from "@/lib/server/billing-docs";

/** Emails the invoice PDF (with a fresh pay link for pay-upfront invoices). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await sendInvoice(env, await authenticate(env, req), id)));
