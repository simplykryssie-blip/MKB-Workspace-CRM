import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getDocVersion } from "@/lib/server/staff-onboarding";

/** One past version of a staff onboarding document. */
export const GET = handle<{ key: string; version: string }>(async (req, env, { key, version }) => jsonResponse(await getDocVersion(env, await authenticate(env, req), String(key), Number(version))));
