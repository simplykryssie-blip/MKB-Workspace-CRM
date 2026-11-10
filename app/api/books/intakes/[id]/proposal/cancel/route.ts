import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { cancelProposalLink } from "@/lib/server/books-intake";

/** Cancels the proposal link — it stops working at once. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await cancelProposalLink(env, await authenticate(env, req), id)));
