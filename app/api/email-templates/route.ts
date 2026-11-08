import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listTemplates } from "@/lib/server/email";

/** Wording of every automatic client email. */
export const GET = handle(async (req, env) => jsonResponse(await listTemplates(env, await authenticate(env, req))));
