"use client";

/**
 * In-browser sample-data store for the Phase 2 frontend.
 *
 * Every action (new client, request document, record payment, …) updates this
 * in-memory state so the interface is fully clickable without a backend.
 * Nothing leaves the browser and nothing persists past a page reload.
 * In Phase 3 these actions become authenticated API calls with the same shapes.
 */
import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from "react";
import { CLIENTS, SAMPLE_NOW, STAGES, staffById } from "@/lib/sample/clients";
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
  | { type: "update"; id: string; fn: (c: Client) => Client; vault?: VaultEntry };

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "reset":
      return init();
    case "addClient":
      return { clients: [a.client, ...state.clients], vault: a.vault ? { ...state.vault, [a.client.id]: a.vault } : state.vault };
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
const init = (): State => ({ clients: structuredClone(CLIENTS), vault: sampleVault() });

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

function makeStore(dispatch: React.Dispatch<Action>, getNextInvoice: () => number, getVault: () => Record<string, VaultEntry>) {
  const up = (id: string, fn: (c: Client) => Client) => dispatch({ type: "update", id, fn });

  return {
    reset: () => dispatch({ type: "reset" }),

    addClient(input: NewClientInput): string {
      const id = `c-${Math.floor(2000 + Math.random() * 7000)}`;
      const at = nowIso();
      const staffIds = input.staffIds.length ? input.staffIds : ["s-mk"];
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
      dispatch({
        type: "update",
        id,
        vault: { ...(v.taxId ? { taxId: v.taxId } : {}), ...(v.ein ? { ein: v.ein } : {}), ...(v.rp?.taxId ? { rpTaxId: v.rp.taxId } : {}) },
        fn: (c) =>
          log(
            {
              ...c,
              dob: v.dob ?? c.dob,
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
    requestDocument(id: string, d: { name: string; service: ServiceKey; category: string; sensitive: boolean; taxYear?: number }): string {
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
    uploadDocument(id: string, d: { name: string; service: ServiceKey; category: string; sensitive: boolean; sizeKb: number; replaces?: string; taxYear?: number }): string {
      const docId = d.replaces ?? uid("d");
      up(id, (c) => {
        const doc: ClientDocument = { id: docId, name: d.name, service: d.service, category: d.category, sensitive: d.sensitive, status: "received", requestedAt: nowIso(), uploadedAt: nowIso(), sizeKb: d.sizeKb, uploadedBy: "staff", taxYear: d.taxYear };
        const documents = d.replaces
          ? c.documents.map((x) => (x.id === d.replaces ? { ...x, status: "received" as const, uploadedAt: nowIso(), sizeKb: d.sizeKb, uploadedBy: "staff" as const } : x))
          : [doc, ...c.documents];
        return log({ ...c, documents }, "upload", `Uploaded "${d.name}"`);
      });
      return docId;
    },
    setDocStatus(id: string, docId: string, status: ClientDocument["status"]) {
      up(id, (c) => {
        const d = c.documents.find((x) => x.id === docId)!;
        const verb = status === "reviewed" ? "Marked reviewed" : status === "rejected" ? "Asked client to re-upload" : "Updated";
        return log({ ...c, documents: c.documents.map((x) => (x.id === docId ? { ...x, status } : x)) }, "upload", `${verb}: "${d.name}"`);
      });
    },
    remindDocument(id: string, docId: string) {
      up(id, (c) => log(c, "message", `Reminder sent for "${c.documents.find((x) => x.id === docId)?.name}"`, "system"));
    },
    logDocumentAccess(id: string, docId: string, action: "Viewed" | "Downloaded") {
      up(id, (c) => log(c, "upload", `${action} "${c.documents.find((x) => x.id === docId)?.name}" (audit)`));
    },

    // Messages ---------------------------------------------------------------
    sendMessage(id: string, body: string, service?: ServiceKey) {
      up(id, (c) =>
        log({ ...c, messages: [...c.messages, { id: uid("m"), from: "staff", author: "MKB Owner", body, at: nowIso(), read: true, service }] }, "message", "Sent a message"),
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
    createInvoice(id: string, i: { service: ServiceKey; description: string; amount: number; dueAt: string; draft: boolean; taxReturnId?: string }) {
      const number = `INV-${getNextInvoice()}`;
      up(id, (c) =>
        log(
          {
            ...c,
            invoices: [{ id: uid("i"), number, service: i.service, description: i.description, amount: i.amount, paid: 0, status: i.draft ? "draft" : "open", issuedAt: nowIso(), dueAt: i.dueAt, taxReturnId: i.taxReturnId }, ...c.invoices],
          },
          "invoice",
          `${i.draft ? "Drafted" : "Sent"} invoice ${number}`,
        ),
      );
      return number;
    },
    sendInvoice(id: string, invId: string) {
      up(id, (c) => log({ ...c, invoices: c.invoices.map((x) => (x.id === invId ? { ...x, status: "open" as const } : x)) }, "invoice", `Sent invoice ${c.invoices.find((x) => x.id === invId)?.number}`));
    },
    recordPayment(id: string, invId: string, amount: number, method: string) {
      up(id, (c) => {
        const invoices = c.invoices.map((x): Invoice => {
          if (x.id !== invId) return x;
          const paid = Math.min(x.amount, x.paid + amount);
          return { ...x, paid, status: paid >= x.amount ? "paid" : "partial" };
        });
        const inv = c.invoices.find((x) => x.id === invId)!;
        return log({ ...c, invoices }, "payment", `Recorded ${method} payment on ${inv.number}`);
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
      up(id, (c) => log({ ...c, notes: [{ id: uid("n"), authorId: "s-mk", body, at: nowIso(), service } satisfies Note, ...c.notes] }, "note", "Added an internal note"));
    },
    togglePin(id: string, noteId: string) {
      up(id, (c) => ({ ...c, notes: c.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)) }));
    },
    deleteNote(id: string, noteId: string) {
      up(id, (c) => log({ ...c, notes: c.notes.filter((n) => n.id !== noteId) }, "note", "Deleted an internal note"));
    },
  };
}

export type ClientStore = ReturnType<typeof makeStore> & { clients: Client[] };

const Ctx = createContext<ClientStore | null>(null);

export function ClientsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const counter = useMemo(() => ({ n: 1200 }), []);
  const getNext = useCallback(() => counter.n++, [counter]);
  const vaultRef = useRef(state.vault);
  vaultRef.current = state.vault;
  const actions = useMemo(() => makeStore(dispatch, getNext, () => vaultRef.current), [getNext]);
  const value = useMemo(() => ({ ...actions, clients: state.clients }), [actions, state.clients]);
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
