import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createSignature, listSignatures } from "@/lib/server/signatures";

/** The client's online signature requests (and manually entered intakes that can be sent for review). */
export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await listSignatures(env, await authenticate(env, req), id)));
/** { kind, service, title?, body?, intakeId?, message?, email? } — sends a document to sign by private link. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await createSignature(env, await authenticate(env, req), id, await body(req))));
