import { handle, jsonResponse } from "@/lib/server/core";
import { staffUpload } from "@/lib/server/staff-upload";
import { authenticate } from "@/lib/server/auth";
import { openClientFile } from "@/lib/server/files";

/** Streams a stored client file (?inline=1 to view in the browser). Checked and audited on the server. */
export const GET = handle<{ id: string; fileId: string }>(async (req, env, { id, fileId }) => openClientFile(env, await authenticate(env, req), id, fileId, !!new URL(req.url).searchParams.get("inline")));

/** Staff: stores the file for one of the client's document records (raw body, x-file-name header; ?sensitive=1). */
export const POST = handle<{ id: string; fileId: string }>(async (req, env, { id, fileId }) => jsonResponse(await staffUpload(env, await authenticate(env, req), req, id, fileId, { sensitive: new URL(req.url).searchParams.get("sensitive") === "1" })), { rawBody: true });
