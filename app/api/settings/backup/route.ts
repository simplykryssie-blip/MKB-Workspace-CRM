import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { backupNow, backupStatus } from "@/lib/server/backup";

/** Owner-only: the last daily backup and the saved database snapshots. */
export const GET = handle(async (req, env) => jsonResponse(await backupStatus(env, await authenticate(env, req))));
/** Owner-only: run the backup now (same job as the daily one). */
export const POST = handle(async (req, env) => jsonResponse(await backupNow(env, await authenticate(env, req))));
