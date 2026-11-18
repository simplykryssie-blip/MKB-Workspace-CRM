import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { billIntakeBalance } from "@/lib/server/books-intake";

/** Staff: bill the remaining one-time project balance (after the signing deposit) once the work is done. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await billIntakeBalance(env, await authenticate(env, req), id)));
