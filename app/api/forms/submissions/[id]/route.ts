import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { markSpam } from "@/lib/server/forms";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  await markSpam(env, await authenticate(env, req), id, (await body(req)).spam === true);
  return jsonResponse({ ok: true });
});
