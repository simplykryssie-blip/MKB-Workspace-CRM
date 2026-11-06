import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { deleteForm, saveForm } from "@/lib/server/forms";
import type { LeadForm } from "@/lib/forms/config";

export const PUT = handle<{ id: string }>(async (req, env, { id }) => jsonResponse({ form: await saveForm(env, await authenticate(env, req), id, (await body<{ form: LeadForm }>(req)).form) }));
/** { action: "delete" } — only forms without submissions. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  if (str((await body(req)).action, 20) !== "delete") return jsonResponse({ error: "Unknown action." }, 400);
  await deleteForm(env, await authenticate(env, req), id);
  return jsonResponse({ ok: true });
});
