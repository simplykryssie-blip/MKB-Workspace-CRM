import { clientIp, handle } from "@/lib/server/core";
import { downloadFile } from "@/lib/server/monarch-store";

/** Streams one purchased file (private link, 30 days). */
export const GET = handle<{ token: string; fileId: string }>(async (req, env, { token, fileId }) => downloadFile(env, token, fileId, clientIp(req)));
