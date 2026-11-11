import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { unreadTexts } from "@/lib/server/sms";

/** Unread incoming texts per brand (for the menu). */
export const GET = handle(async (req, env) => jsonResponse(await unreadTexts(env, await authenticate(env, req))));
