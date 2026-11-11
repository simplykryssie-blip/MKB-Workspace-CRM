import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteAudience } from "@/lib/server/campaigns";

export const DELETE = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await deleteAudience(env, await authenticate(env, req), id)));
