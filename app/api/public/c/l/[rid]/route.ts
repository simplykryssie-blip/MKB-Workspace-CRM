import { handle } from "@/lib/server/core";
import { trackClick } from "@/lib/server/campaigns";

/** A link in a campaign email: records the click, then goes to the (signed) address. */
export const GET = handle<{ rid: string }>(async (req, env, { rid }) => { const q = new URL(req.url).searchParams; return trackClick(env, rid, q.get("u") ?? "", q.get("s") ?? ""); });
