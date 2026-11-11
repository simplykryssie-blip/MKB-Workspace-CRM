import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listThreads, replyText } from "@/lib/server/sms";

/** ?brand — conversations, newest first, with unread counts. */
export const GET = handle(async (req, env) => jsonResponse(await listThreads(env, await authenticate(env, req), new URL(req.url).searchParams.get("brand") ?? "")));
/** { brand, phone, body } — reply (or start a conversation). */
export const POST = handle(async (req, env) => jsonResponse(await replyText(env, await authenticate(env, req), await body(req))));
