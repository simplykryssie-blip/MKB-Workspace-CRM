import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveAppointment } from "@/lib/server/calendar";

/** Creates or (with id and rev) updates an appointment or time block. */
export const POST = handle(async (req, env) => jsonResponse(await saveAppointment(env, await authenticate(env, req), await body(req))));
