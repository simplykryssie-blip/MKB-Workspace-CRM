import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { markReviewed } from "@/lib/server/team-admin";

export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  await markReviewed(env, await authenticate(env, req), id);
  return jsonResponse({ ok: true });
});
