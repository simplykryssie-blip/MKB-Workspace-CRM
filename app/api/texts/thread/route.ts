import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getThread } from "@/lib/server/sms";

/** ?brand&phone — one conversation (marks it read). */
export const GET = handle(async (req, env) => { const q = new URL(req.url).searchParams; return jsonResponse(await getThread(env, await authenticate(env, req), q.get("brand") ?? "", q.get("phone") ?? "")); });
