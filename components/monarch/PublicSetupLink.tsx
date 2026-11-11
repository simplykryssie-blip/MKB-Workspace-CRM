"use client";

/* eslint-disable @next/next/no-img-element -- static brand image */
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, FileText, Lock, Plus, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, TextField } from "@/components/ui/Field";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { parseLetter } from "@/lib/engagement/letters";
import type { Location, Preparer } from "@/lib/monarch/types";

/**
 * An office's private Monarch setup link (no login): sign the service bureau
 * agreement, upload documents and list locations / preparers. The token in the
 * address is the only key; it stops working after a while without use.
 */
type Item = { key: string; label: string; help: string; kind: "sign" | "upload" | "locations" | "preparers"; status: "open" | "review" | "done" | "na"; note?: string; files: { name: string; at: string }[] };
type View = {
  office: { name: string; contactName: string };
  items: Item[];
  locations: Location[];
  preparers?: Preparer[];
  included: { locations: number; seats: number };
  agreement: { text: string; version: number; signed?: { name: string; at: string } };
  bank?: { name: string; applicationUrl?: string };
  expiresAt: string;
  contact: { phone: string; email: string };
};
class LinkError extends Error { constructor(public status: number, message: string) { super(message); } }
const rid = (p: string) => `${p}_${crypto.getRandomValues(new Uint32Array(2)).reduce((s, n) => s + n.toString(36), "")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

export function PublicSetupLink({ token }: { token: string }) {
  const base = `/api/public/monarch/${encodeURIComponent(token)}`;
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<LinkError | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const go = useCallback(async (key: string, init: RequestInit, path = "") => {
    setBusy(key); setMsg(null);
    try {
      const r = await fetch(base + path, { ...init, cache: "no-store", referrerPolicy: "no-referrer" });
      const d = (await r.json().catch(() => ({}))) as View & { error?: string };
      if (!r.ok) {
        if (r.status === 410 || r.status === 404) setErr(new LinkError(r.status, d.error ?? "This link isn't active."));
        else setMsg({ ok: false, text: d.error ?? "Something went wrong. Please try again." });
        return false;
      }
      setV(d);
      return true;
    } catch { setMsg({ ok: false, text: "Couldn't connect — check your internet and try again." }); return false; }
    finally { setBusy(null); }
  }, [base]);
  useEffect(() => { void go("load", { method: "GET" }); }, [go]);
  const post = (key: string, body: unknown, ok: string) => go(key, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((x) => { if (x) { setMsg({ ok: true, text: ok }); setOpen(null); } return x; });
  const upload = (item: string, f: File) => {
    if (f.size > 25 * 1024 * 1024) { setMsg({ ok: false, text: "That file is larger than 25 MB." }); return; }
    void go(`up:${item}`, { method: "POST", headers: { "x-file-name": encodeURIComponent(f.name), "content-type": f.type || "application/octet-stream" }, body: f }, `/upload?item=${item}`).then((x) => x && setMsg({ ok: true, text: `Uploaded ${f.name} — thank you!` }));
  };

  const done = v ? v.items.filter((i) => i.status !== "open").length : 0;
  const total = v?.items.length ?? 0;
  const pctv = total ? Math.round((done / total) * 100) : 0;
  return (
    <main className="min-h-screen bg-bg pb-10">
      <header className="bg-[#0b0b0b] px-4 pb-5 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <img src="/brand/monarch-logo-dark.webp" alt="Monarch Tax Suite" width={190} height={43} className="h-auto" style={{ width: 190 }} />
          {v && (
            <>
              <h1 className="mt-4 text-[22px] font-bold leading-tight">Welcome, {v.office.name}</h1>
              <p className="mt-1 text-[14px] text-white/75">Send us these items to get your office set up for the season. Everything saves as you go — come back anytime.</p>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[12.5px] text-white/80"><span>{done} of {total} sent</span><span>{pctv}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#c8a96a]" style={{ width: `${pctv}%` }} /></div>
              </div>
            </>
          )}
        </div>
      </header>
      <div className="h-1 bg-[linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)]" />
      <div className="mx-auto max-w-2xl px-4 pt-5">
        {err ? (
          <Card className="p-8 text-center">
            <h1 className="text-[20px] font-bold text-ink">{err.status === 410 ? "This link isn't active" : "We couldn't open this link"}</h1>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">{err.message}</p>
          </Card>
        ) : !v ? (
          <Card className="p-10 text-center text-[14px] text-muted"><span role="status">Loading…</span></Card>
        ) : (
          <>
            {msg && <p role="status" className={`mb-3 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold ${msg.ok ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger-ink"}`}>{msg.text}</p>}
            {done === total && <Card className="mb-3 flex items-center gap-3 p-4"><CheckCircle2 className="shrink-0 text-success" /><p className="text-[14px] text-ink">You&rsquo;ve sent everything — thank you! We&rsquo;ll review it and reach out about your software setup.</p></Card>}
            <ul className="space-y-2.5">
              {v.items.map((i) => {
                const isOpen = open === i.key;
                return (
                  <li key={i.key}>
                    <Card className={i.status === "open" ? "ring-1 ring-[#c8a96a]/60" : ""}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : i.key)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                        <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-ink">{i.label}</span><span className="block text-[12.5px] text-muted">{i.status === "open" && i.note ? `Please fix: ${i.note}` : i.status === "open" ? i.help : i.kind === "sign" && v.agreement.signed ? `Signed by ${v.agreement.signed.name}` : i.files.length ? `Received ${i.files.map((f) => f.name).join(", ")}` : "Received"}</span></span>
                        {i.status === "open" ? <Badge tone="warning">Needed</Badge> : i.status === "review" ? <Badge tone="info">Received</Badge> : i.status === "na" ? <Badge>Not needed</Badge> : <Badge tone="success" icon={CheckCircle2}>Done</Badge>}
                        <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-line px-4 py-4">
                          {i.kind === "sign" && <Sign v={v} busy={busy} onSign={(name, sig) => post("sign", { action: "sign", name, signature: sig, version: v.agreement.version }, "Signed — thank you!")} />}
                          {i.kind === "upload" && <UploadBox item={i} v={v} busy={busy} onFile={(f) => upload(i.key, f)} />}
                          {i.kind === "locations" && <Locations v={v} busy={busy} onSave={(locations) => post("loc", { action: "locations", locations }, "Locations sent — thank you!")} />}
                          {i.kind === "preparers" && <Preparers v={v} busy={busy} onSave={(preparers) => post("prep", { action: "preparers", preparers }, "Preparers sent — thank you!")} />}
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 flex items-start justify-center gap-1.5 text-center text-[12px] text-muted"><Lock size={12} className="mt-0.5 shrink-0" /> This private link is only for {v.office.name}. It stays active until {day(v.expiresAt)} and renews each time you use it.{(v.contact.phone || v.contact.email) && ` Questions? ${[v.contact.phone, v.contact.email].filter(Boolean).join(" · ")}`}</p>
          </>
        )}
      </div>
    </main>
  );
}

function Sign({ v, busy, onSign }: { v: View; busy: string | null; onSign: (name: string, sig: string) => void }) {
  const [name, setName] = useState(v.office.contactName);
  const [sig, setSig] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  if (v.agreement.signed) return <p className="text-[14px] text-ink">Signed by <b>{v.agreement.signed.name}</b> on {day(v.agreement.signed.at)}. Monarch keeps the signed copy on file.</p>;
  return (
    <div className="space-y-3">
      <div className="max-h-[320px] overflow-y-auto rounded-xl border border-line bg-surface-2 p-4 text-[13.5px] leading-relaxed text-ink-2">
        {parseLetter(v.agreement.text).map((b, n) => b.kind === "h" ? <h3 key={n} className="mb-1 mt-3 text-[14.5px] font-bold text-ink first:mt-0">{b.text}</h3> : b.kind === "li" ? <p key={n} className="pl-4 -indent-3">• {b.text}</p> : <p key={n} className="mb-2">{b.text}</p>)}
      </div>
      <Checkbox label={`I've read the agreement and I'm authorized to sign for ${v.office.name}.`} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
      <TextField label="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      <SignaturePad label="Sign here with your finger or mouse" onChange={setSig} />
      <Button variant="primary" className="w-full sm:w-auto" disabled={!agree || name.trim().length < 3 || !sig || busy === "sign"} onClick={() => sig && onSign(name.trim(), sig)}>{busy === "sign" ? "Signing…" : "Sign agreement"}</Button>
    </div>
  );
}

function UploadBox({ item, v, busy, onFile }: { item: Item; v: View; busy: string | null; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const isBank = item.key === "bank_app";
  return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-ink-2">{item.help}</p>
      {isBank && v.bank?.applicationUrl && <a href={v.bank.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent hover:underline">Open the {v.bank.name} application <ExternalLink size={14} /></a>}
      {item.files.length > 0 && <ul className="space-y-1">{item.files.map((f, n) => <li key={n} className="flex items-center gap-2 text-[13px] text-ink-2"><FileText size={14} className="text-muted" /> {f.name}</li>)}</ul>}
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <Button variant="primary" icon={Upload} className="w-full sm:w-auto" disabled={busy === `up:${item.key}`} onClick={() => ref.current?.click()}>{busy === `up:${item.key}` ? "Uploading…" : item.files.length ? "Upload another file" : "Upload file"}</Button>
      <p className="text-[12px] text-muted">PDF or a clear photo, up to 25 MB.</p>
    </div>
  );
}

function Locations({ v, busy, onSave }: { v: View; busy: string | null; onSave: (l: Location[]) => void }) {
  const [rows, setRows] = useState<Location[]>(v.locations.length ? v.locations : [{ id: rid("loc"), name: "Main office", address: "", manager: v.office.contactName, efin: "", ownEfin: true, seats: 1 }]);
  const up = (i: number, k: keyof Location, val: string | boolean | number) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
  return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-ink-2">Your package includes {v.included.locations} location{v.included.locations === 1 ? "" : "s"} and {v.included.seats} software seat{v.included.seats === 1 ? "" : "s"}. Need more? Add them and we&rsquo;ll reach out about an add-on.</p>
      {rows.map((l, i) => (
        <fieldset key={l.id} className="space-y-2.5 rounded-xl border border-line p-3">
          <legend className="px-1 text-[12.5px] font-semibold text-muted">Location {i + 1}</legend>
          <TextField label="Location name" value={l.name} onChange={(e) => up(i, "name", e.target.value)} />
          <TextField label="Address" required value={l.address} onChange={(e) => up(i, "address", e.target.value)} />
          <TextField label="Manager" value={l.manager} onChange={(e) => up(i, "manager", e.target.value)} />
          <TextField label="How many people will use the software here?" type="number" min={0} value={String(l.seats)} onChange={(e) => up(i, "seats", Number(e.target.value))} />
          <Checkbox label="This location has its own EFIN" checked={l.ownEfin} onChange={(e) => up(i, "ownEfin", e.target.checked)} />
          {l.ownEfin && <TextField label="EFIN (6 digits)" inputMode="numeric" maxLength={6} value={l.efin} onChange={(e) => up(i, "efin", e.target.value.replace(/\D/g, ""))} />}
          {rows.length > 1 && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>Remove</Button>}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={Plus} onClick={() => setRows((r) => [...r, { id: rid("loc"), name: "", address: "", manager: "", efin: "", ownEfin: false, seats: 1 }])}>Add a location</Button>
        <Button variant="primary" disabled={busy === "loc" || rows.some((r) => !r.address.trim()) || rows.some((r) => r.ownEfin && r.efin.length > 0 && r.efin.length !== 6)} onClick={() => onSave(rows)}>{busy === "loc" ? "Sending…" : "Send locations"}</Button>
      </div>
    </div>
  );
}

function Preparers({ v, busy, onSave }: { v: View; busy: string | null; onSave: (p: Preparer[]) => void }) {
  const [rows, setRows] = useState<Preparer[]>(v.preparers?.length ? v.preparers : [{ id: rid("prp"), name: "", ptin: "", locationId: v.locations[0]?.id ?? "" }]);
  const up = (i: number, k: keyof Preparer, val: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
  const bad = rows.some((r) => r.ptin && !/^P\d{8}$/.test(r.ptin));
  return (
    <div className="space-y-3">
      {rows.map((p, i) => (
        <fieldset key={p.id} className="grid gap-2.5 rounded-xl border border-line p-3 sm:grid-cols-2">
          <TextField label="Name" value={p.name} onChange={(e) => up(i, "name", e.target.value)} />
          <TextField label="PTIN" placeholder="P12345678" maxLength={9} value={p.ptin} onChange={(e) => up(i, "ptin", e.target.value.toUpperCase().replace(/\s/g, ""))} />
          {v.locations.length > 1 && <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2 sm:col-span-2">Location<select value={p.locationId} onChange={(e) => up(i, "locationId", e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[14px] font-normal text-ink"><option value="">—</option>{v.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
          {rows.length > 1 && <div className="sm:col-span-2"><Button size="sm" variant="ghost" icon={Trash2} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>Remove</Button></div>}
        </fieldset>
      ))}
      {bad && <p className="text-[12.5px] text-danger-ink">A PTIN is the letter P followed by 8 digits.</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={Plus} onClick={() => setRows((r) => [...r, { id: rid("prp"), name: "", ptin: "", locationId: "" }])}>Add a preparer</Button>
        <Button variant="primary" disabled={busy === "prep" || bad || !rows.some((r) => r.name.trim())} onClick={() => onSave(rows.filter((r) => r.name.trim()))}>{busy === "prep" ? "Sending…" : "Send preparers"}</Button>
      </div>
    </div>
  );
}
