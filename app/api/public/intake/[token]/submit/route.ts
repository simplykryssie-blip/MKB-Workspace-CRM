import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSubmitIntake } from "@/lib/server/books-intake";

/** { answers, rev, consentName, engagement: { version, termsVersion } } — accepts the letter and submits; the link then stops working. */
export const POST = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSubmitIntake(env, token, clientIp(req), await body(req, 250_000))));
