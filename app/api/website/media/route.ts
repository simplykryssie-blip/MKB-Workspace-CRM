import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { uploadMedia, siteParam } from "@/lib/server/website";

/** Image upload: the raw file as the request body (PNG/JPG/WebP/GIF, up to 5 MB). */
export const POST = handle(async (req, env) => jsonResponse(await uploadMedia(env, await authenticate(env, req), req, siteParam(req)), 201), { rawBody: true });
