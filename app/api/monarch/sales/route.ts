import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createSale } from "@/lib/server/monarch-sales";

/** { officeId, packageId?, description?, qty, price, payment: "link" | "paid" | "later", method? } */
export const POST = handle(async (req, env) => jsonResponse(await createSale(env, await authenticate(env, req), await body(req))));
