import { handle, jsonResponse } from "@/lib/server/core";
import { bookingSlots } from "@/lib/server/booking";

/** Public: open start times for a type (?type=&member=any). */
export const GET = handle(async (req, env) => { const q = new URL(req.url).searchParams; return jsonResponse(await bookingSlots(env, { type: q.get("type") ?? undefined, member: q.get("member") ?? undefined })); });
