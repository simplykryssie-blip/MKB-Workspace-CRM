import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { list8821, prepare8821 } from "@/lib/server/f8821";

/** Form 8821 status for every tax client. */
export const GET = handle(async (req, env) => jsonResponse(await list8821(env, await authenticate(env, req))));
/** { clientId } or { all: true } — prepares forms that still need the client's signature. */
export const POST = handle(async (req, env) => jsonResponse(await prepare8821(env, await authenticate(env, req), await body(req))));
