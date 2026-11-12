import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { searchContacts } from "@/lib/server/calendar";

/** ?q — clients, leads and Monarch firms to link. */
export const GET = handle(async (req, env) => jsonResponse(await searchContacts(env, await authenticate(env, req), new URL(req.url).searchParams.get("q") ?? "")));
