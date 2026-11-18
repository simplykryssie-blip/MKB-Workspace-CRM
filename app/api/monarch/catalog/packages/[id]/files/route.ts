import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { uploadPackageFile } from "@/lib/server/monarch-store";

/** Adds a file to a download product (raw body, x-file-name header). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await uploadPackageFile(env, await authenticate(env, req), req, id), 201), { rawBody: true });
