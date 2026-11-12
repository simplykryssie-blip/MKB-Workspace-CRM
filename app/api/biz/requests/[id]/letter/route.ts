import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { bizLetter } from "@/lib/server/biz";

export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await bizLetter(env, await authenticate(env, req), id)));
