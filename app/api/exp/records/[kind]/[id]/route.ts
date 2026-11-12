import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteExpDraft, saveExp, type ExpKind } from "@/lib/server/exp";

const KINDS: Record<string, ExpKind> = { matters: "exp_matter", cases: "exp_case" };
export const PUT = handle<{ kind: string; id: string }>(async (req, env, { kind, id }) => {
  const k = KINDS[kind];
  if (!k) throw badRequest("Unknown record type.");
  return jsonResponse({ record: await saveExp(env, await authenticate(env, req), k, id, (await body<{ record: never }>(req, 450_000)).record) });
});
export const DELETE = handle<{ kind: string; id: string }>(async (req, env, { kind, id }) => {
  if (kind !== "cases") throw badRequest("Only draft cases can be removed.");
  return jsonResponse(await deleteExpDraft(env, await authenticate(env, req), id));
});
