import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveFees } from "@/lib/server/tax";
import type { FeeItem } from "@/lib/tax/config";

export const PUT = handle(async (req, env) => {
  await saveFees(env, await authenticate(env, req), (await body<{ fees: FeeItem[] }>(req)).fees);
  return jsonResponse({ ok: true });
});
