import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { recordPayment } from "@/lib/server/billing";

/** { amount, method, reference?, receivedAt?, note? } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await recordPayment(env, await authenticate(env, req), id, await body(req))));
