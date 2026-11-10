import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveProposal } from "@/lib/server/books-intake";

/** { plan, lines, message, rev } — saves MKB's reviewed price. */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await saveProposal(env, await authenticate(env, req), id, await body(req))));
