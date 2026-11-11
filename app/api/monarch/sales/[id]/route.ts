import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { updateSale } from "@/lib/server/monarch-sales";

/** { action: "paid" | "refund" | "void" | "link", method? } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await updateSale(env, await authenticate(env, req), id, await body(req))));
