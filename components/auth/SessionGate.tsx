"use client";

import { useEffect } from "react";

/**
 * With the backend on, checks the session when the app loads and sends anyone
 * signed out (or mid two-step verification) back to sign-in. The server still
 * checks every API request on its own.
 */
export function SessionGate() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BACKEND !== "1") return;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { mfaPending?: boolean; kind?: string };
        if (!r.ok || d.mfaPending) window.location.assign("/login");
        else if (d.kind === "client") window.location.assign("/login/done");
      })
      .catch(() => {});
  }, []);
  return null;
}
