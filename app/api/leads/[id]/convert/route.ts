import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { markConverted } from "@/lib/server/leads";

export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body(req);
  return jsonResponse({ lead: await markConverted(env, await authenticate(env, req), id, str(b.clientId, 60), b.merged === true) });
});
