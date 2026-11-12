import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { clientEmails } from "@/lib/server/documents";

export const GET = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await clientEmails(env, await authenticate(env, req), id)));
