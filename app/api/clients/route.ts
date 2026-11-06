import { body, badRequest, handle, jsonResponse, one, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { listClients } from "@/lib/server/clients";
import { createClient, getFull, listFull, type ClientSnapshot, type NewIdentifiers } from "@/lib/server/client-records";
import { requirePermission } from "@/lib/server/identity";

/** ?full=1 returns complete records (for the app); otherwise a summary list. */
export const GET = handle(async (req, env) => {
  const a = await authenticate(env, req);
  return jsonResponse({ clients: new URL(req.url).searchParams.get("full") ? await listFull(env, a) : await listClients(env, a) });
});

/** Create a client (optionally from a lead). Identifiers are encrypted on arrival. */
export const POST = handle(async (req, env) => {
  const a = await authenticate(env, req);
  const b = await body<{ client: ClientSnapshot; identifiers?: NewIdentifiers; fromLeadId?: string }>(req);
  const fromLeadId = str(b.fromLeadId, 60) || undefined;
  if (fromLeadId) {
    requirePermission(a, "leads", "edit");
    const lead = await one<{ status: string }>(env.DB, "SELECT status FROM leads WHERE id = ?", fromLeadId);
    if (!lead || lead.status !== "open") throw badRequest("That lead is not open.");
  }
  const { stmts, finish } = await createClient(env, a, b.client, b.identifiers ?? {}, { fromLeadId });
  await env.DB.batch(stmts);
  await finish();
  return jsonResponse({ client: await getFull(env, a, b.client.id) }, 201);
});
