import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteClosure } from "@/lib/server/firm";

export const DELETE = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await deleteClosure(env, await authenticate(env, req), id)));
