import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { markUnmatchedRead } from "@/lib/server/email-inbound";

export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await markUnmatchedRead(env, await authenticate(env, req), id)));
