import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createWorkspace, listBooks, type WorkspaceSnapshot } from "@/lib/server/books";

export const GET = handle(async (req, env) => jsonResponse(await listBooks(env, await authenticate(env, req))));
export const POST = handle(async (req, env) => jsonResponse({ workspace: await createWorkspace(env, await authenticate(env, req), (await body<{ workspace: WorkspaceSnapshot }>(req, 650_000)).workspace) }, 201));
