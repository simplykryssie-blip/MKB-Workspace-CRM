import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { resendConfirmation } from "@/lib/server/booking";

/** Emails the confirmation (and a fresh reschedule/cancel link) again. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await resendConfirmation(env, await authenticate(env, req), id)));
