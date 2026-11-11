import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { billNow } from "@/lib/server/books-billing";

/** { period: "YYYY-MM", send? } — creates (and by default emails) the month's bookkeeping invoice. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await billNow(env, await authenticate(env, req), id, await body(req))));
