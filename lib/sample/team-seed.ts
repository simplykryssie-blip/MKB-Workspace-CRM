/**
 * Team & Permissions sample data — fictional team members only (example.com
 * emails, 555 numbers). The four existing staff identities (s-mk, s-al, s-rt,
 * s-jp) are reused so all historical attribution in other modules stays intact.
 * Kept free of imports from ./clients (clients.ts imports TEAM_STAFF from here).
 */
import { SAMPLE_NOW } from "./time";
import { ACTIONS, MODULES, ONBOARDING, OFFBOARDING, SENSITIVE_KEYS, type AccessRequest, type ActionKey, type AuditEvent, type Department, type Invitation, type Member, type ModuleKey, type Perms, type Role, type SecuritySettings } from "@/lib/team/config";

const d = (days: number, h = 10, m = 0) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};

/* ------------------------------------------------------------------ */
/* Default roles                                                       */
/* ------------------------------------------------------------------ */

const ALL = ACTIONS.map((a) => a.key) as ActionKey[];
const every = (actions: ActionKey[], except: ModuleKey[] = []): Perms => Object.fromEntries(MODULES.filter((m) => !except.includes(m.key)).map((m) => [m.key, [...actions]]));
const SVC: ModuleKey[] = ["tax", "books", "biz", "exp"];
const svc = (actions: ActionKey[]): Perms => Object.fromEntries(SVC.map((k) => [k, [...actions]]));
const DEPT_SENSITIVE = ["tax.viewMasked", "exp.viewMasked", "tax.taxDocs", "tax.financials", "exp.criminalHistory", "exp.arrest", "exp.court", "exp.caseDocs", "exp.screening"];

export const DEFAULT_ROLES: Role[] = [
  {
    id: "role-owner", name: "Owner", kind: "system", level: 100, isOwner: true, allDepartments: true, scope: "all_departments", maxSensitivity: "restricted",
    description: "Full access to the entire MKB Business Suite, including ownership, security, billing and audit logs. Cannot be assigned by administrators or managers.",
    perms: every(ALL), recordTypes: {}, sensitive: [...SENSITIVE_KEYS],
    caps: ["audit.view", "roles.manage", "access.approve", "access.approveSensitive", "security.manage", "integrations.manage", "subscription.manage", "ownership.manage"],
  },
  {
    id: "role-admin", name: "Administrator", kind: "system", level: 80, allDepartments: true, scope: "all_departments", maxSensitivity: "confidential",
    description: "Manages team members, client records, departments and operational settings within authorized limits. Cannot transfer ownership or override owner-only security controls.",
    perms: {
      ...every(["view", "create", "edit", "archive", "assign", "approve", "export", "download", "print"], ["team", "settings"]),
      ...svc(["view", "create", "edit", "archive", "assign", "approve", "export", "download", "print", "settings"]),
      team: ["view", "create", "edit", "archive", "assign", "approve", "export", "settings"],
      settings: ["view", "edit", "settings"],
    },
    recordTypes: {}, sensitive: ["tax.viewMasked", "exp.viewMasked", "tax.ein", "tax.taxDocs", "tax.financials"],
    caps: ["audit.view", "roles.manage", "access.approve"],
  },
  {
    id: "role-manager", name: "Manager", kind: "system", level: 60, allDepartments: false, scope: "all_departments", maxSensitivity: "restricted",
    description: "Manages assigned departments: department clients and cases, assigning and reviewing staff work, approvals when authorized, deadlines and department reports.",
    perms: {
      dashboard: ["view"], crm: ["view", "create", "edit", "assign", "export", "download", "print"], leads: ["view", "create", "edit", "assign"],
      ...svc(["view", "create", "edit", "archive", "assign", "approve", "export", "download", "print"]),
      documents: ["view", "create", "edit", "archive", "download", "print"], communication: ["view", "create", "edit"], billing: ["view"], reports: ["view", "export"], team: ["view"],
    },
    recordTypes: { reports: ["Department report"] }, sensitive: [...DEPT_SENSITIVE], caps: [],
  },
  {
    id: "role-senior", name: "Senior Staff", kind: "system", level: 40, allDepartments: false, scope: "assigned", maxSensitivity: "restricted",
    description: "Handles assigned client work, reviews other staff's work when authorized and assists with quality control. Cannot change permissions.",
    perms: {
      dashboard: ["view"], crm: ["view", "edit", "download", "print"], leads: ["view"],
      ...svc(["view", "create", "edit", "assign", "approve", "download", "print"]),
      documents: ["view", "create", "edit", "download", "print"], communication: ["view", "create"], billing: ["view"], reports: ["view"], team: ["view"],
    },
    recordTypes: { reports: ["Department report"] }, sensitive: [...DEPT_SENSITIVE], caps: [],
  },
  {
    id: "role-staff", name: "Staff", kind: "system", level: 30, allDepartments: false, scope: "assigned", maxSensitivity: "confidential",
    description: "Works assigned clients: creates and updates permitted records, completes tasks, uploads documents and communicates with assigned clients.",
    perms: { dashboard: ["view"], crm: ["view", "edit"], ...svc(["view", "create", "edit", "download"]), documents: ["view", "create", "download"], communication: ["view", "create"] },
    recordTypes: {}, sensitive: ["tax.viewMasked", "exp.viewMasked", "tax.taxDocs", "exp.caseDocs"], caps: [],
  },
  {
    id: "role-limited", name: "Limited Access Staff", kind: "system", level: 10, allDepartments: false, scope: "selected", maxSensitivity: "standard",
    description: "Access only to explicitly assigned tasks and records. Cannot browse the client database, unrelated departments or sensitive records without additional authorization.",
    perms: { dashboard: ["view"], crm: ["view"], ...svc(["view", "edit"]), documents: ["view", "create"], communication: ["view"] },
    recordTypes: { crm: ["Client profile"], documents: ["Standard document"] }, sensitive: [], caps: [],
  },
  {
    id: "role-client", name: "Client", kind: "system", level: 0, isClient: true, allDepartments: false, scope: "selected", maxSensitivity: "standard",
    description: "External portal role. Only the client's own profile, authorized businesses, documents, service requests, invoices and messages — never internal notes, staff assignments, other clients or internal workflows.",
    perms: {}, recordTypes: {}, sensitive: [], caps: [],
  },
];

/* ------------------------------------------------------------------ */
/* Team members (fictional)                                            */
/* ------------------------------------------------------------------ */

const onboarded = (at: string): Member["onboarding"] => Object.fromEntries(ONBOARDING.map((s) => [s, at]));
const sess = (id: string, device: string, location: string, days: number): Member["sessions"][number] => ({ id, device, location, startedAt: d(days, 8), lastActiveAt: d(0, 9 + (id.length % 5)) });
const logins = (days: number[], fails: number[] = []): Member["logins"] => [
  ...days.map((x) => ({ at: d(x, 8, 30), success: true, device: "Chrome · Windows" })),
  ...fails.map((x) => ({ at: d(x, 7, 55), success: false, device: "Unknown browser", reason: "Wrong password" })),
].sort((a, b) => b.at.localeCompare(a.at));
const m = (o: Partial<Member> & Pick<Member, "id" | "name" | "initials" | "title" | "email" | "phone" | "roleId" | "departments" | "status" | "addedAt">): Member => ({
  grants: [], selectedClientIds: [], mfa: "enabled", onboarding: o.status === "invited" ? {} : onboarded(o.addedAt), sessions: [], logins: [], ...o,
});

export const MEMBERS: Member[] = [
  m({ id: "s-mk", name: "MKB Owner", initials: "MK", title: "Owner", email: "owner@mkb-sample.example.com", phone: "(555) 010-0900", roleId: "role-owner", departments: ["tax", "books", "biz", "exp", "admin", "support"], status: "active", addedAt: d(-900), lastLoginAt: d(0, 8, 30), sessions: [sess("se-mk1", "Chrome · macOS", "Riverton, GA (sample)", -2), sess("se-mk2", "Safari · iPhone", "Riverton, GA (sample)", -1)], logins: logins([0, -1, -2, -3]), lastAccessReviewAt: d(-30) }),
  m({ id: "s-dc", name: "Dana Cole", initials: "DC", title: "Operations administrator", email: "dana.cole@mkb-sample.example.com", phone: "(555) 010-0901", roleId: "role-admin", departments: ["admin", "support"], status: "active", addedAt: d(-400), lastLoginAt: d(0, 8, 10), managerId: "s-mk", sessions: [sess("se-dc1", "Edge · Windows", "Lakeside, GA (sample)", -1)], logins: logins([0, -1, -3]), lastAccessReviewAt: d(-45) }),
  m({ id: "s-al", name: "Alex Lane", initials: "AL", title: "Tax manager", email: "alex.lane@mkb-sample.example.com", phone: "(555) 010-0902", roleId: "role-manager", departments: ["tax"], status: "active", addedAt: d(-700), lastLoginAt: d(0, 9), managerId: "s-mk", grants: ["tax.revealSsn", "tax.editSsn"], sessions: [sess("se-al1", "Chrome · Windows", "Springfield, GA (sample)", 0)], logins: logins([0, -1, -2], [-2]), lastAccessReviewAt: d(-120) }),
  m({ id: "s-rt", name: "Robin Tate", initials: "RT", title: "Bookkeeping manager", email: "robin.tate@mkb-sample.example.com", phone: "(555) 010-0903", roleId: "role-manager", departments: ["books"], status: "active", addedAt: d(-650), lastLoginAt: d(-1, 16), managerId: "s-mk", sessions: [sess("se-rt1", "Firefox · Linux", "Oakdale, GA (sample)", -1)], logins: logins([-1, -2, -4]), lastAccessReviewAt: d(-60) }),
  m({ id: "s-jp", name: "Jesse Park", initials: "JP", title: "Case coordinator", email: "jesse.park@mkb-sample.example.com", phone: "(555) 010-0904", roleId: "role-manager", departments: ["exp", "biz"], status: "active", addedAt: d(-500), lastLoginAt: d(0, 8, 45), managerId: "s-mk", grants: ["exp.revealSsn"], sessions: [sess("se-jp1", "Chrome · macOS", "Fairview, GA (sample)", 0)], logins: logins([0, -1, -2]), lastAccessReviewAt: d(-100) }),
  m({ id: "s-sr", name: "Sam Rivera", initials: "SR", title: "Senior tax preparer", email: "sam.rivera@mkb-sample.example.com", phone: "(555) 010-0905", roleId: "role-senior", departments: ["tax"], status: "active", addedAt: d(-260), lastLoginAt: d(0, 9, 20), managerId: "s-al", sessions: [sess("se-sr1", "Chrome · Windows", "Bayview, GA (sample)", 0)], logins: logins([0, -1]), lastAccessReviewAt: d(-80) }),
  m({ id: "s-kn", name: "Kai Nguyen", initials: "KN", title: "Bookkeeper", email: "kai.nguyen@mkb-sample.example.com", phone: "(555) 010-0906", roleId: "role-staff", departments: ["books"], status: "active", addedAt: d(-140), lastLoginAt: d(-1, 15), managerId: "s-rt", mfa: "not_enrolled", sessions: [sess("se-kn1", "Chrome · Chromebook", "Riverton, GA (sample)", -1)], logins: logins([-1, -2], [-1, -1]), lastAccessReviewAt: d(-20) }),
  m({ id: "s-lm", name: "Lee Morales", initials: "LM", title: "Client support specialist", email: "lee.morales@mkb-sample.example.com", phone: "(555) 010-0907", roleId: "role-staff", departments: ["support"], status: "active", addedAt: d(-90), lastLoginAt: d(0, 8, 5), managerId: "s-dc", sessions: [sess("se-lm1", "Safari · macOS", "Lakeside, GA (sample)", 0)], logins: logins([0, -1]), lastAccessReviewAt: d(-85) }),
  m({ id: "s-rp", name: "Riya Patel", initials: "RP", title: "Records clerk", email: "riya.patel@mkb-sample.example.com", phone: "(555) 010-0908", roleId: "role-limited", departments: ["exp"], status: "active", addedAt: d(-40), lastLoginAt: d(-2, 11), managerId: "s-jp", selectedClientIds: ["c-1010"], grants: ["exp.arrest"], sessions: [], logins: logins([-2, -3]), lastAccessReviewAt: d(-40) }),
  m({ id: "s-ow", name: "Owen Wells", initials: "OW", title: "Business services associate", email: "owen.wells@mkb-sample.example.com", phone: "(555) 010-0909", roleId: "role-staff", departments: ["biz"], status: "suspended", addedAt: d(-200), lastLoginAt: d(-12, 9), managerId: "s-jp", logins: logins([-12], [-11, -11, -11, -11, -11]), lastAccessReviewAt: d(-150) }),
  m({ id: "s-hb", name: "Harper Bell", initials: "HB", title: "Bookkeeper (former)", email: "harper.bell@mkb-sample.example.com", phone: "(555) 010-0910", roleId: "role-staff", departments: [], status: "deactivated", addedAt: d(-600), lastLoginAt: d(-75, 17), managerId: "s-rt", logins: logins([-75]),
    offboarding: { startedAt: d(-74), byId: "s-dc", steps: Object.fromEntries(OFFBOARDING.map((s) => [s, d(-74, 15)])), completedAt: d(-74, 16) } }),
  m({ id: "s-nf", name: "Noah Fischer", initials: "NF", title: "Tax associate", email: "noah.fischer@mkb-sample.example.com", phone: "(555) 010-0911", roleId: "role-staff", departments: ["tax"], status: "invited", addedAt: d(-2), managerId: "s-al", mfa: "not_enrolled" }),
  m({ id: "s-er", name: "Elena Ruiz", initials: "ER", title: "Senior bookkeeper", email: "elena.ruiz@mkb-sample.example.com", phone: "(555) 010-0912", roleId: "role-senior", departments: ["books"], status: "invited", addedAt: d(-16), managerId: "s-rt", mfa: "not_enrolled" }),
];

/** Staff identities beyond the original four — used by staffById so attribution resolves everywhere. */
export const TEAM_STAFF = MEMBERS.filter((x) => !["s-mk", "s-al", "s-rt", "s-jp"].includes(x.id)).map((x) => ({ id: x.id, name: x.name, initials: x.initials, title: x.title }));

export const INVITATIONS: Invitation[] = [
  { id: "inv-1", memberId: "s-nf", email: "noah.fischer@mkb-sample.example.com", name: "Noah Fischer", roleId: "role-staff", departments: ["tax"], managerId: "s-al", grants: [], sentAt: d(-2, 11), expiresAt: d(5, 11), status: "pending", invitedBy: "s-dc" },
  { id: "inv-2", memberId: "s-er", email: "elena.ruiz@mkb-sample.example.com", name: "Elena Ruiz", roleId: "role-senior", departments: ["books"], managerId: "s-rt", grants: [], sentAt: d(-16, 10), expiresAt: d(-9, 10), status: "expired", invitedBy: "s-mk" },
  { id: "inv-0", memberId: "s-rp", email: "riya.patel@mkb-sample.example.com", name: "Riya Patel", roleId: "role-limited", departments: ["exp"], managerId: "s-jp", grants: [], sentAt: d(-42, 9), expiresAt: d(-35, 9), status: "accepted", invitedBy: "s-jp" },
];

export const DEPARTMENT_CONFIG: Department[] = [
  { key: "tax", managerId: "s-al", reporting: true, modules: ["tax"], workflow: { "Prepare returns": "all", "Review & sign off returns": "senior", "Transmit e-file": "manager", "Approve fee adjustments": "manager" } },
  { key: "books", managerId: "s-rt", reporting: true, modules: ["books"], workflow: { "Review months": "all", "Record reconciliations": "all", "Final approval": "manager", "Deliver reports & close months": "senior" } },
  { key: "biz", managerId: "s-jp", reporting: true, modules: ["biz"], workflow: { "Process service requests": "all", "Record agency submissions": "senior", "Record verified approvals": "manager", "Approve completion": "manager" } },
  { key: "exp", managerId: "s-jp", reporting: true, modules: ["exp"], workflow: { "Request records": "all", "Record screening reviews": "senior", "Approve administrative processing": "manager", "Record filings & court updates": "senior" } },
  { key: "admin", managerId: "s-dc", reporting: true, modules: [], workflow: { "Manage company settings": "manager", "Manage billing operations": "manager" } },
  { key: "support", managerId: "s-dc", reporting: false, modules: [], workflow: { "Respond to client messages": "all", "Schedule appointments": "all" } },
];

export const ACCESS_REQUESTS: AccessRequest[] = [
  { id: "ar-1", memberId: "s-sr", kind: "sensitive", target: "tax.revealSsn", reason: "Need to verify a dependent's SSN against the client's documents for a 2025 return (sample).", status: "pending", requestedAt: d(-1, 14) },
  { id: "ar-2", memberId: "s-lm", kind: "module", target: "books", reason: "Clients call support about their monthly reports; read-only Bookkeeping access would help (sample).", status: "pending", requestedAt: d(0, 9, 10) },
  { id: "ar-3", memberId: "s-rp", kind: "sensitive", target: "exp.arrest", reason: "Records requests for assigned cases (sample).", status: "approved", requestedAt: d(-38), decidedBy: "s-mk", decidedAt: d(-37), note: "Approved for assigned records only." },
  { id: "ar-4", memberId: "s-kn", kind: "module", target: "tax", reason: "Wanted to see a client's tax return (sample).", status: "denied", requestedAt: d(-20), decidedBy: "s-rt", decidedAt: d(-19), note: "Bookkeeping staff don't get Tax Preparation access — ask the tax team." },
];

const ev = (id: string, days: number, h: number, actorId: string, action: AuditEvent["action"], resource: string, o: Partial<AuditEvent> = {}): AuditEvent => ({ id, at: d(days, h, (id.length * 7) % 60), actorId, action, resource, success: true, ...o });
export const AUDIT_SEED: AuditEvent[] = [
  ev("au-01", 0, 8, "s-mk", "Login", "MKB Business Suite", { meta: "Chrome · macOS · MFA" }),
  ev("au-02", 0, 8, "s-dc", "Login", "MKB Business Suite", { meta: "Edge · Windows · MFA" }),
  ev("au-03", 0, 9, "s-al", "Sensitive reveal", "Client c-1001 — full SSN", { department: "tax", meta: "Tax return TR-c-1001-2025" }),
  ev("au-04", 0, 9, "s-sr", "Client record access", "Client c-1001", { department: "tax" }),
  ev("au-05", 0, 9, "s-lm", "Access request", "Bookkeeping module (view)", { department: "support" }),
  ev("au-06", -1, 7, "s-kn", "Failed login", "MKB Business Suite", { success: false, meta: "Wrong password" }),
  ev("au-07", -1, 7, "s-kn", "Failed login", "MKB Business Suite", { success: false, meta: "Wrong password" }),
  ev("au-08", -1, 8, "s-kn", "Login", "MKB Business Suite", { meta: "Chrome · Chromebook · MFA not enrolled" }),
  ev("au-09", -1, 14, "s-sr", "Access request", "Tax & financial: Reveal full SSN", { department: "tax" }),
  ev("au-10", -1, 15, "s-jp", "Sensitive download", "Court minutes — EXP-2042-C2", { department: "exp" }),
  ev("au-11", -1, 16, "s-rt", "Approval", "Bookkeeping final approval — Harbor Demo Bakery LLC, Sep 2026", { department: "books" }),
  ev("au-12", -2, 10, "s-dc", "Invitation", "Noah Fischer (Staff, Tax Preparation)", { department: "tax" }),
  ev("au-13", -2, 11, "s-al", "Failed login", "MKB Business Suite", { success: false, meta: "Wrong MFA code" }),
  ev("au-14", -2, 15, "s-mk", "Record export", "Clients list (CSV)", { meta: "12 rows" }),
  ev("au-15", -3, 9, "s-dc", "Assignment change", "Client c-1002 — added Kai Nguyen", { department: "books" }),
  ev("au-16", -5, 13, "s-mk", "Permission change", "Role: Manager — enabled Reports export", { meta: "High-impact change confirmed" }),
  ev("au-17", -11, 7, "s-ow", "Failed login", "MKB Business Suite", { success: false, meta: "5 failed attempts — account locked" }),
  ev("au-18", -11, 9, "s-dc", "Account suspension", "Owen Wells", { department: "biz", meta: "Repeated failed logins; pending review" }),
  ev("au-19", -16, 10, "s-mk", "Invitation", "Elena Ruiz (Senior Staff, Bookkeeping)", { department: "books" }),
  ev("au-20", -20, 9, "s-rt", "Access request", "Denied: Kai Nguyen — Tax Preparation", { department: "books" }),
  ev("au-21", -37, 9, "s-mk", "Approval", "Granted Riya Patel: Expungement arrest records", { department: "exp" }),
  ev("au-22", -60, 12, "s-al", "Password change", "Alex Lane", {}),
  ev("au-23", -74, 15, "s-dc", "Session revoked", "Harper Bell — all sessions", { department: "books" }),
  ev("au-24", -74, 16, "s-dc", "Account deactivation", "Harper Bell", { department: "books", meta: "Offboarding completed; 3 clients reassigned to Robin Tate" }),
  ev("au-25", -90, 11, "s-mk", "Role change", "Dana Cole: Manager → Administrator", { department: "admin", meta: "High-impact change confirmed" }),
];

export const SECURITY_DEFAULTS: SecuritySettings = {
  mfaRequiredFor: ["role-owner", "role-admin", "role-manager"],
  passwordMinLength: 12,
  passwordComplexity: true,
  passwordRotationDays: 0,
  sessionTimeoutMinutes: 30,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  recovery: ["Email verification", "Owner-approved reset"],
  reauthForSensitive: true,
};
