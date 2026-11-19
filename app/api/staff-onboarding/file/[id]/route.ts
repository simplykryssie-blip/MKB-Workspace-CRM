import { handle } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { docFile } from "@/lib/server/staff-onboarding";

/** A signed onboarding PDF or uploaded form (the person themself, or someone who manages them). */
export const GET = handle<{ id: string }>(async (req, env, { id }) => docFile(env, await authenticate(env, req), String(id)));
