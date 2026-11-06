import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { testSubmit } from "@/lib/server/forms";

export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await testSubmit(env, await authenticate(env, req), id, await body(req))));
