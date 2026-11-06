import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { decideRequest } from "@/lib/server/team-admin";

export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body(req);
  await decideRequest(env, await authenticate(env, req), id, b.approve === true, str(b.note, 500));
  return jsonResponse({ ok: true });
});
