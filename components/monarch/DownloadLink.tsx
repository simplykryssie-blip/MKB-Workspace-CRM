"use client";

/* eslint-disable @next/next/no-img-element -- static brand image */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** A buyer's private download page for a Monarch store product (link valid 30 days). */
type View = { product: string; expiresAt: string; files: { id: string; name: string; size: number }[] };
const size = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function DownloadLink({ token }: { token: string }) {
  const base = `/api/public/monarch/download/${encodeURIComponent(token)}`;
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { fetch(base, { cache: "no-store" }).then(async (r) => { const d = (await r.json().catch(() => ({}))) as View & { error?: string }; if (!r.ok) throw new Error(d.error ?? "This link isn't valid."); setV(d); }).catch((e) => setErr(e instanceof Error ? e.message : "We couldn't open this link.")); }, [base]);
  return (
    <main className="min-h-screen bg-bg pb-12">
      <header className="bg-[#0b0b0b] px-4 pb-5 pt-4 text-white"><div className="mx-auto max-w-2xl"><img src="/brand/monarch-logo-dark.webp" alt="Monarch Tax Suite" width={190} height={43} className="h-auto" style={{ width: 190 }} />{v && <h1 className="mt-4 text-[22px] font-bold">{v.product}</h1>}</div></header>
      <div className="h-1 bg-[linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)]" />
      <div className="mx-auto max-w-2xl px-4 pt-5">
        {err ? <Card className="p-8 text-center text-[14px] text-ink">{err}</Card> : !v ? <Card className="p-10 text-center text-[14px] text-muted">Loading…</Card> : (
          <Card className="p-5">
            <p className="text-[14px] text-muted">Your files are ready. This link works until {new Date(v.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
            <ul className="mt-3 space-y-2">
              {v.files.map((f) => <li key={f.id}><a href={`${base}/${f.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-3 text-[14px] text-ink hover:bg-surface-2"><span className="min-w-0 truncate font-medium">{f.name}</span><span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted">{size(f.size)} <Download size={16} /></span></a></li>)}
              {!v.files.length && <li className="text-[14px] text-muted">Your files are being prepared — we&rsquo;ll email you when they&rsquo;re ready.</li>}
            </ul>
          </Card>
        )}
      </div>
    </main>
  );
}
