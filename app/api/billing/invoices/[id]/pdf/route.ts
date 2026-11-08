import { handle } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { downloadInvoice } from "@/lib/server/billing-docs";

/** The branded invoice PDF (?inline=1 to view). */
export const GET = handle<{ id: string }>(async (req, env, { id }) => downloadInvoice(env, await authenticate(env, req), id, !!new URL(req.url).searchParams.get("inline")));
