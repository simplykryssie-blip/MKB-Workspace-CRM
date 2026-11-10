import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalCompleteTask } from "@/lib/server/portal";

/** { response? } — the client marks a bookkeeping item done. */
export const POST = handle<{ wsId: string; taskId: string }>(async (req, env, { wsId, taskId }) => jsonResponse(await portalCompleteTask(env, await authenticate(env, req), wsId, taskId, await body(req))));
