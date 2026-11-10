import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { cancelTaxInterviewLink } from "@/lib/server/tax-link";

/** Cancels the interview link — it stops working at once. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await cancelTaxInterviewLink(env, await authenticate(env, req), id)));
