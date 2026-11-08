import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { discardImport } from "@/lib/server/bank-import";

export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await discardImport(env, await authenticate(env, req), id)));
