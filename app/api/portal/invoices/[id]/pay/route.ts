import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalPay } from "@/lib/server/portal";

/** Opens Stripe Checkout for what's owed on the invoice. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await portalPay(env, await authenticate(env, req), id)));
