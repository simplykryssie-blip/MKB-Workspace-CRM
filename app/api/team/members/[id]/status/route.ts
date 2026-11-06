import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { setStatus } from "@/lib/server/team";

export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body(req);
  await setStatus(env, await authenticate(env, req), id, str(b.action, 30), str(b.reason, 500), str(b.sessionId, 20));
  return jsonResponse({ ok: true });
});
