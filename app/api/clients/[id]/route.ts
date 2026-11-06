import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getClient } from "@/lib/server/clients";

export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await getClient(env, await authenticate(env, req), id)));
