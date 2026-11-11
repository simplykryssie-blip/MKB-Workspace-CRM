import { clientIp, handle } from "@/lib/server/core";
import { publicMonarchPay } from "@/lib/server/monarch-sales";

/** Public (no sign-in): an office's private Monarch pay link → Stripe Checkout. */
export const GET = handle<{ token: string }>(async (req, env, { token }) => publicMonarchPay(env, token, clientIp(req), new URL(req.url).searchParams.get("done") === "1"));
