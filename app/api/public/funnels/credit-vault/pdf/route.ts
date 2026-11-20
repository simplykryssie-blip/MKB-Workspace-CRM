import { handle } from "@/lib/server/core";
import { creditVaultPdf } from "@/lib/server/credit-vault";

/** Public with a valid kit link: the Credit Comeback Vault PDF. */
export const GET = handle(async (req, env) => creditVaultPdf(env, new URL(req.url).searchParams.get("k")));
