import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSubmitTaxInterview } from "@/lib/server/tax-link";

/** { answers, rev, consentName, signature, engagement? } — signs and submits; the link then stops working. */
export const POST = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSubmitTaxInterview(env, token, clientIp(req), await body(req, 900_000))));
