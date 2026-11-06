import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveDepartment } from "@/lib/server/team-admin";
import type { Department } from "@/lib/team/config";

export const PUT = handle<{ key: string }>(async (req, env, { key }) => {
  await saveDepartment(env, await authenticate(env, req), key, (await body<{ department: Partial<Department> }>(req)).department ?? {});
  return jsonResponse({ ok: true });
});
