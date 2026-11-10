import { handle } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { leadTaxAnswersPdf } from "@/lib/server/prospects";

/** The lead's tax interview answers so far, as a PDF. */
export const GET = handle<{ id: string; returnId: string }>(async (req, env, { id, returnId }) => leadTaxAnswersPdf(env, await authenticate(env, req), id, returnId));
