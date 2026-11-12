import { handle, HttpError, jsonResponse } from "@/lib/server/core";
import { sha256 } from "@/lib/server/crypto";
import { processCampaigns } from "@/lib/server/campaigns";
import { processBookings } from "@/lib/server/booking";

/**
 * Every 15 minutes (the worker's cron trigger, never a browser): starts
 * scheduled campaigns and sends what fits under today's email cap, then
 * frees unpaid booking holds and sends appointment reminders. It proves
 * itself with a key derived from the server's encryption key, so it needs no
 * extra secret (and doesn't depend on the daily billing job's CRON_SECRET).
 */
export const POST = handle(async (req, env) => {
  const key = req.headers.get("x-cron-key") ?? "";
  if (!env.ENCRYPTION_KEY || !key || key !== (await sha256(`cron-campaigns:${env.ENCRYPTION_KEY}`))) throw new HttpError(404, "Not found.");
  await processCampaigns(env).catch((e) => console.error("campaigns cron", e));
  // Appointments: free unpaid holds and send reminders.
  await processBookings(env).catch((e) => console.error("bookings cron", e));
  return jsonResponse({ ok: true });
}, { signedExternal: true });
