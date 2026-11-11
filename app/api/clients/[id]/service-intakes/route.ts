import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listServiceIntakes, sendServiceIntake } from "@/lib/server/service-intake";

/** The client's payroll, Business Solutions and Record Relief intakes. */
export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await listServiceIntakes(env, await authenticate(env, req), id)));
/** { kind: "payroll" | "biz" | "relief", email? } — emails the client the intake by private link. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await sendServiceIntake(env, await authenticate(env, req), id, await body(req))));
