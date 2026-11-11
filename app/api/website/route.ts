import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getWebsite, siteParam } from "@/lib/server/website";

export const GET = handle(async (req, env) => jsonResponse(await getWebsite(env, await authenticate(env, req), siteParam(req))));
