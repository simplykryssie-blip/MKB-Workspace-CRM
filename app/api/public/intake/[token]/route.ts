import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicIntake, publicSaveIntake } from "@/lib/server/books-intake";

/** Public (private link, no sign-in): the client's intake. Full numbers are never included. */
export const GET = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicIntake(env, token, clientIp(req)), 200, { "referrer-policy": "no-referrer", "x-robots-tag": "noindex" }));
/** { answers?, step?, rev } — saves progress. */
export const PUT = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSaveIntake(env, token, clientIp(req), await body(req, 250_000))));
