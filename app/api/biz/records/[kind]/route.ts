import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createBiz, type BizKind } from "@/lib/server/biz";

const KINDS: Record<string, BizKind> = { requests: "biz_request", entities: "biz_entity", items: "biz_item" };
export const POST = handle<{ kind: string }>(async (req, env, { kind }) => {
  const k = KINDS[kind];
  if (!k) throw badRequest("Unknown record type.");
  return jsonResponse({ record: await createBiz(env, await authenticate(env, req), k, (await body<{ record: never }>(req, 450_000)).record) }, 201);
});
