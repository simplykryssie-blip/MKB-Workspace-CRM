import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { sendIntakeLink } from "@/lib/server/books-intake";

/** { email } — emails the client a private link to fill in this intake (replaces any earlier link). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await sendIntakeLink(env, await authenticate(env, req), id, await body(req))));
