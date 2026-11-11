import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { notifyBooks } from "@/lib/server/books-notify";

/** { kind: "items" | "reminder" | "reports", period, items } — emails the client about their bookkeeping month. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await notifyBooks(env, await authenticate(env, req), id, await body(req))));
