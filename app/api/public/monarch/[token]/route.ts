import { badRequest, body, clientIp, handle, jsonResponse } from "@/lib/server/core";
import { publicLocations, publicPreparers, publicSign, publicView } from "@/lib/server/monarch-link";

const H = { "referrer-policy": "no-referrer", "x-robots-tag": "noindex" };

/** Public (private link, no sign-in): what the office still needs to send. */
export const GET = handle<{ token: string }>(async (req, env, { token }) => jsonResponse(await publicView(env, token, clientIp(req)), 200, H));
/** { action: "sign" | "locations" | "preparers", ... } */
export const POST = handle<{ token: string }>(async (req, env, { token }) => {
  const ip = clientIp(req);
  const b = await body<Record<string, unknown>>(req, 600_000);
  if (b.action === "sign") return jsonResponse(await publicSign(env, token, ip, b), 200, H);
  if (b.action === "locations") return jsonResponse(await publicLocations(env, token, ip, b), 200, H);
  if (b.action === "preparers") return jsonResponse(await publicPreparers(env, token, ip, b), 200, H);
  throw badRequest("Unknown action.");
});
