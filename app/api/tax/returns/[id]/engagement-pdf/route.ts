import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { engagementPdf } from "@/lib/server/tax";

/** Saves the signed engagement letter as a PDF in the client's Documents. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await engagementPdf(env, await authenticate(env, req), id)));
