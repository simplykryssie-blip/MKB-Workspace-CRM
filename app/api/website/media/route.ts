import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listMedia, uploadMedia, siteParam } from "@/lib/server/website";

/** The website's media library (?site=monarch for Monarch's). */
export const GET = handle(async (req, env) => jsonResponse(await listMedia(env, await authenticate(env, req), siteParam(req))));
/** Image upload: the raw file as the request body (PNG/JPG/WebP/GIF, up to 10 MB). */
export const POST = handle(async (req, env) => jsonResponse(await uploadMedia(env, await authenticate(env, req), req, siteParam(req)), 201), { rawBody: true });
