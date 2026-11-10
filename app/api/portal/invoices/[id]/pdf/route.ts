import { handle } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalInvoicePdf } from "@/lib/server/portal";

/** The invoice as a PDF. */
export const GET = handle<{ id: string }>(async (req, env, { id }) => portalInvoicePdf(env, await authenticate(env, req), id));
