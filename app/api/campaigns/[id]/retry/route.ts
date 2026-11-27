import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { retryFailed } from "@/lib/server/campaigns";

/** Send again to this campaign's failed recipients (staff choice only). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await retryFailed(env, await authenticate(env, req), id)));
