import { clientIp, handle } from "@/lib/server/core";
import { publicPay } from "@/lib/server/billing-docs";

/** Public (no sign-in): the client's private pay link → Stripe Checkout. */
export const GET = handle<{ token: string }>(async (req, env, { token }) => publicPay(env, token, clientIp(req), new URL(req.url).searchParams.get("done") === "1"));
