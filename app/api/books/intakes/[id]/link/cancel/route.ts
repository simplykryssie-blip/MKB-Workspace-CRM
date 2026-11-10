import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { cancelIntakeLink } from "@/lib/server/books-intake";

/** Cancels the intake's private link — it stops working at once. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await cancelIntakeLink(env, await authenticate(env, req), id)));
