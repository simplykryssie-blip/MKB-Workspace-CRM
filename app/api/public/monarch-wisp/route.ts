import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { generateWisp } from "@/lib/server/monarch-wisp";

/** Public: WISP Generator → the plan as a PDF, emailed, and a new Monarch lead. */
export const POST = handle(async (req, env) => jsonResponse(await generateWisp(env, clientIp(req), await body(req, 32_000)), 201));
