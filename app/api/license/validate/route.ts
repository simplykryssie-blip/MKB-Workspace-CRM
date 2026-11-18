import { clientIp, handle, HttpError, jsonResponse, rateLimit } from "@/lib/server/core";
import { decideEmbed, hostFromHeader, publicReason } from "@/lib/server/calc-embed";

const cors = { "access-control-allow-origin": "*", "cache-control": "no-store" };
/** Public license check for an embed id and a website (same answers as the old Monarch app; reveals no license details). */
export const GET = handle(async (req, env) => {
  if (!(await rateLimit(env.DB, `calc-validate:${clientIp(req)}`, 60, 10))) return jsonResponse({ valid: false, reason: "rate_limited" }, 429, { ...cors, "retry-after": "600" });
  const u = new URL(req.url);
  const param = u.searchParams.get("domain");
  const host = param ? hostFromHeader(/^https?:\/\//i.test(param) ? param : `https://${param}`) : hostFromHeader(req.headers.get("origin") ?? req.headers.get("referer"));
  if (!host) throw new HttpError(400, "domain_required");
  const d = await decideEmbed(env.DB, u.searchParams.get("id"), host);
  return jsonResponse(d.ok ? { valid: true } : { valid: false, reason: publicReason(d.reason) }, 200, cors);
});
