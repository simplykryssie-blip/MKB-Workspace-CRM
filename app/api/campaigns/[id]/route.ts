import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteCampaign, getCampaign, saveCampaign } from "@/lib/server/campaigns";

export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await getCampaign(env, await authenticate(env, req), id)));
/** { name?, content?, filters?, rev } — saves a draft. */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await saveCampaign(env, await authenticate(env, req), id, await body(req, 100_000))));
export const DELETE = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await deleteCampaign(env, await authenticate(env, req), id)));
