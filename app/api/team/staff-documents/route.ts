import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { allStaffDocs } from "@/lib/server/staff-onboarding";

/** Every team member's onboarding documents and identity status (members the viewer manages). */
export const GET = handle(async (req, env) => jsonResponse(await allStaffDocs(env, await authenticate(env, req))));
