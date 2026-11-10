import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalDocuments } from "@/lib/server/portal";

/** Documents MKB asked for, and the client's files on record. */
export const GET = handle(async (req, env) => jsonResponse(await portalDocuments(env, await authenticate(env, req))));
