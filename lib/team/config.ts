/**
 * Team & Permissions — the central permission model for the MKB Business Suite.
 *
 * Everything here describes what the production backend must enforce. In the
 * Phase 2 prototype these checks drive navigation and button availability so the
 * design can be reviewed, but frontend checks are NOT security: the backend must
 * enforce every permission independently of the interface.
 */

export const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "crm", label: "CRM / Clients" },
  { key: "leads", label: "Leads" },
  { key: "tax", label: "Tax Preparation" },
  { key: "books", label: "Bookkeeping" },
  { key: "biz", label: "Business Services" },
  { key: "exp", label: "Expungement" },
  { key: "documents", label: "Documents" },
  { key: "communication", label: "Communication" },
  { key: "billing", label: "Billing" },
  { key: "monarch", label: "Monarch Tax Suite" },
  { key: "campaigns", label: "Campaigns (marketing email & text)" },
  { key: "reports", label: "Reports" },
  { key: "team", label: "Team & Permissions" },
  { key: "settings", label: "Company Settings" },
] as const;
export type ModuleKey = (typeof MODULES)[number]["key"];

export const ACTIONS = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "archive", label: "Archive" },
  { key: "assign", label: "Assign" },
  { key: "approve", label: "Approve" },
  { key: "export", label: "Export" },
  { key: "download", label: "Download" },
  { key: "print", label: "Print" },
  { key: "settings", label: "Manage settings" },
] as const;
export type ActionKey = (typeof ACTIONS)[number]["key"];

export const DEPARTMENTS = [
  { key: "tax", label: "Tax Preparation" },
  { key: "books", label: "Bookkeeping" },
  { key: "biz", label: "Business Services" },
  { key: "exp", label: "Expungement Services" },
  { key: "admin", label: "Administration" },
  { key: "support", label: "Client Support" },
] as const;
export type DeptKey = (typeof DEPARTMENTS)[number]["key"];
export const deptLabel = (k: DeptKey) => DEPARTMENTS.find((d) => d.key === k)!.label;

/** Service modules belong to a department: membership is required (no automatic cross-department access). */
export const MODULE_DEPT: Partial<Record<ModuleKey, DeptKey>> = { tax: "tax", books: "books", biz: "biz", exp: "exp" };

/** Record types per module — permissions can be narrowed to specific record types. */
export const RECORD_TYPES: Record<ModuleKey, string[]> = {
  dashboard: ["Dashboard widgets"],
  crm: ["Client profile", "Business entity", "Client notes"],
  leads: ["Lead", "Lead notes"],
  tax: ["Tax return", "Organizer", "E-file submission"],
  books: ["Monthly close", "Reconciliation", "Financial report"],
  biz: ["Service request", "Formation filing", "Compliance deadline"],
  exp: ["Expungement matter", "Expungement case", "Records request", "Screening review"],
  documents: ["Standard document", "Sensitive document"],
  communication: ["Client message", "Appointment", "Internal note"],
  billing: ["Invoice", "Payment", "Refund / adjustment"],
  monarch: ["Office", "Sale", "Commission", "Bank report"],
  campaigns: ["Campaign", "Audience", "Template"],
  reports: ["Department report", "Company report"],
  team: ["Team member", "Role", "Invitation"],
  settings: ["Company settings", "Integrations"],
};

export const SENSITIVITY = ["standard", "confidential", "restricted"] as const;
export type Sensitivity = (typeof SENSITIVITY)[number];
export const SENSITIVITY_META: Record<Sensitivity, { label: string; note: string }> = {
  standard: { label: "Standard", note: "Ordinary client and work records" },
  confidential: { label: "Confidential", note: "Financial statements, invoices, internal notes" },
  restricted: { label: "Restricted", note: "Requires the separate sensitive-information permissions below" },
};

/** Highly sensitive information — never implied by an ordinary view permission. */
export const SENSITIVE_GROUPS = [
  {
    key: "tax",
    label: "Tax & financial information",
    dept: "tax" as DeptKey,
    perms: [
      { key: "tax.viewMasked", label: "View masked SSN / ITIN / EIN" },
      { key: "tax.revealSsn", label: "Reveal full SSN" },
      { key: "tax.editSsn", label: "Edit SSN" },
      { key: "tax.itin", label: "ITIN access" },
      { key: "tax.ein", label: "EIN access" },
      { key: "tax.taxDocs", label: "Tax documents" },
      { key: "tax.financials", label: "Financial statements" },
      { key: "tax.bank", label: "Bank information" },
      { key: "tax.payment", label: "Payment information" },
      { key: "tax.downloadSensitive", label: "Download sensitive documents" },
      { key: "tax.exportSensitive", label: "Export sensitive information" },
    ],
  },
  {
    key: "exp",
    label: "Expungement information",
    dept: "exp" as DeptKey,
    perms: [
      { key: "exp.viewMasked", label: "View masked SSN" },
      { key: "exp.revealSsn", label: "Reveal full SSN" },
      { key: "exp.editSsn", label: "Edit SSN" },
      { key: "exp.criminalHistory", label: "Criminal history" },
      { key: "exp.arrest", label: "Arrest records" },
      { key: "exp.court", label: "Court records" },
      { key: "exp.caseDocs", label: "Case documents" },
      { key: "exp.personalHistory", label: "Sensitive personal history" },
      { key: "exp.screening", label: "Expungement screening information" },
      { key: "exp.downloadSensitive", label: "Download sensitive documents" },
      { key: "exp.exportSensitive", label: "Export sensitive information" },
    ],
  },
  {
    key: "books",
    label: "Bookkeeping financial information",
    dept: "books" as DeptKey,
    perms: [
      { key: "books.bank", label: "Full bank & card account numbers" },
    ],
  },
] as const;
export const SENSITIVE_KEYS = SENSITIVE_GROUPS.flatMap((g) => g.perms.map((p) => p.key)) as string[];
export const sensitiveLabel = (k: string) => {
  for (const g of SENSITIVE_GROUPS) for (const p of g.perms) if (p.key === k) return `${g.label}: ${p.label}`;
  return k;
};
/** Grants that count as high-impact (always need confirmation). */
export const HIGH_IMPACT = new Set(["books.bank", "tax.revealSsn", "tax.editSsn", "exp.revealSsn", "exp.editSsn", "tax.exportSensitive", "exp.exportSensitive", "tax.downloadSensitive", "exp.downloadSensitive"]);

/** Owner-only and administrative capabilities (beyond the module matrix). */
export const CAPABILITIES = [
  { key: "audit.view", label: "View audit logs" },
  { key: "roles.manage", label: "Create and edit roles & permissions" },
  { key: "access.approve", label: "Approve access requests (non-sensitive)" },
  { key: "access.approveSensitive", label: "Approve sensitive access requests" },
  { key: "security.manage", label: "Manage security settings" },
  { key: "integrations.manage", label: "Manage integrations" },
  { key: "subscription.manage", label: "Manage billing & subscription" },
  { key: "ownership.manage", label: "Ownership transfer & account recovery" },
] as const;
export type Capability = (typeof CAPABILITIES)[number]["key"];
export const OWNER_ONLY: Capability[] = ["access.approveSensitive", "security.manage", "subscription.manage", "ownership.manage", "integrations.manage"];

export type Scope = "all_departments" | "assigned" | "team" | "selected";
export const SCOPE_META: Record<Scope, { label: string; note: string }> = {
  all_departments: { label: "All records in authorized departments", note: "Every client and case in the member's departments" },
  team: { label: "Records within a managed team", note: "Records assigned to the member or anyone who reports to them" },
  assigned: { label: "Assigned records only", note: "Only clients, cases and work assigned to the member" },
  selected: { label: "Individually selected records", note: "Only records explicitly granted to the member" },
};

export type Perms = Partial<Record<ModuleKey, ActionKey[]>>;
export type Role = {
  id: string;
  name: string;
  description: string;
  kind: "system" | "custom";
  /** Rank for "no one assigns a higher role" checks. */
  level: number;
  isOwner?: boolean;
  isClient?: boolean;
  /** Not limited by department membership (Owner, Administrator). */
  allDepartments: boolean;
  scope: Scope;
  maxSensitivity: Sensitivity;
  perms: Perms;
  recordTypes: Partial<Record<ModuleKey, string[]>>;
  sensitive: string[];
  caps: Capability[];
};

export type MemberStatus = "invited" | "active" | "suspended" | "deactivated";
export const STATUS_META: Record<MemberStatus, { label: string; tone: "info" | "success" | "warning" | "neutral" }> = {
  invited: { label: "Invited", tone: "info" },
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "warning" },
  deactivated: { label: "Deactivated", tone: "neutral" },
};

export const ONBOARDING = ["Invitation accepted", "Account created", "Role assigned", "Departments assigned", "Permissions reviewed", "Security requirements completed", "Manager assigned", "Training completed"] as const;
export const OFFBOARDING = ["Suspend account", "Revoke active sessions", "Remove department access", "Reassign clients", "Reassign open tasks", "Review outstanding approvals", "Preserve historical activity", "Record offboarding date and administrator"] as const;

export type Session = { id: string; device: string; location: string; startedAt: string; lastActiveAt: string; revokedAt?: string };
export type LoginEvent = { at: string; success: boolean; device: string; reason?: string };

export type Member = {
  id: string;
  name: string;
  initials: string;
  title: string;
  email: string;
  phone: string;
  roleId: string;
  departments: DeptKey[];
  status: MemberStatus;
  addedAt: string;
  lastLoginAt?: string;
  managerId?: string;
  /** Individually granted sensitive permissions (on top of the role). */
  grants: string[];
  /** For "Individually selected records" scope. */
  selectedClientIds: string[];
  mfa: "enabled" | "not_enrolled";
  onboarding: Partial<Record<(typeof ONBOARDING)[number], string>>;
  offboarding?: { startedAt: string; byId: string; steps: Partial<Record<(typeof OFFBOARDING)[number], string>>; completedAt?: string };
  sessions: Session[];
  logins: LoginEvent[];
  lastAccessReviewAt?: string;
};

export type Invitation = { id: string; memberId: string; email: string; name: string; roleId: string; departments: DeptKey[]; managerId?: string; grants: string[]; sentAt: string; expiresAt: string; status: "pending" | "accepted" | "expired" | "cancelled"; resentAt?: string; invitedBy: string };

export type AccessRequest = { id: string; memberId: string; kind: "sensitive" | "module" | "record"; target: string; reason: string; status: "pending" | "approved" | "denied"; requestedAt: string; decidedBy?: string; decidedAt?: string; note?: string };

export type Department = { key: DeptKey; managerId?: string; reporting: boolean; modules: ModuleKey[]; workflow: Record<string, "manager" | "senior" | "all" | "off"> };
export const WORKFLOW_PERMS: Record<DeptKey, string[]> = {
  tax: ["Prepare returns", "Review & sign off returns", "Transmit e-file", "Approve fee adjustments"],
  books: ["Review months", "Record reconciliations", "Final approval", "Deliver reports & close months"],
  biz: ["Process service requests", "Record agency submissions", "Record verified approvals", "Approve completion"],
  exp: ["Request records", "Record screening reviews", "Approve administrative processing", "Record filings & court updates"],
  admin: ["Manage company settings", "Manage billing operations"],
  support: ["Respond to client messages", "Schedule appointments"],
};
export const WORKFLOW_LEVEL: Record<"manager" | "senior" | "all" | "off", string> = { manager: "Managers only", senior: "Senior staff and managers", all: "All department members", off: "Disabled" };

export const AUDIT_ACTIONS = [
  "Login",
  "Logout",
  "Failed login",
  "Password change",
  "Invitation",
  "Role change",
  "Permission change",
  "Client record access",
  "Sensitive reveal",
  "Sensitive download",
  "Record export",
  "Assignment change",
  "Approval",
  "Account suspension",
  "Account deactivation",
  "Session revoked",
  "Access request",
  "Security settings",
  "Record update",
  "Website update",
  "Website publish",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditEvent = { id: string; at: string; actorId: string; action: AuditAction; resource: string; department?: DeptKey; meta?: string; success: boolean };

export type SecuritySettings = {
  mfaRequiredFor: string[];
  passwordMinLength: number;
  passwordComplexity: boolean;
  passwordRotationDays: number;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  recovery: string[];
  reauthForSensitive: boolean;
  updatedAt?: string;
  updatedBy?: string;
};

export const NOT_SECURITY = "Prototype preview — these checks only change what the interface shows. The production backend must enforce every permission independently of the interface.";
