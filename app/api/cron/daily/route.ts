import { handle, HttpError, jsonResponse } from "@/lib/server/core";
import { sha256 } from "@/lib/server/crypto";
import { runMonthlyBilling } from "@/lib/server/books-billing";

/**
 * The daily scheduled job (called by the worker's cron trigger, never by a browser).
 * It proves itself with the CRON_SECRET (compared as hashes).
 */
export const POST = handle(async (req, env) => {
  const key = req.headers.get("x-cron-key") ?? "";
  if (!env.CRON_SECRET || !key || (await sha256(key)) !== (await sha256(env.CRON_SECRET))) throw new HttpError(404, "Not found.");
  const billing = await runMonthlyBilling(env);
  console.log("daily job", JSON.stringify({ date: billing.date, checked: billing.checked, billed: billing.results.length }));
  return jsonResponse({ billing });
}, { signedExternal: true });
