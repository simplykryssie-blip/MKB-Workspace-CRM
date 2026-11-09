import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getIntake, saveIntake } from "@/lib/server/books-intake";

export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await getIntake(env, await authenticate(env, req), id)));
/** { answers?, step?, rev, workspaceId? } */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await saveIntake(env, await authenticate(env, req), id, await body(req, 250_000))));
