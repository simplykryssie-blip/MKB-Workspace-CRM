import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getClient } from "@/lib/server/clients";
import { getFull, saveClient, type ClientSnapshot } from "@/lib/server/client-records";
import { audit } from "@/lib/server/identity";

export const GET = handle<{ id: string }>(async (req, env, { id }) => {
  const a = await authenticate(env, req);
  if (!new URL(req.url).searchParams.get("full")) return jsonResponse(await getClient(env, a, id));
  const c = await getFull(env, a, id);
  if (a.kind === "staff") await audit(env.DB, a, { action: "Client record access", resource: `Client ${id}` });
  return jsonResponse({ client: c });
});

/** Save changes. The body names the revision it was based on; a newer saved version wins (409). */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body<{ client: ClientSnapshot }>(req);
  return jsonResponse({ client: await saveClient(env, await authenticate(env, req), id, b.client) });
});
