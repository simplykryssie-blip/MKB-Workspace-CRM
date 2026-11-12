import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveType } from "@/lib/server/calendar";

/** Creates or updates an appointment type. */
export const POST = handle(async (req, env) => jsonResponse(await saveType(env, await authenticate(env, req), await body(req))));
