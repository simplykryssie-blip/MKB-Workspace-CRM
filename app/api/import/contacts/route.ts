import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { applyContacts, previewContacts } from "@/lib/server/import-contacts";

/** Owner-only: { csv } previews the old CRM's contacts; { csv, choices, apply: true } imports them (leads / Monarch offices). */
export const POST = handle(async (req, env) => {
  const b = await body<{ csv?: unknown; choices?: unknown; apply?: unknown }>(req, 1_200_000);
  const a = await authenticate(env, req);
  return jsonResponse(b.apply === true ? await applyContacts(env, a, b) : await previewContacts(env, a, b));
});
