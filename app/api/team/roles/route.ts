import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { duplicateRole } from "@/lib/server/team-admin";

/** Duplicate a role: { fromId, id, name } */
export const POST = handle(async (req, env) => {
  const b = await body(req);
  return jsonResponse({ role: await duplicateRole(env, await authenticate(env, req), str(b.fromId, 60), str(b.id, 60), str(b.name, 60)) }, 201);
});
