import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveLead, type LeadSnapshot } from "@/lib/server/leads";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse({ lead: await saveLead(env, await authenticate(env, req), id, (await body<{ lead: LeadSnapshot }>(req)).lead) }));
