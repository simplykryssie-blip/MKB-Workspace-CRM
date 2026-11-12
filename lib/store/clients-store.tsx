"use client";

/**
 * In-browser sample-data store for the Phase 2 frontend.
 *
 * Every action (new client, request document, record payment, …) updates this
 * in-memory state so the interface is fully clickable without a backend.
 * Nothing leaves the browser and nothing persists past a page reload.
 * In Phase 3 these actions become authenticated API calls with the same shapes.
 */
import { useEffect } from "react";
import { BACKEND, RemoteError, call, debouncer, notify, pendingClientCreates } from "@/lib/sync/remote";
import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from "react";
import { CLIENTS, SAMPLE_NOW, STAGES, staffById, meId } from "@/lib/sample/clients";
import type {
  ActivityItem,
  ActivityKind,
  Appointment,
  Client,
  ClientDocument,
  Enrollment,
  Invoice,
  Message,
  Note,
  ServiceKey,
  Signature,
} from "@/lib/types";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
/** Session-relative timestamp: sample "now" plus real seconds elapsed, so new items sort as newest. */
const started = Date.now();
export const nowIso = () => new Date(SAMPLE_NOW.getTime() + (Date.now() - started)).toISOString();

/** Full tax identifiers, kept apart from client records (Phase 3: encrypted
 *  server-side vault, fetched only by permitted staff, every read audited). */
export type VaultEntry = { taxId?: string; ein?: string; rpTaxId?: string };
type State = { clients: Client[]; vault: Record<string, VaultEntry> };

type Action =
  | { type: "reset" }
  | { type: "addClient"; client: Client; vault?: VaultEntry }
  | { type: "update"; id: string; fn: (c: Client) => Client; vault?: VaultEntry }
  | { type: "hydrate"; clients: Client[]; known: Set<string> }
  | { type: "replace"; client: Client }
  | { type: "dropVault"; id: string }
  | { type: "remove"; id: string };

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "reset":
      return init();
    case "addClient":
      return { clients: [a.client, ...state.clients], vault: a.vault ? { ...state.vault, [a.client.id]: a.vault } : state.vault };
    case "hydrate": {
      // Keep anything created here that the server doesn't have yet (it's still being saved).
      const local = state.clients.filter((c) => !a.clients.some((x) => x.id === c.id) && !a.known.has(c.id));
      return { clients: [...local, ...a.clients], vault: Object.fromEntries(Object.entries(state.vault).filter(([id]) => local.some((c) => c.id === id))) };
    }
    case "replace":
      return { ...state, clients: state.clients.some((c) => c.id === a.client.id) ? state.clients.map((c) => (c.id === a.client.id ? a.client : c)) : [a.client, ...state.clients] };
    case "remove":
      return { ...state, clients: state.clients.filter((c) => c.id !== a.id) };
    case "dropVault": {
      const v = { ...state.vault };
      delete v[a.id];
      return { ...state, vault: v };
    }
    case "update":
      return {
        clients: state.clients.map((c) => (c.id === a.id ? a.fn(c) : c)),
        vault: a.vault ? { ...state.vault, [a.id]: { ...state.vault[a.id], ...a.vault } } : state.vault,
      };
  }
}

/** Sample vault: full numbers use the never-issued 000 SSN area and 00 EIN
 *  prefix, so they can't belong to a real person or business. */
const sampleVault = (): Record<string, VaultEntry> =>
  Object.fromEntries(
    CLIENTS.map((c) => [
      c.id,
      {
        taxId: c.taxIdLast4 ? `000-00-${c.taxIdLast4}` : undefined,
        ein: c.business?.einLast4 ? `00-000${c.business.einLast4}` : undefined,
        rpTaxId: c.business?.responsibleParty?.taxIdLast4 ? `000-00-${c.business.responsibleParty.taxIdLast4}` : undefined,
      },
    ]),
  );
// With the backend on, records load from the server after sign-in (never sample data).
const init = (): State => (BACKEND ? { clients: [], vault: {} } : { clients: structuredClone(CLIENTS), vault: sampleVault() });

function log(c: Client, kind: ActivityKind, text: string, actor: ActivityItem["actor"] = "staff"): Client {
  const at = nowIso();
  return { ...c, lastActivityAt: at, activity: [{ id: uid("x"), kind, text, at, actor }, ...c.activity] };
}

export type NewClientInput = {
  type: Client["type"];
  name: string;
  contactName?: string;
  email: string;
  phone: string;
  address: Client["address"];
  dob?: string;
  taxIdType?: "SSN" | "ITIN";
  taxId?: string;
  ein?: string;
  responsibleParty?: { name: string; title: string; taxIdType: "SSN" | "ITIN"; taxId?: string };
  entityType?: NonNullable<Client["business"]>["entityType"];
  services: ServiceKey[];
  /** Optional per-service engagement titles (defaults otherwise). */
  titles?: Partial<Record<ServiceKey, string>>;
  staffIds: string[];
  invite: boolean;
  /** Carried over when converting a lead: nothing is re-entered and history is kept. */
  fromLead?: { leadId: string; source: string; tags: string[]; notes: Note[]; activity: ActivityItem[] };
};

export const DEFAULT_TITLES: Record<ServiceKey, string> = {
  tax: "2025 Individual return (1040)",
  books: "Monthly bookkeeping",
  biz: "Business formation",
  expunge: "Record review",
};
/** Engagement title that fits the client: business returns use the entity's IRS form. */
export function defaultTitleFor(s: ServiceKey, type: Client["type"] = "individual", entity?: NonNullable<Client["business"]>["entityType"]) {
  if (s === "tax" && type === "business") {
    const form = entity === "S-Corp" ? "1120-S" : entity === "C-Corp" ? "1120" : entity === "Nonprofit" ? "990" : entity === "Sole Prop" ? "1040 + Sch C" : "1065";
    return `2025 Business return (${form})`;
  }
  if (s === "biz" && type === "individual") return "Business formation consult";
  return DEFAULT_TITLES[s];
}
export const DEFAULT_FEES: Record<ServiceKey, number> = { tax: 425, books: 650, biz: 899, expunge: 750 };

const last4 = (v?: string) => (v ? v.replace(/\D/g, "").slice(-4) : undefined);

type Remote = {
  setIds: (id: string, v: Parameters<ReturnType<typeof makeStore>["updateTaxIds"]>[1]) => Promise<void>;
  /** Billing calls (live CRM): the server owns invoices and payments; the client is reloaded afterwards. */
  billing: (clientId: string, method: "POST" | "PUT", path: string, body: unknown, done?: string) => void;
};
const maskedDob = (iso?: string) => (iso ? `${iso.slice(0, 4)}-••-••` : undefined);

function makeStore(dispatch: React.Dispatch<Action>, getNextInvoice: () => number, getVault: () => Record<string, VaultEntry>, remote?: Remote) {
  const up = (id: string, fn: (c: Client) => Client) => dispatch({ type: "update", id, fn });
  /** Live CRM: sends the file to private storage under the document's id, then marks the record as having its file. */
  const storeFile = async (id: string, docId: string, file: Blob & { name?: string }, name: string, sensitive: boolean) => {
    const fname = (file.name || name).replace(/[\r\n]/g, " ").slice(0, 150);
    try {
      await pendingClientCreates.get(id); // a brand-new client must exist on the server first
      const r = await fetch(`/api/clients/${encodeURIComponent(id)}/files/${encodeURIComponent(docId)}${sensitive ? "?sensitive=1" : ""}`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(fname) }, body: file });
      const j = (await r.json().catch(() => ({}))) as { error?: string; sizeKb?: number };
      if (!r.ok) throw new Error(j.error ?? "Upload failed.");
      up(id, (c) => ({ ...c, documents: c.documents.map((x) => (x.id === docId ? { ...x, hasFile: true, fileName: fname, sizeKb: j.sizeKb ?? x.sizeKb } : x)) }));
      return true;
    } catch (e) {
      notify(`"${name}" wasn't saved — ${e instanceof Error ? e.message : "upload failed"} Please upload it again.`);
      return false;
    }
  };

  return {
    reset: () => dispatch({ type: "reset" }),

    addClient(input: NewClientInput): string {
      const id = `c-${Math.floor(100000 + Math.random() * 899_900_000)}`;
      const at = nowIso();
      const staffIds = input.staffIds.length ? input.staffIds : [meId()];
      const enrollments: Enrollment[] = input.services.map((s) => ({
        id: uid("e"),
        service: s,
        title: input.titles?.[s]?.trim() || defaultTitleFor(s, input.type, input.entityType),
        stage: STAGES[s][0],
        progress: 5,
        status: "active",
        staffId: staffIds[0],
        startedAt: at,
        fee: DEFAULT_FEES[s],
      }));
      const client: Client = {
        id,
        type: input.type,
        name: input.name.trim(),
        contactName: input.contactName?.trim() || undefined,
        email: input.email.trim(),
        phone: input.phone.trim() || "—",
        preferredContact: "Email",
        address: input.address,
        dob: input.type === "individual" ? input.dob : undefined,
        taxIdType: input.type === "individual" && input.taxId ? input.taxIdType : undefined,
        taxIdLast4: input.type === "individual" ? last4(input.taxId) : undefined,
        business:
          input.type === "business"
            ? { legalName: input.name.trim(), entityType: input.entityType ?? "LLC", state: input.address.state || "GA", industry: "—", fiscalYearEnd: "December", einLast4: last4(input.ein),
                responsibleParty: input.responsibleParty?.name.trim()
                  ? { name: input.responsibleParty.name.trim(), title: input.responsibleParty.title, taxIdType: input.responsibleParty.taxId ? input.responsibleParty.taxIdType : undefined, taxIdLast4: last4(input.responsibleParty.taxId) }
                  : undefined }
            : undefined,
        staffIds,
        status: "onboarding",
        portal: input.invite ? "invited" : "not_invited",
        tags: input.fromLead ? [...new Set([...input.fromLead.tags, "Converted lead"])] : [],
        source: input.fromLead?.source ?? "Manual entry",
        leadId: input.fromLead?.leadId,
        since: at,
        lastActivityAt: at,
        enrollments,
        documents: [],
        messages: [],
        appointments: [],
        invoices: [],
        signatures: [],
        notes: input.fromLead ? input.fromLead.notes.map((n) => ({ ...n, id: uid("n") })) : [],
        activity: [
          ...(input.fromLead ? [{ id: uid("x"), kind: "lead" as const, text: `Converted from lead ${input.fromLead.leadId}`, at, actor: "staff" as const }] : []),
          ...(input.invite ? [{ id: uid("x"), kind: "message" as const, text: "Portal invitation sent", at, actor: "system" as const }] : []),
          { id: uid("x"), kind: "intake", text: "Client record created", at, actor: "staff" },
          // Full lead history travels with the client (and stays on the lead too).
          ...(input.fromLead ? input.fromLead.activity.map((a) => ({ ...a, id: uid("x"), text: `Lead: ${a.text}` })) : []),
        ],
      };
      dispatch({ type: "addClient", client, vault: { taxId: input.type === "individual" ? input.taxId : undefined, ein: input.type === "business" ? input.ein : undefined, rpTaxId: input.type === "business" ? input.responsibleParty?.taxId : undefined } });
      return id;
    },

    updateClient(id: string, patch: Partial<Client>, summary = "Updated client details") {
      up(id, (c) => log({ ...c, ...patch }, "status", summary));
    },

    /** Replace tax identifiers. Only last-4 lands on the client record. */
    updateTaxIds(id: string, v: { taxId?: string; taxIdType?: "SSN" | "ITIN"; ein?: string; dob?: string; rp?: { name: string; title: string; taxIdType: "SSN" | "ITIN"; taxId?: string } }) {
      const changed = [v.taxId && (v.taxIdType ?? "SSN"), v.ein && "EIN", v.dob && "date of birth", v.rp && "responsible party", v.rp?.taxId && `responsible party ${v.rp.taxIdType}`].filter(Boolean).join(", ");
      if (!changed) return;
      // Backend: full numbers go straight to the server's encrypted vault; the browser keeps only last 4.
      if (BACKEND && remote) remote.setIds(id, v);
      dispatch({
        type: "update",
        id,
        vault: BACKEND ? undefined : { ...(v.taxId ? { taxId: v.taxId } : {}), ...(v.ein ? { ein: v.ein } : {}), ...(v.rp?.taxId ? { rpTaxId: v.rp.taxId } : {}) },
        fn: (c) =>
          log(
            {
              ...c,
              dob: v.dob ? (BACKEND ? maskedDob(v.dob) : v.dob) : c.dob,
              taxIdType: v.taxId ? v.taxIdType : c.taxIdType,
              taxIdLast4: v.taxId ? last4(v.taxId) : c.taxIdLast4,
              business: c.business
                ? {
                    ...c.business,
                    einLast4: v.ein ? last4(v.ein) : c.business.einLast4,
                    responsibleParty: v.rp
                      ? {
                          name: v.rp.name,
                          title: v.rp.title,
                          taxIdType: v.rp.taxId ? v.rp.taxIdType : c.business.responsibleParty?.taxIdType,
                          taxIdLast4: v.rp.taxId ? last4(v.rp.taxId) : c.business.responsibleParty?.taxIdLast4,
                        }
                      : c.business.responsibleParty,
                  }
                : c.business,
            },
            "status",
            `Updated ${changed} (audit)`,
          ),
      });
    },

    /** Backend: audited reveal from the server's vault (needs record access and the reveal permission). */
    async revealRemote(id: string, field: "taxId" | "ein" | "dob" | "rpTaxId"): Promise<string | undefined> {
      const f = field === "taxId" ? "tax_id" : field === "rpTaxId" ? "rp_tax_id" : field;
      const r = await call<{ value: string }>("POST", `/api/clients/${id}/identifiers/${f}`);
      return r.value;
    },
    /** Audited reveal of a full identifier. Returns undefined if none on file. */
    reveal(id: string, field: "taxId" | "ein" | "dob" | "rpTaxId"): string | undefined {
      const label = field === "taxId" ? "SSN/ITIN" : field === "ein" ? "EIN" : field === "rpTaxId" ? "responsible party SSN/ITIN" : "date of birth";
      up(id, (c) => log(c, "status", `Revealed full ${label} (audit)`));
      if (field === "dob") return undefined; // DOB is on the record; caller formats it
      return getVault()[id]?.[field];
    },

    /** Record an event on the client's activity history (used by service workspaces). */
    logActivity(id: string, kind: ActivityKind, text: string, actor: ActivityItem["actor"] = "staff") {
      up(id, (c) => log(c, kind, text, actor));
    },

    sendInvite(id: string) {
      up(id, (c) => log({ ...c, portal: c.portal === "active" ? "active" : "invited" }, "message", "Portal invitation sent", "system"));
    },

    // Services ------------------------------------------------------------
    enroll(id: string, e: { service: ServiceKey; title: string; staffId: string; fee: number; dueAt?: string }): string {
      const eid = uid("e");
      up(id, (c) =>
        log(
          {
            ...c,
            staffIds: c.staffIds.includes(e.staffId) ? c.staffIds : [...c.staffIds, e.staffId],
            enrollments: [
              ...c.enrollments,
              { id: eid, ...e, stage: STAGES[e.service][0], progress: 5, status: "active", startedAt: nowIso() },
            ],
          },
          "intake",
          `Enrolled in ${e.title}`,
        ),
      );
      return eid;
    },

    /** Keep any engagement in step with its service workspace (e.g. bookkeeping month stage). */
    syncEnrollmentStage(id: string, enrollmentId: string, stage: string, status: Enrollment["status"], progress: number) {
      up(id, (c) => ({ ...c, enrollments: c.enrollments.map((e) => (e.id === enrollmentId ? { ...e, stage, status, progress } : e)) }));
    },

    /** Keep a client's Tax Preparation engagement in step with its return's status. */
    syncTaxEnrollment(id: string, enrollmentId: string, returnStatus: string) {
      const stages = STAGES.tax;
      up(id, (c) => ({
        ...c,
        enrollments: c.enrollments.map((e): Enrollment => {
          if (e.id !== enrollmentId) return e;
          const rejected = returnStatus === "Rejected";
          const stage = rejected ? "Submitted" : stages.includes(returnStatus) ? returnStatus : e.stage;
          const i = stages.indexOf(stage);
          const status: Enrollment["status"] = rejected
            ? "on_hold"
            : returnStatus === "Completed"
              ? "complete"
              : returnStatus === "Awaiting Documents" || returnStatus === "Awaiting Client Approval"
                ? "waiting_on_client"
                : returnStatus === "Ready for Review"
                  ? "in_review"
                  : "active";
          return { ...e, stage, status, progress: Math.max(5, Math.round((i / (stages.length - 1)) * 100)) };
        }),
      }));
    },

    advanceStage(id: string, enrollmentId: string) {
      up(id, (c) => {
        let text = "";
        const enrollments = c.enrollments.map((e) => {
          if (e.id !== enrollmentId) return e;
          const stages = STAGES[e.service];
          const i = stages.indexOf(e.stage);
          if (i >= stages.length - 1) return e;
          const next = stages[i + 1];
          const last = i + 1 === stages.length - 1;
          text = `Moved "${e.title}" to "${next}"`;
          return {
            ...e,
            stage: next,
            progress: last ? 100 : Math.round(((i + 1) / (stages.length - 1)) * 100),
            status: last ? ("complete" as const) : e.status === "waiting_on_client" ? ("active" as const) : e.status,
          };
        });
        return text ? log({ ...c, enrollments }, "status", text) : c;
      });
    },

    setEnrollmentStatus(id: string, enrollmentId: string, status: Enrollment["status"]) {
      up(id, (c) => {
        const e = c.enrollments.find((x) => x.id === enrollmentId)!;
        return log({ ...c, enrollments: c.enrollments.map((x) => (x.id === enrollmentId ? { ...x, status } : x)) }, "status", `Set "${e.title}" to ${status.replace(/_/g, " ")}`);
      });
    },

    // Documents ------------------------------------------------------------
    requestDocument(id: string, d: { name: string; service: ServiceKey; category: string; sensitive: boolean; taxYear?: number; workspaceId?: string; period?: string; entityId?: string; bizRequestId?: string; expMatterId?: string; expCaseId?: string }): string {
      const docId = uid("d");
      up(id, (c) =>
        log(
          { ...c, documents: [{ id: docId, ...d, status: "requested", requestedAt: nowIso() }, ...c.documents] },
          "upload",
          `Requested "${d.name}"${d.taxYear ? ` (TY ${d.taxYear})` : ""} from client`,
        ),
      );
      return docId;
    },
    uploadDocument(id: string, d: { name: string; service: ServiceKey; category: string; sensitive: boolean; sizeKb: number; replaces?: string; taxYear?: number; workspaceId?: string; period?: string; by?: "client" | "staff"; entityId?: string; bizRequestId?: string; expiresAt?: string; expMatterId?: string; expCaseId?: string; /** The actual file (live CRM): stored privately under this document. */ file?: Blob & { name?: string }; /** Hidden from the client until released (e.g. reports awaiting approval). */ internal?: boolean }): string {
      const docId = d.replaces ?? uid("d");
      const by = d.by ?? "staff";
      if (BACKEND && d.file) void storeFile(id, docId, d.file, d.name, d.sensitive);
      up(id, (c) => {
        const doc: ClientDocument = { id: docId, name: d.name, service: d.service, category: d.category, sensitive: d.sensitive, status: "received", requestedAt: nowIso(), uploadedAt: nowIso(), sizeKb: d.sizeKb, uploadedBy: by, taxYear: d.taxYear, workspaceId: d.workspaceId, period: d.period, entityId: d.entityId, bizRequestId: d.bizRequestId, expiresAt: d.expiresAt, expMatterId: d.expMatterId, expCaseId: d.expCaseId, internal: d.internal || undefined };
        const documents = d.replaces
          ? c.documents.map((x) => (x.id === d.replaces ? { ...x, status: "received" as const, uploadedAt: nowIso(), sizeKb: d.sizeKb, uploadedBy: by, internal: d.internal ?? x.internal } : x))
          : [doc, ...c.documents];
        return log({ ...c, documents }, "upload", `Uploaded "${d.name}"`, by);
      });
      return docId;
    },
    /** Upload (or replace) the file behind an existing document record. */
    attachFile(id: string, docId: string, file: Blob & { name?: string }, name: string, sensitive = false) {
      return storeFile(id, docId, file, name, sensitive);
    },
    /** Show or hide a document from the client (portal). */
    setDocInternal(id: string, docId: string, internal: boolean) {
      up(id, (c) => ({ ...c, documents: c.documents.map((x) => (x.id === docId ? { ...x, internal: internal || undefined } : x)) }));
    },
    setDocStatus(id: string, docId: string, status: ClientDocument["status"]) {
      up(id, (c) => {
        const d = c.documents.find((x) => x.id === docId)!;
        const verb = status === "reviewed" ? "Marked reviewed" : status === "rejected" ? "Asked client to re-upload" : "Updated";
        return log({ ...c, documents: c.documents.map((x) => (x.id === docId ? { ...x, status } : x)) }, "upload", `${verb}: "${d.name}"`);
      });
    },
    /** Business services: a deliverable was delivered to the client portal. */
    markDocDelivered(id: string, docId: string) {
      up(id, (c) => log({ ...c, documents: c.documents.map((x) => (x.id === docId ? { ...x, deliveredAt: nowIso(), status: "reviewed" as const } : x)) }, "upload", `Delivered "${c.documents.find((x) => x.id === docId)?.name}" to the client portal`));
    },
    setDocExpiry(id: string, docId: string, expiresAt?: string) {
      up(id, (c) => ({ ...c, documents: c.documents.map((x) => (x.id === docId ? { ...x, expiresAt } : x)) }));
    },
    /** Live CRM: emails the client the document's name and a portal link (the server records it). */
    remindDocument(id: string, docId: string): Promise<boolean> {
      if (BACKEND) {
        return call<{ sent: boolean }>("POST", `/api/clients/${id}/documents/remind`, { docIds: [docId] })
          .then(() => { window.dispatchEvent(new CustomEvent("mkb:client-changed", { detail: id })); return true; })
          .catch((e) => { notify(e instanceof RemoteError ? e.message : "Couldn't send the reminder."); return false; });
      }
      up(id, (c) => log(c, "message", `Reminder sent for "${c.documents.find((x) => x.id === docId)?.name}"`, "system"));
      return Promise.resolve(true);
    },
    logDocumentAccess(id: string, docId: string, action: "Viewed" | "Downloaded") {
      up(id, (c) => log(c, "upload", `${action} "${c.documents.find((x) => x.id === docId)?.name}" (audit)`));
    },

    // Messages ---------------------------------------------------------------
    sendMessage(id: string, body: string, service?: ServiceKey, opts?: { from?: "client" | "staff"; author?: string; workspaceId?: string; bizRequestId?: string; expMatterId?: string; /** Its own email is sent separately. */ quiet?: boolean }) {
      const from = opts?.from ?? "staff";
      up(id, (c) =>
        log(
          { ...c, messages: [...c.messages, { id: uid("m"), from, author: opts?.author ?? (from === "client" ? c.contactName ?? c.name : "MKB Owner"), body, at: nowIso(), read: from === "staff", service, workspaceId: opts?.workspaceId, bizRequestId: opts?.bizRequestId, expMatterId: opts?.expMatterId, quiet: opts?.quiet || undefined }] },
          "message",
          from === "client" ? "Client sent a message" : "Sent a message",
          from === "client" ? "client" : "staff",
        ),
      );
    },
    markMessagesRead(id: string) {
      up(id, (c) => (c.messages.some((m) => !m.read) ? { ...c, messages: c.messages.map((m): Message => ({ ...m, read: true })) } : c));
    },

    // Appointments -----------------------------------------------------------
    schedule(id: string, a: Omit<Appointment, "id" | "status">) {
      up(id, (c) =>
        log({ ...c, appointments: [...c.appointments, { ...a, id: uid("a"), status: "scheduled" as const }].sort((x, y) => x.at.localeCompare(y.at)) }, "appointment", `Scheduled "${a.title}"`),
      );
    },
    setAppointmentStatus(id: string, apptId: string, status: Appointment["status"]) {
      up(id, (c) => {
        const a = c.appointments.find((x) => x.id === apptId)!;
        return log({ ...c, appointments: c.appointments.map((x) => (x.id === apptId ? { ...x, status } : x)) }, "appointment", `${status === "cancelled" ? "Cancelled" : status === "completed" ? "Completed" : "Updated"} "${a.title}"`);
      });
    },

    // Invoices -----------------------------------------------------------------
    createInvoice(id: string, i: { service: ServiceKey; description: string; amount: number; dueAt: string; draft: boolean; taxReturnId?: string; workspaceId?: string; bizRequestId?: string; expMatterId?: string; lines?: Invoice["lines"]; paymentMode?: Invoice["paymentMode"] }) {
      if (BACKEND && remote) {
        remote.billing(id, "POST", "/api/billing/invoices", { clientId: id, ...i, lines: i.lines?.length ? i.lines : [{ label: i.description, amount: i.amount, kind: "service" }] });
        return "the new invoice";
      }
      const number = `INV-${getNextInvoice()}`;
      up(id, (c) =>
        log(
          {
            ...c,
            invoices: [{ id: uid("i"), number, service: i.service, description: i.description, amount: i.amount, paid: 0, status: i.draft ? "draft" : "open", issuedAt: nowIso(), dueAt: i.dueAt, taxReturnId: i.taxReturnId, workspaceId: i.workspaceId, bizRequestId: i.bizRequestId, expMatterId: i.expMatterId, lines: i.lines }, ...c.invoices],
          },
          "invoice",
          `${i.draft ? "Drafted" : "Sent"} invoice ${number}`,
        ),
      );
      return number;
    },
    sendInvoice(id: string, invId: string) {
      if (BACKEND && remote) return remote.billing(id, "POST", `/api/billing/invoices/${invId}/send`, {}, "Invoice sent");
      up(id, (c) => log({ ...c, invoices: c.invoices.map((x) => (x.id === invId ? { ...x, status: "open" as const } : x)) }, "invoice", `Sent invoice ${c.invoices.find((x) => x.id === invId)?.number}`));
    },
    recordPayment(id: string, invId: string, amount: number, method: string) {
      if (BACKEND && remote) return remote.billing(id, "POST", `/api/billing/invoices/${invId}/payments`, { amount, method });
      up(id, (c) => {
        const invoices = c.invoices.map((x): Invoice => {
          if (x.id !== invId) return x;
          const paid = Math.min(x.amount, x.paid + amount);
          return { ...x, paid, status: paid >= x.amount ? "paid" : "partial", paidAt: paid >= x.amount ? nowIso() : x.paidAt };
        });
        const inv = c.invoices.find((x) => x.id === invId)!;
        return log({ ...c, invoices }, "payment", `Recorded ${method} payment on ${inv.number}`);
      });
    },

    /** Refund (reduces amount paid), credit (reduces amount owed) or correction (changes the total). History is kept on the invoice. */
    adjustInvoice(id: string, invId: string, adj: { kind: "refund" | "credit" | "correction"; amount: number; note: string; byId: string }) {
      if (BACKEND && remote) return remote.billing(id, "POST", `/api/billing/invoices/${invId}/adjust`, { kind: adj.kind, amount: adj.amount, note: adj.note });
      up(id, (c) => {
        const inv = c.invoices.find((x) => x.id === invId)!;
        const invoices = c.invoices.map((x): Invoice => {
          if (x.id !== invId) return x;
          // A refund returns money that is then no longer owed, so it lowers both the total and the amount paid.
          const amount = adj.kind === "correction" ? Math.max(0, x.amount + adj.amount) : Math.max(0, x.amount - adj.amount);
          const paid = adj.kind === "refund" ? Math.max(0, x.paid - adj.amount) : Math.min(x.paid, amount);
          const status: Invoice["status"] = x.status === "draft" ? "draft" : paid >= amount ? "paid" : paid > 0 ? "partial" : x.status === "overdue" ? "overdue" : "open";
          return { ...x, amount, paid, status, adjustments: [{ id: uid("adj"), at: nowIso(), ...adj }, ...(x.adjustments ?? [])] };
        });
        return log({ ...c, invoices }, "payment", `${adj.kind === "refund" ? "Refunded" : adj.kind === "credit" ? "Credited" : "Corrected"} ${inv.number}: $${adj.amount.toFixed(2)} — ${adj.note}`);
      });
    },

    // Signatures ---------------------------------------------------------------
    requestSignature(id: string, s: { document: string; service: ServiceKey }): string {
      const sigId = uid("s");
      up(id, (c) => log({ ...c, signatures: [{ id: sigId, ...s, status: "pending", sentAt: nowIso() } satisfies Signature, ...c.signatures] }, "signature", `Sent "${s.document}" for signature`));
      return sigId;
    },
    /** Record a signature as completed (in Phase 3 this comes from the client signing in the portal). */
    markSigned(id: string, sigId: string) {
      up(id, (c) => log({ ...c, signatures: c.signatures.map((x) => (x.id === sigId ? { ...x, status: "signed" as const, signedAt: nowIso() } : x)) }, "signature", `Signed "${c.signatures.find((x) => x.id === sigId)?.document}"`, "client"));
    },
    resendSignature(id: string, sigId: string) {
      up(id, (c) => log({ ...c, signatures: c.signatures.map((x) => (x.id === sigId ? { ...x, sentAt: nowIso() } : x)) }, "signature", `Resent "${c.signatures.find((x) => x.id === sigId)?.document}"`, "system"));
    },
    cancelSignature(id: string, sigId: string) {
      up(id, (c) => log({ ...c, signatures: c.signatures.map((x) => (x.id === sigId ? { ...x, status: "expired" as const } : x)) }, "signature", `Voided "${c.signatures.find((x) => x.id === sigId)?.document}"`));
    },

    // Notes -----------------------------------------------------------------------
    addNote(id: string, body: string, service?: ServiceKey) {
      up(id, (c) => log({ ...c, notes: [{ id: uid("n"), authorId: meId(), body, at: nowIso(), service } satisfies Note, ...c.notes] }, "note", "Added an internal note"));
    },
    togglePin(id: string, noteId: string) {
      up(id, (c) => ({ ...c, notes: c.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)) }));
    },
    deleteNote(id: string, noteId: string) {
      up(id, (c) => log({ ...c, notes: c.notes.filter((n) => n.id !== noteId) }, "note", "Deleted an internal note"));
    },
  };
}

export type ClientStore = ReturnType<typeof makeStore> & { clients: Client[]; ready: boolean };

const Ctx = createContext<ClientStore | null>(null);

export function ClientsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const counter = useMemo(() => ({ n: 1200 }), []);
  const getNext = useCallback(() => counter.n++, [counter]);
  const vaultRef = useRef(state.vault);
  vaultRef.current = state.vault;
  const sync = useClientSync(state, dispatch);
  const actions = useMemo(() => makeStore(dispatch, getNext, () => vaultRef.current, sync.remote), [getNext, sync.remote]);
  const value = useMemo(() => ({ ...actions, clients: state.clients, ready: sync.ready }), [actions, state.clients, sync.ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClients() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useClients must be used inside <ClientsProvider>");
  return v;
}

export function useClient(id: string) {
  const s = useClients();
  return s.clients.find((c) => c.id === id);
}

export { staffById };

/* ------------------------------------------------------------------ */
/* Backend sync (only when NEXT_PUBLIC_BACKEND=1)                      */
/* ------------------------------------------------------------------ */

type Rev = Client & { rev?: number };
/**
 * Loads clients from the server, then saves every change back: new clients are
 * created (identifiers go to the encrypted vault), edited clients are saved with
 * the revision they started from. If someone else saved first, the latest
 * version is loaded instead. The server checks permissions on every save.
 */
function useClientSync(state: State, dispatch: React.Dispatch<Action>) {
  const [ready, setReady] = useReducer(() => true, !BACKEND);
  const synced = useRef(new Map<string, Client>()); // last version the server has (by object identity)
  const revs = useRef(new Map<string, number>());
  const inflight = useRef(new Set<string>());
  const later = useRef(debouncer(500)).current;
  const stateRef = useRef(state);
  stateRef.current = state;

  const adopt = useCallback((c: Rev, replace: boolean) => {
    revs.current.set(c.id, c.rev ?? 1);
    if (replace) dispatch({ type: "replace", client: c });
    synced.current.set(c.id, replace ? c : stateRef.current.clients.find((x) => x.id === c.id) ?? c);
  }, []);
  const reload = useCallback(async (id: string) => {
    try {
      const r = await call<{ client: Rev }>("GET", `/api/clients/${id}?full=1`);
      revs.current.set(id, r.client.rev ?? 1);
      dispatch({ type: "replace", client: r.client });
      synced.current.set(id, r.client);
    } catch { /* no longer accessible */ }
  }, []);

  // Another module changed a client on the server (e.g. a tax intake updated the profile): reload it.
  useEffect(() => {
    if (!BACKEND) return;
    const on = (e: Event) => { const id = (e as CustomEvent<string>).detail; if (id) void reload(id); };
    window.addEventListener("mkb:client-changed", on);
    return () => window.removeEventListener("mkb:client-changed", on);
  }, [reload]);

  useEffect(() => {
    if (!BACKEND) return;
    call<{ clients: Rev[] }>("GET", "/api/clients?full=1")
      .then((r) => {
        r.clients.forEach((c) => { revs.current.set(c.id, c.rev ?? 1); synced.current.set(c.id, c); });
        dispatch({ type: "hydrate", clients: r.clients, known: new Set() });
        setReady();
      })
      .catch((e) => { if (!(e instanceof RemoteError && e.status === 401)) { notify("Couldn't load clients. Check your connection and reload."); setReady(); } });
  }, []);

  const save = useCallback(async (id: string) => {
    if (inflight.current.has(id)) return later(id, () => save(id)); // one save at a time per client
    const c = stateRef.current.clients.find((x) => x.id === id);
    if (!c || synced.current.get(id) === c) return;
    inflight.current.add(id);
    try {
      if (!revs.current.has(id)) {
        // New client: create it, sending identifiers once (then forget them in the browser).
        const v = stateRef.current.vault[id] ?? {};
        const created = (async () => {
          const r = await call<{ client: Rev }>("POST", "/api/clients", {
            client: c,
            fromLeadId: c.leadId,
            identifiers: { taxId: v.taxId, taxIdType: c.taxIdType, ein: v.ein, rpTaxId: v.rpTaxId, dob: c.dob && /^\d{4}-\d{2}-\d{2}$/.test(c.dob) ? c.dob : undefined },
          });
          dispatch({ type: "dropVault", id });
          const now = stateRef.current.clients.find((x) => x.id === id);
          // Keep edits made while creating; otherwise show the server's (masked) version.
          adopt(r.client, now === c);
          return true;
        })();
        pendingClientCreates.set(id, created.catch(() => false));
        await created;
      } else {
        const r = await call<{ client: Rev }>("PUT", `/api/clients/${id}`, { client: { ...c, rev: revs.current.get(id) } });
        revs.current.set(id, r.client.rev ?? 1);
        synced.current.set(id, c);
      }
    } catch (e) {
      if (e instanceof RemoteError && e.status === 401) return;
      notify(e instanceof RemoteError ? e.message : "Couldn't save — check your connection.");
      // A refused create is undone (otherwise it would be retried forever).
      if (!revs.current.has(id) && e instanceof RemoteError && e.status < 500) { dispatch({ type: "remove", id }); dispatch({ type: "dropVault", id }); return; }
      await reload(id);
    } finally {
      inflight.current.delete(id);
    }
    // Anything changed while we were saving gets its own save.
    if (stateRef.current.clients.find((x) => x.id === id) !== synced.current.get(id)) later(id, () => save(id));
  }, []);

  useEffect(() => {
    if (!BACKEND || !ready) return;
    state.clients.forEach((c) => { if (synced.current.get(c.id) !== c) later(c.id, () => save(c.id)); });
  }, [state.clients, ready]);

  const remote = useMemo<Remote | undefined>(() => (BACKEND ? {
    async setIds(id, v) {
      const put = (f: string, value: string, kind?: string) => call("PUT", `/api/clients/${id}/identifiers/${f}`, { value, kind });
      try {
        await pendingClientCreates.get(id);
        if (v.taxId) await put("tax_id", v.taxId, v.taxIdType);
        if (v.ein) await put("ein", v.ein);
        if (v.dob) await put("dob", v.dob);
        if (v.rp?.taxId) await put("rp_tax_id", v.rp.taxId, v.rp.taxIdType);
      } catch (e) {
        notify(e instanceof RemoteError ? e.message : "Couldn't save the identifier.");
        await reload(id);
      }
    },
    billing(clientId, method, path, body, done) {
      (async () => {
        try {
          await pendingClientCreates.get(clientId);
          await call(method, path, body);
          if (done) notify(done);
        } catch (e) {
          notify(e instanceof RemoteError ? e.message : "Couldn't save the invoice — check your connection.");
        }
        await reload(clientId);
        window.dispatchEvent(new CustomEvent("mkb:billing-changed", { detail: clientId }));
      })();
    },
  } : undefined), []);

  return { ready, remote };
}
