import { clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicProposal } from "@/lib/server/books-intake";

/** Public (private link, no sign-in): the reviewed proposal and the engagement letter. */
export const GET = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicProposal(env, token, clientIp(req)), 200, { "referrer-policy": "no-referrer", "x-robots-tag": "noindex" }));
