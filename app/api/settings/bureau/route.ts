import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getBureau, saveBureau } from "@/lib/server/f8821";

/** Staff-only service bureau details (EFIN, ETIN…); blank Form 8821 designee details fall back to them. */
export const GET = handle(async (req, env) => jsonResponse(await getBureau(env, await authenticate(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveBureau(env, await authenticate(env, req), await body(req))));
