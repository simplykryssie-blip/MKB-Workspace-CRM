import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteTask } from "@/lib/server/calendar";

export const DELETE = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await deleteTask(env, await authenticate(env, req), id)));
