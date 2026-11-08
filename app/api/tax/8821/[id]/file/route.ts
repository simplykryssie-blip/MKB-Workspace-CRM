import { handle } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { download8821 } from "@/lib/server/f8821";

/** The filled IRS form with the full SSN/EIN (reveal permission; audited). */
export const GET = handle<{ id: string }>(async (req, env, { id }) => download8821(env, await authenticate(env, req), id));
