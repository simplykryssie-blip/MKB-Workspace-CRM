import { body, handle, jsonResponse, str } from "@/lib/server/core";
import { login } from "@/lib/server/auth";

/** Client portal sign-in (client accounts only). Next step: the code we email. */
export const POST = handle(async (req, env) => {
  const b = await body(req);
  const r = await login(env, req, str(b.email, 200), typeof b.password === "string" ? b.password.slice(0, 256) : "", "client");
  return jsonResponse({ next: r.next }, 200, r.setCookie ? { "set-cookie": r.setCookie } : {});
});
