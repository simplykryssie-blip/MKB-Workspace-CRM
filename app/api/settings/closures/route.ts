import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { addClosure } from "@/lib/server/firm";

/** Adds an office closed day (or range). */
export const POST = handle(async (req, env) => jsonResponse(await addClosure(env, await authenticate(env, req), await body(req)), 201));
