import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveWorkspace, type WorkspaceSnapshot } from "@/lib/server/books";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse({ workspace: await saveWorkspace(env, await authenticate(env, req), id, (await body<{ workspace: WorkspaceSnapshot }>(req, 650_000)).workspace) }));
