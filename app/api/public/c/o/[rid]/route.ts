import { handle } from "@/lib/server/core";
import { trackOpen } from "@/lib/server/campaigns";

/** Open tracking pixel for a campaign email. */
export const GET = handle<{ rid: string }>(async (_req, env, { rid }) => trackOpen(env, rid.replace(/\.gif$/, "")));
