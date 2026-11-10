"use client";

/**
 * In-browser sample-data store for Leads (Phase 2 frontend only).
 * Same rules as the clients store: nothing leaves the browser, everything
 * resets on reload, and Phase 3 swaps these actions for authenticated API calls.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { BACKEND, RemoteError, call, debouncer, notify, pendingClientCreates } from "@/lib/sync/remote";
import { DEFAULT_SOURCES, DEFAULT_STAGES, LEADS } from "@/lib/sample/leads";
import { staffById, meId } from "@/lib/sample/clients";
import { DEFAULT_FEES, defaultTitleFor, nowIso, useClients, type NewClientInput } from "@/lib/store/clients-store";
import { SERVICES } from "@/lib/sample-data";
import type { ActivityItem, ActivityKind, Lead, LeadPriority, LeadStage, Note, ServiceKey } from "@/lib/types";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

type State = { leads: Lead[]; stages: LeadStage[]; sources: string[]; pendingRemap?: { from: string; to: string } };
type Action =
  | { type: "reset" }
  | { type: "add"; lead: Lead }
  | { type: "update"; id: string; fn: (l: Lead) => Lead }
  | { type: "updateMany"; ids: string[]; fn: (l: Lead) => Lead }
  | { type: "stages"; stages: LeadStage[]; remap?: { from: string; to: string } }
  | { type: "sources"; sources: string[] }
  | { type: "hydrate"; leads: Lead[]; stages: LeadStage[]; sources: string[]; known: Set<string> }
  | { type: "replace"; lead: Lead }
  | { type: "remove"; id: string };

// With the backend on, leads load from the server after sign-in (never sample data).
const init = (): State => (BACKEND ? { leads: [], stages: structuredClone(DEFAULT_STAGES), sources: [...DEFAULT_SOURCES] } : { leads: structuredClone(LEADS), stages: structuredClone(DEFAULT_STAGES), sources: [...DEFAULT_SOURCES] });

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "reset":
      return init();
    case "add":
      return { ...s, leads: [a.lead, ...s.leads] };
    case "update":
      return { ...s, leads: s.leads.map((l) => (l.id === a.id ? a.fn(l) : l)) };
    case "updateMany":
      return { ...s, leads: s.leads.map((l) => (a.ids.includes(l.id) ? a.fn(l) : l)) };
    case "hydrate": {
      // Keep leads created here that haven't reached the server yet.
      const local = s.leads.filter((l) => !a.leads.some((x) => x.id === l.id) && !a.known.has(l.id));
      return { leads: [...local, ...a.leads], stages: a.stages, sources: a.sources };
    }
    case "remove":
      return { ...s, leads: s.leads.filter((l) => l.id !== a.id) };
    case "replace":
      return { ...s, leads: s.leads.some((l) => l.id === a.lead.id) ? s.leads.map((l) => (l.id === a.lead.id ? a.lead : l)) : [a.lead, ...s.leads] };
    case "stages":
      return {
        ...s,
        stages: a.stages,
        pendingRemap: a.remap ?? s.pendingRemap,
        leads: a.remap ? s.leads.map((l) => (l.stageId === a.remap!.from ? { ...l, stageId: a.remap!.to } : l)) : s.leads,
      };
    case "sources":
      return { ...s, sources: a.sources };
  }
}

const log = (l: Lead, kind: ActivityKind, text: string, actor: ActivityItem["actor"] = "staff"): Lead => {
  const at = nowIso();
  return { ...l, lastActivityAt: at, activity: [{ id: uid("x"), kind, text, at, actor }, ...l.activity] };
};

export type NewLeadInput = Omit<Lead, "id" | "status" | "createdAt" | "lastActivityAt" | "reminders" | "notes" | "activity" | "convertedAt" | "convertedClientId" | "lostReason"> & {
  firstNote?: string;
  followUp?: { at: string; note: string };
};

export type ConvertOptions = {
  /** Editable copy of the lead's details, pre-filled — nothing is re-typed. */
  client: Omit<NewClientInput, "fromLead">;
};

function makeActions(dispatch: React.Dispatch<Action>, get: () => State, clients: ReturnType<typeof useClients>) {
  const up = (id: string, fn: (l: Lead) => Lead) => dispatch({ type: "update", id, fn });
  const stageName = (id: string) => get().stages.find((s) => s.id === id)?.name ?? "Unknown stage";

  return {
    reset: () => dispatch({ type: "reset" }),

    addLead(input: NewLeadInput): string {
      const id = `L-${Math.floor(3000 + Math.random() * 6000)}`;
      const at = nowIso();
      const { firstNote, followUp, ...rest } = input;
      const lead: Lead = {
        ...rest,
        id,
        status: "open",
        createdAt: at,
        lastActivityAt: at,
        reminders: followUp ? [{ id: uid("r"), at: followUp.at, note: followUp.note, done: false, ownerId: input.ownerId }] : [],
        notes: firstNote?.trim() ? [{ id: uid("n"), authorId: meId(), body: firstNote.trim(), at }] : [],
        activity: [
          ...(input.ownerId !== meId() ? [{ id: uid("x"), kind: "lead" as const, text: `Assigned to ${staffById(input.ownerId).name}`, at, actor: "staff" as const }] : []),
          { id: uid("x"), kind: "lead", text: `Lead created from ${input.source}${input.sourceDetail ? ` (${input.sourceDetail})` : ""}`, at, actor: "staff" },
        ],
      };
      dispatch({ type: "add", lead });
      return id;
    },

    updateLead(id: string, patch: Partial<Lead>, summary = "Updated lead details") {
      up(id, (l) => log({ ...l, ...patch }, "lead", summary));
    },

    setStage(ids: string | string[], stageId: string) {
      const list = Array.isArray(ids) ? ids : [ids];
      dispatch({ type: "updateMany", ids: list, fn: (l) => (l.stageId === stageId ? l : log({ ...l, stageId }, "lead", `Moved to "${stageName(stageId)}"`)) });
    },
    setOwner(ids: string | string[], ownerId: string) {
      const list = Array.isArray(ids) ? ids : [ids];
      dispatch({
        type: "updateMany",
        ids: list,
        fn: (l) => (l.ownerId === ownerId ? l : log({ ...l, ownerId, reminders: l.reminders.map((r) => (r.done ? r : { ...r, ownerId })) }, "lead", `Assigned to ${staffById(ownerId).name}`)),
      });
    },
    setPriority(ids: string | string[], priority: LeadPriority) {
      const list = Array.isArray(ids) ? ids : [ids];
      dispatch({ type: "updateMany", ids: list, fn: (l) => (l.priority === priority ? l : log({ ...l, priority }, "lead", `Priority set to ${priority}`)) });
    },

    logActivity(id: string, channel: "Call" | "Email" | "Text" | "Meeting", summary: string, outcome?: string) {
      const kind: ActivityKind = channel === "Call" ? "call" : channel === "Meeting" ? "appointment" : "message";
      up(id, (l) => log(l, kind, `Logged ${channel.toLowerCase()}: ${summary}${outcome ? ` — ${outcome}` : ""}`));
    },

    addNote(id: string, body: string) {
      up(id, (l) => log({ ...l, notes: [{ id: uid("n"), authorId: meId(), body, at: nowIso() } satisfies Note, ...l.notes] }, "note", "Added a note"));
    },
    togglePin(id: string, noteId: string) {
      up(id, (l) => ({ ...l, notes: l.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)) }));
    },
    deleteNote(id: string, noteId: string) {
      up(id, (l) => log({ ...l, notes: l.notes.filter((n) => n.id !== noteId) }, "note", "Deleted a note"));
    },

    addReminder(id: string, at: string, note: string, ownerId: string) {
      up(id, (l) => log({ ...l, reminders: [...l.reminders, { id: uid("r"), at, note, done: false, ownerId }] }, "lead", `Follow-up scheduled: ${note}`));
    },
    completeReminder(id: string, rid: string) {
      up(id, (l) => {
        const r = l.reminders.find((x) => x.id === rid)!;
        return log({ ...l, reminders: l.reminders.map((x) => (x.id === rid ? { ...x, done: true } : x)) }, "lead", `Completed follow-up: ${r.note}`);
      });
    },
    deleteReminder(id: string, rid: string) {
      up(id, (l) => log({ ...l, reminders: l.reminders.filter((x) => x.id !== rid) }, "lead", "Removed a follow-up"));
    },

    markLost(ids: string | string[], reason: string) {
      const list = Array.isArray(ids) ? ids : [ids];
      dispatch({ type: "updateMany", ids: list, fn: (l) => (l.status !== "open" ? l : log({ ...l, status: "lost", lostReason: reason, reminders: l.reminders.map((r) => ({ ...r, done: true })) }, "lead", `Marked lost: ${reason}`)) });
    },
    reopen(id: string) {
      up(id, (l) => log({ ...l, status: "open", lostReason: undefined }, "lead", "Reopened lead"));
    },

    /** Lead → new client. Contact, business, notes, staff, source and history all carry over. */
    convert(id: string, opts: ConvertOptions): string {
      const lead = get().leads.find((l) => l.id === id)!;
      const clientId = clients.addClient({
        ...opts.client,
        fromLead: {
          leadId: lead.id,
          source: lead.sourceDetail ? `${lead.source} — ${lead.sourceDetail}` : lead.source,
          tags: lead.tags,
          notes: lead.notes,
          activity: lead.activity,
        },
      });
      const svc = opts.client.services.map((s) => SERVICES[s].label).join(", ");
      up(id, (l) =>
        log({ ...l, status: "converted", convertedClientId: clientId, convertedAt: nowIso(), reminders: l.reminders.map((r) => ({ ...r, done: true })) }, "lead", `Converted to client — enrolled in ${svc}`),
      );
      return clientId;
    },

    /** Lead matches an existing client: enroll that client instead of creating a duplicate. */
    convertToExisting(id: string, clientId: string, services: ServiceKey[], staffId: string, titles?: Partial<Record<ServiceKey, string>>) {
      const lead = get().leads.find((l) => l.id === id)!;
      const existing = clients.clients.find((c) => c.id === clientId);
      services.forEach((s) => clients.enroll(clientId, { service: s, title: titles?.[s]?.trim() || defaultTitleFor(s, existing?.type, existing?.business?.entityType), staffId, fee: DEFAULT_FEES[s] }));
      lead.notes.forEach((n) => clients.addNote(clientId, `From lead ${lead.id}: ${n.body}`));
      up(id, (l) => log({ ...l, status: "converted", convertedClientId: clientId, convertedAt: nowIso(), reminders: l.reminders.map((r) => ({ ...r, done: true })) }, "lead", "Merged into existing client record"));
    },

    // Pipeline configuration --------------------------------------------------
    addStage(name: string) {
      dispatch({ type: "stages", stages: [...get().stages, { id: uid("st"), name: name.trim() }] });
    },
    renameStage(stageId: string, name: string) {
      dispatch({ type: "stages", stages: get().stages.map((s) => (s.id === stageId ? { ...s, name: name.trim() } : s)) });
    },
    moveStage(stageId: string, dir: -1 | 1) {
      const st = [...get().stages];
      const i = st.findIndex((s) => s.id === stageId);
      const j = i + dir;
      if (j < 0 || j >= st.length) return;
      [st[i], st[j]] = [st[j], st[i]];
      dispatch({ type: "stages", stages: st });
    },
    removeStage(stageId: string, moveTo: string) {
      dispatch({ type: "stages", stages: get().stages.filter((s) => s.id !== stageId), remap: { from: stageId, to: moveTo } });
    },
    addSource(name: string) {
      const n = name.trim();
      if (n && !get().sources.some((s) => s.toLowerCase() === n.toLowerCase())) dispatch({ type: "sources", sources: [...get().sources, n] });
    },
    removeSource(name: string) {
      dispatch({ type: "sources", sources: get().sources.filter((s) => s !== name) });
    },
  };
}


export type LeadsStore = ReturnType<typeof makeActions> & State & { ready: boolean; reload: () => Promise<unknown> };
const Ctx = createContext<LeadsStore | null>(null);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const clients = useClients();
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const ref = useRef(state);
  ref.current = state;
  const clientsRef = useRef(clients);
  clientsRef.current = clients;
  // Actions read the latest client store through a proxy so they stay stable.
  const actions = useMemo(
    () =>
      makeActions(dispatch, () => ref.current, new Proxy({} as ReturnType<typeof useClients>, { get: (_t, k) => clientsRef.current[k as keyof ReturnType<typeof useClients>] })),
    [],
  );
  const { ready, reload } = useLeadSync(state, dispatch, clientsRef);
  const value = useMemo(() => ({ ...actions, ...state, ready, reload }), [actions, state, ready, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLeads() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLeads must be used inside <LeadsProvider>");
  return v;
}
export const useLead = (id: string) => useLeads().leads.find((l) => l.id === id);

/* ------------------------------------------------------------------ */
/* Backend sync (only when NEXT_PUBLIC_BACKEND=1)                      */
/* ------------------------------------------------------------------ */

type RevLead = Lead & { rev?: number };
function useLeadSync(state: State, dispatch: React.Dispatch<Action>, clientsRef: React.RefObject<ReturnType<typeof useClients>>) {
  const [ready, setReady] = useReducer(() => true, !BACKEND);
  const synced = useRef(new Map<string, Lead>());
  const revs = useRef(new Map<string, number>());
  const inflight = useRef(new Set<string>());
  const later = useRef(debouncer(500)).current;
  const stateRef = useRef(state);
  stateRef.current = state;
  const settingsSynced = useRef<{ stages: LeadStage[]; sources: string[] } | null>(null);

  const reloadAll = useCallback(async () => {
    try {
      const r = await call<{ leads: RevLead[]; stages: LeadStage[]; sources: string[] }>("GET", "/api/leads");
      r.leads.forEach((l) => { revs.current.set(l.id, l.rev ?? 1); synced.current.set(l.id, l); });
      // "known" = leads the server had before: if they're gone now (e.g. no longer visible), drop them.
      dispatch({ type: "hydrate", leads: r.leads, stages: r.stages, sources: r.sources, known: new Set(revs.current.keys()) });
      settingsSynced.current = { stages: r.stages, sources: r.sources };
      return r;
    } catch (e) {
      if (!(e instanceof RemoteError && (e.status === 401 || e.status === 403))) notify("Couldn't load leads. Check your connection and reload.");
      return null;
    }
  }, []);
  useEffect(() => { if (BACKEND) reloadAll().finally(() => setReady()); }, []);

  const save = useCallback(async (id: string) => {
    if (inflight.current.has(id)) return later(id, () => save(id));
    const l = stateRef.current.leads.find((x) => x.id === id);
    if (!l || synced.current.get(id) === l) return;
    inflight.current.add(id);
    try {
      if (!revs.current.has(id)) {
        const r = await call<{ lead: RevLead }>("POST", "/api/leads", { lead: l });
        revs.current.set(id, r.lead.rev ?? 1);
        synced.current.set(id, l);
      } else {
        const prev = synced.current.get(id);
        if (l.status === "converted" && prev?.status !== "converted" && l.convertedClientId) {
          // Wait for the new client to exist on the server, then record the conversion.
          const client = clientsRef.current?.clients.find((c) => c.id === l.convertedClientId);
          const convert = () => call<{ lead: RevLead }>("POST", `/api/leads/${id}/convert`, { clientId: l.convertedClientId, merged: client?.leadId !== id });
          let r: { lead: RevLead } | undefined;
          // The new client's own save may not have started yet: wait for it, and retry while it's still being created.
          for (let i = 0; !r; i++) {
            await new Promise((ok) => setTimeout(ok, i ? 1500 : 0));
            await pendingClientCreates.get(l.convertedClientId);
            try { r = await convert(); } catch (e) { if (!(e instanceof RemoteError && e.status === 404) || i >= 5) throw e; }
          }
          revs.current.set(id, r.lead.rev ?? 1);
          synced.current.set(id, { ...l, status: "converted" });
        }
        const r = await call<{ lead: RevLead }>("PUT", `/api/leads/${id}`, { lead: { ...l, rev: revs.current.get(id) } });
        revs.current.set(id, r.lead.rev ?? 1);
        synced.current.set(id, l);
      }
    } catch (e) {
      if (e instanceof RemoteError && e.status === 401) return;
      notify(e instanceof RemoteError ? e.message : "Couldn't save the lead — check your connection.");
      if (!revs.current.has(id) && e instanceof RemoteError && e.status < 500) dispatch({ type: "remove", id });
      await reloadAll();
    } finally {
      inflight.current.delete(id);
    }
    if (stateRef.current.leads.find((x) => x.id === id) !== synced.current.get(id)) later(id, () => save(id));
  }, []);

  useEffect(() => {
    if (!BACKEND || !ready) return;
    state.leads.forEach((l) => { if (synced.current.get(l.id) !== l) later(l.id, () => save(l.id)); });
  }, [state.leads, ready]);

  // Pipeline stages and sources.
  useEffect(() => {
    if (!BACKEND || !ready || !settingsSynced.current) return;
    const cur = settingsSynced.current;
    if (cur.stages === state.stages && cur.sources === state.sources) return;
    later("__settings", async () => {
      const st = stateRef.current;
      try {
        await call("PUT", "/api/leads/settings", { stages: st.stages, sources: st.sources, remap: st.pendingRemap });
        settingsSynced.current = { stages: st.stages, sources: st.sources };
        // Leads moved out of a removed stage got new revisions on the server.
        if (st.pendingRemap) await reloadAll();
      } catch (e) {
        notify(e instanceof RemoteError ? e.message : "Couldn't save pipeline settings.");
        await reloadAll();
      }
    });
  }, [state.stages, state.sources, ready]);

  return { ready, reload: reloadAll };
}
