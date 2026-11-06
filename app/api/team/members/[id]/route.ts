import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { updateProfile } from "@/lib/server/team-admin";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  await updateProfile(env, await authenticate(env, req), id, await body(req));
  return jsonResponse({ ok: true });
});
