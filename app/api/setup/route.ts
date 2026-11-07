import { body, handle, jsonResponse } from "@/lib/server/core";
import { createOwner, setupStatus } from "@/lib/server/bootstrap";

export const GET = handle(async (_req, env) => jsonResponse(await setupStatus(env)));
export const POST = handle(async (req, env) => jsonResponse(await createOwner(env, req, await body(req)), 201));
