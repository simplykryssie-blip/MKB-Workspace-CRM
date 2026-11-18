import { clientIp, handle } from "@/lib/server/core";
import { storeCheckout } from "@/lib/server/monarch-store";

/** Monarch store "Buy now": opens Stripe Checkout for the product (public, rate-limited). */
export const GET = handle<{ slug: string }>(async (req, env, { slug }) => storeCheckout(env, req, String(slug).toLowerCase().slice(0, 80), clientIp(req)));
