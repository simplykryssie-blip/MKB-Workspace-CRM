import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deletePackageFile } from "@/lib/server/monarch-store";

export const DELETE = handle<{ id: string; fileId: string }>(async (req, env, { id, fileId }) => jsonResponse(await deletePackageFile(env, await authenticate(env, req), id, fileId)));
