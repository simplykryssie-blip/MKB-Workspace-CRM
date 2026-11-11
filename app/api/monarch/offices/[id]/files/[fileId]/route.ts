import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteFile, openFile } from "@/lib/server/monarch-link";

/** Opens an office's file (?inline=1 to view in the browser). */
export const GET = handle<{ id: string; fileId: string }>(async (req, env, { id, fileId }) => openFile(env, await authenticate(env, req), id, fileId, !!new URL(req.url).searchParams.get("inline")));
/** { action: "delete" } */
export const POST = handle<{ id: string; fileId: string }>(async (req, env, { id, fileId }) => {
  const b = await body<{ action?: string }>(req);
  if (b.action !== "delete") throw badRequest("Unknown action.");
  return jsonResponse(await deleteFile(env, await authenticate(env, req), id, fileId));
});
