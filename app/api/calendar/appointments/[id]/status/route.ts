import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { setAppointmentStatus } from "@/lib/server/calendar";

/** { status: scheduled | completed | cancelled | no_show } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await setAppointmentStatus(env, await authenticate(env, req), id, await body(req))));
