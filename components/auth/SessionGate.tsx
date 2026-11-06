"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND } from "@/lib/sync/remote";

/**
 * With the backend on: checks the session when the app loads, sends anyone
 * signed out (or mid two-step verification) back to sign-in, and makes the
 * interface reflect the real signed-in team member. The server still checks
 * every request on its own.
 */
export function SessionGate() {
  const team = useTeam();
  const toast = useToast();
  useEffect(() => {
    if (!BACKEND) return;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { mfaPending?: boolean; kind?: string; member?: { id: string } };
        if (!r.ok || d.mfaPending) window.location.assign("/login");
        else if (d.kind === "client") window.location.assign("/login/done");
        else if (d.member) team.setActing({ kind: "member", id: d.member.id });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Save problems and other notices from the sync layer.
  useEffect(() => {
    const h = (e: Event) => toast((e as CustomEvent<string>).detail, "info");
    window.addEventListener("mkb:notice", h);
    return () => window.removeEventListener("mkb:notice", h);
  }, [toast]);
  return null;
}

/** Replaces the "Previewing as" selector when real sign-in is on. */
export function SignedInAs() {
  const team = useTeam();
  return <span className="truncate text-[12px] font-semibold">Signed in as {team.me?.name ?? "…"}</span>;
}
