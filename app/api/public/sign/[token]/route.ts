import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSignature, submitSignature } from "@/lib/server/signatures";

/** Public (private link, no sign-in): the document to read. */
export const GET = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSignature(env, token, clientIp(req))));
/** { name, signature, agree } — signs it. */
export const POST = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await submitSignature(env, token, clientIp(req), await body(req))));
