import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listClients } from "@/lib/server/clients";

export const GET = handle(async (req, env) => jsonResponse({ clients: await listClients(env, await authenticate(env, req)) }));
