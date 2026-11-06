import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveReturn, type ReturnSnapshot } from "@/lib/server/tax";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse({ return: await saveReturn(env, await authenticate(env, req), id, (await body<{ return: ReturnSnapshot }>(req)).return) }));
