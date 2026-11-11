import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { cancelServiceIntakeLink } from "@/lib/server/service-intake";

/** Cancels the intake's private link. */
export const DELETE = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await cancelServiceIntakeLink(env, await authenticate(env, req), id)));
