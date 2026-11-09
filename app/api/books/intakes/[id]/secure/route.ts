import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { revealIntakeSecure, setIntakeSecure } from "@/lib/server/books-intake";

/** { key, value } — saves a full account or routing number, encrypted. */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await setIntakeSecure(env, await authenticate(env, req), id, await body(req))));
/** { key } — reveals it (bank-number permission; audited). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await revealIntakeSecure(env, await authenticate(env, req), id, await body(req))));
