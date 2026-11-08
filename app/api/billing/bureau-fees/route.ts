import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getBureauFees, saveBureauFees } from "@/lib/server/billing";

/** ?bureau= — back-end fees for one service bureau (staff only). */
export const GET = handle(async (req, env) => jsonResponse(await getBureauFees(env, await authenticate(env, req), new URL(req.url).searchParams.get("bureau") ?? "")));
/** ?bureau= with { fees } — replaces that bureau's fee list. */
export const PUT = handle(async (req, env) => jsonResponse(await saveBureauFees(env, await authenticate(env, req), new URL(req.url).searchParams.get("bureau") ?? "", await body(req))));
