import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { manualSubmitServiceIntake } from "@/lib/server/service-intake";

/** { answers, rev, requestDocs, emailCopy } — save as manually entered (PDF to Documents). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await manualSubmitServiceIntake(env, await authenticate(env, req), String(id), await body(req))));
