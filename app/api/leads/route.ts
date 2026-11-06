import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createLead, listLeads, type LeadSnapshot } from "@/lib/server/leads";

export const GET = handle(async (req, env) => jsonResponse(await listLeads(env, await authenticate(env, req))));
export const POST = handle(async (req, env) => jsonResponse({ lead: await createLead(env, await authenticate(env, req), (await body<{ lead: LeadSnapshot }>(req)).lead) }, 201));
