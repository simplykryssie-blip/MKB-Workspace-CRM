"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { checklistFor, isDone, itemState, progress, STAGES, usd, type MonarchData, type Office } from "@/lib/monarch/types";
import { Empty, MonarchGate, Stat } from "./MonarchBits";
import { OfficeDialog } from "./OfficeDialog";

const DAY = 864e5;
const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : Infinity);

export function itemsOf(d: MonarchData, o: Office) {
  return checklistFor(o, d.packages.find((p) => p.id === o.packageId), d.banks.find((b) => b.id === o.bankId), d.software.find((s) => s.id === o.softwareId));
}

/** What needs staff attention, most important first. */
export function needsYou(d: MonarchData) {
  const out: { office: Office; what: string; action: string }[] = [];
  for (const o of d.offices) {
    if (o.stage === "inactive" || o.stage === "active") continue;
    const items = itemsOf(d, o);
    const review = items.filter((i) => itemState(o, i.key).status === "review");
    if (review.length) out.push({ office: o, what: `sent ${review.map((i) => i.label.toLowerCase()).join(", ")} — review`, action: "Review" });
    if (o.stage === "collecting" && o.link.state === "on" && daysSince(o.link.lastUsed ?? o.link.sentAt) >= 7) out.push({ office: o, what: `hasn't used their upload link in ${daysSince(o.link.lastUsed ?? o.link.sentAt)} days`, action: "Resend link" });
    if (o.stage === "collecting" && (o.link.state === "expired" || o.link.state === "off")) out.push({ office: o, what: `upload link is ${o.link.state === "expired" ? "expired" : "off"} but documents are still missing`, action: "Send a new link" });
    if (o.stage === "paid" && o.link.state === "none") out.push({ office: o, what: "paid — onboarding hasn't started", action: "Send upload link" });
    if (o.stage === "setup") {
      const next = items.find((i) => i.who === "staff" && !isDone(itemState(o, i.key)));
      if (next) out.push({ office: o, what: `ready for setup — next: ${next.label.toLowerCase()}`, action: "Open" });
    }
  }
  for (const s of d.sales) {
    if (s.status !== "unpaid" || daysSince(s.createdAt) < 7) continue;
    const o = d.offices.find((x) => x.id === s.officeId);
    if (o) out.push({ office: o, what: `${usd(s.amountCents)} for ${s.description} unpaid for ${daysSince(s.createdAt)} days`, action: "Follow up" });
  }
  return out;
}

export function MonarchHome() {
  return <MonarchGate>{(d) => <Home d={d} />}</MonarchGate>;
}

function Home({ d }: { d: MonarchData }) {
  const [adding, setAdding] = useState(false);
  const onboarding = d.offices.filter((o) => ["interested", "paid", "collecting", "setup"].includes(o.stage));
  const waiting = d.offices.filter((o) => o.stage === "collecting").length;
  const ready = d.offices.filter((o) => o.stage === "setup").length;
  const active = d.offices.filter((o) => o.stage === "active");
  const todo = needsYou(d);
  return (
    <div>
      <PageHeader title="Onboarding" subtitle="Every office from interested to fully set up." actions={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>New office</Button>} />
      <section aria-label="At a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In onboarding" value={onboarding.length} sub="offices not active yet" bar="var(--accent)" />
        <Stat label="Waiting on documents" value={waiting} sub="upload links out" bar="var(--warning)" />
        <Stat label="Ready for setup" value={ready} sub="office's part is done" bar="var(--svc-books)" />
        <Stat label="Active offices" value={active.length} sub="fully set up" href="/monarch/offices" bar="var(--success)" />
      </section>

      <section aria-label="Pipeline" className="mt-5 overflow-x-auto pb-1">
        <div className="grid min-w-[1000px] grid-cols-5 gap-3">
          {STAGES.map((st) => {
            const list = d.offices.filter((o) => o.stage === st.key);
            const shown = st.key === "active" ? list.slice(0, 6) : list;
            return (
              <div key={st.key} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface-2 p-2.5 ring-1 ring-line">
                <div className="flex items-center justify-between px-1.5 pt-0.5"><h2 className="text-[13px] font-bold text-ink">{st.label}</h2><span className="text-[12px] font-semibold text-muted">{list.length}</span></div>
                {shown.map((o) => <PipeCard key={o.id} d={d} o={o} />)}
                {st.key === "active" && list.length > shown.length && <Link href="/monarch/offices" className="px-1.5 text-[12.5px] font-semibold text-accent hover:underline">All {list.length} active offices</Link>}
                {!list.length && <p className="px-1.5 pb-1 text-[12px] text-faint">None</p>}
              </div>
            );
          })}
        </div>
      </section>

      <Card className="mt-5">
        <CardHeader title="Needs you" subtitle="Reviews, follow-ups and next steps" />
        {todo.length ? (
          <ul className="border-t border-line">
            {todo.slice(0, 30).map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-5 py-3 text-[13.5px] last:border-0 sm:px-6">
                <span className="min-w-[220px] flex-1"><b className="text-ink">{t.office.name}</b> <span className="text-ink-2">— {t.what}</span></span>
                <Link href={`/monarch/offices/${t.office.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">{t.action} <ArrowRight size={13} /></Link>
              </li>
            ))}
          </ul>
        ) : <Empty title="Nothing waiting on you">New uploads, stalled links and unpaid sales show up here.</Empty>}
      </Card>
      <OfficeDialog open={adding} onClose={() => setAdding(false)} data={d} />
    </div>
  );
}

function PipeCard({ d, o }: { d: MonarchData; o: Office }) {
  const items = itemsOf(d, o);
  const p = progress(o, items);
  const review = items.some((i) => itemState(o, i.key).status === "review");
  const pkg = d.packages.find((x) => x.id === o.packageId);
  const missing = items.filter((i) => i.who === "office" && !isDone(itemState(o, i.key)) && itemState(o, i.key).status !== "review");
  const note = o.stage === "interested" ? (pkg ? `Interested in ${pkg.name}` : "No package chosen")
    : o.stage === "paid" ? (o.link.state === "none" ? "Send the upload link" : "Link sent")
    : o.stage === "collecting" ? (review ? "New upload to review" : missing.length ? `Missing: ${missing.slice(0, 2).map((i) => i.label.replace(/ \/.*$/, "")).join(", ")}${missing.length > 2 ? ` +${missing.length - 2}` : ""}` : "All sent")
    : o.stage === "setup" ? (items.find((i) => i.who === "staff" && !isDone(itemState(o, i.key)))?.label ?? "Almost done")
    : "Active";
  return (
    <Link href={`/monarch/offices/${o.id}`} className={`flex flex-col gap-1.5 rounded-xl border bg-surface p-3 shadow-soft hover:border-line-strong ${review ? "border-accent/50" : "border-line"}`}>
      <span className="text-[13.5px] font-semibold leading-snug text-ink">{o.name}</span>
      <span className="text-[12px] text-muted">{pkg?.name ?? "No package yet"}{o.city ? ` · ${o.city}${o.state ? `, ${o.state}` : ""}` : ""}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line" aria-hidden="true"><span className="block h-full rounded-full" style={{ width: `${Math.round((p.done / Math.max(1, p.total)) * 100)}%`, background: p.done === p.total ? "var(--success)" : "var(--accent)" }} /></span>
      <span className={`text-[12px] font-semibold ${review ? "text-accent-ink" : "text-ink-2"}`}>{note}</span>
    </Link>
  );
}
