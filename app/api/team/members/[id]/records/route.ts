import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { setSelectedRecords } from "@/lib/server/team-admin";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  await setSelectedRecords(env, await authenticate(env, req), id, (await body(req)).clientIds);
  return jsonResponse({ ok: true });
});
