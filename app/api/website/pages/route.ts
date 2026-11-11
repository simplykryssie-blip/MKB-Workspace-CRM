import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createPage, siteParam } from "@/lib/server/website";
import type { SitePage } from "@/lib/website/types";

export const POST = handle(async (req, env) => jsonResponse(await createPage(env, await authenticate(env, req), (await body<{ page: SitePage }>(req, 600_000)).page ?? {}, siteParam(req)), 201));
