import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveBiz, type BizKind } from "@/lib/server/biz";

const KINDS: Record<string, BizKind> = { requests: "biz_request", entities: "biz_entity", items: "biz_item" };
export const PUT = handle<{ kind: string; id: string }>(async (req, env, { kind, id }) => {
  const k = KINDS[kind];
  if (!k) throw badRequest("Unknown record type.");
  return jsonResponse({ record: await saveBiz(env, await authenticate(env, req), k, id, (await body<{ record: never }>(req, 450_000)).record) });
});
