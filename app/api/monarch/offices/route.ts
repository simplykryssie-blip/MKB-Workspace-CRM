import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createOffice } from "@/lib/server/monarch";

export const POST = handle(async (req, env) => jsonResponse(await createOffice(env, await authenticate(env, req), await body(req))));
