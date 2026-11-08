import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getLetter, saveLetter } from "@/lib/server/engagement";

/** ?version=N — one version of a letter. */
export const GET = handle<{ key: string }>(async (req, env, { key }) => jsonResponse(await getLetter(env, await authenticate(env, req), key, Number(new URL(req.url).searchParams.get("version") ?? 1))));
/** { title, body, note? } — saves a new version. */
export const PUT = handle<{ key: string }>(async (req, env, { key }) => jsonResponse(await saveLetter(env, await authenticate(env, req), key, await body(req, 100_000))));
