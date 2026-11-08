import { handle } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { openClientFile } from "@/lib/server/files";

/** Streams a stored client file (?inline=1 to view in the browser). Checked and audited on the server. */
export const GET = handle<{ id: string; fileId: string }>(async (req, env, { id, fileId }) => openClientFile(env, await authenticate(env, req), id, fileId, !!new URL(req.url).searchParams.get("inline")));
