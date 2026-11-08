import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { mark8821 } from "@/lib/server/f8821";

/** { to: "submitted" | "on_file" | "revoked", note? } */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await mark8821(env, await authenticate(env, req), id, await body(req))));
