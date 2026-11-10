import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { leadIntakes, sendLeadIntake } from "@/lib/server/prospects";

/** The lead's intake forms (sent before they're a client). */
export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await leadIntakes(env, await authenticate(env, req), id)));
/** { kind: "books", email } — emails the lead an intake by private link. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await sendLeadIntake(env, await authenticate(env, req), id, await body(req))));
