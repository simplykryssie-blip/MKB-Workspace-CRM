import { handle, HttpError, jsonResponse } from "@/lib/server/core";
import { sha256 } from "@/lib/server/crypto";
import { runMonthlyBilling } from "@/lib/server/books-billing";
import { runBackup } from "@/lib/server/backup";

/**
 * The daily scheduled job (called by the worker's cron trigger, never by a browser).
 * It proves itself with the CRON_SECRET (compared as hashes).
 */
export const POST = handle(async (req, env) => {
  const key = req.headers.get("x-cron-key") ?? "";
  if (!env.CRON_SECRET || !key || (await sha256(key)) !== (await sha256(env.CRON_SECRET))) throw new HttpError(404, "Not found.");
  // Billing and the backup run independently: one failing never skips the other.
  const billing = await runMonthlyBilling(env).catch((e) => ({ error: String(e).slice(0, 300) }) as const);
  const backup = await runBackup(env).catch((e) => ({ ok: false, error: String(e).slice(0, 300) }));
  console.log("daily job", JSON.stringify({ billing: "error" in billing ? billing.error : { date: billing.date, checked: billing.checked, billed: billing.results.length }, backup }));
  return jsonResponse({ billing, backup });
}, { signedExternal: true });
