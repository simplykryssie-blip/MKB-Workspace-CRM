import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSubmitServiceIntake } from "@/lib/server/service-intake";

/** { answers, rev, consentName, signature } — signs and submits; the link then stops working. */
export const POST = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSubmitServiceIntake(env, token, clientIp(req), await body(req, 800_000))));
