"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileSignature, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LogoMark } from "@/components/brand/Logo";
import { LetterView } from "@/components/engagement/LetterView";
import { SignaturePad } from "@/components/ui/SignaturePad";

type Part = { title: string; body: string; version: number };
type Loaded = { title: string; kind: string; parts: Part[]; firstName: string; message: string };
class LinkError extends Error { constructor(public status: number, message: string) { super(message); } }

/** A client's private link to read a document and sign it (no login). */
export function PublicSign({ token }: { token: string }) {
  const base = `/api/public/sign/${encodeURIComponent(token)}`;
  const api = useCallback(async <T,>(method: "GET" | "POST", body?: unknown): Promise<T> => {
    let r: Response;
    try { r = await fetch(base, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}), cache: "no-store", referrerPolicy: "no-referrer" }); }
    catch { throw new LinkError(0, "Couldn't reach MKB — check your internet connection and try again."); }
    const data = (await r.json().catch(() => ({}))) as T & { error?: string };
    if (!r.ok) throw new LinkError(r.status, data.error ?? "Something went wrong. Please try again or call us at 888-379-9372.");
    return data;
  }, [base]);
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState<LinkError | null>(null);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { api<Loaded>("GET").then(setData).catch((e) => setErr(e instanceof LinkError ? e : new LinkError(0, "Something went wrong."))); }, [api]);
  const ok = agree && !!drawn && name.trim().split(/\s+/).length >= 2;
  const sign = async () => {
    setBusy(true); setMsg("");
    try { await api("POST", { name: name.trim(), signature: drawn, agree }); setDone(true); window.scrollTo({ top: 0 }); }
    catch (e) { if (e instanceof LinkError && e.status === 410) setErr(e); else setMsg(e instanceof Error ? e.message : "Couldn't sign. Please try again."); }
    setBusy(false);
  };
  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center gap-3">
          <LogoMark height={26} />
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-ink">MKB Financial Group</p>
            <p className="flex items-center gap-1 text-[12px] text-muted"><Lock size={11} /> Private, secure signing</p>
          </div>
        </header>
        {done ? (
          <Card className="p-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-success" />
            <h1 className="mt-3 text-[22px] font-bold text-ink">Thank you{data?.firstName ? `, ${data.firstName}` : ""} — it&rsquo;s signed.</h1>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">A signed copy of &ldquo;{data?.title}&rdquo; was emailed to you. MKB Financial Group has been notified. You can close this page.</p>
          </Card>
        ) : err ? (
          <Card className="p-8 text-center">
            <h1 className="text-[20px] font-bold text-ink">{err.status === 410 ? "This link isn't active" : err.status === 429 ? "Please wait a moment" : "We couldn't open this link"}</h1>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">{err.message}</p>
            <p className="mt-4 text-[13.5px] text-ink-2">Call MKB Financial Group at <a className="font-semibold text-accent" href="tel:8883799372">888-379-9372</a>.</p>
          </Card>
        ) : !data ? (
          <Card className="p-10 text-center text-[14px] text-muted"><span role="status">Loading your document…</span></Card>
        ) : (
          <>
            <Card className="p-5 sm:p-6">
              <h1 className="flex items-center gap-2 text-[20px] font-bold text-ink sm:text-[24px]"><FileSignature size={22} className="shrink-0 text-accent" />{data.title}</h1>
              <p className="mt-1 text-[14px] text-ink-2">Hi {data.firstName} — please read everything below, then sign at the bottom.</p>
              {data.message && <p className="mt-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[13.5px] text-ink-2">{data.message}</p>}
            </Card>
            <Card className="p-5 sm:p-6">
              <div className="space-y-8 break-words">{data.parts.map((p, i) => <LetterView key={i} title={p.title} body={p.body} version={p.version} vars={{}} />)}</div>
            </Card>
            <Card className="space-y-3 p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold text-ink">Sign</h2>
              <label className="flex items-start gap-2 text-[14px] text-ink"><input type="checkbox" checked={agree} onChange={() => setAgree(!agree)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />I read this document and agree to it. I understand my typed name and drawn signature are my electronic signature.</label>
              <div className="max-w-sm"><label htmlFor="ps-name" className="mb-1 block text-[13px] font-medium text-ink-2">Your full name (first and last)</label><input id="ps-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" /></div>
              <div className="max-w-lg"><SignaturePad label="Sign here with your finger or mouse" onChange={setDrawn} /></div>
              {msg && <p role="alert" className="text-[13px] font-semibold text-danger-ink">{msg}</p>}
              <Button variant="primary" icon={FileSignature} disabled={busy || !ok} onClick={() => void sign()}>{busy ? "Signing…" : "Sign document"}</Button>
              {!ok && <p className="text-[12px] text-muted">Check the box, type your full name and draw your signature to sign.</p>}
              <p className="text-[12px] text-muted">Once you sign, this link closes and a signed copy is emailed to you.</p>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
