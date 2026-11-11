import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { linkOff, sendLink } from "@/lib/server/monarch-link";

/** { action: "send" | "copy" | "off" } — the office's private upload link. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  const a = await authenticate(env, req);
  const b = await body<{ action?: string }>(req);
  if (b.action === "off") return jsonResponse(await linkOff(env, a, id));
  if (b.action === "send" || b.action === "copy") return jsonResponse(await sendLink(env, a, id, { copyOnly: b.action === "copy" }));
  throw badRequest("Unknown action.");
});
