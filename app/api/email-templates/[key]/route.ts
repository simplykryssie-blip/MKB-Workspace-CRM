import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveTemplate } from "@/lib/server/email";

/** { wording } to save, or { reset: true } to go back to the default. */
export const PUT = handle<{ key: string }>(async (req, env, { key }) => jsonResponse(await saveTemplate(env, await authenticate(env, req), key, await body(req))));
