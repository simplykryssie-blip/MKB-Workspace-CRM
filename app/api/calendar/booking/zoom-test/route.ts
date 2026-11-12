import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { testZoom } from "@/lib/server/booking";

/** Checks the saved Zoom keys. */
export const POST = handle(async (req, env) => jsonResponse(await testZoom(env, await authenticate(env, req))));
