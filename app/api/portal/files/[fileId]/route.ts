import { handle } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { portalFile } from "@/lib/server/portal";

/** Downloads (or with ?view=1 opens) one of the client's own documents. */
export const GET = handle<{ fileId: string }>(async (req, env, { fileId }) => portalFile(env, await authenticate(env, req), fileId, new URL(req.url).searchParams.get("view") === "1"));
