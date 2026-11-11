import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicSaveServiceIntake, publicServiceIntake } from "@/lib/server/service-intake";

/** Public (private link, no sign-in): the client's payroll, Business Solutions or Record Relief intake. */
export const GET = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicServiceIntake(env, token, clientIp(req)), 200, { "referrer-policy": "no-referrer", "x-robots-tag": "noindex" }));
/** { answers?, step?, rev } — saves progress. */
export const PUT = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicSaveServiceIntake(env, token, clientIp(req), await body(req, 250_000))));
