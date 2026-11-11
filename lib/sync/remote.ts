"use client";

/**
 * Connection between the interface stores and the backend API.
 * Off (prototype, in-browser sample data) unless NEXT_PUBLIC_BACKEND=1.
 */
export const BACKEND = process.env.NEXT_PUBLIC_BACKEND === "1";

export class RemoteError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function call<T = unknown>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method, credentials: "same-origin", headers: { "content-type": "application/json" }, body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}) });
  const data = (await r.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (r.status === 401) {
    // Signed out (or session expired): back to sign-in.
    window.location.assign("/login");
    throw new RemoteError(401, data.error ?? "Please sign in.", data.code);
  }
  if (!r.ok) throw new RemoteError(r.status, data.error ?? "Something went wrong.", data.code);
  return data;
}

/** Shows a message (picked up by <SyncNotices/>, which uses the app's toasts). */
export function notify(message: string) {
  window.dispatchEvent(new CustomEvent("mkb:notice", { detail: message }));
}

/** Clients being created right now — other stores (e.g. lead conversion) can wait for them. */
export const pendingClientCreates = new Map<string, Promise<boolean>>();

/** Runs `fn` for a key after `ms` of quiet; later calls for the same key replace earlier ones. */
export function debouncer(ms: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (key: string, fn: () => void) => {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms));
  };
}
