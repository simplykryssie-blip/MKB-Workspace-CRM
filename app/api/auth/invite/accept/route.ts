import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { acceptInvite } from "@/lib/server/auth";

export const POST = handle(async (req, env) => {
  const b = await body(req);
  const r = await acceptInvite(env, req, str(b.token, 100), typeof b.password === "string" ? b.password : "");
  return jsonResponse({ next: r.next }, 200, r.setCookie ? { "set-cookie": r.setCookie } : {});
});
