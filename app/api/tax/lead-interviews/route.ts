import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { leadInterviewsOut } from "@/lib/server/tax";

/** How many tax interviews sent to leads are still waiting on them. */
export const GET = handle(async (req, env) => jsonResponse(await leadInterviewsOut(env, await authenticate(env, req))));
