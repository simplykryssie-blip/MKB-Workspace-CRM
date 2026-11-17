import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { moneyVaultReport } from "@/lib/server/funnels";

/** The Money Vault campaign report: counts only (Leads access). */
export const GET = handle(async (req, env) => jsonResponse(await moneyVaultReport(env, await authenticate(env, req))));
