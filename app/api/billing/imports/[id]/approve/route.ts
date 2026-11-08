import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { approveImport } from "@/lib/server/bank-import";

/** { matches: [{ n, invoiceId }] } — applies the approved deposits as payments. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await approveImport(env, await authenticate(env, req), id, await body(req, 500_000))));
