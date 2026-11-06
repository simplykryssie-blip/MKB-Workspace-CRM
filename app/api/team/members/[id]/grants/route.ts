import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { setGrant } from "@/lib/server/team";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body(req);
  await setGrant(env, await authenticate(env, req), id, str(b.key, 60), b.on === true);
  return jsonResponse({ ok: true });
});
