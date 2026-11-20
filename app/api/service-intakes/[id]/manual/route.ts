import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { manualSaveServiceIntake, manualServiceIntake } from "@/lib/server/service-intake";

/** A service intake being entered manually by staff: load it, and save answers as you go. */
export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await manualServiceIntake(env, await authenticate(env, req), String(id))));
export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await manualSaveServiceIntake(env, await authenticate(env, req), String(id), await body(req))));
