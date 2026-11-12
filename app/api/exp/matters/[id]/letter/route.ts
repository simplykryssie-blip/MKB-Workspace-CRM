import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { expLetter } from "@/lib/server/exp";

export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await expLetter(env, await authenticate(env, req), id)));
