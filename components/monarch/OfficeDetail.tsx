"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, FileText, Link2, Link2Off, Mail, Pencil, Plus, Send, Trash2, Upload, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { newId, uploadRaw, useMonarch } from "@/lib/store/monarch-store";
import { capacity, isDone, itemState, progress, STAGES, stageIndex, usd, type ItemDef, type Location, type MonarchData, type Office, type Preparer } from "@/lib/monarch/types";
import { ItemBadge, MonarchGate, SALE_LABEL, SALE_TONE, shortDate, StageBadge, useAct } from "./MonarchBits";
import { itemsOf } from "./MonarchHome";
import { OfficeDialog } from "./OfficeDialog";

export function OfficeDetail({ id }: { id: string }) {
  return <MonarchGate>{(d) => { const o = d.offices.find((x) => x.id === id); return o ? <Detail d={d} o={o} /> : <Card className="p-8 text-center text-[14px] text-muted">This office doesn&rsquo;t exist (or was deleted). <Link href="/monarch/offices" className="font-semibold text-accent">Back to offices</Link></Card>; }}</MonarchGate>;
}

function Detail({ d, o }: { d: MonarchData; o: Office }) {
  const m = useMonarch();
  const router = useRouter();
  const { busy, run } = useAct();
  const [editing, setEditing] = useState(false);
  const [locs, setLocs] = useState(false);
  const [preps, setPreps] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const items = itemsOf(d, o);
  const p = progress(o, items);
  const pkg = d.packages.find((x) => x.id === o.packageId);
  const sw = d.software.find((x) => x.id === o.softwareId);
  const bank = d.banks.find((x) => x.id === o.bankId);
  const reseller = d.resellers.find((x) => x.id === o.resellerId);
  const cap = capacity(o, pkg);
  const sales = d.sales.filter((s) => s.officeId === o.id);
  const office = (method: "POST" | "PUT", path: string, body?: unknown) => m.applyOffice(method, path, body);
  const patch = (pt: Record<string, unknown>, ok?: string) => run("patch", () => office("PUT", `/api/monarch/offices/${o.id}`, { rev: o.rev, patch: pt }), ok);
  const setItem = (key: string, status: string, extra: { note?: string; date?: string } = {}, ok?: string) => run(`item:${key}`, () => office("PUT", `/api/monarch/offices/${o.id}`, { item: { key, status, ...extra } }), ok);

  const link = (action: "send" | "copy" | "off") => run(`link:${action}`, async () => {
    const r = await m.applyOffice<{ office: Office; url?: string; emailed?: boolean }>("POST", `/api/monarch/offices/${o.id}/link`, { action });
    if (action === "copy" && r.url) { await navigator.clipboard?.writeText(r.url).catch(() => {}); setCopied(r.url); }
    return r;
  }, (r) => action === "off" ? "Upload link turned off" : action === "copy" ? "New link copied — the old one no longer works" : r.emailed ? `Upload link emailed to ${o.email}` : "Link created — email isn't connected, so copy it from the outbox");

  const linkText = o.link.state === "on" ? `${o.link.lastUsed ? `Last used ${shortDate(o.link.lastUsed)}` : "Not opened yet"} · stops working ${shortDate(o.link.expiresAt)} if unused${d.settings.closeOnActive ? ", or when onboarding is complete" : ""}`
    : o.link.state === "expired" ? `Expired ${shortDate(o.link.expiresAt)} after going unused` : o.link.state === "off" ? "Turned off" : "No link sent yet";

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Monarch", href: "/monarch" }, { label: "Offices", href: "/monarch/offices" }, { label: o.name }]}
        title={<span className="flex flex-wrap items-center gap-2">{o.name} <StageBadge stage={o.stage} /></span>}
        subtitle={<>{[o.contactName, o.city && `${o.city}${o.state ? `, ${o.state}` : ""}`, pkg?.name].filter(Boolean).join(" · ") || "No details yet"}{reseller && <> · brought in by <Link href="/monarch/resellers" className="font-semibold text-accent hover:underline">{reseller.name}</Link></>}</>}
        actions={<><Button icon={Pencil} onClick={() => setEditing(true)}>Edit</Button><Button icon={Wallet} href={`/monarch/sales?office=${o.id}`}>Record a sale</Button></>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 sm:px-6">
        <Badge tone={o.link.state === "on" ? "success" : o.link.state === "none" ? "neutral" : "warning"} icon={o.link.state === "on" ? Link2 : Link2Off}>{o.link.state === "on" ? "Upload link on" : o.link.state === "expired" ? "Upload link expired" : o.link.state === "off" ? "Upload link off" : "No upload link"}</Badge>
        <span className="min-w-[200px] flex-1 text-[13px] text-ink-2">{linkText}</span>
        <Button size="sm" variant="primary" icon={Send} disabled={!!busy || !o.email} title={o.email ? undefined : "Add an email address first"} onClick={() => void link("send")}>{o.link.state === "none" ? "Email upload link" : "Email a new link"}</Button>
        <Button size="sm" icon={Copy} disabled={!!busy} onClick={() => void link("copy")}>Copy a new link</Button>
        {o.link.state === "on" && <Button size="sm" icon={Link2Off} disabled={!!busy} onClick={() => void link("off")}>Turn off</Button>}
      </Card>
      {copied && <p className="-mt-2 mb-4 break-all rounded-xl bg-accent-soft px-4 py-2 text-[12.5px] text-accent-ink">Copied: {copied}</p>}

      <ol aria-label="Stage" className="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {STAGES.map((s, i) => {
          const cur = stageIndex(o.stage);
          const done = i < cur, on = i === cur;
          return (
            <li key={s.key}>
              <button type="button" onClick={() => !on && void patch({ stage: s.key }, `Moved to ${s.label}`)} disabled={!!busy || on} title={on ? "Current stage" : `Move to ${s.label}`}
                className={`flex w-full items-center gap-1.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold ring-1 ${on ? "bg-accent text-white ring-accent" : done ? "bg-success-soft text-success-ink ring-success/20" : "bg-surface text-muted ring-line hover:text-ink"}`}>
                {done && <Check size={14} />}{s.label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Onboarding checklist" subtitle={`Built from this office's package, software and bank · ${p.done} of ${p.total} done`} />
          <ul className="border-t border-line">
            {items.map((i) => <ItemRow key={i.key} d={d} o={o} def={i} busy={busy} setItem={setItem} run={run} onLocations={() => setLocs(true)} onPreparers={() => setPreps(true)} />)}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Software & bank" action={<Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>Change</Button>} />
            <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-line px-5 py-4 text-[13.5px] sm:px-6">
              <dt className="text-muted">Software</dt><dd className="font-semibold text-ink">{sw?.name ?? "Not chosen"}</dd>
              <dt className="text-muted">Bank</dt><dd className="font-semibold text-ink">{bank?.name ?? "Not chosen"}</dd>
              <dt className="text-muted">Package price</dt><dd className="font-semibold text-ink">{pkg ? usd(pkg.priceCents) : "—"}</dd>
              <dt className="text-muted">Your SB fee</dt><dd className="font-semibold text-ink">{sw ? `${usd(sw.sbFeeCents)} per funded return` : "—"}</dd>
              <dt className="text-muted">Bank add-on</dt><dd className="font-semibold text-ink">{bank ? `${usd(bank.addonFeeCents)} per bank product` : "—"}</dd>
              <dt className="text-muted">Enrollment</dt><dd className="font-semibold text-ink">{o.bank.enrollment ?? "Not in a report yet"}</dd>
              <dt className="text-muted">Funded (season)</dt><dd className="font-semibold text-ink">{o.bank.funded !== undefined ? `${o.bank.funded} · ${usd(o.bank.feesCents ?? 0)} fees` : "—"}</dd>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Included in their package" subtitle={pkg ? pkg.name : "No package yet"} />
            <div className="space-y-3 border-t border-line px-5 py-4 sm:px-6">
              <Meter label="Locations" used={cap.usedLocations} of={cap.locations} />
              <Meter label="Software seats" used={cap.usedSeats} of={cap.seats} />
              {(cap.usedLocations > cap.locations || cap.usedSeats > cap.seats) && (
                <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> More than their package includes. <Link href={`/monarch/sales?office=${o.id}`} className="font-semibold underline">Sell an add-on</Link></p>
              )}
              <p className="text-[12px] text-muted">Includes {pkg?.locations ?? 0} location{pkg?.locations === 1 ? "" : "s"} and {pkg?.seats ?? 0} seat{pkg?.seats === 1 ? "" : "s"}{o.extraLocations || o.extraSeats ? `, plus add-ons: ${o.extraLocations} location${o.extraLocations === 1 ? "" : "s"}, ${o.extraSeats} seat${o.extraSeats === 1 ? "" : "s"}` : ""}.</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Locations" action={<Button size="sm" variant="ghost" icon={Pencil} onClick={() => setLocs(true)}>Edit</Button>} />
            {o.locations.length ? (
              <ul className="border-t border-line">
                {o.locations.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0 sm:px-6">
                    <span className="min-w-0"><span className="block font-semibold text-ink">{l.name}</span><span className="block text-[12px] text-muted">{[l.address, l.manager, `${l.seats} seat${l.seats === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</span></span>
                    <span className={`shrink-0 text-right text-[12.5px] font-semibold ${l.efin ? "text-ink-2" : "text-warning-ink"}`}>{l.efin ? `EFIN ${l.efin}` : l.ownEfin ? "EFIN needed" : "Shares main EFIN"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="border-t border-line px-5 py-4 text-[13px] text-muted sm:px-6">None yet — the office adds them on their upload link, or you can add them.</p>}
          </Card>

          {(pkg?.askPtins || o.preparers.length > 0) && (
            <Card>
              <CardHeader title="Preparers" action={<Button size="sm" variant="ghost" icon={Pencil} onClick={() => setPreps(true)}>Edit</Button>} />
              <ul className="border-t border-line">
                {o.preparers.map((pr) => <li key={pr.id} className="flex justify-between gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0 sm:px-6"><span className="font-semibold text-ink">{pr.name}</span><span className="text-ink-2">{pr.ptin || "PTIN needed"}</span></li>)}
                {!o.preparers.length && <li className="px-5 py-4 text-[13px] text-muted sm:px-6">None yet.</li>}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Sales" action={<Button size="sm" variant="ghost" icon={Plus} href={`/monarch/sales?office=${o.id}`}>Record</Button>} />
            <ul className="border-t border-line">
              {sales.map((s) => <li key={s.id} className="flex items-center gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0 sm:px-6"><span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{s.description}</span><span className="block text-[12px] text-muted">{shortDate(s.createdAt)}{s.method ? ` · ${s.method}` : ""}</span></span><Badge tone={SALE_TONE[s.status]}>{SALE_LABEL[s.status]}</Badge><span className="w-20 text-right font-bold tabular-nums">{usd(s.amountCents)}</span></li>)}
              {!sales.length && <li className="px-5 py-4 text-[13px] text-muted sm:px-6">No sales yet.</li>}
            </ul>
          </Card>

          {(() => {
            const keys = new Set(items.map((i) => i.key));
            const other = o.files.filter((f) => !keys.has(f.item));
            return other.length ? (
              <Card>
                <CardHeader title="Files" subtitle="Other files for this office (e.g. their WISP from the website)" />
                <ul className="border-t border-line">
                  {other.map((f) => <li key={f.id} className="flex items-center gap-2 border-b border-line px-5 py-2.5 text-[13px] last:border-0 sm:px-6"><FileText size={14} className="shrink-0 text-muted" /><a href={`/api/monarch/offices/${o.id}/files/${f.id}?inline=1`} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-semibold text-accent hover:underline">{f.name}</a><span className="shrink-0 text-[12px] text-muted">{shortDate(f.at)}</span></li>)}
                </ul>
              </Card>
            ) : null;
          })()}

          <Notes o={o} />

          <Card className="px-5 py-4 sm:px-6">
            <p className="text-[13px] font-semibold text-ink">Renews</p>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <input type="date" aria-label="Renewal date" defaultValue={o.renewsOn ?? ""} key={o.renewsOn ?? "none"} onBlur={(e) => e.target.value !== (o.renewsOn ?? "") && void patch({ renewsOn: e.target.value }, "Renewal date saved")} className="h-9 rounded-xl border border-line bg-surface px-3 text-[13.5px] text-ink" />
              <span className="text-[12px] text-muted">Set automatically a year after a season package is paid.</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              {o.stage !== "inactive"
                ? <Button size="sm" onClick={() => void patch({ stage: "inactive" }, "Marked inactive")}>Mark inactive</Button>
                : <Button size="sm" onClick={() => void patch({ stage: "interested" }, "Reopened")}>Reopen</Button>}
              {!sales.length && <Button size="sm" icon={Trash2} onClick={() => { if (confirm(`Delete ${o.name}? This removes the office and its uploaded files.`)) void run("del", async () => { await m.apply("POST", `/api/monarch/offices/${o.id}`, { action: "delete" }); router.push("/monarch/offices"); }, "Office deleted"); }}>Delete office</Button>}
            </div>
          </Card>
        </div>
      </div>
      <OfficeDialog open={editing} onClose={() => setEditing(false)} data={d} office={o} />
      <LocationsDialog open={locs} onClose={() => setLocs(false)} o={o} />
      <PreparersDialog open={preps} onClose={() => setPreps(false)} o={o} />
    </div>
  );
}

function Meter({ label, used, of }: { label: string; used: number; of: number }) {
  const over = used > of;
  const pctv = of ? Math.min(100, Math.round((used / of) * 100)) : used ? 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px]"><span className="font-semibold text-ink">{label}</span><span className={`font-bold ${over ? "text-danger-ink" : used === of && of ? "text-warning-ink" : "text-ink"}`}>{used} of {of}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line"><div className="h-full rounded-full" style={{ width: `${pctv}%`, background: over ? "var(--danger)" : used === of && of ? "var(--warning)" : "var(--success)" }} /></div>
    </div>
  );
}

type Run = ReturnType<typeof useAct>["run"];
function ItemRow({ d, o, def, busy, setItem, run, onLocations, onPreparers }: { d: MonarchData; o: Office; def: ItemDef; busy: string | null; setItem: (key: string, status: string, extra?: { note?: string; date?: string }, ok?: string) => Promise<unknown>; run: Run; onLocations: () => void; onPreparers: () => void }) {
  const m = useMonarch();
  const st = itemState(o, def.key);
  const done = isDone(st);
  const files = o.files.filter((f) => f.item === def.key);
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState(o.softwareUsername);
  const [date, setDate] = useState(st.date ?? "");
  useEffect(() => setUser(o.softwareUsername), [o.softwareUsername]);
  const bank = d.banks.find((b) => b.id === o.bankId);
  const sw = d.software.find((s) => s.id === o.softwareId);

  const upload = (f: File) => run(`up:${def.key}`, () => uploadRaw<{ office: Office }>(`/api/monarch/offices/${o.id}/files?item=${def.key}`, f).then((r) => { m.setOffice(r.office); return r; }), "Uploaded");
  const email = (kind: "bank_app" | "welcome") => run(`email:${kind}`, () => m.applyOffice<{ office: Office; emailed: boolean }>("POST", `/api/monarch/offices/${o.id}/email`, { kind }), (r) => r.emailed ? `Emailed to ${o.email}` : "Saved — email isn't connected, so it's in the outbox");

  let detail = def.help;
  if (def.key === "agreement" && o.agreement) detail = `Signed online ${shortDate(o.agreement.at)} by ${o.agreement.name}`;
  else if (def.key === "locations" && o.locations.length) detail = `${o.locations.length} location${o.locations.length === 1 ? "" : "s"} · ${o.locations.filter((l) => l.ownEfin && !l.efin).length ? `${o.locations.filter((l) => l.ownEfin && !l.efin).length} still need an EFIN` : "all have an EFIN"}`;
  else if (def.key === "preparers" && o.preparers.length) detail = `${o.preparers.length} preparer${o.preparers.length === 1 ? "" : "s"} · ${o.preparers.filter((p) => !p.ptin).length} without a PTIN`;
  else if (def.key === "bank_app" && st.sentAt) detail = `Application link emailed ${shortDate(st.sentAt)}${files.length ? ` · their copy uploaded ${shortDate(files[files.length - 1].at)}` : ""}`;
  else if (def.key === "bank_approved" && o.bank.enrollment) detail = `Latest ${bank?.name ?? "bank"} report: ${o.bank.enrollment}${st.note ? ` · ${st.note}` : ""}`;
  else if (def.key === "welcome" && st.sentAt) detail = `Sent ${shortDate(st.sentAt)}`;
  else if (def.key === "walkthrough" && st.date) detail = `Done ${shortDate(st.date)}`;
  else if (st.status === "open" && st.note) detail = `Sent back: ${st.note}`;

  const B = (p: React.ComponentProps<typeof Button>) => <Button size="sm" {...p} />;
  return (
    <li className="border-b border-line px-5 py-3.5 last:border-0 sm:px-6">
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className={`mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-[1.5px] ${done ? "border-success bg-success text-white" : st.status === "review" ? "border-accent" : "border-line-strong"}`}>{done && <Check size={14} strokeWidth={3} />}</span>
        <div className="min-w-[200px] flex-1">
          <p className="text-[14px] font-semibold text-ink">{def.label}</p>
          <p className="text-[12.5px] text-muted">{detail}</p>
          {files.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {files.map((f) => <li key={f.id}><a href={`/api/monarch/offices/${o.id}/files/${f.id}?inline=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[12px] font-semibold text-accent ring-1 ring-line hover:underline"><FileText size={12} /> {f.name}</a></li>)}
            </ul>
          )}
        </div>
        <ItemBadge def={def} state={st} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-[34px]">
        {st.status === "review" && <><B variant="primary" icon={Check} disabled={!!busy} onClick={() => void setItem(def.key, "done", {}, "Checked off")}>Looks good</B><B disabled={!!busy} onClick={() => { const n = prompt("What does the office need to fix? (shown on their link)"); if (n) void setItem(def.key, "open", { note: n }, "Sent back to the office"); }}>Send back</B></>}
        {def.kind === "upload" && !done && <><input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} /><B icon={Upload} disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === `up:${def.key}` ? "Uploading…" : "Upload for them"}</B></>}
        {def.key === "locations" && <B icon={Pencil} onClick={onLocations}>{o.locations.length ? "Edit locations" : "Add locations"}</B>}
        {def.key === "preparers" && <B icon={Pencil} onClick={onPreparers}>{o.preparers.length ? "Edit preparers" : "Add preparers"}</B>}
        {def.key === "bank_app" && !done && <B icon={Mail} disabled={!!busy || !bank?.applicationUrl || !o.email} title={!bank ? "Choose their bank first" : !bank.applicationUrl ? "Add the application link in Setup" : undefined} onClick={() => void email("bank_app")}>{st.sentAt ? "Resend bank application" : `Email ${bank?.name ?? "bank"} application`}</B>}
        {def.key === "software_account" && !done && (
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void run("user", async () => { await m.applyOffice("PUT", `/api/monarch/offices/${o.id}`, { rev: o.rev, patch: { softwareUsername: user } }); }).then(() => setItem("software_account", "done", {}, "Account recorded")); }}>
            <input aria-label={`${sw?.name ?? "Software"} username`} value={user} onChange={(e) => setUser(e.target.value)} placeholder="Their username" className="h-8 w-44 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink" />
            <Button size="sm" variant="primary" type="submit" disabled={!user.trim() || !!busy}>Save &amp; check off</Button>
          </form>
        )}
        {def.key === "software_account" && done && o.softwareUsername && <span className="text-[12.5px] text-ink-2">Username: <b>{o.softwareUsername}</b></span>}
        {def.key === "welcome" && <B variant={done ? "secondary" : "primary"} icon={Send} disabled={!!busy || !o.softwareUsername || !o.email} title={!o.softwareUsername ? "Record their software username first" : undefined} onClick={() => void email("welcome")}>{done ? "Send again" : "Send software welcome"}</B>}
        {def.key === "walkthrough" && !done && <><input type="date" aria-label="Walkthrough date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink" /><B variant="primary" disabled={!!busy} onClick={() => void setItem("walkthrough", "done", { date: date || new Date().toISOString().slice(0, 10) }, "Checked off")}>Mark done</B></>}
        {def.kind === "staff" && !["software_account", "welcome", "walkthrough"].includes(def.key) && !done && <B disabled={!!busy} onClick={() => void setItem(def.key, "done", {}, "Checked off")}>Mark done</B>}
        {def.kind !== "staff" && st.status === "open" && def.key !== "agreement" && <B variant="ghost" disabled={!!busy} onClick={() => void setItem(def.key, "done", {}, "Checked off")}>Mark done</B>}
        {!done && st.status !== "review" && <B variant="ghost" disabled={!!busy} onClick={() => void setItem(def.key, "na", {}, "Marked not needed")}>Not needed</B>}
        {done && def.key !== "agreement" && <B variant="ghost" disabled={!!busy} onClick={() => void setItem(def.key, "open", {}, "Reopened")}>Reopen</B>}
      </div>
    </li>
  );
}

function Notes({ o }: { o: Office }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [v, setV] = useState(o.notes);
  useEffect(() => setV(o.notes), [o.notes]);
  return (
    <Card className="px-5 py-4 sm:px-6">
      <TextArea label="Notes" rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Anything to remember about this office" />
      {v !== o.notes && <Button className="mt-2" size="sm" variant="primary" disabled={!!busy} onClick={() => void run("n", () => m.applyOffice("PUT", `/api/monarch/offices/${o.id}`, { rev: o.rev, patch: { notes: v } }), "Notes saved")}>Save notes</Button>}
    </Card>
  );
}

function LocationsDialog({ open, onClose, o }: { open: boolean; onClose: () => void; o: Office }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [rows, setRows] = useState<Location[]>([]);
  useEffect(() => { if (open) setRows(o.locations.length ? o.locations : [{ id: newId("loc"), name: "Main office", address: "", manager: o.contactName, efin: "", ownEfin: true, seats: 1 }]); }, [open, o]);
  const up = (i: number, k: keyof Location, v: string | boolean | number) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <Modal open={open} onClose={onClose} title="Locations" description="Each location the office files from. EFINs are used to match bank reports." size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!busy} onClick={() => void run("l", async () => { await m.applyOffice("PUT", `/api/monarch/offices/${o.id}`, { rev: o.rev, patch: { locations: rows } }); onClose(); }, "Locations saved")}>Save</Button></>}>
      <div className="space-y-3">
        {rows.map((l, i) => (
          <fieldset key={l.id} className="rounded-xl border border-line p-3">
            <legend className="px-1 text-[12.5px] font-semibold text-muted">Location {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Name" value={l.name} onChange={(e) => up(i, "name", e.target.value)} />
              <TextField label="Address" value={l.address} onChange={(e) => up(i, "address", e.target.value)} />
              <TextField label="Manager" value={l.manager} onChange={(e) => up(i, "manager", e.target.value)} />
              <TextField label="Software seats" type="number" min={0} value={String(l.seats)} onChange={(e) => up(i, "seats", Number(e.target.value))} />
              <Checkbox label="Has its own EFIN" checked={l.ownEfin} onChange={(e) => up(i, "ownEfin", e.target.checked)} />
              {l.ownEfin && <TextField label="EFIN" inputMode="numeric" maxLength={6} value={l.efin} onChange={(e) => up(i, "efin", e.target.value.replace(/\D/g, ""))} />}
            </div>
            {rows.length > 1 && <Button className="mt-2" size="sm" variant="ghost" icon={Trash2} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>Remove</Button>}
          </fieldset>
        ))}
        <Button size="sm" icon={Plus} onClick={() => setRows((r) => [...r, { id: newId("loc"), name: "", address: "", manager: "", efin: "", ownEfin: false, seats: 1 }])}>Add location</Button>
      </div>
    </Modal>
  );
}

function PreparersDialog({ open, onClose, o }: { open: boolean; onClose: () => void; o: Office }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [rows, setRows] = useState<Preparer[]>([]);
  useEffect(() => { if (open) setRows(o.preparers.length ? o.preparers : [{ id: newId("prp"), name: "", ptin: "", locationId: o.locations[0]?.id ?? "" }]); }, [open, o]);
  const up = (i: number, k: keyof Preparer, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <Modal open={open} onClose={onClose} title="Preparers" size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!busy} onClick={() => void run("p", async () => { await m.applyOffice("PUT", `/api/monarch/offices/${o.id}`, { rev: o.rev, patch: { preparers: rows.filter((r) => r.name.trim()) } }); onClose(); }, "Preparers saved")}>Save</Button></>}>
      <div className="space-y-2">
        {rows.map((p, i) => (
          <div key={p.id} className="grid items-end gap-2 sm:grid-cols-[1fr_140px_1fr_auto]">
            <TextField label="Name" value={p.name} onChange={(e) => up(i, "name", e.target.value)} />
            <TextField label="PTIN" placeholder="P12345678" maxLength={9} value={p.ptin} onChange={(e) => up(i, "ptin", e.target.value.toUpperCase())} />
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">Location<select value={p.locationId} onChange={(e) => up(i, "locationId", e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[14px] font-normal text-ink"><option value="">—</option>{o.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
            <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button size="sm" icon={Plus} onClick={() => setRows((r) => [...r, { id: newId("prp"), name: "", ptin: "", locationId: "" }])}>Add preparer</Button>
      </div>
    </Modal>
  );
}

