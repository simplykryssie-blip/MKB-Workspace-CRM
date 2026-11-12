import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createExp, type ExpKind } from "@/lib/server/exp";

const KINDS: Record<string, ExpKind> = { matters: "exp_matter", cases: "exp_case" };
export const POST = handle<{ kind: string }>(async (req, env, { kind }) => {
  const k = KINDS[kind];
  if (!k) throw badRequest("Unknown record type.");
  return jsonResponse({ record: await createExp(env, await authenticate(env, req), k, (await body<{ record: never }>(req, 450_000)).record) }, 201);
});
