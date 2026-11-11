import { badRequest, body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { sendBankApp, sendWelcome } from "@/lib/server/monarch-link";

/** { kind: "bank_app" | "welcome" } — emails the office its bank application link or software welcome. */
export const POST = handle<{ id: string }>(async (req, env, { id }) => {
  const a = await authenticate(env, req);
  const b = await body<{ kind?: string }>(req);
  if (b.kind === "bank_app") return jsonResponse(await sendBankApp(env, a, id));
  if (b.kind === "welcome") return jsonResponse(await sendWelcome(env, a, id));
  throw badRequest("Unknown email.");
});
