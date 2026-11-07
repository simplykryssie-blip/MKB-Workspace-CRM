"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Lock } from "lucide-react";

/** One-time: create the Owner account in a brand-new database (needs the setup link). */
export function OwnerSetup() {
  const [token, setToken] = useState<string | null>(null);
  const [needed, setNeeded] = useState<boolean | null>(null);
  const [v, setV] = useState({ name: "", email: "", pw: "", pw2: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (t) window.history.replaceState(null, "", window.location.pathname);
    fetch("/api/setup").then((r) => r.json()).then((d) => setNeeded(!!(d as { needed?: boolean }).needed)).catch(() => setNeeded(false));
  }, []);
  const input = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";
  const field = (id: keyof typeof v, label: string, type = "text", auto?: string) => (
    <div><label htmlFor={`os-${id}`} className="mb-1.5 block text-[13.5px] font-medium text-ink-2">{label}</label><input id={`os-${id}`} type={type} autoComplete={auto} value={v[id]} onChange={(e) => setV({ ...v, [id]: e.target.value })} className={input} /></div>
  );
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mkb-monogram.webp" alt="MKB Financial Group" width={56} height={56} className="mx-auto h-14 w-14 rounded-xl" />
          <h1 className="mt-4 text-[22px] font-bold text-ink">Create the Owner account</h1>
          <p className="mt-1 text-[14px] text-muted">One-time setup for MKB Business Suite</p>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-7">
          {done ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 size={36} className="mx-auto text-success" />
              <p className="text-[14px] text-ink-2">Your Owner account is ready. Sign in — you&rsquo;ll set up your authenticator app next.</p>
              <a href="/login" className="grid h-11 place-items-center rounded-xl bg-accent text-[15px] font-semibold text-white">Sign in</a>
            </div>
          ) : needed === false ? (
            <p className="text-center text-[14px] text-ink-2">Setup is already complete. <a href="/login" className="font-semibold text-accent">Sign in</a></p>
          ) : !token ? (
            <p className="text-center text-[14px] text-ink-2">Open the setup link you were given.</p>
          ) : (
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              if (v.pw !== v.pw2) return setErr("The passwords don't match.");
              setBusy(true); setErr(null);
              const r = await fetch("/api/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: v.name, email: v.email, password: v.pw }) });
              const d = (await r.json().catch(() => ({}))) as { error?: string };
              setBusy(false);
              if (!r.ok) return setErr(d.error ?? "Something went wrong.");
              setDone(true);
            }}>
              {field("name", "Your full name", "text", "name")}
              {field("email", "Email (your sign-in)", "email", "username")}
              {field("pw", "Password", "password", "new-password")}
              {field("pw2", "Confirm password", "password", "new-password")}
              <p className="flex items-start gap-1.5 text-[12.5px] text-muted"><KeyRound size={13} className="mt-0.5 shrink-0" />At least 12 characters, using three of: lowercase, uppercase, numbers, symbols. A passphrase works well.</p>
              {err && <p role="alert" className="rounded-xl bg-danger-soft/50 px-3 py-2 text-[13px] text-danger-ink">{err}</p>}
              <button disabled={busy} className="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Create Owner account"}</button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-[12px] text-muted"><Lock size={11} className="mr-1 inline" />This link stops working once the Owner account exists.</p>
      </div>
    </main>
  );
}
