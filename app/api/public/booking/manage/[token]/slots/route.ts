import { handle, jsonResponse } from "@/lib/server/core";
import { manageSlots } from "@/lib/server/booking";

/** Public, private link: open times to move to (same person, same type). */
export const GET = handle<{ token: string }>(async (_req, env, { token }) => jsonResponse(await manageSlots(env, token)));
