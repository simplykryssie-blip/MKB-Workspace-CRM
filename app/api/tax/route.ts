import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createReturn, listTax, type ReturnSnapshot } from "@/lib/server/tax";

export const GET = handle(async (req, env) => jsonResponse(await listTax(env, await authenticate(env, req))));
export const POST = handle(async (req, env) => jsonResponse({ return: await createReturn(env, await authenticate(env, req), (await body<{ return: ReturnSnapshot }>(req)).return) }, 201));
