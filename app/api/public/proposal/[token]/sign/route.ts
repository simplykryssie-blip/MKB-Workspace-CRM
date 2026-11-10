import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSignProposal } from "@/lib/server/books-intake";

/** { name, signature, version, engagement: { version, termsVersion } } — signs; the link then stops working. */
export const POST = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSignProposal(env, token, clientIp(req), await body(req, 800_000))));
