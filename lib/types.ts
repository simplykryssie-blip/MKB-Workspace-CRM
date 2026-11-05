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
};

export type Message = {
  id: string;
  from: "client" | "staff";
  author: string;
  body: string;
  at: string;
  service?: ServiceKey;
  read: boolean;
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

export type ActivityKind = "upload" | "payment" | "signature" | "message" | "intake" | "status" | "appointment" | "note" | "invoice";

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
    industry: string;
    fiscalYearEnd: string;
  };
  staffIds: string[];
  status: ClientStatus;
  portal: PortalStatus;
  tags: string[];
  source: string;
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
