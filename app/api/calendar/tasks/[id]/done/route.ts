import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { toggleTask } from "@/lib/server/calendar";

/** { done } — finishing a repeating task adds the next one. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await toggleTask(env, await authenticate(env, req), id, await body(req))));
