import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listNotifications, markRead } from "@/lib/server/notifications";

/** The signed-in staff member's bell. */
export const GET = handle(async (req, env) => jsonResponse(await listNotifications(env, await authenticate(env, req))));
/** Mark some ({ids}) or all ({all: true}) as read. */
export const POST = handle(async (req, env) => jsonResponse(await markRead(env, await authenticate(env, req), await body(req))));
