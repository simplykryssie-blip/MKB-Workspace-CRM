import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listTemplates, saveTemplate } from "@/lib/server/campaigns";

export const GET = handle(async (req, env) => jsonResponse(await listTemplates(env, await authenticate(env, req), new URL(req.url).searchParams.get("brand") ?? "")));
/** { id?, brand, name, content } */
export const POST = handle(async (req, env) => jsonResponse(await saveTemplate(env, await authenticate(env, req), await body(req, 100_000))));
