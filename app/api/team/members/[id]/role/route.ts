import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { changeRole } from "@/lib/server/team";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  await changeRole(env, await authenticate(env, req), id, str((await body(req)).roleId, 80));
  return jsonResponse({ ok: true });
});
