import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { startManualServiceIntake } from "@/lib/server/service-intake";

/** { kind } — open a service intake for staff to fill in manually (nothing is sent to the client). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await startManualServiceIntake(env, await authenticate(env, req), String(id), await body(req))));
