import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { saveSettings } from "@/lib/server/campaigns";

/** { fromName, fromEmail, replyTo, mailingAddress, dailyLimit, reserve } */
export const PUT = handle<{ brand: string }>(async (req, env, { brand }) => jsonResponse(await saveSettings(env, await authenticate(env, req), brand, await body(req))));
