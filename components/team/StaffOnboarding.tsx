"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, FileSignature, FileUp, Loader2, Lock, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextField } from "@/components/ui/Field";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { parseLetter } from "@/lib/engagement/letters";
import type { StaffDocStatus, StaffOnboarding as Status } from "@/lib/staff/onboarding-docs";

type View = Status & { name: string };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function api<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method, credentials: "same-origin", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (r.status === 401) { window.location.assign("/login"); throw new Error("Please sign in."); }
  if (!r.ok) throw new Error(d.error ?? "Something went wrong.");
  return d;
}

/** A new team member's first screen: sign every document, upload the tax form, then wait for the Owner to confirm identity. */
export function StaffOnboarding() {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<View>("GET", "/api/staff-onboarding").then((d) => { setV(d); setOpen((cur) => cur ?? d.docs.find((x) => !x.done)?.key ?? null); }).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load.")), []);
  useEffect(() => { void load(); }, [load]);
  const after = (d: View) => { setV(d); setErr(null); setOpen(d.docs.find((x) => !x.done)?.key ?? null); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const sign = async (doc: StaffDocStatus, name: string, signature: string) => {
    setBusy(true);
    try { after(await api<View>("POST", "/api/staff-onboarding", { key: doc.key, version: doc.version, name, signature, agree: true })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't sign."); void load(); }
    setBusy(false);
  };
  const upload = async (doc: StaffDocStatus, f: File) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/staff-onboarding/upload/${encodeURIComponent(doc.key)}`, { method: "POST", credentials: "same-origin", headers: { "x-file-name": encodeURIComponent(f.name), "content-type": f.type || "application/octet-stream" }, body: f });
      const d = (await r.json().catch(() => ({}))) as View & { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Upload failed.");
      after(d);
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); }
    setBusy(false);
  };
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => undefined); window.location.assign("/login"); };

  if (!v) return <main className="grid min-h-screen place-items-center bg-bg px-4 text-[14px] text-muted">{err ?? <Loader2 className="animate-spin" />}</main>;
  const docsDone = v.docs.filter((d) => d.required).every((d) => d.done);
  const left = v.docs.filter((d) => d.required && !d.done).length;
  return (
    <main className="min-h-screen bg-bg px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="mb-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mkb-monogram.webp" alt="MKB Financial Group" width={48} height={48} className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold tracking-tight text-ink">Welcome to MKB Financial Group, {v.name.split(" ")[0]}</h1>
            <p className="text-[14px] text-muted">Before you can use the CRM, read and sign each document below.</p>
          </div>
          <button type="button" onClick={() => void signOut()} className="hidden items-center gap-1.5 text-[13px] text-muted hover:text-ink sm:inline-flex"><LogOut size={14} /> Sign out</button>
        </div>

        {v.complete ? (
          <div className="mb-5 rounded-2xl border border-success/30 bg-success-soft p-5 text-success-ink">
            <p className="flex items-center gap-2 text-[15px] font-semibold"><CheckCircle2 size={18} /> You're all set.</p>
            <Button variant="primary" className="mt-3" href="/dashboard">Go to the CRM</Button>
          </div>
        ) : docsDone ? (
          <div className="mb-5 rounded-2xl border border-accent/30 bg-accent-soft p-5 text-accent-ink">
            <p className="flex items-center gap-2 text-[15px] font-semibold"><ShieldCheck size={18} /> All documents signed — thank you.</p>
            <p className="mt-1 text-[13.5px]">Last step: the Owner confirms your identity on a short video call with your government photo ID. Your access opens as soon as that's done. You can sign out for now.</p>
            <Button className="mt-3" onClick={() => void load()}>Check again</Button>
          </div>
        ) : (
          <p className="mb-4 text-[14px] text-ink-2"><b>{left}</b> document{left === 1 ? "" : "s"} left. Your signed copies are kept on file and you can download them any time.</p>
        )}
        {err && <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-2.5 text-[13.5px] text-danger-ink">{err}</p>}

        <ol className="space-y-3">
          {v.docs.map((d, i) => (
            <li key={d.key} className="rounded-2xl border border-line bg-surface shadow-soft">
              <button type="button" onClick={() => setOpen(open === d.key ? null : d.key)} className="flex w-full items-center gap-3 px-5 py-4 text-left" aria-expanded={open === d.key}>
                {d.done ? <CheckCircle2 size={20} className="shrink-0 text-success" /> : <Circle size={20} className="shrink-0 text-faint" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{i + 1}. {d.title}{!d.required && <span className="ml-2 text-[12px] font-normal text-muted">(optional)</span>}</span>
                  <span className="block text-[12.5px] text-muted">{d.done ? `${d.kind === "upload" ? "Uploaded" : "Signed"} ${day(d.done.at)}` : d.kind === "upload" ? "Upload a file" : "Read and sign"}</span>
                </span>
                {d.done && <a href={`/api/staff-onboarding/file/${d.done.id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[13px] font-semibold text-accent hover:underline">View</a>}
              </button>
              {open === d.key && !d.done && (
                <div className="border-t border-line px-5 py-4">
                  <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line bg-surface-2 p-4 text-[13.5px] leading-relaxed text-ink-2">
                    {parseLetter(d.body).map((b, n) => b.kind === "h" ? <h3 key={n} className="mb-1 mt-3 text-[14.5px] font-bold text-ink first:mt-0">{b.text}</h3> : b.kind === "li" ? <p key={n} className="pl-4 -indent-3">• {b.text}</p> : <p key={n} className="mb-2">{b.text}</p>)}
                  </div>
                  {d.kind === "sign" ? <SignForm key={d.key + d.version} doc={d} defaultName={v.name} busy={busy} onSign={(n, s) => void sign(d, n, s)} /> : <UploadForm doc={d} busy={busy} onFile={(f) => void upload(d, f)} />}
                </div>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-center text-[12px] text-muted"><Lock size={11} className="mr-1 inline" />Signed with your own CRM account · MKB Financial Group</p>
        <p className="mt-2 text-center sm:hidden"><button type="button" onClick={() => void signOut()} className="text-[13px] text-muted underline">Sign out</button></p>
      </div>
    </main>
  );
}

function SignForm({ doc, defaultName, busy, onSign }: { doc: StaffDocStatus; defaultName: string; busy: boolean; onSign: (name: string, sig: string) => void }) {
  const [name, setName] = useState(defaultName);
  const [sig, setSig] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  return (
    <div className="mt-4 space-y-3">
      <Checkbox label={`I have read and agree to the ${doc.title}.`} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
      <TextField label="Your full legal name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      <SignaturePad label="Sign here with your finger or mouse" onChange={setSig} />
      <Button variant="primary" icon={FileSignature} className="w-full sm:w-auto" disabled={busy || !agree || name.trim().length < 3 || !sig} onClick={() => sig && onSign(name.trim(), sig)}>{busy ? "Signing…" : "Sign"}</Button>
    </div>
  );
}

function UploadForm({ doc, busy, onFile }: { doc: StaffDocStatus; busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-4">
      <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden" aria-label={`Upload ${doc.title}`} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <Button variant="primary" icon={FileUp} disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : "Choose file to upload"}</Button>
      <p className="mt-1.5 text-[12px] text-muted">PDF or photo, up to 15 MB.</p>
    </div>
  );
}
