import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { revealSecureAnswer, setSecureAnswer } from "@/lib/server/tax";

/** Store a full SSN / EIN / bank number from the interview (encrypted). */
export const PUT = handle<{ id: string }>(async (req, env, { id }) => {
  const b = await body(req);
  return jsonResponse(await setSecureAnswer(env, await authenticate(env, req), id, str(b.key, 120), str(b.kind, 10) as "ssn", str(b.value, 40)));
});
/** Reveal one (audited; needs the matching sensitive permission). */
export const POST = handle<{ id: string }>(async (req, env, { id }) => jsonResponse(await revealSecureAnswer(env, await authenticate(env, req), id, str((await body(req)).key, 120))));
