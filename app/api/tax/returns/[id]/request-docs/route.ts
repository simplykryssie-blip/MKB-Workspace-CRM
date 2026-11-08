import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { emailDocumentRequest } from "@/lib/server/tax";

/** { names: string[] } — emails the client the documents still needed. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await emailDocumentRequest(env, await authenticate(env, req), id, (await body<{ names?: unknown }>(req)).names)));
