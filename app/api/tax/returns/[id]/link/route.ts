import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { sendTaxInterviewLink, taxInterviewLinkStatus } from "@/lib/server/tax-link";

/** The return's latest interview link (never the link itself). */
export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await taxInterviewLinkStatus(env, await authenticate(env, req), id)));
/** { email } — emails the client a private link to this return's interview. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await sendTaxInterviewLink(env, await authenticate(env, req), id, await body(req))));
