import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteMedia, replaceMedia, siteParam } from "@/lib/server/website";

/** Replace the picture (raw image body) — the link stays the same. */
export const PUT = handle<{ key: string }>(async (req, env, { key }) => jsonResponse(await replaceMedia(env, await authenticate(env, req), req, key, siteParam(req))), { rawBody: true });
/** Delete the picture (?delete=1 with an empty JSON body). */
export const POST = handle<{ key: string }>(async (req, env, { key }) => jsonResponse(await deleteMedia(env, await authenticate(env, req), key, siteParam(req))));
