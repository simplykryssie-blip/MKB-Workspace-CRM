/**
 * Domain types for the MKB Business Suite.
 *
 * These mirror the shape the Phase 3 database will have, so screens built
 * against sample data now can switch to real queries without redesign.
 * One Client record is shared by every service division (no duplicates).
 */

export type ServiceKey = "tax" | "books" | "biz" | "expunge";

export type Staff = {
  id: string;
  name: string;
  initials: string;
  title: string;
};

export type ClientType = "individual" | "business";
export type ClientStatus = "active" | "onboarding" | "inactive";
export type PortalStatus = "active" | "invited" | "not_invited";

/** One client's enrollment in one service division. */
export type Enrollment = {
  id: string;
  service: ServiceKey;
  /** e.g. "2025 Individual return (1040)" or "Monthly bookkeeping" */
  title: string;
  /** Workflow stage label, specific to each division. */
  stage: string;
  /** 0–100, for progress bars. */
  progress: number;
  status: "active" | "waiting_on_client" | "in_review" | "complete" | "on_hold";
  staffId: string;
  startedAt: string;
  dueAt?: string;
  fee: number;
};

export type DocStatus = "requested" | "received" | "reviewed" | "rejected";

export type ClientDocument = {
  id: string;
  name: string;
  service: ServiceKey;
  category: string;
  status: DocStatus;
  /** Sensitive docs (IDs, tax returns, court records) need elevated permission. */
  sensitive: boolean;
  uploadedAt?: string;
  requestedAt: string;
  sizeKb?: number;
  uploadedBy?: "client" | "staff";
  /** Tax documents are tagged by tax year so years never mix. */
  taxYear?: number;
  /** Bookkeeping documents are tagged by business workspace and month ("2026-10"). */
  workspaceId?: string;
  period?: string;
};

export type Message = {
  id: string;
  from: "client" | "staff";
  author: string;
  body: string;
  at: string;
  service?: ServiceKey;
  read: boolean;
  /** Bookkeeping: which business workspace a client-visible message belongs to. */
  workspaceId?: string;
};

export type Appointment = {
  id: string;
  title: string;
  service: ServiceKey;
  at: string;
  durationMin: number;
  mode: "In person" | "Video" | "Phone";
  staffId: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
};

export type InvoiceStatus = "draft" | "open" | "overdue" | "paid" | "partial";

export type Invoice = {
  id: string;
  number: string;
  service: ServiceKey;
  description: string;
  amount: number;
  paid: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  /** Set for tax preparation invoices — links billing to a specific return. */
  taxReturnId?: string;
  /** Set for bookkeeping invoices — links billing to a business workspace. */
  workspaceId?: string;
};

export type Signature = {
  id: string;
  document: string;
  service: ServiceKey;
  status: "pending" | "signed" | "declined" | "expired";
  sentAt: string;
  signedAt?: string;
};

export type Note = {
  id: string;
  authorId: string;
  body: string;
  at: string;
  pinned?: boolean;
  service?: ServiceKey;
};

export type ActivityKind = "upload" | "payment" | "signature" | "message" | "intake" | "status" | "appointment" | "note" | "invoice" | "call" | "lead";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  text: string;
  at: string;
  actor: "client" | "staff" | "system";
};

export type Client = {
  id: string;
  type: ClientType;
  /** Display name: person's name, or business name. */
  name: string;
  /** Primary contact person (for businesses). */
  contactName?: string;
  email: string;
  phone: string;
  preferredContact: "Email" | "Phone" | "Text" | "Portal";
  address: { line1: string; line2?: string; city: string; state: string; zip: string };
  /** ISO date (YYYY-MM-DD). Displayed masked; full value only on audited reveal. */
  dob?: string;
  /** Individual taxpayer ID type and last four digits. The full number lives
   *  in the encrypted vault (sample: in-memory), never on the client record. */
  taxIdType?: "SSN" | "ITIN";
  taxIdLast4?: string;
  business?: {
    legalName: string;
    entityType: "LLC" | "S-Corp" | "C-Corp" | "Sole Prop" | "Partnership" | "Nonprofit";
    state: string;
    formedAt?: string;
    /** Last four of the EIN; full EIN lives in the vault. */
    einLast4?: string;
    /** IRS "responsible party": the individual who controls the entity
     *  (owner, member, officer). Full SSN/ITIN lives in the vault. */
    responsibleParty?: { name: string; title: string; taxIdType?: "SSN" | "ITIN"; taxIdLast4?: string };
    industry: string;
    fiscalYearEnd: string;
  };
  staffIds: string[];
  status: ClientStatus;
  portal: PortalStatus;
  tags: string[];
  source: string;
  /** Set when the client was created by converting a lead (history is preserved on the lead). */
  leadId?: string;
  since: string;
  lastActivityAt: string;
  enrollments: Enrollment[];
  documents: ClientDocument[];
  messages: Message[];
  appointments: Appointment[];
  invoices: Invoice[];
  signatures: Signature[];
  notes: Note[];
  activity: ActivityItem[];
};

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

/** A pipeline stage. Stages are customizable by the owner (add, rename, reorder, remove). */
export type LeadStage = { id: string; name: string };

/** Open = in the pipeline; converted = became a client; lost = closed without converting. */
export type LeadStatus = "open" | "converted" | "lost";
export type LeadPriority = "low" | "medium" | "high" | "urgent";

export type LeadReminder = { id: string; at: string; note: string; done: boolean; ownerId: string };

export type Lead = {
  id: string;
  type: ClientType;
  /** Person's name, or business name. */
  name: string;
  contactName?: string;
  email: string;
  phone: string;
  address?: { line1: string; line2?: string; city: string; state: string; zip: string };
  business?: { entityType: NonNullable<Client["business"]>["entityType"]; industry: string };
  source: string;
  /** e.g. referrer's name, campaign, ad set. */
  sourceDetail?: string;
  /** Services the lead is interested in — become the default enrollments on conversion. */
  interests: ServiceKey[];
  estValue: number;
  ownerId: string;
  stageId: string;
  status: LeadStatus;
  priority: LeadPriority;
  tags: string[];
  createdAt: string;
  lastActivityAt: string;
  reminders: LeadReminder[];
  notes: Note[];
  activity: ActivityItem[];
  lostReason?: string;
  convertedClientId?: string;
  convertedAt?: string;
};
