import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { sign8821 } from "@/lib/server/f8821";

/** { name, title?, method: "in_office" | "paper", idCheck } — records the signature. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await sign8821(env, await authenticate(env, req), id, await body(req))));
