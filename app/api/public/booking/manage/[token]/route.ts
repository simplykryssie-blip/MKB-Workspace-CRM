import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { manageAction, manageView } from "@/lib/server/booking";

/** Public, private link: the person's appointment. */
export const GET = handle<{ token: string }>(async (_req, env, { token }) => jsonResponse(await manageView(env, token)));
/** { action: "cancel" | "reschedule" | "release", at? } */
export const POST = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await manageAction(env, token, await body(req), clientIp(req))));
