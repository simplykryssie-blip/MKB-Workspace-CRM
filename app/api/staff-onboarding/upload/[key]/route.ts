import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { uploadDoc } from "@/lib/server/staff-onboarding";

/** Upload a document (e.g. the W-8BEN / W-9 tax form). Raw file body, x-file-name header. */
export const POST = handle<{ key: string }>(async (req, env, { key }) => jsonResponse(await uploadDoc(env, req, await authenticate(env, req), String(key))), { rawBody: true });
