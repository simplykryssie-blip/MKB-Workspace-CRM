import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { doneFollowUp } from "@/lib/server/calendar";

/** Marks a lead follow-up done (shown in the planner). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await doneFollowUp(env, await authenticate(env, req), id)));
