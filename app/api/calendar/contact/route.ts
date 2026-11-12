import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { contactCalendar } from "@/lib/server/calendar";

/** ?type=client|lead|office&id — that person's appointments and tasks. */
export const GET = handle(async (req, env) => { const q = new URL(req.url).searchParams; return jsonResponse(await contactCalendar(env, await authenticate(env, req), { type: q.get("type") ?? undefined, id: q.get("id") ?? undefined })); });
