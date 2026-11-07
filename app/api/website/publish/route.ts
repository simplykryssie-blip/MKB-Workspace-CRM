import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { publish } from "@/lib/server/website";

export const POST = handle(async (req, env) => jsonResponse(await publish(env, await authenticate(env, req), await body(req))));
