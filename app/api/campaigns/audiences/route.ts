import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listAudiences, saveAudience } from "@/lib/server/campaigns";

export const GET = handle(async (req, env) => jsonResponse(await listAudiences(env, await authenticate(env, req), new URL(req.url).searchParams.get("brand") ?? "")));
/** { id?, brand, name, filters } */
export const POST = handle(async (req, env) => jsonResponse(await saveAudience(env, await authenticate(env, req), await body(req))));
