import { clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicUpload } from "@/lib/server/monarch-link";

/** Public (private link): uploads a file for one checklist item (raw body, x-file-name header, ?item=). */
export const POST = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicUpload(env, token, clientIp(req), req, new URL(req.url).searchParams.get("item") ?? ""), 200, { "referrer-policy": "no-referrer" }), { rawBody: true });
