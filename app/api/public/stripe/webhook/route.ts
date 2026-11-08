import { handle, jsonResponse } from "@/lib/server/core";
import { stripeWebhook } from "@/lib/server/billing-docs";

/** Stripe → MKB: verified by Stripe's signature, records completed payments once each. */
export const POST = handle(async (req, env) => jsonResponse(await stripeWebhook(env, req)), { rawBody: true, signedExternal: true });
