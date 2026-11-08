import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { syncProfileFromReturn } from "@/lib/server/tax";

/** Copies the submitted intake's confirmed details onto the client profile. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await syncProfileFromReturn(env, await authenticate(env, req), id)));
