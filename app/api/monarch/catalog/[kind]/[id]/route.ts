import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveCatalog, type CatalogKind } from "@/lib/server/monarch";

const KINDS: CatalogKind[] = ["packages", "software", "banks", "resellers"];

/** Creates or updates a package, software product, bank or reseller. */
export const PUT = handle<{ kind: string; id: string }>(async (req, env, { kind, id }) => {
  if (!KINDS.includes(kind as CatalogKind)) throw badRequest("Unknown list.");
  return jsonResponse(await saveCatalog(env, await authenticate(env, req), kind as CatalogKind, id, await body(req, 32_000)));
});
