import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createIntake, listIntakes } from "@/lib/server/books-intake";

/** Bookkeeping intakes the person may see. */
export const GET = handle(async (req, env) => jsonResponse(await listIntakes(env, await authenticate(env, req))));
/** { clientId } — starts (or reopens) an intake. */
export const POST = handle(async (req, env) => jsonResponse(await createIntake(env, await authenticate(env, req), await body(req))));
