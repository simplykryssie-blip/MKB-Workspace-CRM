import { handle, jsonResponse } from "@/lib/server/core";
import { authenticate } from "@/lib/server/auth";
import { effectiveSensitive, roleOf } from "@/lib/team/policy";

/** Who is signed in, and what they may do (the interface uses this; the server re-checks every request). */
export const GET = handle(async (req, env) => {
  const a = await authenticate(env, req, { allowPartial: true });
  if (a.kind === "client") return jsonResponse({ kind: "client", clientId: a.clientId, mfaPending: a.mfaPending });
  const role = roleOf(a.policy.roles, a.member);
  return jsonResponse({
    kind: "staff",
    mfaPending: a.mfaPending,
    member: { id: a.member.id, name: a.member.name, email: a.member.email, roleId: a.member.roleId, roleName: role?.name, departments: a.member.departments },
    perms: role?.perms ?? {},
    sensitive: effectiveSensitive(a.policy, a.member),
    caps: role?.caps ?? [],
  });
});
