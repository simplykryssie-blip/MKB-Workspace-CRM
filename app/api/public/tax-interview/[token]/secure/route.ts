import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSecureTaxInterview } from "@/lib/server/tax-link";

/** { key, kind, value } — saves a full SSN/EIN/bank number encrypted; returns only the last 4. */
export const PUT = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSecureTaxInterview(env, token, clientIp(req), await body(req))));
