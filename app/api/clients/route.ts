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
  // The lead is marked converted in the same write, so a lead and its new client can't both stay open.
  if (fromLeadId) {
    const t = new Date().toISOString();
    stmts.push(
      env.DB.prepare("UPDATE leads SET status = 'converted', converted_client_id = ?, converted_at = ?, rev = rev + 1, last_activity_at = ? WHERE id = ? AND status = 'open'").bind(b.client.id, t, t, fromLeadId),
      env.DB.prepare("UPDATE lead_reminders SET done = 1 WHERE lead_id = ?").bind(fromLeadId),
      env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, member_id, at) VALUES (?, ?, 'lead', ?, 'staff', ?, ?)").bind(`x_${crypto.randomUUID()}`, fromLeadId, `Converted to client ${b.client.id}`, a.kind === "staff" ? a.member.id : null, t),
    );
  }
  await env.DB.batch(stmts);
  await finish();
  return jsonResponse({ client: await getFull(env, a, b.client.id) }, 201);
});
