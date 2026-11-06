/**
 * Access policy — ONE implementation used by both the interface (to decide what
 * to show) and the server (to decide what to allow). The server is the
 * authority: it evaluates these rules on every request, using records loaded
 * from the database, never anything sent by the browser.
 */
import { MODULE_DEPT, SENSITIVE_GROUPS, type ActionKey, type Capability, type DeptKey, type Department, type Member, type ModuleKey, type Role } from "./config";
import type { ServiceKey } from "@/lib/types";

export type PolicyState = { roles: Role[]; departments: Department[] };
/** The member fields the rules need (the server loads these from the database). */
export type PolicyMember = Pick<Member, "id" | "status" | "roleId" | "departments" | "grants" | "selectedClientIds">;
export const SERVICE_DEPT: Record<ServiceKey, DeptKey> = { tax: "tax", books: "books", biz: "biz", expunge: "exp" };

export function roleOf(roles: Role[], m?: Pick<Member, "roleId">) {
  return roles.find((r) => r.id === m?.roleId);
}

/** Service modules require membership in a department whose access list includes the module. */
function deptAllows(departments: Department[], m: PolicyMember, module: ModuleKey) {
  const dept = MODULE_DEPT[module];
  if (!dept) return true;
  return departments.some((d) => m.departments.includes(d.key) && d.modules.includes(module));
}

export function canDo(s: PolicyState, m: PolicyMember | undefined, module: ModuleKey, action: ActionKey = "view") {
  if (!m || m.status !== "active") return false;
  const r = roleOf(s.roles, m);
  if (!r || r.isClient) return false;
  if (!(r.perms[module] ?? []).includes(action)) return false;
  return r.allDepartments || deptAllows(s.departments, m, module);
}

export function hasSensitive(s: PolicyState, m: PolicyMember | undefined, key: string) {
  if (!m || m.status !== "active") return false;
  const r = roleOf(s.roles, m);
  if (!r || r.isClient) return false;
  if (!r.sensitive.includes(key) && !m.grants.includes(key)) return false;
  const group = SENSITIVE_GROUPS.find((g) => key.startsWith(`${g.key}.`));
  // Sensitive tax / expungement information also requires that department.
  return r.allDepartments || !group || m.departments.includes(group.dept);
}

export function hasCap(s: Pick<PolicyState, "roles">, m: PolicyMember | undefined, cap: Capability) {
  if (!m || m.status !== "active") return false;
  return !!roleOf(s.roles, m)?.caps.includes(cap);
}

export function effectiveSensitive(s: PolicyState, m: PolicyMember) {
  return SENSITIVE_GROUPS.flatMap((g) => g.perms.map((p) => p.key)).filter((k) => hasSensitive(s, m, k));
}

const level = (s: PolicyState, m?: PolicyMember) => roleOf(s.roles, m)?.level ?? 0;

/** Who may change a team member: never yourself, never the Owner, never someone at or above your own level. */
export function canManage(s: PolicyState, actor: PolicyMember | undefined, target: PolicyMember | undefined, action: ActionKey = "edit") {
  if (!actor || !target) return false;
  if (!canDo(s, actor, "team", action)) return false;
  if (actor.id === target.id) return false;
  if (roleOf(s.roles, target)?.isOwner) return false;
  return !!roleOf(s.roles, actor)?.isOwner || level(s, target) < level(s, actor);
}

/** Roles an actor may assign: never Owner or Client, and only below their own level (Owner: any). */
export function assignableRoles(s: PolicyState, actor: PolicyMember | undefined) {
  const owner = !!roleOf(s.roles, actor)?.isOwner;
  return s.roles.filter((r) => !r.isOwner && !r.isClient && (owner || r.level < level(s, actor)));
}

/** A role edit can never grant more than the actor holds (no self-escalation through roles). */
export function clampRoleToActor(s: PolicyState, actor: PolicyMember | undefined, r: Role): Role {
  const ar = roleOf(s.roles, actor);
  if (!ar || ar.isOwner) return r;
  const perms = Object.fromEntries(Object.entries(r.perms).map(([mod, acts]) => [mod, (acts ?? []).filter((a) => (ar.perms[mod as ModuleKey] ?? []).includes(a))]));
  return { ...r, perms, sensitive: r.sensitive.filter((k) => ar.sensitive.includes(k)), caps: r.caps.filter((c) => ar.caps.includes(c)), allDepartments: ar.allDepartments && r.allDepartments };
}

/**
 * Record-level access to a client. `assigned` = client IDs the member is assigned to
 * anywhere (team, returns, workspaces, requests, cases); `teamAssigned` = the same for
 * the member's direct reports. Knowing a client's ID or URL never grants access.
 */
export function clientAccess(
  s: PolicyState,
  m: PolicyMember | undefined,
  client: { id: string; services: ServiceKey[] },
  ctx: { assigned: Set<string>; teamAssigned: Set<string> },
) {
  if (!m || m.status !== "active" || !canDo(s, m, "crm", "view")) return false;
  const r = roleOf(s.roles, m);
  if (!r) return false;
  if (r.allDepartments) return true;
  const mine = m.selectedClientIds.includes(client.id) || ctx.assigned.has(client.id);
  switch (r.scope) {
    case "selected":
      return m.selectedClientIds.includes(client.id);
    case "assigned":
      return mine;
    case "team":
      return mine || ctx.teamAssigned.has(client.id);
    case "all_departments":
      return mine || m.departments.includes("support") || client.services.some((sv) => m.departments.includes(SERVICE_DEPT[sv]));
  }
}
