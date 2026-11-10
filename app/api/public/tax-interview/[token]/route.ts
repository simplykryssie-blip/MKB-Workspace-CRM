import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSaveTaxInterview, publicTaxInterview } from "@/lib/server/tax-link";

/** Public (private link, no sign-in): the tax interview. Full numbers are never included. */
export const GET = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicTaxInterview(env, token, clientIp(req)), 200, { "referrer-policy": "no-referrer", "x-robots-tag": "noindex" }));
/** { answers, rev } — saves progress. */
export const PUT = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSaveTaxInterview(env, token, clientIp(req), await body(req, 300_000))));
