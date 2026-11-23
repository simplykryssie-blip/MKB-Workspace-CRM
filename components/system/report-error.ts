/** Sends a crash report to the server (audit log "App error"). Never throws; sends no form contents. */
export function reportError(error: Error & { digest?: string }) {
  try {
    const payload = JSON.stringify({ message: error?.message, stack: error?.stack, digest: error?.digest, path: window.location.pathname, ua: navigator.userAgent });
    void fetch("/api/client-errors", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  } catch { /* nothing to do */ }
}
