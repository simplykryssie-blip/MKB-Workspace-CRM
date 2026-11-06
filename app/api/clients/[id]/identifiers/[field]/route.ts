import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { revealIdentifier, setIdentifier, type VaultField } from "@/lib/server/clients";

/** Reveal (POST, audited) — never a GET, so it can't be triggered by a link or prefetch. */
export const POST = handle<{ id: string; field: string }>(async (req, env, { id, field }) => jsonResponse(await revealIdentifier(env, await authenticate(env, req), id, field as VaultField)));
/** Store / replace (encrypted). */
export const PUT = handle<{ id: string; field: string }>(async (req, env, { id, field }) => {
  const b = await body(req);
  return jsonResponse(await setIdentifier(env, await authenticate(env, req), id, field as VaultField, str(b.value, 40), str(b.kind, 10) || undefined));
});
