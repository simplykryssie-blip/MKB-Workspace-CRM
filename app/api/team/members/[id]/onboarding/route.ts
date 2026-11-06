import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { toggleOnboarding } from "@/lib/server/team-admin";

export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  await toggleOnboarding(env, await authenticate(env, req), id, str((await body(req)).step, 80));
  return jsonResponse({ ok: true });
});
