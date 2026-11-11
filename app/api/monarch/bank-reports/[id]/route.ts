import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteUpload } from "@/lib/server/monarch-bank";

/** { action: "delete" } — removes an uploaded report. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body<{ action?: string }>(req);
  if (b.action !== "delete") throw badRequest("Unknown action.");
  return jsonResponse(await deleteUpload(env, await authenticate(env, req), id));
});
