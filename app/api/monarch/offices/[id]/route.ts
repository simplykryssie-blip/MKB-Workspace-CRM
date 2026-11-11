import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteOffice, updateOffice } from "@/lib/server/monarch";

/** { rev, patch?, item? } — staff changes to an office. */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await updateOffice(env, await authenticate(env, req), id, await body(req, 200_000))));
/** { action: "delete" } — removes an office with no sales. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body<{ action?: string }>(req);
  if (b.action !== "delete") throw badRequest("Unknown action.");
  return jsonResponse(await deleteOffice(env, await authenticate(env, req), id));
});
