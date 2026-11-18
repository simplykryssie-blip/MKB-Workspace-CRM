import { clientIp, handle, jsonResponse } from "@/lib/server/core";
import { downloadView } from "@/lib/server/monarch-store";

export const GET = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await downloadView(env, token, clientIp(req)), 200, { "cache-control": "no-store" }));
