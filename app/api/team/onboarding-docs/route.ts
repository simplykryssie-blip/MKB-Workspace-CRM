import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listDocs, saveDoc } from "@/lib/server/staff-onboarding";

/** Settings: the staff onboarding documents (current versions + history). */
export const GET = handle(async (req, env) => jsonResponse(await listDocs(env, await authenticate(env, req))));
/** Save an edit or a new document (a new version; old versions are kept). */
export const POST = handle(async (req, env) => jsonResponse(await saveDoc(env, await authenticate(env, req), await body(req))));
