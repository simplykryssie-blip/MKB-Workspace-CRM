import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveMyCalendar } from "@/lib/server/calendar";

/** { color, memberId? } — calendar color. */
export const PUT = handle(async (req, env) => jsonResponse(await saveMyCalendar(env, await authenticate(env, req), await body(req))));
