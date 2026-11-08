"use client";

/**
 * Team & Permissions store (Phase 2 — in-browser sample data only).
 *
 * "Previewing as" lets reviewers see the suite as any team member or as a client.
 * The checks below decide what the INTERFACE shows; they are not security. The
 * production backend must evaluate the same rules on every request, independently
 * of the interface, and record every audit event server-side.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BACKEND, RemoteError, call, notify } from "@/lib/sync/remote";
import { ACCESS_REQUESTS, AUDIT_SEED, DEFAULT_ROLES, DEPARTMENT_CONFIG, INVITATIONS, MEMBERS, SECURITY_DEFAULTS } from "@/lib/sample/team-seed";
import { SAMPLE_NOW, setMeId, setStaffDirectory } from "@/lib/sample/clients";
import { nowIso, useClients } from "@/lib/store/clients-store";
import { useTax } from "@/lib/store/tax-store";
import { useBooks } from "@/lib/store/books-store";
import { useBiz } from "@/lib/store/biz-store";
import { useExp } from "@/lib/store/exp-store";
import {
  HIGH_IMPACT,
  MODULE_DEPT,
  ONBOARDING,
  OFFBOARDING,
  OWNER_ONLY,
  SENSITIVE_GROUPS,
  type AccessRequest,
  type ActionKey,
  type AuditEvent,
  type Capability,
  type DeptKey,
  type Department,
  type Invitation,
  type Member,
  type ModuleKey,
  type Role,
  type SecuritySettings,
} from "@/lib/team/config";
import type { Client, ServiceKey } from "@/lib/types";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

type State = { roles: Role[]; members: Member[]; invitations: Invitation[]; departments: Department[]; requests: AccessRequest[]; audit: AuditEvent[]; security: SecuritySettings };
const init = (): State => ({ roles: structuredClone(DEFAULT_ROLES), members: structuredClone(MEMBERS), invitations: structuredClone(INVITATIONS), departments: structuredClone(DEPARTMENT_CONFIG), requests: structuredClone(ACCESS_REQUESTS), audit: structuredClone(AUDIT_SEED), security: structuredClone(SECURITY_DEFAULTS) });
type Action = { type: "reset" } | { type: "fn"; fn: (s: State) => State };
const reducer = (s: State, a: Action): State => (a.type === "reset" ? init() : a.fn(s));

/* ------------------------------------------------------------------ */
/* Permission evaluation (mirror of what the backend must enforce)     */
/* ------------------------------------------------------------------ */

export type Acting = { kind: "member"; id: string } | { kind: "client"; clientId: string };

// Rules live in lib/team/policy.ts — the same code the server enforces.
export { canDo, effectiveSensitive, hasCap, hasSensitive, roleOf } from "@/lib/team/policy";
import { SERVICE_DEPT, canDo, hasCap, hasSensitive, roleOf } from "@/lib/team/policy";

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function makeActions(dispatch: React.Dispatch<Action>, get: () => State, actorId: () => string) {
  const set = (fn: (s: State) => State) => dispatch({ type: "fn", fn });
  const M = (id: string) => get().members.find((x) => x.id === id)!;
  const actor = () => M(actorId());
  const upM = (id: string, fn: (m: Member) => Member) => set((s) => ({ ...s, members: s.members.map((x) => (x.id === id ? fn(x) : x)) }));
  const log = (e: Omit<AuditEvent, "id" | "at" | "actorId" | "success"> & { success?: boolean; actorId?: string }) =>
    set((s) => ({ ...s, audit: [{ id: uid("au"), at: nowIso(), actorId: e.actorId ?? actorId(), success: e.success ?? true, ...e }, ...s.audit] }));
  const level = (m?: Member) => roleOf(get().roles, m)?.level ?? 0;

  /** Who may change a team member: never yourself, never the Owner, never someone at or above your own level. */
  const canManage = (targetId: string, action: ActionKey = "edit") => {
    const a = actor();
    const t = M(targetId);
    if (!canDo(get(), a, "team", action)) return false;
    if (a.id === t.id) return false;
    if (roleOf(get().roles, t)?.isOwner) return false;
    return roleOf(get().roles, a)?.isOwner || level(t) < level(a);
  };
  const assignableRoles = () => get().roles.filter((r) => !r.isOwner && !r.isClient && (roleOf(get().roles, actor())?.isOwner || r.level < level(actor())));
  /** Can the actor grant a sensitive permission? Only if they hold it, can assign, and the target is manageable. */
  const canGrant = (targetId: string, key: string) => canManage(targetId, "assign") && hasSensitive(get(), actor(), key);

  const a = {
    reset: () => dispatch({ type: "reset" }),
    canManage,
    assignableRoles,
    canGrant,
    log,

    /* ---------------- Invitations ---------------- */
    invite(o: { name: string; email: string; phone: string; title: string; roleId: string; departments: DeptKey[]; managerId?: string; grants: string[]; expiresInDays: number }): string | null {
      const role = get().roles.find((r) => r.id === o.roleId);
      if (!role || !assignableRoles().some((r) => r.id === o.roleId) || !canDo(get(), actor(), "team", "create")) return null;
      const id = uid("s");
      const at = nowIso();
      const initials = o.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const member: Member = { id, name: o.name, initials, title: o.title, email: o.email, phone: o.phone, roleId: o.roleId, departments: o.departments, status: "invited", addedAt: at, managerId: o.managerId, grants: o.grants.filter((g) => hasSensitive(get(), actor(), g)), selectedClientIds: [], mfa: "not_enrolled", onboarding: {}, sessions: [], logins: [] };
      const inv: Invitation = { id: uid("inv"), memberId: id, email: o.email, name: o.name, roleId: o.roleId, departments: o.departments, managerId: o.managerId, grants: member.grants, sentAt: at, expiresAt: new Date(SAMPLE_NOW.getTime() + o.expiresInDays * 86400000).toISOString(), status: "pending", invitedBy: actorId() };
      set((s) => ({ ...s, members: [...s.members, member], invitations: [inv, ...s.invitations] }));
      log({ action: "Invitation", resource: `${o.name} (${role.name})`, department: o.departments[0], meta: `Invited ${o.email}; expires in ${o.expiresInDays} days` });
      return id;
    },
    resendInvite(invId: string) {
      const inv = get().invitations.find((x) => x.id === invId)!;
      set((s) => ({ ...s, invitations: s.invitations.map((x) => (x.id === invId ? { ...x, status: "pending", resentAt: nowIso(), expiresAt: new Date(SAMPLE_NOW.getTime() + 7 * 86400000).toISOString() } : x)) }));
      log({ action: "Invitation", resource: inv.name, meta: "Invitation resent (expires in 7 days)" });
    },
    cancelInvite(invId: string) {
      const inv = get().invitations.find((x) => x.id === invId)!;
      set((s) => ({ ...s, invitations: s.invitations.map((x) => (x.id === invId ? { ...x, status: "cancelled" } : x)), members: s.members.map((x) => (x.id === inv.memberId ? { ...x, status: "deactivated" } : x)) }));
      log({ action: "Invitation", resource: inv.name, meta: "Invitation cancelled" });
    },
    /** Sample only: simulates the invitee accepting (real acceptance happens through authentication in Phase 3). */
    simulateAccept(invId: string) {
      const inv = get().invitations.find((x) => x.id === invId)!;
      const at = nowIso();
      set((s) => ({ ...s, invitations: s.invitations.map((x) => (x.id === invId ? { ...x, status: "accepted" } : x)), members: s.members.map((x) => (x.id === inv.memberId ? { ...x, status: "active", lastLoginAt: at, onboarding: { "Invitation accepted": at, "Account created": at, "Role assigned": at, ...(x.departments.length ? { "Departments assigned": at } : {}), ...(x.managerId ? { "Manager assigned": at } : {}) } } : x)) }));
      log({ action: "Invitation", resource: inv.name, meta: "Invitation accepted (simulated)", actorId: inv.memberId });
    },

    /* ---------------- Profiles + access ---------------- */
    updateProfile(id: string, patch: Partial<Pick<Member, "name" | "title" | "email" | "phone" | "managerId">>) {
      if (!canManage(id) && id !== actorId()) return false;
      upM(id, (x) => ({ ...x, ...patch }));
      return true;
    },
    /** Role changes: never your own, never Owner, never at or above your own level. */
    changeRole(id: string, roleId: string) {
      if (!canManage(id, "assign") || !assignableRoles().some((r) => r.id === roleId)) return false;
      const from = roleOf(get().roles, M(id))?.name;
      const to = get().roles.find((r) => r.id === roleId)!.name;
      upM(id, (x) => ({ ...x, roleId }));
      log({ action: "Role change", resource: `${M(id).name}: ${from} → ${to}`, meta: "High-impact change confirmed" });
      return true;
    },
    setDepartments(id: string, departments: DeptKey[]) {
      if (!canManage(id, "assign")) return false;
      const before = M(id).departments;
      upM(id, (x) => ({ ...x, departments }));
      log({ action: "Permission change", resource: `${M(id).name}: departments`, meta: `${before.join(", ") || "none"} → ${departments.join(", ") || "none"}` });
      return true;
    },
    setGrant(id: string, key: string, on: boolean) {
      if (on ? !canGrant(id, key) : !canManage(id, "assign")) return false;
      upM(id, (x) => ({ ...x, grants: on ? [...new Set([...x.grants, key])] : x.grants.filter((g) => g !== key) }));
      log({ action: "Permission change", resource: `${M(id).name}: ${key}`, meta: `${on ? "Granted" : "Removed"}${HIGH_IMPACT.has(key) ? " — high-impact change confirmed" : ""}` });
      return true;
    },
    setSelectedClients(id: string, clientIds: string[]) {
      if (!canManage(id, "assign")) return false;
      upM(id, (x) => ({ ...x, selectedClientIds: clientIds }));
      log({ action: "Assignment change", resource: `${M(id).name}: individually selected records`, meta: `${clientIds.length} client(s)` });
      return true;
    },
    markReviewed(id: string) {
      if (!canManage(id, "assign")) return false;
      upM(id, (x) => ({ ...x, lastAccessReviewAt: nowIso() }));
      log({ action: "Permission change", resource: `${M(id).name}: access review completed` });
      return true;
    },
    suspend(id: string, reason: string) {
      if (!canManage(id, "archive")) return false;
      upM(id, (x) => ({ ...x, status: "suspended", sessions: x.sessions.map((se) => (se.revokedAt ? se : { ...se, revokedAt: nowIso() })) }));
      log({ action: "Account suspension", resource: M(id).name, meta: reason });
      return true;
    },
    reactivate(id: string) {
      if (!canManage(id, "archive")) return false;
      upM(id, (x) => ({ ...x, status: "active" }));
      log({ action: "Account suspension", resource: M(id).name, meta: "Reactivated" });
      return true;
    },
    revokeSession(id: string, sessionId?: string) {
      if (!canManage(id, "archive") && id !== actorId()) return false;
      upM(id, (x) => ({ ...x, sessions: x.sessions.map((se) => (!sessionId || se.id === sessionId) && !se.revokedAt ? { ...se, revokedAt: nowIso() } : se) }));
      log({ action: "Session revoked", resource: `${M(id).name} — ${sessionId ? "1 session" : "all sessions"}`, meta: "Takes effect at the authentication service in Phase 3" });
      return true;
    },
    toggleOnboarding(id: string, step: (typeof ONBOARDING)[number]) {
      if (!canManage(id)) return false;
      upM(id, (x) => {
        const o = { ...x.onboarding };
        if (o[step]) delete o[step];
        else o[step] = nowIso();
        return { ...x, onboarding: o };
      });
      log({ action: "Permission change", resource: `${M(id).name}: onboarding`, meta: step });
      return true;
    },

    /* ---------------- Offboarding (never deletes history) ---------------- */
    startOffboarding(id: string) {
      if (!canManage(id, "archive")) return false;
      upM(id, (x) => ({ ...x, offboarding: x.offboarding ?? { startedAt: nowIso(), byId: actorId(), steps: {} } }));
      return true;
    },
    offboardStep(id: string, step: (typeof OFFBOARDING)[number], note?: string) {
      if (!canManage(id, "archive")) return false;
      const at = nowIso();
      upM(id, (x) => {
        let next: Member = { ...x, offboarding: { ...x.offboarding!, steps: { ...x.offboarding!.steps, [step]: at } } };
        if (step === "Suspend account") next = { ...next, status: "suspended" };
        if (step === "Revoke active sessions") next = { ...next, sessions: next.sessions.map((se) => (se.revokedAt ? se : { ...se, revokedAt: at })) };
        if (step === "Remove department access") next = { ...next, departments: [], grants: [], selectedClientIds: [] };
        return next;
      });
      log({ action: step === "Suspend account" ? "Account suspension" : step === "Revoke active sessions" ? "Session revoked" : step.startsWith("Reassign") ? "Assignment change" : "Permission change", resource: `${M(id).name} — offboarding`, meta: note ? `${step}: ${note}` : step });
      return true;
    },
    completeOffboarding(id: string) {
      const x = M(id);
      if (!canManage(id, "archive") || !x.offboarding || OFFBOARDING.some((s) => s !== "Record offboarding date and administrator" && !x.offboarding!.steps[s])) return false;
      const at = nowIso();
      upM(id, (y) => ({ ...y, status: "deactivated", offboarding: { ...y.offboarding!, completedAt: at, steps: { ...y.offboarding!.steps, "Record offboarding date and administrator": at } } }));
      log({ action: "Account deactivation", resource: x.name, meta: "Offboarding completed; historical activity preserved" });
      return true;
    },

    /* ---------------- Access requests ---------------- */
    requestAccess(r: Omit<AccessRequest, "id" | "status" | "requestedAt" | "memberId">) {
      const id = uid("ar");
      set((s) => ({ ...s, requests: [{ ...r, id, memberId: actorId(), status: "pending", requestedAt: nowIso() }, ...s.requests] }));
      log({ action: "Access request", resource: r.target, meta: r.reason });
      return id;
    },
    canDecide(reqId: string) {
      const r = get().requests.find((x) => x.id === reqId)!;
      if (r.memberId === actorId()) return false; // never approve your own request
      return r.kind === "sensitive" ? hasCap(get(), actor(), "access.approveSensitive") : hasCap(get(), actor(), "access.approve") || roleOf(get().roles, actor())?.isOwner;
    },
    decide(reqId: string, approve: boolean, note?: string) {
      if (!a.canDecide(reqId)) return false;
      const r = get().requests.find((x) => x.id === reqId)!;
      set((s) => ({ ...s, requests: s.requests.map((x) => (x.id === reqId ? { ...x, status: approve ? "approved" : "denied", decidedBy: actorId(), decidedAt: nowIso(), note } : x)) }));
      if (approve) {
        if (r.kind === "sensitive") upM(r.memberId, (x) => ({ ...x, grants: [...new Set([...x.grants, r.target])] }));
        if (r.kind === "module") set((s) => ({ ...s, departments: s.departments }));
      }
      log({ action: "Approval", resource: `${approve ? "Approved" : "Denied"}: ${M(r.memberId).name} — ${r.target}`, meta: note });
      return true;
    },

    /* ---------------- Roles ---------------- */
    canEditRole(roleId: string) {
      const r = get().roles.find((x) => x.id === roleId)!;
      const me = roleOf(get().roles, actor());
      if (!hasCap(get(), actor(), "roles.manage") || r.isOwner || r.isClient) return false;
      return !!me?.isOwner || r.level < (me?.level ?? 0);
    },
    /** Anything not held by the actor can't be granted to a role by the actor (no escalation). */
    clampToActor(r: Role): Role {
      const me = roleOf(get().roles, actor())!;
      if (me.isOwner) return r;
      const perms = Object.fromEntries(Object.entries(r.perms).map(([k, v]) => [k, (v ?? []).filter((act) => (me.perms[k as ModuleKey] ?? []).includes(act))]));
      return { ...r, perms, sensitive: r.sensitive.filter((k) => me.sensitive.includes(k)), caps: r.caps.filter((c) => me.caps.includes(c) && !OWNER_ONLY.includes(c)), allDepartments: r.allDepartments && me.allDepartments, level: Math.min(r.level, me.level - 1) };
    },
    saveRole(role: Role, summary: string) {
      const exists = get().roles.some((x) => x.id === role.id);
      if (exists ? !a.canEditRole(role.id) : !hasCap(get(), actor(), "roles.manage")) return false;
      const clean = a.clampToActor(role);
      set((s) => ({ ...s, roles: exists ? s.roles.map((x) => (x.id === role.id ? clean : x)) : [...s.roles, clean] }));
      log({ action: "Permission change", resource: `Role: ${clean.name}`, meta: summary });
      return true;
    },
    duplicateRole(roleId: string, name: string): string | null {
      if (!hasCap(get(), actor(), "roles.manage")) return null;
      const src = get().roles.find((x) => x.id === roleId)!;
      if (src.isOwner || src.isClient) return null;
      const id = uid("role");
      const copy = a.clampToActor({ ...structuredClone(src), id, name, kind: "custom", description: `Copy of ${src.name}. ${src.description}` });
      set((s) => ({ ...s, roles: [...s.roles, copy] }));
      log({ action: "Permission change", resource: `Role: ${name}`, meta: `Duplicated from ${src.name}` });
      return id;
    },
    deleteRole(roleId: string) {
      const r = get().roles.find((x) => x.id === roleId)!;
      if (r.kind !== "custom" || !a.canEditRole(roleId) || get().members.some((m) => m.roleId === roleId)) return false;
      set((s) => ({ ...s, roles: s.roles.filter((x) => x.id !== roleId) }));
      log({ action: "Permission change", resource: `Role: ${r.name}`, meta: "Custom role deleted" });
      return true;
    },

    /* ---------------- Departments + security ---------------- */
    saveDepartment(d: Department) {
      if (!canDo(get(), actor(), "team", "settings")) return false;
      set((s) => ({ ...s, departments: s.departments.map((x) => (x.key === d.key ? d : x)) }));
      log({ action: "Permission change", resource: `Department settings`, department: d.key });
      return true;
    },
    saveSecurity(sec: SecuritySettings) {
      if (!hasCap(get(), actor(), "security.manage")) return false;
      set((s) => ({ ...s, security: { ...sec, updatedAt: nowIso(), updatedBy: actorId() } }));
      log({ action: "Security settings", resource: "Security policy", meta: "Policy updated — enforced by the authentication service in Phase 3" });
      return true;
    },
  };
  return a;
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

type Ctx = ReturnType<typeof makeActions> &
  State & {
    acting: Acting;
    setActing: (a: Acting) => void;
    me?: Member;
    myRole?: Role;
    can: (module: ModuleKey, action?: ActionKey) => boolean;
    sensitive: (key: string) => boolean;
    cap: (c: Capability) => boolean;
    /** Client IDs a member is assigned to anywhere in the suite. */
    assignedClients: (memberId: string) => Set<string>;
    clientAccess: (client: Pick<Client, "id" | "enrollments">) => boolean;
    /** Backend: the signed-in person and team data have loaded. */
    ready: boolean;
    refreshAudit: () => void;
  };
const Ctx = createContext<Ctx | null>(null);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const [acting, setActingState] = useReducer((_: Acting, a: Acting) => a, { kind: "member", id: "s-mk" } as Acting);
  const ref = useRef(state);
  ref.current = state;
  const aref = useRef(acting);
  aref.current = acting;
  const clients = useClients();
  const tax = useTax();
  const books = useBooks();
  const biz = useBiz();
  const exp = useExp();
  const local = useMemo(() => makeActions(dispatch, () => ref.current, () => (aref.current.kind === "member" ? aref.current.id : "s-mk")), []);
  const [ready, setReady] = useState(!BACKEND);
  const { actions, refresh, refreshAudit } = useTeamSync(local, dispatch, ref, setActingState, setReady);

  const assignedClients = useCallback(
    (memberId: string) => {
      const set = new Set<string>();
      clients.clients.forEach((c) => c.staffIds.includes(memberId) && set.add(c.id));
      tax.returns.forEach((r) => (r.preparerId === memberId || r.reviewerId === memberId) && set.add(r.clientId));
      books.workspaces.forEach((w) => (w.bookkeeperId === memberId || w.reviewerId === memberId) && set.add(w.clientId));
      biz.requests.forEach((r) => r.clientId && (r.assignedTo === memberId || r.reviewerId === memberId) && set.add(r.clientId));
      exp.cases.forEach((c) => c.assignedTo === memberId && set.add(c.clientId));
      exp.matters.forEach((m) => Object.values(m.assignments).includes(memberId) && set.add(m.clientId));
      return set;
    },
    [clients.clients, tax.returns, books.workspaces, biz.requests, exp.cases, exp.matters],
  );

  const value = useMemo<Ctx>(() => {
    const me = acting.kind === "member" ? state.members.find((m) => m.id === acting.id) : undefined;
    const myRole = acting.kind === "client" ? state.roles.find((r) => r.isClient) : roleOf(state.roles, me);
    const clientAccess = (client: Pick<Client, "id" | "enrollments">) => {
      if (acting.kind === "client") return client.id === acting.clientId;
      // Backend: the server already sent only the clients this person may open.
      if (BACKEND) return !!me && me.status === "active";
      if (!me || !myRole || me.status !== "active" || !canDo(state, me, "crm", "view")) return false;
      if (myRole.allDepartments) return true;
      const mine = me.selectedClientIds.includes(client.id) || assignedClients(me.id).has(client.id);
      switch (myRole.scope) {
        case "selected":
          return me.selectedClientIds.includes(client.id);
        case "assigned":
          return mine;
        case "team":
          return mine || state.members.some((x) => x.managerId === me.id && assignedClients(x.id).has(client.id));
        case "all_departments":
          // Clients of the member's own departments only (Client Support works with every client).
          return mine || me.departments.includes("support") || client.enrollments.some((e) => me.departments.includes(SERVICE_DEPT[e.service]));
      }
    };
    return {
      ...actions,
      ...state,
      acting,
      setActing: (a: Acting) => {
        setActingState(a);
        if (!BACKEND) actions.log({ action: "Login", resource: "MKB Business Suite", meta: a.kind === "member" ? "Preview sign-in (no real authentication)" : `Client portal preview — client ${a.clientId}`, actorId: a.kind === "member" ? a.id : "s-mk" });
      },
      me,
      myRole,
      can: (module, action = "view") => acting.kind === "member" && canDo(state, me, module, action),
      sensitive: (key) => acting.kind === "member" && hasSensitive(state, me, key),
      cap: (c) => acting.kind === "member" && hasCap(state, me, c),
      assignedClients,
      clientAccess,
      ready,
      refreshAudit,
    };
  }, [actions, state, acting, assignedClients, ready, refreshAudit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTeam() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTeam must be used inside <TeamProvider>");
  return v;
}

/* ------------------------------------------------------------------ */
/* Backend sync (only when NEXT_PUBLIC_BACKEND=1)                      */
/* ------------------------------------------------------------------ */

type Actions = ReturnType<typeof makeActions>;
type ServerState = { roles: Role[]; departments: Department[]; members: Member[]; invitations: Invitation[]; requests: AccessRequest[]; security?: SecuritySettings };
type AuditRow = { id: string; at: string; actor_member_id: string | null; action: AuditEvent["action"]; resource: string; department: DeptKey | null; meta: string | null; success: number };

/**
 * With the backend on: loads the signed-in person and the team from the server,
 * sends every administrative action to the server (which re-checks it), then
 * reloads the server's version. A refused action is undone and explained.
 */
function useTeamSync(local: Actions, dispatch: React.Dispatch<Action>, ref: React.RefObject<State>, setActing: (a: Acting) => void, setReady: (v: boolean) => void) {
  const queue = useRef(Promise.resolve());
  const refresh = useCallback(async () => {
    try {
      const s = await call<ServerState>("GET", "/api/team/state");
      // Real names for every module's "who did this" (instead of the sample directory).
      setStaffDirectory(s.members.map((m) => ({ id: m.id, name: m.name, initials: m.initials, title: m.title, active: m.status === "active" })));
      dispatch({ type: "fn", fn: (cur) => ({ ...cur, roles: s.roles, departments: s.departments, members: s.members, invitations: s.invitations, requests: s.requests, security: s.security ?? cur.security }) });
    } catch (e) {
      if (!(e instanceof RemoteError && e.status === 401)) notify("Couldn't load team information.");
    }
  }, []);
  const refreshAudit = useCallback(async () => {
    if (!BACKEND) return;
    try {
      const r = await call<{ events: AuditRow[] }>("GET", "/api/team/audit?limit=100");
      dispatch({ type: "fn", fn: (cur) => ({ ...cur, audit: r.events.map((e) => ({ id: e.id, at: e.at, actorId: e.actor_member_id ?? "system", action: e.action, resource: e.resource, department: e.department ?? undefined, meta: e.meta ?? undefined, success: !!e.success })) }) });
    } catch { /* no audit access */ }
  }, []);

  useEffect(() => {
    if (!BACKEND) return;
    (async () => {
      try {
        const me = await call<{ kind: string; member?: { id: string }; caps?: string[] }>("GET", "/api/auth/session");
        if (me.member) { setMeId(me.member.id); setActing({ kind: "member", id: me.member.id }); }
        await refresh();
        if (me.caps?.includes("audit.view")) await refreshAudit();
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const actions = useMemo(() => {
    if (!BACKEND) return local;
    // Server commands run one at a time, in order (e.g. offboarding steps).
    const send = (method: "POST" | "PUT", path: string, body?: unknown) => {
      queue.current = queue.current.then(async () => {
        try { await call(method, path, body); }
        catch (e) { if (!(e instanceof RemoteError && e.status === 401)) notify(e instanceof Error ? e.message : "That change wasn't saved."); }
        await refresh();
      });
    };
    const m = (id: string) => `/api/team/members/${id}`;
    const ok = (r: unknown) => r !== false && r !== null;
    const a: Actions = {
      ...local,
      log: () => {}, // the server writes the audit log
      invite(o) { const id = local.invite(o); if (id) send("POST", "/api/team/invitations", { ...o, memberId: id }); return id; },
      resendInvite(id) { local.resendInvite(id); send("POST", `/api/team/invitations/${id}`, { action: "resend" }); },
      cancelInvite(id) { local.cancelInvite(id); send("POST", `/api/team/invitations/${id}`, { action: "cancel" }); },
      simulateAccept() { notify("With real sign-in, invitations are accepted from the emailed link."); },
      updateProfile(id, patch) { const r = local.updateProfile(id, patch); if (ok(r)) send("PUT", m(id), patch); return r; },
      changeRole(id, roleId) { const r = local.changeRole(id, roleId); if (ok(r)) send("PUT", `${m(id)}/role`, { roleId }); return r; },
      setDepartments(id, departments) { const r = local.setDepartments(id, departments); if (ok(r)) send("PUT", `${m(id)}/departments`, { departments }); return r; },
      setGrant(id, key, on) { const r = local.setGrant(id, key, on); if (ok(r)) send("PUT", `${m(id)}/grants`, { key, on }); return r; },
      setSelectedClients(id, clientIds) { const r = local.setSelectedClients(id, clientIds); if (ok(r)) send("PUT", `${m(id)}/records`, { clientIds }); return r; },
      markReviewed(id) { const r = local.markReviewed(id); if (ok(r)) send("POST", `${m(id)}/review`); return r; },
      suspend(id, reason) { const r = local.suspend(id, reason); if (ok(r)) send("POST", `${m(id)}/status`, { action: "suspend", reason }); return r; },
      reactivate(id) { const r = local.reactivate(id); if (ok(r)) send("POST", `${m(id)}/status`, { action: "reactivate" }); return r; },
      revokeSession(id, sessionId) { const r = local.revokeSession(id, sessionId); if (ok(r)) send("POST", `${m(id)}/status`, sessionId ? { action: "revoke_session", sessionId } : { action: "revoke_sessions" }); return r; },
      toggleOnboarding(id, step) { const r = local.toggleOnboarding(id, step); if (ok(r)) send("POST", `${m(id)}/onboarding`, { step }); return r; },
      startOffboarding(id) { const r = local.startOffboarding(id); if (ok(r)) send("POST", `${m(id)}/offboarding`, { action: "start" }); return r; },
      offboardStep(id, step, note) { const r = local.offboardStep(id, step, note); if (ok(r)) send("POST", `${m(id)}/offboarding`, { action: "step", step, note }); return r; },
      completeOffboarding(id) { const r = local.completeOffboarding(id); if (ok(r)) send("POST", `${m(id)}/offboarding`, { action: "complete" }); return r; },
      requestAccess(r) { const id = local.requestAccess(r); send("POST", "/api/team/requests", r); return id; },
      decide(id, approve, note) { const r = local.decide(id, approve, note); if (ok(r)) send("POST", `/api/team/requests/${id}`, { approve, note }); return r; },
      saveRole(role, summary) { const r = local.saveRole(role, summary); if (ok(r)) send("PUT", `/api/team/roles/${role.id}`, { role, summary }); return r; },
      duplicateRole(fromId, name) { const id = local.duplicateRole(fromId, name); if (id) send("POST", "/api/team/roles", { fromId, id, name }); return id; },
      deleteRole(id) { const r = local.deleteRole(id); if (ok(r)) send("POST", `/api/team/roles/${id}`, { action: "delete" }); return r; },
      saveDepartment(d) { const r = local.saveDepartment(d); if (ok(r)) send("PUT", `/api/team/departments/${d.key}`, { department: d }); return r; },
      saveSecurity(sec) { const r = local.saveSecurity(sec); if (ok(r)) send("PUT", "/api/team/security", sec); return r; },
    };
    return a;
  }, [local]);
  void ref;
  return { actions, refresh, refreshAudit };
}
