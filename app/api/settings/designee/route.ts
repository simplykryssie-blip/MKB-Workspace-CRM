import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getDesignee, saveDesignee } from "@/lib/server/f8821";

/** Staff-only IRS designee details used on Form 8821. */
export const GET = handle(async (req, env) => jsonResponse(await getDesignee(env, await authenticate(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveDesignee(env, await authenticate(env, req), await body(req))));
