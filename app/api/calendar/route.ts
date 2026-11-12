import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getCalendar } from "@/lib/server/calendar";

/** ?from&to&members=<ids>|all — appointments, tasks and follow-ups for those calendars. */
export const GET = handle(async (req, env) => { const q = new URL(req.url).searchParams; return jsonResponse(await getCalendar(env, await authenticate(env, req), { from: q.get("from") ?? undefined, to: q.get("to") ?? undefined, members: q.get("members") ?? undefined })); });
