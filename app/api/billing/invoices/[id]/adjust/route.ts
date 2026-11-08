import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { adjustInvoice } from "@/lib/server/billing";

/** { kind: "refund" | "credit" | "correction", amount, note } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await adjustInvoice(env, await authenticate(env, req), id, await body(req))));
