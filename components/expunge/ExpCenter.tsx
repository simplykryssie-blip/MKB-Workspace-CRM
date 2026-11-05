"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, CheckCircle2, ClipboardList, FileSearch, FileText, Gavel, Hourglass, Inbox, LayoutGrid, Landmark, Lock, PauseCircle, PenLine, Plus, Receipt, RotateCcw, Scale, Search, Send, ShieldAlert, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { Kpi } from "@/components/biz/BizBits";
import { STAFF, SAMPLE_NOW, staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { matterCases, useExp } from "@/lib/store/exp-store";
import { ASSIGNMENT_ROLES, CASE_STATUSES, COMPLEXITY, EXP_ROLES, RELEASE_STATES, PHASES, RECORD_META, SCREENING_OUTCOMES, chargeCount, verifiedLabel, type Complexity, type ExpMatter, type Jurisdiction, type Phase } from "@/lib/expunge/config";
import { caseDeadline, casePhase, matterPhase, nextAction } from "@/lib/expunge/derive";
import { fmtDate, fmtDateTime, relTime, usd } from "@/lib/format";
import type { Client } from "@/lib/types";
import { NotLegalAdvice, OutcomeBadge, OwnerBadge, PhaseBadge, Restricted, RoleSwitcher, SecurityNote, StatusBadge, caseHref, matterHref, useHashTab } from "./ExpParts";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "matters", label: "Clients & matters", icon: Users },
  { key: "cases", label: "Cases", icon: ClipboardList },
  { key: "records", label: "Records requests", icon: FileSearch },
  { key: "jurisdictions", label: "Jurisdictions", icon: Landmark },
  { key: "pricing", label: "Pricing", icon: Receipt },
  { key: "team", label: "Team & access", icon: ShieldCheck },
] as const;
type Tab = (typeof TABS)[number]["key"];

const CARDS: { p: Phase; label: string; icon: typeof Inbox; tone?: "accent" | "warning" | "success" | "danger" }[] = [
  { p: "New inquiry", label: "New expungement inquiries", icon: Inbox },
  { p: "Intake awaiting completion", label: "Intake forms awaiting completion", icon: PenLine, tone: "warning" },
  { p: "Awaiting criminal records", label: "Awaiting criminal records", icon: FileSearch },
  { p: "Awaiting court minutes", label: "Awaiting court minutes", icon: FileText },
  { p: "Awaiting eligibility review", label: "Awaiting eligibility review", icon: Hourglass },
  { p: "Flagged for legal review", label: "Flagged for legal review", icon: ShieldAlert, tone: "danger" },
  { p: "Documents being prepared", label: "Documents being prepared", icon: PenLine },
  { p: "Awaiting client approval", label: "Awaiting client approval", icon: Users, tone: "warning" },
  { p: "Ready for filing", label: "Ready for filing", icon: Send },
  { p: "Filed / awaiting court action", label: "Filed / awaiting court action", icon: Gavel },
  { p: "Hearing scheduled", label: "Hearing scheduled", icon: CalendarClock, tone: "warning" },
  { p: "Completed", label: "Completed", icon: CheckCircle2, tone: "success" },
  { p: "On hold", label: "On hold", icon: PauseCircle },
];

export function ExpCenter() {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const [tab, go] = useHashTab(TABS.map((t) => t.key), "overview" as Tab);
  const byId = useMemo(() => new Map(clientStore.clients.map((c) => [c.id, c])), [clientStore.clients]);
  const [newOpen, setNewOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Record Expungement"
        subtitle="Administrative assistance from inquiry through records, screening, document preparation, filing coordination and completion."
        actions={
          <>
            <RoleSwitcher />
            <Button variant="ghost" icon={RotateCcw} aria-label="Reset sample data" title="Reset sample data" className="px-2.5" onClick={() => { if (confirm("Reset expungement and client sample data?")) { exp.reset(); clientStore.reset(); toast("Sample data reset"); } }} />
            <Button variant="primary" icon={Plus} disabled={!exp.can.edit} onClick={() => setNewOpen(true)}>New inquiry</Button>
          </>
        }
      />
      <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Record Expungement" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "overview" && <Overview byId={byId} />}
      {tab === "matters" && <MattersTab byId={byId} onNew={() => setNewOpen(true)} />}
      {tab === "cases" && <CasesTab byId={byId} />}
      {tab === "records" && <RecordsTab byId={byId} />}
      {tab === "jurisdictions" && <JurisdictionsTab />}
      {tab === "pricing" && <PricingTab />}
      {tab === "team" && <TeamTab byId={byId} />}
      <NewInquiryDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}

/* ================================================================== */

function NewInquiryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const exp = useExp();
  const { clients } = useClients();
  const toast = useToast();
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [source, setSource] = useState<ExpMatter["source"]>("phone");
  const [staff, setStaff] = useState("s-jp");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) { setClientId(""); setNote(""); setTried(false); }
  }, [open]);
  const existing = exp.matters.find((m) => m.clientId === clientId);
  return (
    <Modal open={open} onClose={onClose} title="New expungement inquiry" description="Linked to the existing client record — one expungement matter per client holds all of their cases." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { setTried(true); if (!clientId || existing) return; const id = exp.createInquiry(clientId, source, note.trim() || undefined, staff); toast(`${id} created`); onClose(); router.push(matterHref({ id })); }}>Create inquiry</Button></>}>
      <div className="space-y-4">
        <div>
          <SelectField id="ni-client" label="Client" required value={clientId} onChange={(e) => setClientId(e.target.value)} options={[["", "Choose a client…"], ...clients.filter((c) => c.type === "individual").sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.name] as [string, string])]} />
          <p className="mt-1 min-h-4 text-[12px] text-danger-ink" role={tried && (!clientId || existing) ? "alert" : undefined}>{tried && !clientId ? "Choose the client (add new people from Clients → New client first)" : existing ? `This client already has ${existing.number} — add cases there instead.` : ""}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="ni-source" label="Source" value={source} onChange={(e) => setSource(e.target.value as ExpMatter["source"])} options={[["phone", "Phone"], ["website", "Website"], ["referral", "Referral"], ["staff", "Walk-in / staff"]]} />
          <SelectField id="ni-staff" label="Intake reviewer" value={staff} onChange={(e) => setStaff(e.target.value)} options={STAFF.map((s) => [s.id, s.name] as [string, string])} />
        </div>
        <TextArea id="ni-note" label="Internal note (MKB only)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did the client ask about? Don't record charge details here." />
        <NotLegalAdvice compact />
      </div>
    </Modal>
  );
}

/* ================================================================== */

function Overview({ byId }: { byId: Map<string, Client> }) {
  const exp = useExp();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase | "all">("all");
  const [staff, setStaff] = useState("all");
  // Phase counts: cases, plus matters with no working cases (inquiries / intake).
  const counts = new Map<Phase, number>();
  exp.matters.forEach((m) => {
    const cs = matterCases(exp, m.id);
    if (m.intake.status === "inquiry" || m.intake.status === "sent" || m.intake.status === "in_progress" || !cs.length) {
      const p = matterPhase(m, cs);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    } else cs.forEach((c) => counts.set(casePhase(c, m), (counts.get(casePhase(c, m)) ?? 0) + 1));
  });
  const rows = exp.matters
    .map((m) => {
      const cs = matterCases(exp, m.id);
      const p = phase === "all" ? matterPhase(m, cs) : phase;
      const lead = cs.find((c) => casePhase(c, m) === p) ?? cs[0];
      const inPhase = phase === "all" || matterPhase(m, cs) === phase || cs.some((c) => casePhase(c, m) === phase);
      const deadlines = cs.map(caseDeadline).filter(Boolean).sort() as string[];
      return { m, cs, p, lead, inPhase, deadline: deadlines[0], next: lead ? nextAction(lead, m) : m.intake.status === "inquiry" ? { text: "Contact the client and send the intake", owner: "MKB" as const } : { text: "Client to finish the intake", owner: "Client" as const }, staffId: lead?.assignedTo ?? m.assignments["Intake review"] };
    })
    .filter((x) => x.inPhase && (staff === "all" || x.staffId === staff))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {CARDS.map((k) => <Kpi key={k.p} label={k.label} value={counts.get(k.p) ?? 0} icon={k.icon} tone={k.tone} onClick={() => setPhase(k.p)} />)}
      </div>
      <Card>
        <CardHeader icon={ClipboardList} title="Work queue" subtitle={`${phase === "all" ? "All matters" : phase} · ${rows.length} · soonest deadline first`} action={
          <div className="flex flex-wrap items-center gap-2">
            {phase !== "all" && <button onClick={() => setPhase("all")} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-accent hover:bg-accent-soft"><X size={13} /> {phase}</button>}
            <select aria-label="Assigned staff" value={staff} onChange={(e) => setStaff(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2"><option value="all">All staff</option>{STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
        } />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[900px] text-left text-[13.5px]">
            <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-2.5">Client</th><th className="px-3 py-2.5">Cases</th><th className="px-3 py-2.5">Jurisdiction</th><th className="px-3 py-2.5">Assigned</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Next action</th><th className="px-3 py-2.5 pr-5">Deadline</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-muted">Nothing in this view.</td></tr>}
              {rows.map(({ m, cs, p, deadline, next, staffId }) => (
                <tr key={m.id} onClick={() => router.push(matterHref(m))} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-5 py-3"><Link href={matterHref(m)} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-accent">{byId.get(m.clientId)?.name}</Link><div className="text-[12px] text-muted">{m.number}</div></td>
                  <td className="px-3 py-3 tabular-nums text-ink-2">{cs.filter((c) => !c.draft).length}{cs.some((c) => c.draft) ? <span className="text-[12px] text-muted"> (+{cs.filter((c) => c.draft).length} draft)</span> : ""}</td>
                  <td className="px-3 py-3 text-ink-2">{[...new Set(cs.map((c) => c.state))].join(", ") || "—"}</td>
                  <td className="px-3 py-3 text-ink-2">{staffById(staffId).name}</td>
                  <td className="px-3 py-3"><PhaseBadge p={p} /></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><OwnerBadge o={next.owner} /><span className="text-ink-2">{next.text}</span></div></td>
                  <td className={`px-3 py-3 pr-5 tabular-nums ${deadline && deadline < SAMPLE_NOW.toISOString() ? "font-semibold text-danger-ink" : "text-ink-2"}`}>{deadline ? fmtDate(deadline, { month: "short", day: "numeric" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <NotLegalAdvice />
    </div>
  );
}

/* ================================================================== */

function MattersTab({ byId, onNew }: { byId: Map<string, Client>; onNew: () => void }) {
  const exp = useExp();
  const [q, setQ] = useState("");
  const list = exp.matters.filter((m) => !q.trim() || `${m.number} ${byId.get(m.clientId)?.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client or matter…" aria-label="Search matters" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink" /></div>
        <Button variant="primary" icon={Plus} disabled={!exp.can.edit} onClick={onNew}>New inquiry</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {list.map((m) => {
          const cs = matterCases(exp, m.id);
          return (
            <Link key={m.id} href={matterHref(m)} className="block rounded-2xl border border-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold text-ink">{byId.get(m.clientId)?.name}</div><div className="text-[12.5px] text-muted">{m.number} · {cs.length} case{cs.length === 1 ? "" : "s"} · {[...new Set(cs.map((c) => c.state))].join(", ") || "no cases yet"}</div></div><PhaseBadge p={matterPhase(m, cs)} /></div>
              <ul className="mt-3 space-y-1 border-t border-line pt-3">
                {cs.length === 0 && <li className="text-[12.5px] text-muted">Cases are added during intake.</li>}
                {cs.map((c) => <li key={c.id} className="flex items-center gap-2 text-[12.5px]"><span className="font-mono text-faint">{c.number.slice(-2)}</span><span className="flex-1 truncate text-ink-2">{c.state} · {c.locality || "locality not set"}{exp.can.criminalHistory ? ` · ${chargeCount(c)} charge${chargeCount(c) === 1 ? "" : "s"}` : ""}</span><span className="text-muted">{casePhase(c, m)}</span></li>)}
              </ul>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */

function CasesTab({ byId }: { byId: Map<string, Client> }) {
  const exp = useExp();
  const router = useRouter();
  const [state, setState] = useState("all");
  const [status, setStatus] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [staff, setStaff] = useState("all");
  const [remedy, setRemedy] = useState("all");
  const M = (id: string) => exp.matters.find((m) => m.id === id)!;
  const remName = (c: { jurisdictionId: string; remedyId?: string }) => exp.jurisdictions.find((j) => j.id === c.jurisdictionId)?.remedies.find((r) => r.id === c.remedyId)?.short ?? "Workflow not set";
  const rows = exp.cases.filter((c) => (remedy === "all" || (c.remedyId ?? "none") === remedy) && (state === "all" || c.state === state) && (status === "all" || c.status === status) && (outcome === "all" || c.screening.outcome === outcome) && (staff === "all" || c.assignedTo === staff));
  const sel = "h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2";
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 p-4 sm:px-6">
        <select aria-label="State" value={state} onChange={(e) => setState(e.target.value)} className={sel}><option value="all">All jurisdictions</option>{exp.jurisdictions.map((j) => <option key={j.id} value={j.state}>{j.stateName}</option>)}</select>
        <select aria-label="Workflow" value={remedy} onChange={(e) => setRemedy(e.target.value)} className={sel}><option value="all">All workflows</option>{exp.jurisdictions.flatMap((j) => j.remedies).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}<option value="none">Workflow not set</option></select>
        <select aria-label="Filing status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}><option value="all">All filing statuses</option>{CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select aria-label="Screening outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className={sel}><option value="all">All screening outcomes</option>{SCREENING_OUTCOMES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select aria-label="Assigned staff" value={staff} onChange={(e) => setStaff(e.target.value)} className={sel}><option value="all">All staff</option>{STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      <p className="px-4 pb-2 text-[12.5px] text-muted sm:px-6">Showing {rows.length} of {exp.cases.length} cases · each arrest or court case has its own record</p>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[980px] text-left text-[13.5px]">
          <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2.5">Case</th><th className="px-3 py-2.5">Client</th><th className="px-3 py-2.5">Jurisdiction · workflow</th><th className="px-3 py-2.5">Dockets · charges</th><th className="px-3 py-2.5">Screening</th><th className="px-3 py-2.5">Filing status</th><th className="px-3 py-2.5 pr-5">Assigned</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-muted">No cases match.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} onClick={() => router.push(caseHref(c))} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover">
                <td className="px-5 py-3"><Link href={caseHref(c)} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-accent">{c.number}</Link><div className="text-[12px] text-muted">{casePhase(c, M(c.matterId))}{c.draft ? " · draft from portal" : ""}</div></td>
                <td className="px-3 py-3 text-ink">{byId.get(c.clientId)?.name}</td>
                <td className="px-3 py-3 text-ink-2">{c.state} · {c.locality}<div className="text-[12px] font-medium text-accent-ink">{remName(c)}</div></td>
                <td className="px-3 py-3 text-ink-2">{exp.can.criminalHistory ? `${c.dockets.length} · ${chargeCount(c)}` : <span className="inline-flex items-center gap-1 text-muted"><Lock size={12} /> restricted</span>}</td>
                <td className="px-3 py-3">{exp.can.screening ? <OutcomeBadge o={c.screening.outcome} /> : <span className="text-muted">restricted</span>}</td>
                <td className="px-3 py-3"><StatusBadge s={c.status} /></td>
                <td className="px-3 py-3 pr-5 text-ink-2">{staffById(c.assignedTo).name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ================================================================== */

function RecordsTab({ byId }: { byId: Map<string, Client> }) {
  const exp = useExp();
  const [status, setStatus] = useState("open");
  const [cust, setCust] = useState("all");
  if (!exp.can.criminalHistory) return <Restricted what="Records requests" />;
  const items = exp.cases.flatMap((c) => c.records.map((r) => ({ r, c })))
    .filter(({ r }) => (status === "open" ? r.status !== "verified" : status === "all" || r.status === status))
    .filter(({ r }) => cust === "all" || (r.custodianName ?? "Not assigned") === cust)
    .sort((a, b) => (a.r.requestedAt ?? "0").localeCompare(b.r.requestedAt ?? "0"));
  const custodians = [...new Set(exp.cases.flatMap((c) => c.records.map((r) => r.custodianName ?? "Not assigned")))].sort();
  const byCust = new Map<string, number>();
  exp.cases.forEach((c) => c.records.filter((r) => r.status === "requested").forEach((r) => byCust.set(r.custodianName ?? "Not assigned", (byCust.get(r.custodianName ?? "Not assigned") ?? 0) + 1)));
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={Landmark} title="Outstanding requests by custodian" subtitle="Clerk offices, courts, law enforcement and state repositories" />
        <div className="flex flex-wrap gap-2 px-5 pb-5 sm:px-6">
          {byCust.size === 0 && <span className="text-[13px] text-muted">No outstanding requests.</span>}
          {[...byCust.entries()].map(([k, n]) => <button key={k} aria-pressed={cust === k} onClick={() => setCust(cust === k ? "all" : k)} className={`rounded-xl border px-3 py-2 text-left text-[12.5px] ${cust === k ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-hover"}`}><div className="font-semibold text-ink">{k}</div><div className="text-muted">{n} awaiting response</div></button>)}
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center gap-2 p-4 sm:px-6">
          <select aria-label="Record status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2"><option value="open">Not yet verified</option><option value="all">All records</option>{Object.entries(RECORD_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select aria-label="Custodian" value={cust} onChange={(e) => setCust(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2"><option value="all">All custodians</option>{custodians.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        </div>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[1000px] text-left text-[13.5px]">
            <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2.5">Document</th><th className="px-3 py-2.5">Case</th><th className="px-3 py-2.5">Custodian · method</th><th className="px-3 py-2.5">Requested</th><th className="px-3 py-2.5">Fee</th><th className="px-3 py-2.5">Received</th><th className="px-3 py-2.5 pr-5">Status</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-muted">No records match.</td></tr>}
              {items.map(({ r, c }) => {
                const overdue = r.status === "requested" && r.requestedAt && new Date(`${r.requestedAt}T12:00`).getTime() + 21 * 86400000 < SAMPLE_NOW.getTime();
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3"><div className="text-ink">{r.docType}</div>{r.missingInfo && <div className="text-[12px] text-danger-ink">{r.missingInfo}</div>}</td>
                    <td className="px-3 py-3"><Link href={caseHref(c, "records")} className="font-medium text-accent hover:underline">{c.number}</Link><div className="text-[12px] text-muted">{byId.get(c.clientId)?.name} · {c.state}</div></td>
                    <td className="px-3 py-3 text-ink-2">{r.custodianName ?? "—"}<div className="text-[12px] text-muted">{r.method ?? ""}</div></td>
                    <td className={`px-3 py-3 tabular-nums ${overdue ? "font-semibold text-danger-ink" : "text-ink-2"}`}>{r.requestedAt ? fmtDate(`${r.requestedAt}T12:00`, { month: "short", day: "numeric" }) : "—"}{overdue ? " · follow up" : ""}</td>
                    <td className="px-3 py-3 tabular-nums text-ink-2">{r.fee != null ? `${usd(r.fee, 2)}${r.feePaid ? " · paid" : " · unpaid"}` : "—"}</td>
                    <td className="px-3 py-3 tabular-nums text-ink-2">{r.receivedAt ? fmtDate(`${r.receivedAt}T12:00`, { month: "short", day: "numeric" }) : "—"}</td>
                    <td className="px-3 py-3 pr-5"><Badge tone={RECORD_META[r.status].tone}>{RECORD_META[r.status].label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== */

type ListKey = "rules" | "requiredDocs" | "forms" | "fees" | "contacts" | "custodians" | "criteria";
const nid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 7)}`;

function JurisdictionsTab() {
  const exp = useExp();
  const toast = useToast();
  const release = exp.jurisdictions.filter((j) => (RELEASE_STATES as readonly string[]).includes(j.state));
  const [id, setId] = useState(release[0].id);
  const src = exp.jurisdictions.find((j) => j.id === id)!;
  const [v, setV] = useState<Jurisdiction>(structuredClone(src));
  const [rem, setRem] = useState(src.remedies[0]?.id ?? "");
  const [cls, setCls] = useState("");
  useEffect(() => setV(structuredClone(exp.jurisdictions.find((j) => j.id === id)!)), [id, exp.jurisdictions]);
  const admin = exp.can.admin;
  const dirty = JSON.stringify(v) !== JSON.stringify(src);
  const remedy = v.remedies.find((r) => r.id === rem) ?? v.remedies[0];
  const upList = <K extends ListKey>(k: K, i: number, patch: Partial<Jurisdiction[K][number]>) => setV({ ...v, [k]: (v[k] as Jurisdiction[K][number][]).map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const rmList = (k: ListKey, i: number) => setV({ ...v, [k]: (v[k] as unknown[]).filter((_, j) => j !== i) });
  const stamp = { lastVerifiedAt: SAMPLE_NOW.toISOString(), verifiedBy: "s-mk" };
  const inp = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink disabled:opacity-70";
  const VBadge = ({ x }: { x: { lastVerifiedAt?: string } }) => x.lastVerifiedAt ? <Badge tone="success" icon={BadgeCheck}>{verifiedLabel(x)}</Badge> : <Badge tone="warning" icon={ShieldAlert}>Not verified</Badge>;
  const mine = <T extends { remedyId: string }>(list: T[]) => list.map((x, i) => ({ x, i })).filter(({ x }) => x.remedyId === remedy?.id);
  const pick = (j: Jurisdiction) => { setId(j.id); setV(structuredClone(j)); setRem(j.remedies[0]?.id ?? ""); };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Jurisdiction" className="inline-flex flex-wrap rounded-xl bg-surface-2 p-1 ring-1 ring-line">
          {release.map((j) => <button key={j.id} role="radio" aria-checked={id === j.id} onClick={() => pick(j)} className={`h-8 rounded-lg px-3 text-[13px] font-medium ${id === j.id ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>{j.stateName}</button>)}
        </div>
        <span className="text-[12.5px] text-muted">This release supports Louisiana and Texas only. The structure allows more states later; none are active or offered.</span>
      </div>
      {!admin && <p className="flex items-center gap-2 text-[13px] text-muted"><Lock size={14} /> Read-only — only the owner/administrator can change jurisdiction rules.</p>}
      <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-soft/50 px-4 py-3 text-[13px] text-warning-ink">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>{v.stateName} is configured on its own and never applied to another state. Every statute, waiting period, form and fee must be confirmed against an authoritative source and carry a last-verified date before screening can rely on it.</span>
      </div>

      <fieldset disabled={!admin} className="space-y-5">
        <Card>
          <CardHeader icon={Landmark} title={`${v.stateName} — jurisdiction`} subtitle={verifiedLabel(v)} action={<div className="flex flex-wrap gap-2">{admin && <Button size="sm" onClick={() => setV({ ...v, ...stamp })}>Mark jurisdiction verified</Button>}<Button size="sm" variant="primary" disabled={!dirty} onClick={() => { exp.saveJurisdiction(v); toast(`${v.stateName} saved`); }}>Save {v.stateName}</Button></div>} />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
            <div className="sm:col-span-2"><TextArea id="jr-vnotes" label="Staff verification notes" value={v.verificationNotes} onChange={(e) => setV({ ...v, verificationNotes: e.target.value })} /></div>
            <div className="sm:col-span-2"><TextArea id="jr-proc" label="Filing procedures" value={v.procedures} onChange={(e) => setV({ ...v, procedures: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Offense classifications</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {v.classifications.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] text-ink-2">{c}{admin && <button type="button" aria-label={`Remove ${c}`} onClick={() => setV({ ...v, classifications: v.classifications.filter((x) => x !== c) })} className="text-muted hover:text-danger"><X size={12} /></button>}</span>)}
                {admin && <><input aria-label="New classification" value={cls} onChange={(e) => setCls(e.target.value)} placeholder="Add classification…" className="h-8 w-48 rounded-full border border-line bg-surface px-3 text-[12.5px] text-ink" /><Button size="sm" variant="ghost" disabled={!cls.trim()} onClick={() => { setV({ ...v, classifications: [...v.classifications, cls.trim()] }); setCls(""); }}>Add</Button></>}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Workflow:</span>
          <div role="radiogroup" aria-label="Workflow" className="inline-flex flex-wrap rounded-xl bg-surface-2 p-1 ring-1 ring-line">
            {v.remedies.map((r) => <button key={r.id} type="button" role="radio" aria-checked={remedy?.id === r.id} onClick={() => setRem(r.id)} className={`h-8 rounded-lg px-3 text-[13px] font-medium ${remedy?.id === r.id ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>{r.name}</button>)}
          </div>
          {v.remedies.length > 1 && <span className="text-[12.5px] text-muted">Separate requirements, screening criteria, checklists, forms and fees — never combined.</span>}
        </div>

        <Card>
          <CardHeader icon={Scale} title={`${remedy?.name} — statutes, rules and waiting periods`} subtitle="A rule can only be marked verified once its citation and official source are entered" action={admin && <Button size="sm" icon={Plus} onClick={() => setV({ ...v, rules: [...v.rules, { id: nid("r"), remedyId: remedy!.id, title: "", citation: "", description: "", appliesTo: "", waitingPeriod: "" }] })}>Add rule</Button>} />
          <ul className="divide-y divide-line border-t border-line">
            {mine(v.rules).length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No rules configured.</li>}
            {mine(v.rules).map(({ x: r, i }, n) => (
              <li key={r.id} className="grid gap-2 px-5 py-4 sm:grid-cols-2 sm:px-6">
                <input aria-label={`Rule ${n + 1} title`} className={inp} value={r.title} placeholder="Title" onChange={(e) => upList("rules", i, { title: e.target.value })} />
                <input aria-label={`Rule ${n + 1} citation`} className={inp} value={r.citation} placeholder="Statute or rule citation (blank until verified)" onChange={(e) => upList("rules", i, { citation: e.target.value, lastVerifiedAt: undefined })} />
                <input aria-label={`Rule ${n + 1} applies to`} className={inp} value={r.appliesTo} placeholder="Applies to (offense / disposition)" onChange={(e) => upList("rules", i, { appliesTo: e.target.value })} />
                <input aria-label={`Rule ${n + 1} waiting period`} className={inp} value={r.waitingPeriod} placeholder="Waiting period (blank until verified)" onChange={(e) => upList("rules", i, { waitingPeriod: e.target.value, lastVerifiedAt: undefined })} />
                <input aria-label={`Rule ${n + 1} source`} className={`${inp} sm:col-span-2`} value={r.sourceUrl ?? ""} placeholder="Authoritative source link" onChange={(e) => upList("rules", i, { sourceUrl: e.target.value || undefined, lastVerifiedAt: undefined })} />
                <textarea aria-label={`Rule ${n + 1} description`} className={`${inp} h-auto min-h-[60px] py-2 sm:col-span-2`} value={r.description} onChange={(e) => upList("rules", i, { description: e.target.value })} />
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><VBadge x={r} />{r.notes && !r.lastVerifiedAt && <span className="text-[12px] text-muted">{r.notes}</span>}{admin && <><Button size="sm" variant="ghost" className="ml-auto" disabled={!r.citation.trim() || !r.sourceUrl} title={!r.citation.trim() || !r.sourceUrl ? "Add the citation and authoritative source first" : undefined} onClick={() => upList("rules", i, stamp)}>Mark verified</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove rule ${n + 1}`} onClick={() => rmList("rules", i)} /></>}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={ClipboardList} title={`${remedy?.name} — screening criteria`} subtitle="Administrative questions staff confirm for this workflow only. Wording is verified like a rule." action={admin && <Button size="sm" icon={Plus} onClick={() => setV({ ...v, criteria: [...v.criteria, { id: nid("q"), remedyId: remedy!.id, question: "" }] })}>Add criterion</Button>} />
          <ul className="divide-y divide-line border-t border-line">
            {mine(v.criteria).map(({ x: q, i }, n) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 px-5 py-3 sm:px-6">
                <input aria-label={`Criterion ${n + 1}`} className={`${inp} min-w-[240px] flex-1`} value={q.question} onChange={(e) => upList("criteria", i, { question: e.target.value, lastVerifiedAt: undefined })} />
                <VBadge x={q} />
                {admin && <><Button size="sm" variant="ghost" disabled={!q.question.trim()} onClick={() => upList("criteria", i, stamp)}>Mark verified</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove criterion ${n + 1}`} onClick={() => rmList("criteria", i)} /></>}
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader icon={FileSearch} title={`${remedy?.short} — required documents`} action={admin && <Button size="sm" icon={Plus} onClick={() => setV({ ...v, requiredDocs: [...v.requiredDocs, { id: nid("rd"), remedyId: remedy!.id, caseType: "", docs: [] }] })}>Add</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {mine(v.requiredDocs).map(({ x: r, i }, n) => (
                <li key={r.id} className="space-y-2 px-5 py-3 sm:px-6">
                  <div className="flex gap-2"><input aria-label={`Case type ${n + 1}`} className={inp} value={r.caseType} placeholder="Case type (e.g. Any case, Conviction)" onChange={(e) => upList("requiredDocs", i, { caseType: e.target.value, lastVerifiedAt: undefined })} />{admin && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove case type ${n + 1}`} onClick={() => rmList("requiredDocs", i)} />}</div>
                  <textarea aria-label={`Documents for case type ${n + 1}`} className={`${inp} h-auto min-h-[70px] py-2`} value={r.docs.join("\n")} onChange={(e) => upList("requiredDocs", i, { docs: e.target.value.split("\n"), lastVerifiedAt: undefined })} />
                  <div className="flex items-center gap-2"><VBadge x={r} />{admin && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => upList("requiredDocs", i, stamp)}>Mark verified</Button>}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={Receipt} title={`${remedy?.short} — government fees`} subtitle="Amounts stay blank until confirmed" action={admin && <Button size="sm" icon={Plus} onClick={() => setV({ ...v, fees: [...v.fees, { id: nid("fee"), remedyId: remedy!.id, label: "", kind: "court_filing", payableTo: "" }] })}>Add</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {mine(v.fees).map(({ x: f, i }, n) => (
                <li key={f.id} className="grid gap-2 px-5 py-3 sm:grid-cols-2 sm:px-6">
                  <input aria-label={`Fee ${n + 1} label`} className={inp} value={f.label} placeholder="Fee" onChange={(e) => upList("fees", i, { label: e.target.value })} />
                  <select aria-label={`Fee ${n + 1} type`} className={inp} value={f.kind} onChange={(e) => upList("fees", i, { kind: e.target.value as typeof f.kind })}><option value="court_filing">Court filing fee</option><option value="clerk">Clerk fee</option><option value="government">Government fee</option><option value="records">Records request fee</option></select>
                  <input aria-label={`Fee ${n + 1} amount`} className={inp} type="number" min={0} step="0.01" value={f.amount ?? ""} placeholder="Amount (blank until verified)" onChange={(e) => upList("fees", i, { amount: e.target.value === "" ? undefined : Number(e.target.value), lastVerifiedAt: undefined })} />
                  <input aria-label={`Fee ${n + 1} payable to`} className={inp} value={f.payableTo} placeholder="Payable to" onChange={(e) => upList("fees", i, { payableTo: e.target.value })} />
                  <div className="flex items-center gap-2 sm:col-span-2"><VBadge x={f} />{f.notes && <span className="text-[12px] text-muted">{f.notes}</span>}{admin && <><Button size="sm" variant="ghost" className="ml-auto" disabled={f.amount == null} onClick={() => upList("fees", i, stamp)}>Mark verified</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove fee ${n + 1}`} onClick={() => rmList("fees", i)} /></>}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={FileText} title={`${remedy?.short} — filing forms`} action={admin && <Button size="sm" icon={Plus} onClick={() => setV({ ...v, forms: [...v.forms, { id: nid("f"), remedyId: remedy!.id, name: "", source: "" }] })}>Add</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {mine(v.forms).map(({ x: f, i }, n) => (
                <li key={f.id} className="grid gap-2 px-5 py-3 sm:grid-cols-2 sm:px-6">
                  <input aria-label={`Form ${n + 1} name`} className={inp} value={f.name} placeholder="Form name" onChange={(e) => upList("forms", i, { name: e.target.value })} />
                  <input aria-label={`Form ${n + 1} link`} className={inp} value={f.url ?? ""} placeholder="Official form link" onChange={(e) => upList("forms", i, { url: e.target.value || undefined, lastVerifiedAt: undefined })} />
                  <div className="flex items-center gap-2 sm:col-span-2"><VBadge x={f} /><span className="text-[12px] text-muted">{f.source}</span>{admin && <><Button size="sm" variant="ghost" className="ml-auto" disabled={!f.url} onClick={() => upList("forms", i, stamp)}>Mark verified</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove form ${n + 1}`} onClick={() => rmList("forms", i)} /></>}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={Users} title={`${v.localityLabel === "Parish" ? "Parishes" : "Counties"} & courts`} action={admin && <Button size="sm" icon={Plus} onClick={() => setV({ ...v, localities: [...v.localities, { id: nid("loc"), name: "", courts: [] }] })}>Add {v.localityLabel.toLowerCase()}</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {v.localities.map((l, i) => (
                <li key={l.id} className="space-y-2 px-5 py-3 sm:px-6">
                  <input aria-label={`${v.localityLabel} ${i + 1}`} className={inp} value={l.name} onChange={(e) => setV({ ...v, localities: v.localities.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  {l.courts.map((c, ci) => (
                    <div key={c.id} className="grid gap-2 rounded-xl bg-surface-2 p-2.5 ring-1 ring-line sm:grid-cols-2">
                      {(["name", "clerk", "clerkContact", "daContact"] as const).map((k) => <input key={k} aria-label={`${l.name} court ${ci + 1} ${k}`} className={inp} value={c[k] ?? ""} placeholder={{ name: "Court", clerk: "Clerk office", clerkContact: "Clerk contact", daContact: "Prosecutor / DA contact" }[k]} onChange={(e) => setV({ ...v, localities: v.localities.map((x, j) => (j === i ? { ...x, courts: x.courts.map((y, yi) => (yi === ci ? { ...y, [k]: e.target.value } : y)) } : x)) })} />)}
                    </div>
                  ))}
                  {admin && <Button size="sm" variant="ghost" icon={Plus} onClick={() => setV({ ...v, localities: v.localities.map((x, j) => (j === i ? { ...x, courts: [...x.courts, { id: nid("ct"), name: "", clerk: "", clerkContact: "" }] } : x)) })}>Add court</Button>}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={FileSearch} title="Record custodians" subtitle="Used by the records-request tracker" action={admin && <Button size="sm" icon={Plus} onClick={() => setV({ ...v, custodians: [...v.custodians, { id: nid("cu"), name: "", type: "Clerk of court", contact: "", methods: ["Mail"] }] })}>Add</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {v.custodians.map((c, i) => (
                <li key={c.id} className="grid gap-2 px-5 py-3 sm:grid-cols-3 sm:px-6">
                  <input aria-label={`Custodian ${i + 1} name`} className={`${inp} sm:col-span-2`} value={c.name} onChange={(e) => upList("custodians", i, { name: e.target.value })} />
                  <select aria-label={`Custodian ${i + 1} type`} className={inp} value={c.type} onChange={(e) => upList("custodians", i, { type: e.target.value as typeof c.type })}>{["Clerk of court", "Court", "Law enforcement", "State repository", "Other"].map((t) => <option key={t}>{t}</option>)}</select>
                  <input aria-label={`Custodian ${i + 1} contact`} className={`${inp} sm:col-span-2`} value={c.contact} onChange={(e) => upList("custodians", i, { contact: e.target.value })} />
                  <input aria-label={`Custodian ${i + 1} methods`} className={inp} value={c.methods.join(", ")} onChange={(e) => upList("custodians", i, { methods: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={Users} title="Court & agency contacts · authoritative sources" action={admin && <div className="flex gap-2"><Button size="sm" icon={Plus} onClick={() => setV({ ...v, contacts: [...v.contacts, { id: nid("k"), name: "", role: "" }] })}>Contact</Button><Button size="sm" icon={Plus} onClick={() => setV({ ...v, sources: [...v.sources, { label: "" }] })}>Source</Button></div>} />
            <ul className="divide-y divide-line border-t border-line">
              {v.contacts.map((k, i) => (
                <li key={k.id} className="grid gap-2 px-5 py-3 sm:grid-cols-2 sm:px-6">
                  <input aria-label={`Contact ${i + 1} name`} className={inp} value={k.name} placeholder="Name" onChange={(e) => upList("contacts", i, { name: e.target.value })} />
                  <input aria-label={`Contact ${i + 1} role`} className={inp} value={k.role} placeholder="Role" onChange={(e) => upList("contacts", i, { role: e.target.value })} />
                  <input aria-label={`Contact ${i + 1} phone`} className={inp} value={k.phone ?? ""} placeholder="Phone" onChange={(e) => upList("contacts", i, { phone: e.target.value })} />
                  <input aria-label={`Contact ${i + 1} email`} className={inp} value={k.email ?? ""} placeholder="Email" onChange={(e) => upList("contacts", i, { email: e.target.value })} />
                </li>
              ))}
              {v.sources.map((s, i) => (
                <li key={`s${i}`} className="grid gap-2 px-5 py-3 sm:grid-cols-2 sm:px-6">
                  <input aria-label={`Source ${i + 1} label`} className={inp} value={s.label} placeholder="Authoritative source" onChange={(e) => setV({ ...v, sources: v.sources.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <input aria-label={`Source ${i + 1} link`} className={inp} value={s.url ?? ""} placeholder="https://" onChange={(e) => setV({ ...v, sources: v.sources.map((x, j) => (j === i ? { ...x, url: e.target.value || undefined } : x)) })} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </fieldset>
    </div>
  );
}

/* ================================================================== */

function PricingTab() {
  const exp = useExp();
  const toast = useToast();
  const admin = exp.can.admin;
  const remedies = [{ id: "Any", short: "Any workflow" }, ...exp.jurisdictions.filter((j) => j.active).flatMap((j) => j.remedies.filter((r) => r.active))];
  const [rid, setRid] = useState("LA-exp");
  const [svc, setSvc] = useState({ name: "", description: "" });
  const cx: Complexity[] = ["standard", "moderate", "complex"];
  return (
    <div className="space-y-5">
      {!admin && <p className="flex items-center gap-2 text-[13px] text-muted"><Lock size={14} /> Read-only — only the owner/administrator can change pricing.</p>}
      <Card>
        <CardHeader icon={Receipt} title="MKB service pricing" subtitle="Per case, by service type, workflow and complexity. Court, clerk, government and records fees are billed separately at cost." action={
          <div role="radiogroup" aria-label="Pricing workflow" className="inline-flex flex-wrap rounded-xl bg-surface-2 p-1 ring-1 ring-line">{remedies.map((r) => <button key={r.id} role="radio" aria-checked={rid === r.id} onClick={() => setRid(r.id)} className={`h-8 rounded-lg px-3 text-[13px] font-medium ${rid === r.id ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>{r.short}</button>)}</div>
        } />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2.5">Service type</th>{cx.map((c) => <th key={c} className="px-3 py-2.5">{c}</th>)}</tr></thead>
            <tbody>
              {exp.services.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3"><div className="font-medium text-ink">{s.name}{!s.active && <span className="ml-1.5"><Badge tone="neutral">Inactive</Badge></span>}</div><div className="text-[12px] text-muted">{s.description}</div></td>
                  {cx.map((c) => {
                    const p = exp.prices.find((x) => x.serviceTypeId === s.id && x.remedyId === rid && x.complexity === c);
                    return (
                      <td key={c} className="px-3 py-3">
                        <input aria-label={`${s.name} ${rid} ${c} price`} type="number" min={0} step="1" disabled={!admin} defaultValue={p?.fee ?? ""} key={`${s.id}-${rid}-${c}-${p?.fee}`} placeholder={rid === "Any" ? "—" : "uses Any"} onBlur={(e) => { const val = e.target.value; if (val === "" && p) { exp.deletePrice(p.id); toast("Price removed"); } else if (val !== "" && Number(val) >= 0 && Number(val) !== p?.fee) { exp.savePrice({ id: p?.id ?? `p-${s.id}-${rid}-${c}`, serviceTypeId: s.id, remedyId: rid, complexity: c, fee: Number(val) }); toast("Price saved"); } }} className="h-9 w-28 rounded-lg border border-line bg-surface px-2.5 text-right tabular-nums text-ink disabled:opacity-70" />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-[12px] text-muted sm:px-6">{COMPLEXITY.moderate} · {COMPLEXITY.complex}. A blank workflow price falls back to &ldquo;Any workflow&rdquo;; if neither is set, staff enter the fee when invoicing.</p>
      </Card>
      {admin && (
        <Card>
          <CardHeader icon={Plus} title="Add a service type" />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-[1fr_2fr_auto] sm:items-end sm:px-6">
            <TextField id="sv-name" label="Name" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} />
            <TextField id="sv-desc" label="Description" value={svc.description} onChange={(e) => setSvc({ ...svc, description: e.target.value })} />
            <Button variant="primary" disabled={!svc.name.trim() || exp.services.some((s) => s.name.toLowerCase() === svc.name.trim().toLowerCase())} onClick={() => { exp.saveService({ id: nid("svc"), name: svc.name.trim(), description: svc.description.trim(), active: true }); setSvc({ name: "", description: "" }); toast("Service type added"); }}>Add</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ================================================================== */

function TeamTab({ byId }: { byId: Map<string, Client> }) {
  const exp = useExp();
  const toast = useToast();
  const log = exp.matters.flatMap((m) => m.access.map((a) => ({ ...a, m }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={ShieldCheck} title="Role access (preview)" subtitle="Owner-controlled roles. Use “Viewing as” at the top to preview each role. Enforced on the server in Phase 3." />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2.5">Role</th><th className="px-3 py-2.5">Criminal history</th><th className="px-3 py-2.5">Edit cases</th><th className="px-3 py-2.5">Screening</th><th className="px-3 py-2.5">Billing</th><th className="px-3 py-2.5">Reveal SSN</th><th className="px-3 py-2.5">Admin (rules, pricing)</th></tr></thead>
            <tbody>{Object.entries(EXP_ROLES).map(([k, r]) => <tr key={k} className={`border-b border-line last:border-0 ${exp.role === k ? "bg-accent-soft/40" : ""}`}><td className="px-5 py-2.5 font-medium text-ink">{r.label}</td>{[r.criminalHistory, r.edit, r.screening, r.billing, r.revealSsn, r.admin].map((x, i) => <td key={i} className="px-3 py-2.5">{x ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">No</Badge>}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHeader icon={Users} title="Staff assignments" subtitle="Who handles each part of the work, per client" />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[1100px] text-left text-[13px]">
            <thead className="bg-surface-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2.5">Client</th>{ASSIGNMENT_ROLES.map((r) => <th key={r} className="px-2 py-2.5">{r}</th>)}</tr></thead>
            <tbody>
              {exp.matters.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-2.5"><Link href={matterHref(m)} className="font-medium text-ink hover:text-accent">{byId.get(m.clientId)?.name}</Link><div className="text-[11.5px] text-muted">{m.number}</div></td>
                  {ASSIGNMENT_ROLES.map((r) => <td key={r} className="px-2 py-2.5"><select aria-label={`${m.number} ${r}`} disabled={!exp.can.admin} value={m.assignments[r]} onChange={(e) => { exp.assign(m.id, r, e.target.value); toast(`${r}: ${staffById(e.target.value).name}`); }} className="h-8 w-full rounded-lg border border-line bg-surface px-1.5 text-[12.5px] text-ink">{STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHeader icon={Lock} title="Criminal-history access log" subtitle="Prototype log of case views and identifier reveals. Phase 3 records every access server-side." />
        <ul className="divide-y divide-line border-t border-line">
          {log.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No access recorded this session. Open a case or reveal a docket number to see entries here.</li>}
          {log.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-[13px] sm:px-6"><span className="font-medium text-ink">{a.who}</span><span className="text-muted">({a.role})</span><span className="text-ink-2">{a.action}</span><span className="text-muted">· {byId.get(a.m.clientId)?.name}{a.caseId ? ` · ${a.caseId}` : ""}</span><span className="ml-auto text-[12px] text-muted">{fmtDateTime(a.at)}</span></li>)}
        </ul>
      </Card>
      <SecurityNote />
    </div>
  );
}

export { relTime };
