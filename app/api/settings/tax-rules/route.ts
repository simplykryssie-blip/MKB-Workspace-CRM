import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getTaxRules, saveTaxRules } from "@/lib/server/settings";

/** Tax workflow rules (Owner final approval before e-file; engagement letter before review). */
export const GET = handle(async (req, env) => jsonResponse(await getTaxRules(env, await authenticate(env, req))));
export const PUT = handle(async (req, env) => jsonResponse(await saveTaxRules(env, await authenticate(env, req), await body(req))));
