import { handle, jsonResponse, badRequest } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { openServiceIntakes } from "@/lib/server/service-intake";
import { isServiceIntakeKind } from "@/lib/intakes/service";

/** ?kind=relief — unfinished intakes of that kind, for clients and leads. */
export const GET = handle(async (req, env) => {
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isServiceIntakeKind(kind)) throw badRequest("Choose an intake kind.");
  return jsonResponse(await openServiceIntakes(env, await authenticate(env, req), kind));
});
