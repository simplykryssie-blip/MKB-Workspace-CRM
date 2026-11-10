"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AlertCircle, CheckCircle2, KeyRound, Lock, Mail, ShieldCheck, Smartphone } from "lucide-react";

/* Sign-in screens. They only talk to /api/auth/*; the server decides everything. */

async function api<T = Record<string, unknown>>(path: string, method: "POST" | "PUT" | "GET", body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string; code?: string } }> {
  const r = await fetch(path, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}), credentials: "same-origin" });
  const data = (await r.json().catch(() => ({}))) as T & { error?: string; code?: string };
  return { ok: r.ok, status: r.status, data };
}
const afterSignIn = async () => {
  const s = await api<{ kind?: string }>("/api/auth/session", "GET");
  window.location.assign(s.data.kind === "client" ? "/portal" : "/dashboard");
};

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mkb-monogram.webp" alt="MKB Financial Group" width={56} height={56} className="h-14 w-14 rounded-xl" />
          <h1 className="mt-4 text-[22px] font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-7">{children}</div>
        <p className="mt-5 text-center text-[12px] text-muted"><Lock size={11} className="mr-1 inline" />Protected sign-in · MKB Financial Group</p>
      </div>
    </main>
  );
}
const input = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";
const primary = "h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60";
function Field({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div><label htmlFor={id} className="mb-1.5 block text-[13.5px] font-medium text-ink-2">{label}</label><input id={id} className={input} {...rest} /></div>;
}
const Err = ({ msg }: { msg: string | null }) => (msg ? <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-danger-soft/50 px-3 py-2 text-[13px] text-danger-ink"><AlertCircle size={14} className="mt-0.5 shrink-0" />{msg}</p> : null);

/* ---------------------------------------------------------------- sign in */
/** `portal`: the client portal's sign-in (password, then a code we email). */
export function LoginFlow({ portal = false }: { portal?: boolean }) {
  const [step, setStep] = useState<"credentials" | "mfa" | "mfa_setup" | "email_code" | "forgot" | "forgot_sent">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await api<{ next?: "done" | "mfa" | "mfa_setup" | "email_code" }>(portal ? "/api/portal/auth/login" : "/api/auth/login", "POST", { email, password });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Couldn't sign in.");
    setPassword("");
    if (r.data.next === "done") return afterSignIn();
    setStep(r.data.next ?? "mfa");
  };

  if (step === "email_code") return <EmailCode email={email} onDone={afterSignIn} onBack={() => setStep("credentials")} />;
  if (step === "mfa") return <MfaCode onDone={afterSignIn} />;
  if (step === "mfa_setup") return <MfaSetup onDone={afterSignIn} />;
  if (step === "forgot" || step === "forgot_sent")
    return (
      <Shell title="Reset your password" subtitle="We'll email you a link that works for 30 minutes.">
        {step === "forgot_sent" ? (
          <div className="space-y-4 text-center"><CheckCircle2 size={32} className="mx-auto text-success" /><p className="text-[14px] text-ink-2">If <strong>{email}</strong> has an account, a reset link is on its way.</p><button className="text-[13.5px] font-semibold text-accent hover:underline" onClick={() => setStep("credentials")}>Back to sign in</button></div>
        ) : (
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); const r = await api("/api/auth/password/forgot", "POST", { email }); setBusy(false); if (!r.ok) return setErr(r.data.error ?? "Try again."); setStep("forgot_sent"); }}>
            <Field id="fp-email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Err msg={err} />
            <button className={primary} disabled={busy || !email}>Send reset link</button>
            <button type="button" className="w-full text-[13.5px] font-semibold text-accent hover:underline" onClick={() => setStep("credentials")}>Back to sign in</button>
          </form>
        )}
      </Shell>
    );
  return (
    <Shell title={portal ? "Client portal" : "Sign in"} subtitle={portal ? "Sign in to your MKB Financial Group account" : "MKB Business Suite"}>
      <form className="space-y-4" onSubmit={submit}>
        <Field id="li-email" label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="li-password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Err msg={err} />
        <button className={primary} disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</button>
        <button type="button" className="w-full text-[13.5px] font-semibold text-accent hover:underline" onClick={() => { setErr(null); setStep("forgot"); }}>Forgot your password?</button>
        {portal && <p className="text-center text-[12.5px] text-muted">New here? Your MKB team emails you an invitation to set up your portal.</p>}
      </form>
    </Shell>
  );
}

/** Client portal: the 6-digit code we emailed after the password. */
function EmailCode({ email, onDone, onBack }: { email: string; onDone: () => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="Check your email" subtitle={`We sent a 6-digit code to ${email || "your email"}. It works for 10 minutes.`}>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); setNote(null); const r = await api("/api/portal/auth/code", "POST", { code }); setBusy(false); if (!r.ok) { setCode(""); if (r.status === 401 && r.data.code === "unauthenticated") { onBack(); return; } return setErr(r.data.error ?? "That code didn't work."); } onDone(); }}>
        <Field id="email-code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <Err msg={err} />
        {note && <p className="flex items-start gap-1.5 rounded-xl bg-success-soft/50 px-3 py-2 text-[13px] text-ink-2"><Mail size={14} className="mt-0.5 shrink-0" />{note}</p>}
        <button className={primary} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Continue"}</button>
        <div className="flex justify-between text-[13.5px]">
          <button type="button" className="font-semibold text-accent hover:underline" onClick={onBack}>Back</button>
          <button type="button" className="font-semibold text-accent hover:underline" disabled={busy} onClick={async () => { setErr(null); setNote(null); const r = await api("/api/portal/auth/code/resend", "POST"); if (!r.ok) return setErr(r.data.error ?? "Couldn't send a new code."); setNote("A new code is on its way. Check spam if you don't see it."); }}>Send a new code</button>
        </div>
      </form>
    </Shell>
  );
}

function MfaCode({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="Two-step verification" subtitle="Enter the 6-digit code from your authenticator app.">
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); const r = await api("/api/auth/mfa", "POST", { code }); setBusy(false); if (!r.ok) { setCode(""); return setErr(r.data.error ?? "That code didn't work."); } onDone(); }}>
        <Field id="mfa-code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <Err msg={err} />
        <button className={primary} disabled={busy || code.length !== 6}>Verify</button>
      </form>
    </Shell>
  );
}

function MfaSetup({ onDone }: { onDone: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ secret: string; otpauth: string }>("/api/auth/mfa/setup", "POST").then(async (r) => {
      if (!r.ok) return setErr(r.data.error ?? "Couldn't start setup.");
      setSecret(r.data.secret);
      setQr(await QRCode.toDataURL(r.data.otpauth, { margin: 1, width: 200 }));
    });
  }, []);
  return (
    <Shell title="Set up two-step verification" subtitle="Your role requires it. It takes about a minute.">
      <ol className="space-y-4 text-[14px] text-ink-2">
        <li className="flex gap-3"><Smartphone size={18} className="mt-0.5 shrink-0 text-accent" /><span>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and scan this code.</span></li>
      </ol>
      <div className="my-4 grid place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-xl ring-1 ring-line" /> : <div className="h-[200px] w-[200px] animate-pulse rounded-xl bg-surface-2" />}
        {secret && <p className="mt-3 text-center text-[12px] text-muted">Can&rsquo;t scan? Enter this key:<br /><code className="mt-1 inline-block break-all rounded-lg bg-surface-2 px-2 py-1 text-[13px] tracking-wider text-ink">{secret.match(/.{1,4}/g)?.join(" ")}</code></p>}
      </div>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); const r = await api("/api/auth/mfa/setup", "PUT", { code }); setBusy(false); if (!r.ok) { setCode(""); return setErr(r.data.error ?? "That code didn't work."); } onDone(); }}>
        <Field id="mfa-setup-code" label="Enter the 6-digit code it shows" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <Err msg={err} />
        <button className={primary} disabled={busy || code.length !== 6 || !secret}><ShieldCheck size={16} className="mr-1.5 inline" />Turn on two-step verification</button>
      </form>
    </Shell>
  );
}

/* ---------------------------------------------------------------- set a password (reset link or invitation) */
export function SetPasswordFlow({ mode, portal = false }: { mode: "reset" | "invite"; portal?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<"done" | "mfa" | "mfa_setup" | "reset_ok" | null>(null);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    // Remove the one-time token from the address bar and browser history.
    if (t) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  if (next === "mfa_setup") return <MfaSetup onDone={afterSignIn} />;
  if (next === "mfa") return <MfaCode onDone={afterSignIn} />;
  if (next === "reset_ok")
    return <Shell title="Password updated" subtitle="You've been signed out everywhere for safety."><Link href={portal ? "/portal/login" : "/login"} className={`${primary} grid place-items-center`}>Sign in</Link></Shell>;
  return (
    <Shell title={mode === "invite" ? (portal ? "Set up your client portal" : "Welcome to MKB") : "Choose a new password"} subtitle={mode === "invite" ? (portal ? "Create a password. Each time you sign in, we'll also email you a code." : "Create your password to activate your account.") : undefined}>
      {!token ? <Err msg="This link is missing its code. Open the link from your email again." /> : (
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          if (pw !== pw2) return setErr("The passwords don't match.");
          setBusy(true); setErr(null);
          const r = await api<{ next?: "done" | "mfa" | "mfa_setup" }>(mode === "invite" ? "/api/auth/invite/accept" : "/api/auth/password/reset", "POST", { token, password: pw });
          setBusy(false);
          if (!r.ok) return setErr(r.data.error ?? "Something went wrong.");
          if (mode === "reset") return setNext("reset_ok");
          if (r.data.next === "done") return afterSignIn();
          setNext(r.data.next ?? "done");
        }}>
          <Field id="sp-pw" label="New password" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          <Field id="sp-pw2" label="Confirm password" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <p className="flex items-start gap-1.5 text-[12.5px] text-muted"><KeyRound size={13} className="mt-0.5 shrink-0" />At least 12 characters, using three of: lowercase, uppercase, numbers, symbols. A passphrase works well.</p>
          <Err msg={err} />
          <button className={primary} disabled={busy || !pw || !pw2}>{mode === "invite" ? (portal ? "Open my portal" : "Activate my account") : "Save new password"}</button>
        </form>
      )}
    </Shell>
  );
}

export function ClientSignedIn() {
  useEffect(() => { window.location.replace("/portal"); }, []);
  return (
    <Shell title="You're signed in" subtitle="Client portal">
      <p className="text-center text-[14px] text-ink-2">Your secure portal is being connected to your account. Your MKB team will let you know when it&rsquo;s ready.</p>
      <button className={`${primary} mt-5`} onClick={async () => { await api("/api/auth/logout", "POST"); window.location.assign("/login"); }}>Sign out</button>
    </Shell>
  );
}
