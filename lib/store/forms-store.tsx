"use client";

/**
 * Forms store (prototype, in-browser). Production (Phase 3): forms and
 * submissions live in the database; public submissions are received by the
 * backend, which checks spam/rate limits and creates the lead server-side.
 */
import { createContext, useContext, useMemo, useReducer, useRef } from "react";
import { SAMPLE_FORMS, SAMPLE_SUBMISSIONS } from "@/lib/sample/forms-seed";
import { baseFields, consentField, fid, sensitiveReason, slugify, type FormField, type LeadForm, type Submission } from "@/lib/forms/config";
import { nowIso, useClients } from "@/lib/store/clients-store";
import { useLeads } from "@/lib/store/leads-store";
import { SAMPLE_NOW } from "@/lib/sample/clients";
import type { Client, ServiceKey } from "@/lib/types";

type State = { forms: LeadForm[]; submissions: Submission[] };
type Action = { type: "set"; fn: (s: State) => State };
const init = (): State => ({ forms: structuredClone(SAMPLE_FORMS), submissions: structuredClone(SAMPLE_SUBMISSIONS) });
const reducer = (s: State, a: Action) => a.fn(s);
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const digits = (v?: string) => (v ?? "").replace(/\D/g, "");
const SERVICE_BY_LABEL: Record<string, ServiceKey> = { tax: "tax", books: "books", biz: "biz", expunge: "expunge" };
const US_STATE_NAMES: Record<string, string> = { Louisiana: "LA", Texas: "TX" };

/** Visible fields given the answers so far (show-if rules). */
export const visibleFields = (f: LeadForm, data: Record<string, string>) => f.fields.filter((x) => !x.showIf || (data[x.showIf.fieldId] ?? "").split("|").includes(x.showIf.equals));

export function validateSubmission(f: LeadForm, data: Record<string, string>): Record<string, string> {
  const errs: Record<string, string> = {};
  visibleFields(f, data).forEach((x) => {
    const v = (data[x.id] ?? "").trim();
    if (x.type === "heading" || x.type === "paragraph") return;
    if (x.required && !v) errs[x.id] = x.type === "consent" ? "Please agree to be contacted so we can respond." : "This is required.";
    else if (v && x.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errs[x.id] = "Enter a valid email address.";
    else if (v && x.type === "phone" && digits(v).length !== 10) errs[x.id] = "Enter a 10-digit phone number.";
  });
  return errs;
}

function makeActions(dispatch: React.Dispatch<Action>, get: () => State, leads: ReturnType<typeof useLeads>, clients: ReturnType<typeof useClients>) {
  const set = (fn: (s: State) => State) => dispatch({ type: "set", fn });
  const F = (id: string) => get().forms.find((x) => x.id === id)!;
  const touch = (f: LeadForm): LeadForm => ({ ...f, updatedAt: nowIso() });
  const uniqueSlug = (base: string, except?: string) => {
    let s = slugify(base);
    let i = 2;
    while (get().forms.some((x) => x.slug === s && x.id !== except)) s = `${slugify(base)}-${i++}`;
    return s;
  };

  const a = {
    reset: () => set(() => init()),
    /** New form, blank or copied from an existing form / template. */
    createForm(name: string, fromId?: string): string {
      const id = uid("form");
      const src = fromId ? F(fromId) : undefined;
      const at = nowIso();
      const f: LeadForm = src
        ? { ...structuredClone(src), id, name, slug: uniqueSlug(name), status: "draft", createdAt: at, updatedAt: at, publishedAt: undefined, fields: src.fields.map((x) => ({ ...x, id: fid(), showIf: undefined })) }
        : { id, name, slug: uniqueSlug(name), title: name, intro: "", status: "draft", services: [], fields: [...baseFields(), consentField()], routing: { ownerId: "s-mk", stageId: "st-new", source: "Website", tags: [], followUpHours: 24 }, thankYou: "Thank you! We'll be in touch within one business day.", createdAt: at, updatedAt: at };
      // Re-point show-if rules at the copied field IDs.
      if (src) f.fields = f.fields.map((x, i) => (src.fields[i].showIf ? { ...x, showIf: { fieldId: f.fields[src.fields.findIndex((y) => y.id === src.fields[i].showIf!.fieldId)]?.id ?? "", equals: src.fields[i].showIf!.equals } } : x));
      set((s) => ({ ...s, forms: [f, ...s.forms] }));
      return id;
    },
    updateForm(id: string, patch: Partial<LeadForm>) {
      if (patch.slug !== undefined) patch = { ...patch, slug: uniqueSlug(patch.slug || F(id).name, id) };
      set((s) => ({ ...s, forms: s.forms.map((x) => (x.id === id ? touch({ ...x, ...patch }) : x)) }));
    },
    setFields(id: string, fields: FormField[]) {
      set((s) => ({ ...s, forms: s.forms.map((x) => (x.id === id ? touch({ ...x, fields }) : x)) }));
    },
    /** Problems that block publishing. */
    publishIssues(id: string): string[] {
      const f = F(id);
      const out: string[] = [];
      const maps = f.fields.map((x) => x.map);
      if (!maps.includes("email") && !maps.includes("phone")) out.push("Add an email or phone field mapped to the lead so you can reply.");
      if (!maps.includes("fullName") && !maps.includes("firstName")) out.push("Add a name field mapped to the lead.");
      if (!f.fields.some((x) => x.type === "consent")) out.push("Add a consent checkbox (permission to contact).");
      f.fields.forEach((x) => { const r = sensitiveReason(x); if (r) out.push(`“${x.label}”: ${r}`); });
      f.fields.forEach((x) => { if ((x.type === "radio" || x.type === "checkboxes" || x.type === "select") && !(x.options ?? []).filter((o) => o.trim()).length) out.push(`“${x.label}” needs at least one option.`); });
      return out;
    },
    publish(id: string) {
      if (a.publishIssues(id).length) return false;
      set((s) => ({ ...s, forms: s.forms.map((x) => (x.id === id ? touch({ ...x, status: "published", publishedAt: x.publishedAt ?? nowIso() }) : x)) }));
      return true;
    },
    unpublish(id: string) { set((s) => ({ ...s, forms: s.forms.map((x) => (x.id === id ? touch({ ...x, status: "draft" }) : x)) })); },
    archive(id: string) { set((s) => ({ ...s, forms: s.forms.map((x) => (x.id === id ? touch({ ...x, status: "archived" }) : x)) })); },
    /** Only forms with no submissions can be deleted (submission history is kept). */
    deleteForm(id: string) {
      if (get().submissions.some((x) => x.formId === id)) return false;
      set((s) => ({ ...s, forms: s.forms.filter((x) => x.id !== id) }));
      return true;
    },

    /**
     * Receives a submission. Matches an existing client or open lead by email or
     * phone (no duplicates); otherwise creates a new lead routed by the form's settings.
     */
    submit(formId: string, data: Record<string, string>, channel: Submission["channel"], honeypot = ""): Submission {
      const f = F(formId);
      const at = nowIso();
      const base: Submission = { id: uid("sub"), formId, at, data, channel, outcome: "spam" };
      if (honeypot.trim()) { set((s) => ({ ...s, submissions: [base, ...s.submissions] })); return base; }

      const vis = visibleFields(f, data);
      const byMap = (m: FormField["map"]) => vis.filter((x) => x.map === m).map((x) => (data[x.id] ?? "").trim()).filter(Boolean);
      const name = byMap("fullName")[0] ?? [byMap("firstName")[0], byMap("lastName")[0]].filter(Boolean).join(" ");
      const email = (byMap("email")[0] ?? "").toLowerCase();
      const phone = byMap("phone")[0] ?? "";
      const bizName = byMap("businessName")[0];
      const stateRaw = byMap("state")[0];
      const state = stateRaw ? US_STATE_NAMES[stateRaw] ?? (stateRaw.length === 2 ? stateRaw : undefined) : undefined;
      const services = [...new Set([...f.services, ...byMap("services").flatMap((v) => v.split("|")).map((v) => SERVICE_BY_LABEL[v]).filter(Boolean)])] as ServiceKey[];
      const summary = vis.filter((x) => x.type !== "heading" && x.type !== "paragraph" && x.type !== "consent" && (data[x.id] ?? "").trim()).map((x) => `${x.label}: ${(data[x.id] ?? "").split("|").join(", ")}`).join("\n");

      const sameContact = (e?: string, p?: string) => (!!email && e?.toLowerCase() === email) || (digits(phone).length === 10 && digits(p) === digits(phone));
      const client: Client | undefined = clients.clients.find((c) => sameContact(c.email, c.phone));
      if (client) {
        clients.logActivity(client.id, "message", `Submitted the “${f.name}” form — ${services.length ? services.join(", ") : "general request"}`, "client");
        const sub = { ...base, outcome: "existing_client" as const, clientId: client.id };
        set((s) => ({ ...s, submissions: [sub, ...s.submissions] }));
        return sub;
      }
      const lead = leads.leads.find((l) => l.status === "open" && sameContact(l.email, l.phone));
      if (lead) {
        leads.addNote(lead.id, `New “${f.name}” submission:\n${summary}`);
        const merged = [...new Set([...lead.interests, ...services])];
        if (merged.length !== lead.interests.length) leads.updateLead(lead.id, { interests: merged }, "Services added from a form submission");
        const sub = { ...base, outcome: "existing_lead" as const, leadId: lead.id };
        set((s) => ({ ...s, submissions: [sub, ...s.submissions] }));
        return sub;
      }
      const follow = new Date(SAMPLE_NOW.getTime() + f.routing.followUpHours * 3600000).toISOString();
      const leadId = leads.addLead({
        type: bizName ? "business" : "individual",
        name: bizName || name || "Website visitor",
        contactName: bizName ? name : undefined,
        email,
        phone,
        address: state ? { line1: "", city: byMap("city")[0] ?? "", state, zip: byMap("zip")[0] ?? "" } : undefined,
        business: bizName ? { entityType: (byMap("entityType")[0] as "LLC") || "LLC", industry: "" } : undefined,
        source: f.routing.source,
        sourceDetail: f.routing.sourceDetail ?? f.name,
        interests: services,
        estValue: 0,
        ownerId: f.routing.ownerId,
        stageId: f.routing.stageId,
        priority: "medium",
        tags: [...f.routing.tags, "Web form"],
        firstNote: `Submitted the “${f.name}” form (${channel}).\n${summary}`,
        followUp: { at: follow, note: `Respond to “${f.name}” submission` },
      });
      const sub = { ...base, outcome: "new_lead" as const, leadId };
      set((s) => ({ ...s, submissions: [sub, ...s.submissions] }));
      return sub;
    },
    markSpam(subId: string, spam: boolean) {
      set((s) => ({ ...s, submissions: s.submissions.map((x) => (x.id === subId ? { ...x, outcome: spam ? "spam" : x.leadId ? "new_lead" : x.clientId ? "existing_client" : "new_lead" } : x)) }));
    },
  };
  return a;
}

type Ctx = State & ReturnType<typeof makeActions>;
const Ctx = createContext<Ctx | null>(null);

export function FormsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const ref = useRef(state);
  ref.current = state;
  const leads = useLeads();
  const clients = useClients();
  const lref = useRef(leads);
  lref.current = leads;
  const cref = useRef(clients);
  cref.current = clients;
  // Actions read live leads/clients through refs so a submission always sees the latest records.
  const actions = useMemo(() => makeActions(dispatch, () => ref.current, new Proxy({} as ReturnType<typeof useLeads>, { get: (_, k) => (lref.current as never)[k] }), new Proxy({} as ReturnType<typeof useClients>, { get: (_, k) => (cref.current as never)[k] })), []);
  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useForms() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useForms must be used inside <FormsProvider>");
  return v;
}
