import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { sendProposal } from "@/lib/server/books-intake";

/** { email } — emails the client a private link to review the proposal and sign the engagement letter. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await sendProposal(env, await authenticate(env, req), id, await body(req))));
