import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteTemplate } from "@/lib/server/campaigns";

export const DELETE = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await deleteTemplate(env, await authenticate(env, req), id)));
