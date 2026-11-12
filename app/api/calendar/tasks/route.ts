import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveTask } from "@/lib/server/calendar";

/** Creates or (with id and rev) updates a task. */
export const POST = handle(async (req, env) => jsonResponse(await saveTask(env, await authenticate(env, req), await body(req))));
