import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getBookingSettings, saveBookingSettings } from "@/lib/server/booking";

/** Online booking rules, Zoom keys (secret never returned) and the booking links. */
export const GET = handle(async (req, env) => jsonResponse(await getBookingSettings(env, await authenticate(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveBookingSettings(env, await authenticate(env, req), await body(req))));
