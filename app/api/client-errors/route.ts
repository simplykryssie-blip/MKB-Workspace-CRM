import { body, handle, jsonResponse, rateLimit } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { audit } from "@/lib/server/identity";

/**
 * A page crashed in a staff member's browser: { message, stack, path, digest, ua }. Recorded in the
 * audit log as "App error" (so it can be found and fixed) and written to the server log. Only for
 * signed-in staff, rate-limited, and trimmed — no form contents are sent.
 */
export const POST = handle(async (req, env) => {
  const a = await authenticate(env, req).catch(() => null);
  const b = await body<{ message?: unknown; stack?: unknown; path?: unknown; digest?: unknown; ua?: unknown }>(req, 8192);
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const msg = s(b.message, 300) || "Unknown error";
  const path = s(b.path, 200).replace(/[?#].*$/, "");
  console.error("client error", JSON.stringify({ msg, path, digest: s(b.digest, 60), ua: s(b.ua, 160), stack: s(b.stack, 600), staff: a?.kind === "staff" ? a.member.id : null }));
  if (!a || a.kind !== "staff") return jsonResponse({ ok: true });
  if (!(await rateLimit(env.DB, `clienterr:${a.member.id}`, 20, 60))) return jsonResponse({ ok: true });
  await audit(env.DB, a, { action: "App error", resource: path || "Unknown page", meta: `${msg} · ${s(b.ua, 120)} · ${s(b.stack, 300)}`.slice(0, 700), success: false });
  return jsonResponse({ ok: true });
});
