import { handle, jsonResponse } from "@/lib/server/core";
import { seedDev } from "@/lib/server/seed";

/** Development only (refused unless APP_ENV=development). */
export const POST = handle(async (_req, env) => jsonResponse(await seedDev(env), 201));
