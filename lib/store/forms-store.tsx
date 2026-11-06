"use client";

/**
 * Forms store (prototype, in-browser). Production (Phase 3): forms and
 * submissions live in the database; public submissions are received by the
 * backend, which checks spam/rate limits and creates the lead server-side.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { BACKEND, RemoteError, call, debouncer, notify } from "@/lib/sync/remote";
import { SAMPLE_FORMS, SAMPLE_SUBMISSIONS } from "@/lib/sample/forms-seed";
import { baseFields, consentField, fid, sensitiveReason, slugify, type FormField, type LeadForm, type Submission } from "@/lib/forms/config";
import { nowIso, useClients } from "@/lib/store/clients-store";
import { useLeads } from "@/lib/store/leads-store";
import { SAMPLE_NOW } from "@/lib/sample/clients";
import type { Client, ServiceKey } from "@/lib/types";

type State = { forms: LeadForm[]; submissions: Submission[] };
type Action = { type: "set"; fn: (s: State) => State };
// With the backend on, forms load from the server after sign-in.
const init = (): State => (BACKEND ? { forms: [], submissions: [] } : { forms: structuredClone(SAMPLE_FORMS), submissions: structuredClone(SAMPLE_SUBMISSIONS) });
const reducer = (s: State, a: Action) => a.fn(s);
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
export { validateSubmission, visibleFields } from "@/lib/forms/logic";
import { digits, extractLead, publishIssues } from "@/lib/forms/logic";

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
      return publishIssues(F(id));
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

      const { name, email, phone, bizName, entityType, city, zip, state, services, summary } = extractLead(f, data);
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
        address: state ? { line1: "", city, state, zip } : undefined,
        business: bizName ? { entityType: (entityType as "LLC") || "LLC", industry: "" } : undefined,
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

type Ctx = State & ReturnType<typeof makeActions> & { ready: boolean; submitRemote: (formId: string, data: Record<string, string>, honeypot: string) => Promise<Submission> };
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
  const sync = useFormSync(state, dispatch, leads);
  const value = useMemo(() => ({ ...state, ...actions, ready: sync.ready, submitRemote: sync.submitRemote }), [state, actions, sync.ready, sync.submitRemote]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useForms() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useForms must be used inside <FormsProvider>");
  return v;
}

/* ------------------------------------------------------------------ */
/* Backend sync (only when NEXT_PUBLIC_BACKEND=1)                      */
/* ------------------------------------------------------------------ */

/**
 * Loads forms and submissions from the server and saves each change (building,
 * publishing — which the server re-checks — archiving, deleting, spam marks).
 */
function useFormSync(state: State, dispatch: React.Dispatch<Action>, leads: ReturnType<typeof useLeads>) {
  const [ready, setReady] = useReducer(() => true, !BACKEND);
  const synced = useRef(new Map<string, LeadForm>());
  const subsSynced = useRef(new Map<string, Submission>());
  const later = useRef(debouncer(600)).current;
  const stateRef = useRef(state);
  stateRef.current = state;
  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  const reload = useCallback(async () => {
    try {
      const r = await call<State>("GET", "/api/forms");
      synced.current = new Map(r.forms.map((f) => [f.id, f]));
      subsSynced.current = new Map(r.submissions.map((x) => [x.id, x]));
      dispatch({ type: "set", fn: () => r });
    } catch (e) {
      if (!(e instanceof RemoteError && (e.status === 401 || e.status === 403))) notify("Couldn't load forms.");
    }
  }, []);
  useEffect(() => { if (BACKEND) reload().finally(() => setReady()); }, []);

  const saveForm = useCallback(async (id: string) => {
    const f = stateRef.current.forms.find((x) => x.id === id);
    const known = synced.current.has(id);
    try {
      if (!f && known) { await call("POST", `/api/forms/${id}`, { action: "delete" }); synced.current.delete(id); return; }
      if (!f || synced.current.get(id) === f) return;
      if (!known) await call("POST", "/api/forms", { form: f });
      // A new form is created as a draft, then saved as-is (including a publish).
      if (!known && f.status === "draft") { synced.current.set(id, f); return; }
      await call("PUT", `/api/forms/${id}`, { form: f });
      synced.current.set(id, f);
    } catch (e) {
      if (e instanceof RemoteError && e.status === 401) return;
      notify(e instanceof RemoteError ? e.message : "Couldn't save the form.");
      await reload();
    }
  }, []);

  useEffect(() => {
    if (!BACKEND || !ready) return;
    state.forms.forEach((f) => { if (synced.current.get(f.id) !== f) later(f.id, () => saveForm(f.id)); });
    [...synced.current.keys()].forEach((id) => { if (!state.forms.some((f) => f.id === id)) later(id, () => saveForm(id)); });
    state.submissions.forEach((x) => {
      const prev = subsSynced.current.get(x.id);
      if (prev && prev.outcome !== x.outcome) {
        subsSynced.current.set(x.id, x);
        call("PUT", `/api/forms/submissions/${x.id}`, { spam: x.outcome === "spam" }).catch((e) => { notify(e instanceof Error ? e.message : "Couldn't update."); reload(); });
      }
    });
  }, [state.forms, state.submissions, ready]);

  /** Staff test: processed by the server exactly like a real submission. */
  const submitRemote = useCallback(async (formId: string, data: Record<string, string>, honeypot: string): Promise<Submission> => {
    await saveForm(formId); // make sure the server has the latest questions
    const r = await call<{ id: string; outcome: Submission["outcome"]; leadId?: string; clientId?: string }>("POST", `/api/forms/${formId}/test`, { data, honeypot });
    await Promise.all([reload(), leadsRef.current.reload()]);
    return { id: r.id, formId, at: new Date().toISOString(), data, channel: "Staff test", outcome: r.outcome, leadId: r.leadId, clientId: r.clientId };
  }, []);

  return { ready, submitRemote };
}
