import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { applyIntakeToProfile } from "@/lib/server/service-intake";

/** Staff: copy a submitted intake's details (incl. date of birth) to the client profile. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await applyIntakeToProfile(env, await authenticate(env, req), id)));
