import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { importReport } from "@/lib/server/monarch-bank";

/** { bankId, reportType, fileName, text, layout } — imports a bank report (CSV text, up to ~6 MB). */
export const POST = handle(async (req, env) => jsonResponse(await importReport(env, await authenticate(env, req), await body(req, 6_500_000))));
