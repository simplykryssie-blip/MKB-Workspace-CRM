import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getInvoiceRow, invoicePayments, toInvoice, updateInvoice } from "@/lib/server/billing";

/** One invoice with its payments. */
export const GET = handle<{ id: string }>(async (req, env, { id }) => {
  const r = await getInvoiceRow(env, await authenticate(env, req), id);
  return jsonResponse({ invoice: { ...toInvoice(r), clientId: r.client_id }, payments: await invoicePayments(env, id) });
});
/** Edits an invoice that has no payments yet. */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await updateInvoice(env, await authenticate(env, req), id, await body(req))));
