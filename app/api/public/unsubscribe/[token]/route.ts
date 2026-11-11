import { handle, jsonResponse } from "@/lib/server/core";
import { unsubscribe, unsubscribeInfo } from "@/lib/server/campaigns";

/** What the unsubscribe page shows. */
export const GET = handle<{ token: string }>(async (_req, env, { token }) => jsonResponse(await unsubscribeInfo(env, token), 200, { "x-robots-tag": "noindex" }));
/** Unsubscribes — from our page, or one-click from the mail app (List-Unsubscribe-Post). The signed token is the proof. */
export const POST = handle<{ token: string }>(async (_req, env, { token }) => jsonResponse(await unsubscribe(env, token)), { signedExternal: true });
