import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { remindDocuments } from "@/lib/server/documents";

export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await remindDocuments(env, await authenticate(env, req), id, await body(req))));
