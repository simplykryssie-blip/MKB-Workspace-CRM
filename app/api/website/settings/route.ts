import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveSettings, siteParam } from "@/lib/server/website";

export const PUT = handle(async (req, env) => jsonResponse(await saveSettings(env, await authenticate(env, req), await body(req), siteParam(req))));
