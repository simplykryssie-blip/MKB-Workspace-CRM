import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { staffUploadFile } from "@/lib/server/monarch-link";

/** Staff upload for a checklist item (raw body, x-file-name header, ?item=). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await staffUploadFile(env, await authenticate(env, req), req, id, new URL(req.url).searchParams.get("item") ?? "")), { rawBody: true });
