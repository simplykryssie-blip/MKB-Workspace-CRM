import { body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { joinCreditVault } from "@/lib/server/credit-vault";

/** Public: join the Black Friday VIP waitlist (→ a lead) and get the private Credit Comeback Vault link. */
export const POST = handle(async (req, env) => jsonResponse(await joinCreditVault(env, req, await body(req), clientIp(req))));
