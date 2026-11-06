import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { createForm, listForms } from "@/lib/server/forms";
import type { LeadForm } from "@/lib/forms/config";

export const GET = handle(async (req, env) => jsonResponse(await listForms(env, await authenticate(env, req))));
export const POST = handle(async (req, env) => jsonResponse({ form: await createForm(env, await authenticate(env, req), (await body<{ form: LeadForm }>(req)).form) }, 201));
