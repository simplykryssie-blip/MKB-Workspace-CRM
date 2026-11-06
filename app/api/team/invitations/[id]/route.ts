import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { invitationAction } from "@/lib/server/team-admin";

/** { action: "resend" | "cancel" } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  await invitationAction(env, req, await authenticate(env, req), id, str((await body(req)).action, 20));
  return jsonResponse({ ok: true });
});
