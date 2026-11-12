"use client";

import Link from "next/link";
import { useClientGate } from "@/components/team/AccessGuard";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleDot, ClipboardList, CreditCard, Eye, FilePlus2, FileText, Lock, MessageSquare, Plus, Receipt, RotateCcw, Send, ShieldCheck, UploadCloud, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ServiceEngagementCard } from "@/components/engagement/ServiceEngagement";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { PaymentDialog } from "@/components/crm/dialogs";
import { FeeBreakdown } from "@/components/biz/BizBits";
import { FilePicker } from "@/components/biz/BizDialogs";
import { STAFF, meId, staffById, staffList } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { matterCases, useExp } from "@/lib/store/exp-store";
import { ACKNOWLEDGMENTS, ASSIGNMENT_ROLES, COMPLEXITY, FEE_KIND, INTAKE_META, chargeCount, type Complexity, type ExpMatter, type FeeKind, type InfoRequest, type Tri } from "@/lib/expunge/config";
import { casePhase, matterPhase, nextAction, priceFor } from "@/lib/expunge/derive";
import { fmtDate, fmtDateTime, relTime, usd } from "@/lib/format";
import { maskDOB } from "@/lib/validation";
import type { Client, InvoiceLine } from "@/lib/types";
import { CaseEditor, SsnField, Masked, NotLegalAdvice, OutcomeBadge, OwnerBadge, PhaseBadge, Restricted, RoleSwitcher, SecurityNote, StatusBadge, TriField, blankCase, caseErrors, caseHref, portalHref, useHashTab, type CaseDraft } from "./ExpParts";

const TABS = [
  { key: "cases", label: "Cases", icon: ClipboardList },
  { key: "intake", label: "Intake", icon: UserRound },
  { key: "requests", label: "Requests & messages", icon: MessageSquare },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "team", label: "Team & access", icon: Users },
  { key: "notes", label: "Internal notes", icon: Lock },
] as const;
type Tab = (typeof TABS)[number]["key"];
const toFiles = (fs: File[]) => fs.map((f) => ({ name: f.name.replace(/\.[^.]+$/, ""), sizeKb: Math.max(1, Math.round(f.size / 1024)), file: f }));

export function MatterPage({ id }: { id: string }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const m = exp.matters.find((x) => x.id === id);
  const c = clientStore.clients.find((x) => x.id === m?.clientId);
  const [tab, go] = useHashTab(TABS.map((t) => t.key), "cases" as Tab);
  useEffect(() => {
    if (m && exp.can.criminalHistory) exp.logAccess(m.id, "Opened client matter");
  }, [m?.id, exp.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const gate = useClientGate(m?.clientId, "this expungement matter");
  if (gate) return gate;
  if (!m || !c)
    return (
      <div className="py-20 text-center">
        <h1 className="text-[20px] font-bold text-ink">Matter not found</h1>
        <p className="mt-1 text-[14px] text-muted">Sample data resets when the page reloads.</p>
        <Link href="/services/record-expungement" className="mt-4 inline-block text-[14px] font-semibold text-accent">Back to Record Expungement</Link>
      </div>
    );
  const cs = matterCases(exp, m.id);
  const phase = matterPhase(m, cs);
  const im = INTAKE_META[m.intake.status];
  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Record Expungement", href: "/services/record-expungement" }, { label: "Clients & matters", href: "/services/record-expungement#matters" }, { label: m.number }]} />
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{c.name}</h1><PhaseBadge p={phase} /><Badge tone={im.tone}>{im.label}</Badge></div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              <span className="font-mono text-[12px] text-faint">{m.number}</span>
              <Link href={`/clients/${c.id}`} className="font-medium text-accent hover:underline">Client profile</Link>
              <span>DOB {maskDOB(c.dob) || "not on file"}</span>
              <span>{cs.filter((x) => !x.draft).length} case{cs.length === 1 ? "" : "s"} · {[...new Set(cs.map((x) => x.state))].join(", ") || "no jurisdictions yet"}</span>
              <span>Since {fmtDate(m.createdAt)} · via {m.source}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            <RoleSwitcher />
            <Button size="sm" icon={Eye} href={portalHref(c.id)}>Client portal view</Button>
            {(m.intake.status === "inquiry") && <Button size="sm" variant="primary" icon={Send} disabled={!exp.can.edit} onClick={() => { exp.sendIntake(m.id); toast("Intake sent to the client"); }}>Send intake</Button>}
            {m.intake.status === "submitted" && <Button size="sm" variant="primary" icon={ShieldCheck} disabled={!exp.can.criminalHistory} onClick={() => { const n = exp.reviewIntake(m.id, meId()); toast(n ? `Intake reviewed — ${n} case(s) still need a workflow chosen` : "Intake reviewed — cases opened"); }}>Mark intake reviewed</Button>}
          </div>
        </div>
      </section>
      <div className="sticky top-16 z-20 -mx-4 mt-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Matter" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}><t.icon size={16} /> {t.label}{t.key === "requests" && m.info.some((i) => i.status !== "accepted") && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink">{m.info.filter((i) => i.status !== "accepted").length}</span>}</button>)}
        </div>
      </div>
      <div className="mt-5">
        {tab === "cases" && (
          <div className="space-y-5">
            <ServiceEngagementCard e={m.engagement} letterName="Record expungement letter" letterUrl={`/api/exp/matters/${encodeURIComponent(m.id)}/letter`} when="The client accepts the letter before MKB prepares any documents" canRecord={exp.can.edit} onAccept={(a) => exp.acceptEngagement(m.id, a)} />
            <CasesTab m={m} />
          </div>
        )}
        {tab === "intake" && <IntakeTab m={m} c={c} />}
        {tab === "requests" && <RequestsTab m={m} c={c} />}
        {tab === "billing" && <BillingTab m={m} c={c} />}
        {tab === "team" && <TeamTab m={m} />}
        {tab === "notes" && <NotesTab m={m} />}
      </div>
    </>
  );
}

/* ================================================================== */

function CasesTab({ m }: { m: ExpMatter }) {
  const exp = useExp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<CaseDraft>(blankCase());
  const [tried, setTried] = useState(false);
  const cs = matterCases(exp, m.id);
  const errs = caseErrors(v, false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[13px] text-muted">Each arrest or court case is its own record, with its own documents, screening, staff, filing history and outcome — even for the same client.</p>
        <Button variant="primary" icon={Plus} disabled={!exp.can.criminalHistory || !exp.can.edit} onClick={() => { setV(blankCase()); setTried(false); setOpen(true); }}>Add case</Button>
      </div>
      {cs.length === 0 && <Card className="p-10 text-center text-[14px] text-muted">No cases yet. They&rsquo;re added from the client&rsquo;s intake or here.</Card>}
      <div className="grid gap-3 lg:grid-cols-2">
        {cs.map((c) => {
          const n = nextAction(c, m);
          return (
            <Link key={c.id} href={caseHref(c)} className="block rounded-2xl border border-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[12.5px] font-semibold text-ink">{c.number}</span>{c.draft && <Badge tone="warning">Draft from client portal</Badge>}<span className="ml-auto"><StatusBadge s={c.status} /></span></div>
              <div className="mt-1 text-[14.5px] font-semibold text-ink">{c.state === "LA" ? "Louisiana" : c.state === "TX" ? "Texas" : c.state} · {c.locality || "locality not set"}</div>
              <div className="text-[12.5px] font-medium text-accent-ink">{exp.jurisdictions.find((j) => j.id === c.jurisdictionId)?.remedies.find((r) => r.id === c.remedyId)?.name ?? "Workflow not chosen yet"}</div>
              {exp.can.criminalHistory ? (
                <div className="text-[12.5px] text-muted">{c.dockets.length} docket{c.dockets.length > 1 ? "s" : ""} · {chargeCount(c)} charge{chargeCount(c) > 1 ? "s" : ""} · {c.dockets.map((d) => d.court).filter(Boolean)[0] ?? "court not set"}</div>
              ) : (
                <div className="flex items-center gap-1 text-[12.5px] text-muted"><Lock size={12} /> Case details restricted</div>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5"><PhaseBadge p={casePhase(c, m)} />{exp.can.screening && <OutcomeBadge o={c.screening.outcome} />}</div>
              <div className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-2"><OwnerBadge o={n.owner} /> {n.text} <span className="ml-auto text-muted">{staffById(c.assignedTo).name}</span></div>
            </Link>
          );
        })}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Add a case" description="One arrest or court case. Add every docket and charge that belongs to this arrest." footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { setTried(true); if (errs.length) return; const id = exp.addCase(m.id, v, "staff"); toast(`${id} added`); setOpen(false); }}>Add case</Button></>}>
        <CaseEditor v={v} setV={setV} />
        {tried && errs.length > 0 && <p className="mt-3 text-[12.5px] text-danger-ink" role="alert">{errs.join(" · ")}</p>}
      </Modal>
    </div>
  );
}

/* ================================================================== */

function IntakeTab({ m, c }: { m: ExpMatter; c: Client }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const [v, setV] = useState(m.intake);
  const [alias, setAlias] = useState("");
  const [prev, setPrev] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => setV(m.intake), [m.intake]);
  const dirty = JSON.stringify(v) !== JSON.stringify(m.intake);
  const cs = matterCases(exp, m.id);
  const ad = v.additional;
  const setAd = (p: Partial<typeof ad>) => setV({ ...v, additional: { ...ad, ...p } });
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={UserRound} title="A. Client information" subtitle="Legal name, aliases and contact. Contact details come from the central client record." action={<Button size="sm" variant="primary" disabled={!dirty || !exp.can.edit} onClick={() => { exp.saveIntake(m.id, v, "staff"); toast("Intake saved"); }}>Save intake</Button>} />
        <div className="space-y-4 px-5 pb-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField id="in-first" label="Legal first name" value={v.first} onChange={(e) => setV({ ...v, first: e.target.value })} />
            <TextField id="in-middle" label="Middle name" value={v.middle} onChange={(e) => setV({ ...v, middle: e.target.value })} />
            <TextField id="in-last" label="Legal last name" value={v.last} onChange={(e) => setV({ ...v, last: e.target.value })} />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Previous names and aliases</span>
            <div className="flex flex-wrap items-center gap-1.5">{v.aliases.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] text-ink-2">{a}<button type="button" aria-label={`Remove ${a}`} onClick={() => setV({ ...v, aliases: v.aliases.filter((_, j) => j !== i) })} className="text-muted hover:text-danger">×</button></span>)}<input aria-label="Add alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Add a name…" className="h-8 w-44 rounded-full border border-line bg-surface px-3 text-[12.5px] text-ink" /><Button size="sm" variant="ghost" disabled={!alias.trim()} onClick={() => { setV({ ...v, aliases: [...v.aliases, alias.trim()] }); setAlias(""); }}>Add</Button></div>
          </div>
          <dl className="grid gap-3 text-[13.5px] sm:grid-cols-3">
            <div><dt className="text-[12px] text-muted">Date of birth</dt><dd className="font-medium text-ink">{maskDOB(c.dob) || "Not on file"} <span className="text-[12px] text-muted">(full DOB on the client record, revealed with permission)</span></dd></div>
            <div><dt className="text-[12px] text-muted">Email · phone</dt><dd className="font-medium text-ink">{c.email} · {c.phone}</dd></div>
          </dl>
          <SsnField c={c} matterId={m.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="in-addr" label="Current address" value={v.currentAddress} onChange={(e) => setV({ ...v, currentAddress: e.target.value })} />
            <SelectField id="in-pref" label="Preferred contact method" value={v.preferredContact} onChange={(e) => setV({ ...v, preferredContact: e.target.value })} options={["Phone", "Text", "Email", "Portal"].map((x) => [x, x])} />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Previous addresses (when relevant to the cases)</span>
            <ul className="space-y-1">{v.previousAddresses.map((a, i) => <li key={i} className="flex items-center gap-2 text-[13px] text-ink-2"><span className="flex-1">{a}</span><button type="button" aria-label={`Remove address ${i + 1}`} onClick={() => setV({ ...v, previousAddresses: v.previousAddresses.filter((_, j) => j !== i) })} className="text-muted hover:text-danger">×</button></li>)}</ul>
            <div className="mt-1.5 flex gap-2"><input aria-label="Add previous address" value={prev} onChange={(e) => setPrev(e.target.value)} placeholder="Address and years" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink" /><Button size="sm" disabled={!prev.trim()} onClick={() => { setV({ ...v, previousAddresses: [...v.previousAddresses, prev.trim()] }); setPrev(""); }}>Add</Button></div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
            <span className="text-[13.5px] font-medium text-ink">Identification document</span>
            <Badge tone={m.intake.idDoc === "received" ? "success" : m.intake.idDoc === "requested" ? "warning" : "neutral"}>{m.intake.idDoc === "received" ? "Received (restricted file)" : m.intake.idDoc === "requested" ? "Requested" : "Not requested"}</Badge>
            {m.intake.idDoc !== "received" && <><div className="w-full sm:w-auto sm:flex-1"><FilePicker files={files} setFiles={setFiles} label="Upload ID (when required)" multiple={false} /></div><Button size="sm" disabled={!files.length} onClick={() => { exp.uploadId(m.id, toFiles(files)[0], "staff"); setFiles([]); toast("ID uploaded"); }}>Upload</Button></>}
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader icon={ClipboardList} title="B. Criminal history" subtitle={`${cs.length} case(s) — each managed on its own case record`} />
        {exp.can.criminalHistory ? (
          <ul className="divide-y divide-line border-t border-line">
            {cs.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">The client hasn&rsquo;t added any cases yet.</li>}
            {cs.map((x) => <li key={x.id}><Link href={caseHref(x)} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6"><span className="font-mono text-[12.5px] text-ink">{x.number}</span><span className="flex-1 text-[13.5px] text-ink-2">{x.state} · {x.locality} · arrest {x.arrestDate ? fmtDate(`${x.arrestDate}T12:00`) : "date unknown"} · {x.dockets.length} docket(s), {chargeCount(x)} charge(s)</span>{x.draft && <Badge tone="warning">Draft</Badge>}</Link></li>)}
          </ul>
        ) : <div className="px-5 pb-5 sm:px-6"><Restricted /></div>}
      </Card>
      <Card>
        <CardHeader icon={ClipboardList} title="C. Additional history" />
        {exp.can.criminalHistory ? (
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3 sm:px-6">
            <TriField id="in-pend" label="Pending criminal charges" value={ad.pendingCharges} onChange={(x) => setAd({ pendingCharges: x })} />
            <TriField id="in-sup" label="Currently on probation or parole" value={ad.onSupervision} onChange={(x) => setAd({ onSupervision: x })} />
            <TriField id="in-prior" label="Prior expungements" value={ad.priorExpungements} onChange={(x) => setAd({ priorExpungements: x })} />
            <TriField id="in-prev" label="Previous expungement applications" value={ad.previousApplications} onChange={(x) => setAd({ previousApplications: x })} />
            <TriField id="in-den" label="Denied applications" value={ad.deniedApplications} onChange={(x) => setAd({ deniedApplications: x })} />
            <TriField id="in-rec" label="Has court minutes or disposition records" value={ad.hasRecords} onChange={(x) => setAd({ hasRecords: x })} />
            <div className="sm:col-span-3"><TextArea id="in-other" label="Other relevant cases / details" value={[ad.pendingDetail, ad.otherCases].filter(Boolean).join("\n")} onChange={(e) => setAd({ otherCases: e.target.value, pendingDetail: undefined })} /></div>
          </div>
        ) : <div className="px-5 pb-5 sm:px-6"><Restricted what="Additional criminal history" /></div>}
      </Card>
      <Card>
        <CardHeader icon={ShieldCheck} title="D. Consent and acknowledgment" subtitle="Completed by the client in the portal" />
        <ul className="space-y-2 px-5 pb-5 sm:px-6">
          {ACKNOWLEDGMENTS.map((a) => <li key={a.key} className="flex items-start gap-2 text-[13.5px]">{m.intake.acks[a.key] ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> : <CircleDot size={16} className="mt-0.5 shrink-0 text-muted" />}<span className="flex-1 text-ink-2">{a.text}</span><span className="text-[12px] text-muted">{m.intake.acks[a.key] ? fmtDateTime(m.intake.acks[a.key]!) : "Not yet"}</span></li>)}
        </ul>
        <div className="border-t border-line px-5 py-3 text-[12.5px] text-muted sm:px-6">Status: {INTAKE_META[m.intake.status].label}{m.intake.submittedAt ? ` · submitted ${fmtDate(m.intake.submittedAt)}` : ""}{m.intake.reviewedAt ? ` · reviewed by ${staffById(m.intake.reviewedBy ?? "s-mk").name} ${fmtDate(m.intake.reviewedAt)}` : ""}</div>
      </Card>
      <NotLegalAdvice compact />
    </div>
  );
}

/* ================================================================== */

function RequestsTab({ m, c }: { m: ExpMatter; c: Client }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const cs = matterCases(exp, m.id);
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState({ label: "", detail: "", file: false, caseId: "" });
  const [msg, setMsg] = useState("");
  const msgs = c.messages.filter((x) => x.expMatterId === m.id);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader icon={FilePlus2} title="Requests to the client" subtitle="Shown in the client portal under “What we need from you”" action={<Button size="sm" variant="primary" icon={Plus} disabled={!exp.can.edit} onClick={() => { setItem({ label: "", detail: "", file: false, caseId: "" }); setOpen(true); }}>Request information</Button>} />
        <ul className="divide-y divide-line border-t border-line">
          {m.info.length === 0 && <li className="px-6 py-8 text-center text-[13px] text-muted">Nothing requested.</li>}
          {m.info.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5 sm:px-6">
              {i.status === "open" ? <CircleDot size={18} className="mt-0.5 shrink-0 text-warning" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />}
              <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto"><div className="text-[14px] font-medium text-ink">{i.label}{i.file && <span className="text-[12px] text-muted"> · file</span>}</div>{i.detail && <div className="text-[13px] text-ink-2">{i.detail}</div>}{i.response && <div className="mt-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink-2 ring-1 ring-line">“{i.response}”</div>}<div className="text-[12px] text-muted">{i.caseId ? `${i.caseId} · ` : ""}requested {relTime(i.createdAt)}{i.respondedAt ? ` · responded ${relTime(i.respondedAt)}` : ""}</div></div>
              <Badge tone={i.status === "open" ? "warning" : i.status === "responded" ? "info" : "success"}>{i.status === "open" ? "Open" : i.status === "responded" ? "Responded" : "Accepted"}</Badge>
              {i.status === "responded" && <Button size="sm" onClick={() => { exp.acceptInfo(m.id, i.id); toast("Accepted"); }}>Accept</Button>}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={MessageSquare} title="Messages" subtitle="Visible to the client" action={<Badge tone="info" icon={Eye}>Client can see</Badge>} />
        <div className="scrollbar-thin max-h-[380px] space-y-2.5 overflow-y-auto border-y border-line bg-surface-2 px-4 py-3 sm:px-5">
          {msgs.length === 0 && <p className="py-4 text-center text-[13px] text-muted">No messages yet.</p>}
          {msgs.map((x) => <div key={x.id} className={`flex ${x.from === "staff" ? "justify-end" : ""}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13.5px] ${x.from === "staff" ? "rounded-tr-md bg-accent text-white" : "rounded-tl-md border border-line bg-surface text-ink"}`}>{x.body}<div className={`mt-0.5 text-[11px] ${x.from === "staff" ? "text-white/80" : "text-muted"}`}>{x.author} · {fmtDateTime(x.at)}</div></div></div>)}
        </div>
        <div className="flex gap-2 p-4 sm:px-5">
          <input aria-label="Message to client" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message the client… (no legal advice)" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
          <Button variant="primary" icon={Send} disabled={!msg.trim() || !exp.can.edit} onClick={() => { clientStore.sendMessage(c.id, msg.trim(), "expunge", { expMatterId: m.id, author: staffById(m.assignments["Client follow-up"]).name }); setMsg(""); toast("Message sent"); }}>Send</Button>
        </div>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Request information" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!item.label.trim()} onClick={() => { exp.requestInfo(m.id, [{ label: item.label.trim(), detail: item.detail.trim() || undefined, file: item.file, caseId: item.caseId || undefined }]); toast("Request sent to the client"); setOpen(false); }}>Send request</Button></>}>
        <div className="space-y-4">
          <TextField id="rq-label" label="What you need" required value={item.label} onChange={(e) => setItem({ ...item, label: e.target.value })} />
          <TextArea id="rq-detail" label="Details for the client" value={item.detail} onChange={(e) => setItem({ ...item, detail: e.target.value })} />
          <SelectField id="rq-case" label="Case" value={item.caseId} onChange={(e) => setItem({ ...item, caseId: e.target.value })} options={[["", "Whole matter"], ...cs.map((x) => [x.id, `${x.number} · ${x.state}`] as [string, string])]} />
          <Checkbox label="Needs a file upload" checked={item.file} onChange={() => setItem({ ...item, file: !item.file })} />
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */

function BillingTab({ m, c }: { m: ExpMatter; c: Client }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const cs = matterCases(exp, m.id).filter((x) => !x.draft);
  const remName = (x: { jurisdictionId: string; remedyId?: string }) => exp.jurisdictions.find((j) => j.id === x.jurisdictionId)?.remedies.find((r) => r.id === x.remedyId)?.short ?? "workflow not set";
  const inv = c.invoices.filter((i) => i.expMatterId === m.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const [lines, setLines] = useState<InvoiceLine[] | null>(null);
  const [pay, setPay] = useState(false);
  const [adj, setAdj] = useState<{ id: string; kind: "refund" | "credit" | "correction"; amount: string; note: string } | null>(null);
  if (!exp.can.billing && !exp.can.criminalHistory) return <Restricted what="Billing details" />;
  const groupTotal = (g: "mkb" | "passthrough") => inv.flatMap((i) => i.lines ?? []).filter((l) => FEE_KIND[l.kind as FeeKind].group === g).reduce((s, l) => s + l.amount, 0);
  const billed = inv.reduce((s, i) => s + i.amount, 0);
  const paid = inv.reduce((s, i) => s + i.paid, 0);
  const suggest = (): InvoiceLine[] => [
    ...cs.map((x) => {
      const svc = exp.services.find((s) => s.id === x.serviceType);
      const p = priceFor(exp.prices, x.serviceType, x.remedyId, x.complexity);
      return { kind: "service" as const, label: `${svc?.name ?? "Service"} — ${x.number} (${remName(x)}, ${x.complexity})`, amount: p?.fee ?? NaN };
    }),
    ...cs.flatMap((x) => x.records.filter((r) => r.fee && !r.feePaid).map((r) => ({ kind: "records" as const, label: `${r.docType} request fee — ${x.number}`, amount: r.fee! }))),
  ];
  const valid = lines && lines.length > 0 && lines.every((l) => l.label.trim() && !Number.isNaN(l.amount));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["MKB service fees", usd(groupTotal("mkb"), 2), ""], ["Court, clerk, government & records fees", usd(groupTotal("passthrough"), 2), ""], ["Amount paid", usd(paid, 2), "text-success-ink"], ["Outstanding balance", usd(billed - paid, 2), billed - paid > 0 ? "text-danger-ink" : "text-faint"]].map(([k, v, cls]) => <div key={k} className="rounded-2xl border border-line bg-surface p-4 shadow-soft"><div className="text-[12px] text-muted">{k}</div><div className={`text-[20px] font-bold tabular-nums ${cls || "text-ink"}`}>{v}</div></div>)}
      </div>
      <Card>
        <CardHeader icon={Receipt} title="Billed by category" subtitle="Each fee type is tracked separately" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-5 pb-5 text-[13px] sm:grid-cols-4 sm:px-6">
          {(Object.keys(FEE_KIND) as FeeKind[]).map((k) => {
            const t = inv.flatMap((i) => i.lines ?? []).filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0);
            return <div key={k} className="flex justify-between gap-2 border-b border-dashed border-line py-1"><span className="text-muted">{FEE_KIND[k].label}</span><span className={`tabular-nums ${t ? "font-semibold text-ink" : "text-faint"}`}>{usd(t, 2)}</span></div>;
          })}
          <div className="flex justify-between gap-2 border-b border-dashed border-line py-1"><span className="text-muted">Refunds & adjustments</span><span className="tabular-nums font-semibold text-ink">{usd(inv.flatMap((i) => i.adjustments ?? []).reduce((s, a) => s + a.amount, 0), 2)}</span></div>
        </div>
      </Card>
      <Card>
        <CardHeader icon={Receipt} title="Pricing by case" subtitle="From the administrator's price table (service type × jurisdiction × complexity)" action={<Button size="sm" variant="primary" icon={Plus} disabled={!exp.can.billing || !cs.length} onClick={() => setLines(suggest())}>Prepare invoice</Button>} />
        <ul className="divide-y divide-line border-t border-line">
          {cs.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No cases to price yet.</li>}
          {cs.map((x) => {
            const p = priceFor(exp.prices, x.serviceType, x.remedyId, x.complexity);
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <span className="font-mono text-[12.5px] text-ink">{x.number}</span><span className="text-[12.5px] text-muted">{remName(x)}</span>
                <select aria-label={`${x.number} service type`} disabled={!exp.can.billing} value={x.serviceType} onChange={(e) => exp.updateCase(x.id, { serviceType: e.target.value }, "service type changed")} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink">{exp.services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select aria-label={`${x.number} complexity`} disabled={!exp.can.billing} value={x.complexity} onChange={(e) => exp.updateCase(x.id, { complexity: e.target.value as Complexity }, "complexity changed")} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink">{Object.entries(COMPLEXITY).map(([k, v]) => <option key={k} value={k}>{v.split(" (")[0]}</option>)}</select>
                <span className="ml-auto text-[14px] font-semibold tabular-nums text-ink">{p ? usd(p.fee) : <span className="text-[12.5px] font-normal text-warning-ink">No price configured</span>}</span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={CreditCard} title="Invoices & payments" subtitle="Invoices live on the client record" action={<div className="flex flex-wrap gap-2"><Button size="sm" disabled={!inv.length || !exp.can.billing} onClick={() => setAdj({ id: inv[0].id, kind: "refund", amount: "", note: "" })}>Refund / adjust</Button><Button size="sm" variant="primary" icon={CreditCard} disabled={billed - paid <= 0 || !exp.can.billing} onClick={() => setPay(true)}>Record payment</Button></div>} />
        <ul className="divide-y divide-line border-t border-line">
          {inv.length === 0 && <li className="px-6 py-8 text-center text-[13px] text-muted">No invoices yet.</li>}
          {inv.map((i) => (
            <li key={i.id} className="space-y-2 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[13px] font-semibold text-ink">{i.number}</span><Badge tone={i.status === "paid" ? "success" : i.status === "overdue" ? "danger" : i.status === "partial" ? "warning" : "info"}>{i.status === "paid" ? "Paid" : i.status === "overdue" ? "Overdue" : i.status === "partial" ? "Partially paid" : "Open"}</Badge><span className="ml-auto text-[13px] tabular-nums text-ink-2">{usd(i.paid, 2)} of {usd(i.amount, 2)} paid</span></div>
              <div className="text-[12px] text-muted">Issued {fmtDate(i.issuedAt)} · due {fmtDate(i.dueAt)}{i.paidAt ? ` · paid ${fmtDate(i.paidAt)}` : ""}</div>
              {i.lines && <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-line"><FeeBreakdown lines={i.lines} /></div>}
              {i.adjustments?.map((a) => <div key={a.id} className="flex items-center gap-2 text-[12.5px] text-ink-2"><RotateCcw size={13} className="text-muted" /> <span className="capitalize">{a.kind}</span> {usd(a.amount, 2)} — {a.note} <span className="text-muted">· {fmtDate(a.at)}</span></div>)}
            </li>
          ))}
        </ul>
      </Card>
      <Modal open={!!lines} onClose={() => setLines(null)} size="lg" title="Prepare invoice" description="MKB fees and pass-through court, clerk, government and records fees are listed separately. Fees with no confirmed amount must be entered." footer={<><Button onClick={() => setLines(null)}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { const n = exp.invoice(m.id, lines!.map((l) => ({ ...l, amount: l.kind === "discount" ? -Math.abs(l.amount) : l.amount })), `Record expungement assistance — ${m.number}`); toast(`${n} sent`); setLines(null); }}>Send invoice</Button></>}>
        {lines && (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line p-2.5 sm:grid-cols-[180px_1fr_110px_auto]">
                <select aria-label={`Line ${i + 1} type`} value={l.kind} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, kind: e.target.value as FeeKind } : x)))} className="col-span-2 h-9 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink sm:col-span-1">{Object.entries(FEE_KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                <input aria-label={`Line ${i + 1} description`} value={l.label} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="col-span-2 h-9 rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink sm:col-span-1" />
                <input aria-label={`Line ${i + 1} amount`} type="number" min={0} step="0.01" value={Number.isNaN(l.amount) ? "" : Math.abs(l.amount)} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value === "" ? NaN : Number(e.target.value) } : x)))} className="h-9 rounded-lg border border-line bg-surface px-2.5 text-right text-[13.5px] tabular-nums text-ink" />
                <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="h-9 w-9 rounded-lg text-muted hover:bg-danger-soft hover:text-danger">×</button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">{(["filing", "clerk", "government", "records", "third_party", "additional", "discount"] as FeeKind[]).map((k) => <Button key={k} size="sm" variant="ghost" icon={Plus} onClick={() => setLines([...lines, { kind: k, label: FEE_KIND[k].label, amount: NaN }])}>{FEE_KIND[k].label}</Button>)}</div>
            {valid && <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-line"><FeeBreakdown lines={lines.map((l) => ({ ...l, amount: l.kind === "discount" ? -Math.abs(l.amount) : l.amount }))} /></div>}
            {!valid && <p className="text-[12.5px] text-danger-ink">Enter an amount for every line (no price is assumed).</p>}
          </div>
        )}
      </Modal>
      <PaymentDialog client={c} open={pay} invoiceId={inv.find((i) => i.status !== "paid")?.id} onClose={() => setPay(false)} />
      <Modal open={!!adj} onClose={() => setAdj(null)} title="Refund or adjustment" footer={<><Button onClick={() => setAdj(null)}>Cancel</Button><Button variant="primary" disabled={!adj || !(Number(adj.amount) > 0) || !adj.note.trim()} onClick={() => { clientStore.adjustInvoice(c.id, adj!.id, { kind: adj!.kind, amount: Number(adj!.amount), note: adj!.note.trim(), byId: meId() }); toast("Adjustment recorded"); setAdj(null); }}>Record</Button></>}>
        {adj && (
          <div className="space-y-4">
            <SelectField id="aj-inv" label="Invoice" value={adj.id} onChange={(e) => setAdj({ ...adj, id: e.target.value })} options={inv.map((i) => [i.id, `${i.number} — ${usd(i.amount, 2)}`] as [string, string])} />
            <SelectField id="aj-kind" label="Type" value={adj.kind} onChange={(e) => setAdj({ ...adj, kind: e.target.value as typeof adj.kind })} options={[["refund", "Refund"], ["credit", "Credit"], ["correction", "Correction (increase)"]]} />
            <TextField id="aj-amount" label="Amount ($)" type="number" min={0} step="0.01" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} />
            <TextArea id="aj-note" label="Reason" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================================================================== */

function TeamTab({ m }: { m: ExpMatter }) {
  const exp = useExp();
  const toast = useToast();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader icon={Users} title="Staff assignments" subtitle="Owner-controlled" />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6">
          {ASSIGNMENT_ROLES.map((r) => <SelectField key={r} id={`as-${r}`} label={r} value={m.assignments[r]} disabled={!exp.can.admin} onChange={(e) => { exp.assign(m.id, r, e.target.value); toast(`${r}: ${staffById(e.target.value).name}`); }} options={staffList().map((s) => [s.id, s.name] as [string, string])} />)}
        </div>
      </Card>
      <Card>
        <CardHeader icon={Lock} title="Access log" subtitle="Who viewed criminal-history details (prototype)" />
        <ul className="divide-y divide-line border-t border-line">
          {m.access.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No access recorded.</li>}
          {m.access.map((a) => <li key={a.id} className="px-5 py-2.5 text-[13px] sm:px-6"><span className="font-medium text-ink">{a.who}</span> <span className="text-muted">({a.role})</span> — <span className="text-ink-2">{a.action}</span>{a.caseId ? <span className="text-muted"> · {a.caseId}</span> : ""}<div className="text-[12px] text-muted">{fmtDateTime(a.at)}</div></li>)}
        </ul>
      </Card>
      <div className="xl:col-span-2"><SecurityNote /></div>
    </div>
  );
}

function NotesTab({ m }: { m: ExpMatter }) {
  const exp = useExp();
  const toast = useToast();
  const [note, setNote] = useState("");
  if (!exp.can.criminalHistory) return <Restricted what="Internal notes" />;
  const caseNotes = matterCases(exp, m.id).flatMap((c) => c.internalNotes.map((n) => ({ ...n, caseId: c.id })));
  return (
    <Card>
      <CardHeader icon={Lock} title="Internal notes" subtitle="MKB only — never shown to the client" action={<Badge tone="neutral" icon={Lock}>Internal</Badge>} />
      <div className="mx-5 mb-3 flex gap-2 sm:mx-6">
        <input aria-label="Internal note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-line-strong bg-surface-2 px-3 text-[14px] text-ink" />
        <Button disabled={!note.trim()} onClick={() => { exp.addNote(m.id, note.trim()); setNote(""); toast("Internal note added"); }}>Add</Button>
      </div>
      <ul className="space-y-2 px-5 pb-5 sm:px-6">
        {[...m.notes, ...caseNotes].sort((a, b) => b.at.localeCompare(a.at)).map((n) => <li key={n.id} className="rounded-xl border border-dashed border-line-strong bg-surface-2 p-3 text-[13.5px]"><p className="text-ink-2">{n.body}</p><p className="mt-1 text-[12px] text-muted">{staffById(n.authorId).name} · {relTime(n.at)}{"caseId" in n ? ` · ${n.caseId}` : ""}</p></li>)}
      </ul>
    </Card>
  );
}

export type { Tri, InfoRequest };
export { UploadCloud, FileText, Masked };
