import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteRole, saveRole } from "@/lib/server/team-admin";
import type { Role } from "@/lib/team/config";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body<{ role: Role; summary?: string }>(req);
  return jsonResponse({ role: await saveRole(env, await authenticate(env, req), id, b.role, str(b.summary, 500)) });
});
/** { action: "delete" } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  if ((await body(req)).action !== "delete") return jsonResponse({ error: "Unknown action." }, 400);
  await deleteRole(env, await authenticate(env, req), id);
  return jsonResponse({ ok: true });
});
