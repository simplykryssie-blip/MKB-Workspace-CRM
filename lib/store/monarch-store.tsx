"use client";

/**
 * Monarch Tax Suite data for the staff screens. Loaded from /api/monarch;
 * every change goes to the server, which sends back the updated records.
 * There is no sample-data mode: Monarch only runs with the backend on.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BACKEND, call, RemoteError } from "@/lib/sync/remote";
import type { MonarchData, MonarchSettings, Office } from "@/lib/monarch/types";

type Ctx = {
  data: MonarchData | null;
  error: string | null;
  reload: () => Promise<void>;
  /** Runs an API call that returns the whole workspace and stores it. */
  apply: <T extends object = object>(method: "POST" | "PUT", path: string, body?: unknown) => Promise<T & { data: MonarchData }>;
  /** Runs an API call that returns one office and swaps it in. */
  applyOffice: <T extends { office: Office }>(method: "POST" | "PUT", path: string, body?: unknown) => Promise<T>;
  saveSettings: (s: Partial<Omit<MonarchSettings, "agreement">> & { agreement?: string }) => Promise<void>;
  /** Swaps in one office returned by an upload. */
  setOffice: (o: Office) => void;
  office: (id: string) => Office | undefined;
};

const C = createContext<Ctx | null>(null);

export function MonarchProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MonarchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!BACKEND) { setError("Monarch runs on the live system only."); return; }
    try { setData(await call<MonarchData>("GET", "/api/monarch")); setError(null); }
    catch (e) { setError(e instanceof RemoteError ? e.message : "Couldn't load Monarch."); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const apply = useCallback(async <T extends object = object>(method: "POST" | "PUT", path: string, body?: unknown) => {
    const r = await call<Record<string, unknown>>(method, path, body);
    const d = (r.data && typeof r.data === "object" ? r.data : r) as MonarchData;
    setData(d);
    return { ...(r as T), data: d };
  }, []);
  const applyOffice = useCallback(async <T extends { office: Office }>(method: "POST" | "PUT", path: string, body?: unknown) => {
    const r = await call<T>(method, path, body);
    setData((d) => (d ? { ...d, offices: d.offices.map((o) => (o.id === r.office.id ? r.office : o)) } : d));
    return r;
  }, []);
  const saveSettings = useCallback(async (s: Partial<Omit<MonarchSettings, "agreement">> & { agreement?: string }) => {
    const r = await call<{ settings: MonarchSettings }>("PUT", "/api/monarch", s);
    setData((d) => (d ? { ...d, settings: r.settings } : d));
  }, []);
  const setOffice = useCallback((o: Office) => setData((d) => (d ? { ...d, offices: d.offices.map((x) => (x.id === o.id ? o : x)) } : d)), []);
  const office = useCallback((id: string) => data?.offices.find((o) => o.id === id), [data]);

  const v = useMemo(() => ({ data, error, reload, apply, applyOffice, saveSettings, setOffice, office }), [data, error, reload, apply, applyOffice, saveSettings, setOffice, office]);
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useMonarch() {
  const c = useContext(C);
  if (!c) throw new Error("useMonarch outside MonarchProvider");
  return c;
}

/** Uploads a file (raw body) and returns the JSON reply. */
export async function uploadRaw<T>(path: string, file: File): Promise<T> {
  const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "x-file-name": encodeURIComponent(file.name), "content-type": file.type || "application/octet-stream" }, body: file });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new RemoteError(r.status, d.error ?? "Upload failed.");
  return d;
}

export const newId = (p: string) => `${p}_${crypto.getRandomValues(new Uint32Array(3)).reduce((s, n) => s + n.toString(36), "")}`;
