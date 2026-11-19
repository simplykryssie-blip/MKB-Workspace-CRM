import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { myOnboarding, signDoc } from "@/lib/server/staff-onboarding";

/** The signed-in team member's own onboarding: documents to sign and where they stand. */
export const GET = handle(async (req, env) => jsonResponse(await myOnboarding(env, await authenticate(env, req))));
/** { key, version, name, signature, agree } — sign one document. */
export const POST = handle(async (req, env) => jsonResponse(await signDoc(env, req, await authenticate(env, req), await body(req))));
