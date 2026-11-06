import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { setDepartments } from "@/lib/server/team";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  await setDepartments(env, await authenticate(env, req), id, (await body(req)).departments);
  return jsonResponse({ ok: true });
});
