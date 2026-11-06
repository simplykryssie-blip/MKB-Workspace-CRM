import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicForm, publicSubmit } from "@/lib/server/forms";

/** Public (no sign-in): a published form's questions. */
export const GET = handle<{ slug: string }>(async (_req, env, { slug }) => jsonResponse({ form: await publicForm(env, slug) }));
/** Public (no sign-in): submit answers. Rate-limited; never returns any record. */
export const POST = handle<{ slug: string }>(async (req, env, { slug }) => jsonResponse(await publicSubmit(env, req, slug, await body(req), clientIp(req))));
