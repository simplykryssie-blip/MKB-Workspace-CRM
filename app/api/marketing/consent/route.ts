import { body, handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { getConsent, setConsent } from "@/lib/server/campaigns";

/** ?brand&email&phone — the person's marketing email and text choices. */
export const GET = handle(async (req, env) => { const q = new URL(req.url).searchParams; return jsonResponse(await getConsent(env, await authenticate(env, req), { brand: q.get("brand") ?? "", email: q.get("email") ?? "", phone: q.get("phone") ?? "" })); });
/** { brand, channel, address, status, note } — staff record an unsubscribe, or a consent with how they agreed. */
export const PUT = handle(async (req, env) => jsonResponse(await setConsent(env, await authenticate(env, req), await body(req))));
