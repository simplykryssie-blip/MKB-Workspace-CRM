import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getServiceIntake } from "@/lib/server/service-intake";

export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await getServiceIntake(env, await authenticate(env, req), id)));
