"use client";

import Link from "next/link";
import { useClientGate } from "@/components/team/AccessGuard";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, BadgeCheck, Check, ClipboardList, Download, FilePlus2, FileSearch, FileText, Gavel, LayoutGrid, Lock, MoreHorizontal, Pause, PenLine, Play, Plus, RotateCcw, Scale, Send, ShieldAlert, ShieldCheck, Trash2, UploadCloud, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { downloadPlaceholder } from "@/components/crm/dialogs";
import { FilePicker } from "@/components/biz/BizDialogs";
import { STAFF, SAMPLE_NOW, staffById, meId, staffList } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { useExp } from "@/lib/store/exp-store";
import { CASE_FLOW, CASE_STATUSES, PREP_META, RECORD_METHODS, RECORD_META, SCREENING_OUTCOMES, chargeCount, verifiedLabel, type CaseStatus, type ExpCase, type ExpMatter, type Jurisdiction, type ScreeningOutcome } from "@/lib/expunge/config";
import { approvalBlockers, casePhase, nextAction } from "@/lib/expunge/derive";
import { fmtDate, fmtDateTime, relTime, usd } from "@/lib/format";
import { CaseEditor, Masked, NotLegalAdvice, OutcomeBadge, OwnerBadge, PhaseBadge, Restricted, RoleSwitcher, StatusBadge, TriField, caseErrors, draftFrom, matterHref, useHashTab, type CaseDraft } from "./ExpParts";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "details", label: "Case & charges", icon: ClipboardList },
  { key: "records", label: "Records", icon: FileSearch },
  { key: "screening", label: "Screening", icon: Scale },
  { key: "documents", label: "Document preparation", icon: PenLine },
  { key: "filing", label: "Filing & court", icon: Gavel },
  { key: "history", label: "History & notes", icon: Activity },
] as const;
type Tab = (typeof TABS)[number]["key"];
const toFiles = (fs: File[]) => fs.map((f) => ({ name: f.name.replace(/\.[^.]+$/, ""), sizeKb: Math.max(1, Math.round(f.size / 1024)), file: f }));
const today = () => SAMPLE_NOW.toISOString().slice(0, 10);
/** Read at render time, so it lists the real team once it has loaded. */
const staffOptsNow = () => staffList().map((s) => [s.id, s.name] as [string, string]);

export function CasePage({ id }: { id: string }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const c = exp.cases.find((x) => x.id === id);
  const m = exp.matters.find((x) => x.id === c?.matterId);
  const client = clientStore.clients.find((x) => x.id === c?.clientId);
  const j = exp.jurisdictions.find((x) => x.id === c?.jurisdictionId);
  const [tab, go] = useHashTab(TABS.map((t) => t.key), "overview" as Tab);
  const [dlg, setDlg] = useState<null | "hold" | "override" | "filing" | "court">(null);
  useEffect(() => {
    if (c && m && exp.can.criminalHistory) exp.logAccess(m.id, "Viewed case record", c.id);
  }, [c?.id, exp.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const gate = useClientGate(c?.clientId, "this expungement case");
  if (gate) return gate;
  if (!c || !m || !client)
    return (
      <div className="py-20 text-center">
        <h1 className="text-[20px] font-bold text-ink">Case not found</h1>
        <Link href="/services/record-expungement#cases" className="mt-4 inline-block text-[14px] font-semibold text-accent">Back to cases</Link>
      </div>
    );
  const closed = ["Completed", "Denied", "Withdrawn"].includes(c.status);
  const remedy = j?.remedies.find((r) => r.id === c.remedyId);
  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Record Expungement", href: "/services/record-expungement" }, { label: client.name, href: matterHref(m) }, { label: c.number }]} />
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{c.number}</h1><StatusBadge s={c.status} /><PhaseBadge p={casePhase(c, m)} />{c.draft && <Badge tone="warning">Draft from client portal</Badge>}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              <span>Client: <Link href={matterHref(m)} className="font-medium text-accent hover:underline">{client.name}</Link></span>
              <span>{j?.stateName ?? c.state} · {c.locality}</span>
              <span className="font-semibold text-accent-ink">{remedy?.name ?? "Workflow not chosen"}</span>
              {exp.can.criminalHistory && <span>{c.dockets.length} docket{c.dockets.length > 1 ? "s" : ""} · {chargeCount(c)} charge{chargeCount(c) > 1 ? "s" : ""}</span>}
              <span className={j?.lastVerifiedAt ? "text-success-ink" : "text-warning-ink"}>{j?.stateName} rules: {j ? verifiedLabel(j) : "not configured"}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            <RoleSwitcher />
            {c.draft && <Button size="sm" variant="primary" icon={ShieldCheck} disabled={!exp.can.edit || !c.remedyId} title={!c.remedyId ? "Choose the workflow on Case & charges first" : undefined} onClick={() => { exp.reviewIntake(m.id, meId()); toast("Client entry reviewed — case opened"); }}>Review client entry & open case</Button>}
            <label className="block"><span className="sr-only">Assigned staff</span><select aria-label="Assigned staff" disabled={!exp.can.edit} value={c.assignedTo} onChange={(e) => { exp.assignCase(c.id, e.target.value); toast(`Assigned to ${staffById(e.target.value).name}`); }} className="h-8 rounded-xl border border-line bg-surface px-2 text-[13px] text-ink">{staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <Menu label="Case actions" trigger={({ toggle }) => <Button size="sm" icon={MoreHorizontal} onClick={toggle} aria-label="Case actions">More</Button>} items={[
              c.status === "On Hold" ? { label: "Resume", icon: Play, onSelect: () => { exp.resume(c.id); toast("Resumed"); } } : { label: "Put on hold…", icon: Pause, onSelect: () => setDlg("hold"), disabled: closed || !exp.can.edit },
              { label: "Change status (override)…", icon: RotateCcw, onSelect: () => setDlg("override"), disabled: !exp.can.edit },
            ]} />
          </div>
        </div>
      </section>
      {!exp.can.criminalHistory ? (
        <div className="mt-5 space-y-4"><Restricted what="This case's criminal-history details, records, screening and filings" /><NotLegalAdvice compact /></div>
      ) : (
        <>
          <div className="sticky top-16 z-20 -mx-4 mt-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
            <div role="tablist" aria-label="Case" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
              {TABS.map((t) => <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}><t.icon size={16} /> {t.label}</button>)}
            </div>
          </div>
          <div className="mt-5">
            {tab === "overview" && <OverviewTab c={c} m={m} j={j} go={go} openFiling={() => setDlg("filing")} openCourt={() => setDlg("court")} />}
            {tab === "details" && <DetailsTab c={c} />}
            {tab === "records" && <RecordsTab c={c} j={j} />}
            {tab === "screening" && <ScreeningTab c={c} j={j} />}
            {tab === "documents" && <DocsTab c={c} />}
            {tab === "filing" && <FilingTab c={c} j={j} openFiling={() => setDlg("filing")} openCourt={() => setDlg("court")} />}
            {tab === "history" && <HistoryTab c={c} />}
          </div>
        </>
      )}
      <HoldDialog c={c} mode={dlg === "hold" || dlg === "override" ? dlg : null} onClose={() => setDlg(null)} />
      <FilingDialog c={c} open={dlg === "filing"} onClose={() => setDlg(null)} />
      <CourtDialog c={c} open={dlg === "court"} onClose={() => setDlg(null)} />
    </>
  );
}

/* ================================================================== */

function Stepper({ c }: { c: ExpCase }) {
  const cur = c.status === "On Hold" ? c.holdFrom ?? "Not Started" : c.status;
  const idx = CASE_FLOW.indexOf(cur as CaseStatus);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Case progress">
      {CASE_FLOW.map((s, i) => {
        const done = c.status === "Completed" || (idx >= 0 && i < idx);
        const now = i === idx && c.status !== "Completed";
        return <li key={s} aria-current={now ? "step" : undefined} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium ${now ? (c.status === "On Hold" ? "border-line-strong bg-surface-2 text-ink-2" : "border-accent bg-accent text-white") : done ? "border-success/30 bg-success-soft text-success-ink" : "border-line text-muted"}`}>{done && <Check size={12} strokeWidth={3} />}{s}</li>;
      })}
      {["On Hold", "Denied", "Withdrawn", "Additional Information Requested"].includes(c.status) && <li className="inline-flex items-center rounded-full border border-warning/40 bg-warning-soft px-2.5 py-1 text-[12px] font-semibold text-warning-ink">{c.status}</li>}
    </ol>
  );
}

function OverviewTab({ c, m, j, go, openFiling, openCourt }: { c: ExpCase; m: ExpMatter; j?: Jurisdiction; go: (t: Tab) => void; openFiling: () => void; openCourt: () => void }) {
  const exp = useExp();
  const toast = useToast();
  const n = nextAction(c, m);
  const p = casePhase(c, m);
  const verified = c.records.filter((r) => r.status === "verified").length;
  let primary: { label: string; run: () => void; icon?: typeof Send } | null = null;
  if (p === "Awaiting criminal records" || p === "Awaiting court minutes") primary = { label: "Open records", icon: FileSearch, run: () => go("records") };
  else if (p === "Awaiting eligibility review" || p === "Flagged for legal review") primary = c.screening.outcome === "Administrative Processing Approved" && c.status === "Not Started" ? { label: "Start document preparation", icon: PenLine, run: () => { if (exp.startPrep(c.id)) toast("Preparing"); } } : { label: "Open screening", icon: Scale, run: () => go("screening") };
  else if (p === "Documents being prepared") primary = { label: "Open document preparation", icon: PenLine, run: () => go("documents") };
  else if (p === "Awaiting client approval") primary = { label: "Open document preparation", icon: PenLine, run: () => go("documents") };
  else if (p === "Ready for filing") primary = { label: "Record filing", icon: Gavel, run: openFiling };
  else if (p === "Filed / awaiting court action" || p === "Hearing scheduled") primary = { label: "Record court update", icon: Gavel, run: openCourt };
  else if (p === "Order received — finishing") primary = { label: "Complete case", icon: ShieldCheck, run: () => { if (exp.complete(c.id, meId())) toast("Completed"); else toast("A verified court order is required"); } };
  else if (p === "On hold") primary = { label: "Resume", icon: Play, run: () => { exp.resume(c.id); toast("Resumed"); } };
  return (
    <div className="space-y-5">
      <Card>
        <div className="space-y-4 p-5 sm:p-6">
          <Stepper c={c} />
          <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${n.owner === "Client" ? "border-warning/40 bg-warning-soft/50" : n.owner === "Legal reviewer" ? "border-danger/30 bg-danger-soft/40" : n.owner === "Done" ? "border-success/30 bg-success-soft/40" : "border-accent/30 bg-accent-soft/40"}`}>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Next step <OwnerBadge o={n.owner} /></div><p className="mt-1 text-[14.5px] font-medium text-ink">{n.text}</p>{c.status === "On Hold" && <p className="text-[13px] text-ink-2">{c.holdReason}</p>}</div>
            {primary && exp.can.edit && <Button variant="primary" icon={primary.icon} onClick={primary.run}>{primary.label}</Button>}
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={ClipboardList} title="Arrest, dockets and charges" action={<Button size="sm" variant="ghost" onClick={() => go("details")}>Edit</Button>} />
          <dl className="grid gap-3 px-5 text-[13.5px] sm:grid-cols-3 sm:px-6">
            <div><dt className="text-[12px] text-muted">Arresting agency</dt><dd className="font-medium text-ink">{c.arrestingAgency || "—"}</dd></div>
            <div><dt className="text-[12px] text-muted">Arrest date</dt><dd className="font-medium text-ink">{c.arrestDate ? fmtDate(`${c.arrestDate}T12:00`) : "—"}</dd></div>
            <div><dt className="text-[12px] text-muted">Arrest / incident no.</dt><dd><Masked value={c.arrestNumber} label="arrest number" matterId={m.id} caseId={c.id} /></dd></div>
          </dl>
          <div className="space-y-3 px-5 py-4 sm:px-6">
            {c.dockets.map((d) => (
              <div key={d.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-2 text-[13px]"><span className="font-semibold text-ink">{d.court || "Court not set"}</span><span className="text-muted">Docket</span><Masked value={d.docketNumber} label="docket number" matterId={m.id} caseId={c.id} /></div>
                <ul className="mt-2 space-y-1.5">
                  {d.charges.map((ch) => <li key={ch.id} className="flex flex-wrap items-center gap-2 text-[13px]"><span className="text-ink">{ch.description}</span>{ch.classification && <Badge tone="neutral">{ch.classification}</Badge>}<Badge tone={ch.disposition === "Convicted" ? "warning" : ch.disposition === "Unknown" || ch.disposition === "Pending" ? "neutral" : "info"}>{ch.disposition}</Badge>{(ch.convictionDate || ch.dispositionDate) && <span className="text-[12px] text-muted">{fmtDate(`${ch.convictionDate ?? ch.dispositionDate}T12:00`)}</span>}{ch.sentence && <span className="text-[12px] text-muted">· {ch.sentence}</span>}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <dl className="grid gap-3 border-t border-line px-5 py-4 text-[13px] sm:grid-cols-3 sm:px-6">
            <div><dt className="text-[12px] text-muted">Probation / parole</dt><dd className="text-ink">{c.supervision || "—"}</dd></div>
            <div><dt className="text-[12px] text-muted">Sentence completed</dt><dd className="capitalize text-ink">{c.sentenceCompleted}</dd></div>
            <div><dt className="text-[12px] text-muted">Fines / costs</dt><dd className="capitalize text-ink">{c.obligations}</dd></div>
          </dl>
        </Card>
        <div className="space-y-5">
          <Card><CardHeader icon={FileSearch} title="Records" subtitle={`${verified} of ${c.records.length} verified`} action={<Button size="sm" variant="ghost" onClick={() => go("records")}>Open</Button>} /><ul className="px-5 pb-4 sm:px-6">{c.records.map((r) => <li key={r.id} className="flex items-center gap-2 py-1 text-[13px]"><span className="flex-1 text-ink-2">{r.docType}</span><Badge tone={RECORD_META[r.status].tone}>{RECORD_META[r.status].label}</Badge></li>)}</ul></Card>
          <Card><CardHeader icon={Scale} title="Screening" action={<OutcomeBadge o={c.screening.outcome} />} /><p className="px-5 pb-4 text-[12.5px] text-muted sm:px-6">Preliminary and administrative only — not a legal determination.{c.screening.reviews.length ? ` Last review ${fmtDate(c.screening.reviews[c.screening.reviews.length - 1].at)}.` : ""}</p></Card>
          <Card><CardHeader icon={PenLine} title="Documents" action={<Badge tone={PREP_META[c.prep.status].tone}>{PREP_META[c.prep.status].label}</Badge>} /><p className="px-5 pb-4 text-[12.5px] text-muted sm:px-6">Client approval: {c.prep.clientApproval.replace("_", " ")} · delivery: {c.prep.delivery.replace("_", " ")}</p></Card>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */

function DetailsTab({ c }: { c: ExpCase }) {
  const exp = useExp();
  const toast = useToast();
  const [v, setV] = useState<CaseDraft>(draftFrom(c));
  const [tried, setTried] = useState(false);
  useEffect(() => setV(draftFrom(c)), [c]);
  const errs = caseErrors(v, false);
  const dirty = JSON.stringify(v) !== JSON.stringify(draftFrom(c));
  return (
    <Card>
      <CardHeader icon={ClipboardList} title="Case & charges" subtitle="One arrest or court case. Multiple dockets per arrest and multiple charges per docket are supported." action={<Button size="sm" variant="primary" disabled={!dirty || !exp.can.edit} onClick={() => { setTried(true); if (errs.length) return; exp.updateCase(c.id, v); toast("Case saved"); }}>Save case</Button>} />
      <div className="px-5 pb-6 sm:px-6">
        <CaseEditor v={v} setV={setV} />
        {tried && errs.length > 0 && <p className="mt-3 text-[12.5px] text-danger-ink" role="alert">{errs.join(" · ")}</p>}
        {v.jurisdictionId !== c.jurisdictionId && <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">Changing the state keeps this case&rsquo;s existing records checklist. Review it on the Records tab — nothing from the old state&rsquo;s rules carries over to screening.</p>}
      </div>
    </Card>
  );
}

/* ================================================================== */

function RecordsTab({ c, j }: { c: ExpCase; j?: Jurisdiction }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const [req, setReq] = useState<string | null>(null);
  const [rcv, setRcv] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [addDoc, setAddDoc] = useState("");
  const rr = c.records.find((r) => r.id === req);
  const [form, setForm] = useState({ custodianId: "", custodianName: "", method: "Mail" as (typeof RECORD_METHODS)[number], fee: "", date: today() });
  const [files, setFiles] = useState<File[]>([]);
  const [missing, setMissing] = useState("");
  useEffect(() => { setForm({ custodianId: "", custodianName: "", method: "Mail", fee: "", date: today() }); }, [req]);
  useEffect(() => { setFiles([]); }, [rcv]);
  useEffect(() => { setMissing(""); }, [bad]);
  const docOptions = [...new Set((j?.requiredDocs ?? []).flatMap((r) => r.docs).concat(["Arrest report", "Criminal history report", "Court minutes", "Bill of information or charging document", "Final disposition", "Judgment of conviction", "Sentence information", "Probation or parole completion documentation", "Dismissal or acquittal documentation", "Set-aside documentation", "Other required court or agency record"]))].filter((d) => !c.records.some((r) => r.docType === d));
  const custodians = (j?.custodians ?? []).filter((x) => !x.locality || x.locality === c.locality);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={FileSearch} title="Records checklist" subtitle={`From the ${j?.stateName ?? c.state} configuration for this case type — customize per case`} action={
          <div className="flex flex-wrap gap-2"><select aria-label="Add a record" value={addDoc} onChange={(e) => setAddDoc(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2"><option value="">Add a record…</option>{docOptions.map((d) => <option key={d} value={d}>{d}</option>)}</select><Button size="sm" icon={Plus} disabled={!addDoc || !exp.can.edit} onClick={() => { exp.addRecord(c.id, addDoc); setAddDoc(""); toast("Record added to the checklist"); }}>Add</Button></div>
        } />
        <ul className="divide-y divide-line border-t border-line">
          {c.records.length === 0 && <li className="px-6 py-8 text-center text-[13px] text-muted">{c.draft ? "The checklist is created when staff review the intake." : "No records on the checklist."}</li>}
          {c.records.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5 sm:px-6">
              <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                <div className="text-[14px] font-medium text-ink">{r.docType}{!r.required && <span className="text-[12px] text-muted"> · optional</span>}</div>
                <div className="text-[12px] text-muted">{r.custodianName ?? "No custodian yet"}{r.method ? ` · ${r.method}` : ""}{r.requestedAt ? ` · requested ${fmtDate(`${r.requestedAt}T12:00`)}` : ""}{r.fee != null ? ` · fee ${usd(r.fee, 2)} ${r.feePaid ? "(paid)" : "(unpaid)"}` : ""}{r.receivedAt ? ` · received ${fmtDate(`${r.receivedAt}T12:00`)}` : ""}</div>
                {r.missingInfo && <div className="text-[12.5px] text-danger-ink">{r.missingInfo}</div>}
              </div>
              <Badge tone={RECORD_META[r.status].tone}>{RECORD_META[r.status].label}</Badge>
              {exp.can.edit && (
                <div className="flex flex-wrap gap-1.5">
                  {(r.status === "not_requested" || r.status === "incomplete") && <Button size="sm" onClick={() => setReq(r.id)}>{r.status === "incomplete" ? "Request again" : "Request"}</Button>}
                  {r.status !== "verified" && <Button size="sm" icon={UploadCloud} onClick={() => setRcv(r.id)}>Received</Button>}
                  {r.status === "received" && <><Button size="sm" variant="ghost" onClick={() => setBad(r.id)}>Incomplete</Button><Button size="sm" variant="primary" icon={BadgeCheck} onClick={() => { exp.verifyRecord(c.id, r.id, true); toast("Verified"); }}>Verify</Button></>}
                  {r.fee != null && !r.feePaid && <Button size="sm" variant="ghost" onClick={() => { exp.payRecordFee(c.id, r.id); toast("Fee marked paid"); }}>Fee paid</Button>}
                  {r.docId && <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${r.docType}`} onClick={() => { clientStore.logDocumentAccess(c.clientId, r.docId!, "Downloaded"); exp.logAccess(c.matterId, `Downloaded ${r.docType}`, c.id); downloadPlaceholder(r.docType); }} />}
                  {r.status === "not_requested" && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${r.docType}`} onClick={() => exp.removeRecord(c.id, r.id)} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Modal open={!!rr} onClose={() => setReq(null)} title="Request a record" description={rr?.docType} footer={<><Button onClick={() => setReq(null)}>Cancel</Button><Button variant="primary" disabled={!(form.custodianId || form.custodianName.trim()) || (form.fee !== "" && Number(form.fee) < 0)} onClick={() => { const cu = custodians.find((x) => x.id === form.custodianId); exp.requestRecord(c.id, req!, { custodianId: cu?.id, custodianName: cu?.name ?? form.custodianName.trim(), method: form.method, fee: form.fee === "" ? undefined : Number(form.fee), requestedAt: form.date }); toast("Request recorded"); setReq(null); }}>Record request</Button></>}>
        <div className="space-y-4">
          <SelectField id="rr-cust" label="Records custodian" value={form.custodianId} onChange={(e) => setForm({ ...form, custodianId: e.target.value })} options={[["", "Other (type below)"], ...custodians.map((x) => [x.id, `${x.name} · ${x.type}`] as [string, string])]} />
          {!form.custodianId && <TextField id="rr-cname" label="Custodian name" value={form.custodianName} onChange={(e) => setForm({ ...form, custodianName: e.target.value })} />}
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField id="rr-method" label="Request method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as typeof form.method })} options={RECORD_METHODS.map((x) => [x, x])} />
            <TextField id="rr-fee" label="Fee ($)" type="number" min={0} step="0.01" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} hint="as charged" />
            <TextField id="rr-date" label="Request date" type="date" max={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <p className="text-[12px] text-muted">MKB sends the request outside this app; this records what was sent.</p>
        </div>
      </Modal>
      <Modal open={!!rcv} onClose={() => setRcv(null)} title="Record received" description={c.records.find((r) => r.id === rcv)?.docType} footer={<><Button onClick={() => setRcv(null)}>Cancel</Button><Button variant="primary" disabled={!files.length} onClick={() => { exp.receiveRecord(c.id, rcv!, toFiles(files)[0]); toast("Received — verify it next"); setRcv(null); }}>Save</Button></>}>
        <FilePicker files={files} setFiles={setFiles} label="Attach the record" multiple={false} required />
        <p className="mt-2 text-[12px] text-muted">Stored as a restricted file on the client record, linked to this case.</p>
      </Modal>
      <Modal open={!!bad} onClose={() => setBad(null)} title="Mark incomplete" footer={<><Button onClick={() => setBad(null)}>Cancel</Button><Button variant="primary" disabled={!missing.trim()} onClick={() => { exp.verifyRecord(c.id, bad!, false, missing.trim()); toast("Marked incomplete"); setBad(null); }}>Save</Button></>}>
        <TextArea id="bad-note" label="What's missing or incomplete" required value={missing} onChange={(e) => setMissing(e.target.value)} />
      </Modal>
    </div>
  );
}

/* ================================================================== */

function ScreeningTab({ c, j }: { c: ExpCase; j?: Jurisdiction }) {
  const exp = useExp();
  const toast = useToast();
  const [s, setS] = useState(c.screening);
  const [open, setOpen] = useState(false);
  const [r, setR] = useState({ outcome: c.screening.outcome as ScreeningOutcome, byId: meId(), legal: false, reviewerName: "", sources: "", explanation: "" });
  const [blockers, setBlockers] = useState<string[]>([]);
  useEffect(() => setS(c.screening), [c.screening]);
  const dirty = JSON.stringify(s) !== JSON.stringify(c.screening);
  const preview = approvalBlockers({ ...c, screening: s }, j);
  const remedy = j?.remedies.find((r) => r.id === c.remedyId);
  const rules = (j?.rules ?? []).filter((r) => r.remedyId === c.remedyId);
  const criteria = (j?.criteria ?? []).filter((q) => q.remedyId === c.remedyId);
  if (!exp.can.screening) return <Restricted what="Screening discussions" />;
  if (!remedy) return <Card className="p-8 text-center text-[14px] text-ink-2">Choose this case&rsquo;s workflow on the Case &amp; charges tab first — each workflow has its own requirements and screening criteria.</Card>;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-soft/50 px-4 py-3 text-[13px] text-warning-ink">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>Administrative screening is preliminary and never guarantees eligibility. It never labels a case legally eligible or ineligible. Outcomes are recorded by a person, using only {remedy?.name ?? "this workflow's"} rules and criteria verified against authoritative sources ({j ? verifiedLabel(j).toLowerCase() : "not configured"}), and anything uncertain goes to qualified legal review.</span>
      </div>
      <Card>
        <CardHeader icon={ClipboardList} title={`${remedy.name} — screening checklist`} subtitle={`${j?.stateName} · ${c.locality} · separate from every other workflow`} action={<Button size="sm" variant="primary" disabled={!dirty} onClick={() => { exp.updateScreening(c.id, s); toast("Checklist saved"); }}>Save checklist</Button>} />
        <div className="space-y-4 px-5 pb-6 sm:px-6">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Applicable statutes or rules ({remedy.name} only)</span>
            {rules.length === 0 && <p className="text-[13px] text-muted">No {remedy.name} rules configured.</p>}
            <div className="space-y-1.5">
              {rules.map((rule) => (
                <label key={rule.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-2.5 text-[13px] hover:bg-surface-hover">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={s.ruleIds.includes(rule.id)} onChange={() => setS({ ...s, ruleIds: s.ruleIds.includes(rule.id) ? s.ruleIds.filter((x) => x !== rule.id) : [...s.ruleIds, rule.id] })} />
                  <span className="flex-1"><span className="font-medium text-ink">{rule.title}</span> <span className="text-muted">{rule.citation || "citation not entered"}{rule.waitingPeriod ? ` · waiting period: ${rule.waitingPeriod}` : ""}</span></span>
                  {rule.lastVerifiedAt ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{remedy.name} criteria</span>
            <div className="space-y-1.5">
              {criteria.length === 0 && <p className="text-[13px] text-muted">No criteria configured.</p>}
              {criteria.map((q) => (
                <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2.5 text-[13px]">
                  <span className="min-w-[200px] flex-1 text-ink">{q.question}</span>
                  {q.lastVerifiedAt ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}
                  <select aria-label={q.question} value={s.answers[q.id] ?? "unknown"} onChange={(e) => setS({ ...s, answers: { ...s.answers, [q.id]: e.target.value as "yes" | "no" | "unknown" } })} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink"><option value="unknown">Not confirmed</option><option value="yes">Confirmed</option><option value="no">Issue found</option></select>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField id="sc-cat" label="Offense category" value={s.offenseCategory} onChange={(e) => setS({ ...s, offenseCategory: e.target.value })} />
            <TextField id="sc-disp" label="Case disposition" value={s.dispositionSummary} onChange={(e) => setS({ ...s, dispositionSummary: e.target.value })} />
            <TextField id="sc-wait" label="Waiting period (from the verified rule)" value={s.waitingPeriod} onChange={(e) => setS({ ...s, waitingPeriod: e.target.value })} />
            <TriField id="sc-waitmet" label="Waiting period met?" value={s.waitingPeriodMet} onChange={(x) => setS({ ...s, waitingPeriodMet: x })} />
            <TriField id="sc-sent" label="Sentence completed?" value={s.sentenceCompleted} onChange={(x) => setS({ ...s, sentenceCompleted: x })} />
            <TriField id="sc-obl" label="Outstanding court obligations?" value={s.obligationsOutstanding} onChange={(x) => setS({ ...s, obligationsOutstanding: x })} />
            <TriField id="sc-pend" label="Pending charges?" value={s.pendingCharges} onChange={(x) => setS({ ...s, pendingCharges: x })} />
            <TriField id="sc-sup" label="On probation or parole?" value={s.onSupervision} onChange={(x) => setS({ ...s, onSupervision: x })} />
            <TriField id="sc-prior" label="Prior expungements?" value={s.priorExpungements} onChange={(x) => setS({ ...s, priorExpungements: x })} />
            <TriField id="sc-docs" label="Required supporting documents complete?" value={s.supportingDocsComplete} onChange={(x) => setS({ ...s, supportingDocsComplete: x })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextArea id="sc-missing" label="Missing information" value={s.missingInfo} onChange={(e) => setS({ ...s, missingInfo: e.target.value })} />
            <TextArea id="sc-disq" label="Potential disqualifying issues" value={s.disqualifyingIssues} onChange={(e) => setS({ ...s, disqualifyingIssues: e.target.value })} />
          </div>
          <Checkbox label="Legal review required" hint="An attorney or qualified legal reviewer must review before administrative processing." checked={s.legalReviewRequired} onChange={() => setS({ ...s, legalReviewRequired: !s.legalReviewRequired })} />
        </div>
      </Card>
      <Card>
        <CardHeader icon={Scale} title="Reviews" subtitle="Each review records the reviewer, date, sources checked and an explanation" action={<div className="flex flex-wrap items-center gap-2"><OutcomeBadge o={c.screening.outcome} /><Button size="sm" variant="primary" icon={Plus} onClick={() => { setR({ outcome: c.screening.outcome, byId: meId(), legal: false, reviewerName: "", sources: "", explanation: "" }); setBlockers([]); setOpen(true); }}>Record review</Button></div>} />
        <ul className="divide-y divide-line border-t border-line">
          {c.screening.reviews.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No reviews yet.</li>}
          {[...c.screening.reviews].reverse().map((v) => (
            <li key={v.id} className="space-y-1 px-5 py-3.5 sm:px-6">
              <div className="flex flex-wrap items-center gap-2"><OutcomeBadge o={v.outcome} />{v.legal && <Badge tone="info" icon={Scale}>Qualified legal review</Badge>}<span className="text-[12.5px] text-muted">{v.reviewerName ? `${v.reviewerName} (recorded by ${staffById(v.byId).name})` : staffById(v.byId).name} · {fmtDateTime(v.at)}</span></div>
              <p className="text-[13.5px] text-ink-2">{v.explanation}</p>
              <p className="text-[12px] text-muted">Sources checked: {v.sources.join("; ")}</p>
            </li>
          ))}
        </ul>
        {preview.length > 0 && <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted sm:px-6">Before “Administrative Processing Approved” can be recorded: {preview.join(" · ")}.</p>}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Record a screening review" description="Preliminary administrative review — not a legal determination." footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!r.explanation.trim() || !r.sources.trim() || (r.legal && !r.reviewerName.trim())} onClick={() => { const b = exp.recordReview(c.id, { outcome: r.outcome, byId: r.byId, legal: r.legal || undefined, reviewerName: r.reviewerName.trim() || undefined, sources: r.sources.split("\n").map((x) => x.trim()).filter(Boolean), explanation: r.explanation.trim() }); if (b.length) { setBlockers(b); return; } toast(`Screening: ${r.outcome}`); setOpen(false); }}>Record review</Button></>}>
        <div className="space-y-4">
          <SelectField id="rv-outcome" label="Outcome" value={r.outcome} onChange={(e) => { setR({ ...r, outcome: e.target.value as ScreeningOutcome }); setBlockers([]); }} options={SCREENING_OUTCOMES.map((x) => [x, x])} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="rv-by" label="Recorded by" value={r.byId} onChange={(e) => setR({ ...r, byId: e.target.value })} options={staffOptsNow()} />
            <TextField id="rv-name" label="Qualified legal reviewer (if any)" value={r.reviewerName} onChange={(e) => setR({ ...r, reviewerName: e.target.value })} placeholder="Attorney or qualified reviewer name" />
          </div>
          <Checkbox label="This review was performed by an attorney or qualified legal reviewer" checked={r.legal} onChange={() => setR({ ...r, legal: !r.legal })} />
          <TextArea id="rv-sources" label="Sources checked (one per line)" required value={r.sources} onChange={(e) => setR({ ...r, sources: e.target.value })} placeholder={"Certified court minutes\nVerified jurisdiction rule …"} />
          <TextArea id="rv-expl" label="Explanation" required value={r.explanation} onChange={(e) => setR({ ...r, explanation: e.target.value })} />
          {blockers.length > 0 && <div className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert"><strong>Can&rsquo;t approve yet:</strong> {blockers.join(" · ")}.</div>}
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */

function DocsTab({ c }: { c: ExpCase }) {
  const exp = useExp();
  const clientStore = useClients();
  const toast = useToast();
  const [up, setUp] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [formName, setFormName] = useState("");
  const [miss, setMiss] = useState("");
  const [changes, setChanges] = useState(false);
  const [note, setNote] = useState("");
  const p = c.prep;
  const started = c.status !== "Not Started" || p.status !== "not_started";
  if (!started)
    return (
      <Card className="p-8 text-center">
        <p className="text-[14px] text-ink-2">Document preparation starts after screening is recorded as <strong>Administrative Processing Approved</strong>.</p>
        <Button className="mt-4" variant="primary" icon={PenLine} disabled={c.screening.outcome !== "Administrative Processing Approved" || !exp.can.edit} onClick={() => { if (exp.startPrep(c.id)) toast("Preparing"); }}>Start document preparation</Button>
      </Card>
    );
  const allDrafted = p.forms.length > 0 && p.forms.every((f) => f.docId);
  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-[12.5px] text-ink-2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" /> Documents here are prepared by MKB from the client&rsquo;s information. They are not filed and not court-approved until the court acts — they&rsquo;re always labeled that way.</p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={FileText} title="Forms and documents" subtitle={`Status: ${PREP_META[p.status].label}`} />
          <ul className="divide-y divide-line border-t border-line">
            {p.forms.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No forms yet — add the forms the verified procedure requires.</li>}
            {p.forms.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto"><div className="text-[14px] font-medium text-ink">{f.name}</div><div className="text-[12px] text-muted">{f.source}</div></div>
                <Badge tone={f.status === "final" ? "success" : f.status === "drafted" ? "info" : "neutral"}>{f.status === "final" ? "Final (internally approved)" : f.status === "drafted" ? "Draft uploaded" : "Needed"}</Badge>
                {exp.can.edit && p.status !== "internally_approved" && <Button size="sm" icon={UploadCloud} onClick={() => { setUp(f.id); setFiles([]); }}>{f.docId ? "Replace" : "Upload"}</Button>}
                {f.docId && <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${f.name}`} onClick={() => { clientStore.logDocumentAccess(c.clientId, f.docId!, "Downloaded"); downloadPlaceholder(`${f.name} (prepared by MKB, not filed)`); }} />}
              </li>
            ))}
          </ul>
          {exp.can.edit && <div className="flex gap-2 border-t border-line p-4 sm:px-6"><input aria-label="New form" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Add a form or document…" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /><Button icon={Plus} disabled={!formName.trim()} onClick={() => { exp.addForm(c.id, formName.trim(), "Added by staff"); setFormName(""); }}>Add</Button></div>}
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={ShieldCheck} title="Workflow" />
            <div className="space-y-3 px-5 pb-5 sm:px-6">
              <div className="grid grid-cols-2 gap-3">
                <SelectField id="pp-prep" label="Assigned preparer" value={p.preparerId} onChange={(e) => exp.updatePrep(c.id, { preparerId: e.target.value })} options={staffOptsNow()} />
                <SelectField id="pp-rev" label="Quality reviewer" value={p.reviewerId} onChange={(e) => exp.updatePrep(c.id, { reviewerId: e.target.value })} options={staffOptsNow()} />
              </div>
              {p.reviewerId === p.preparerId && <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">The reviewer also prepared the documents — a second reviewer is recommended.</p>}
              <dl className="space-y-1 text-[13px]">
                <div className="flex justify-between"><dt className="text-muted">Preparation</dt><dd><Badge tone={PREP_META[p.status].tone}>{PREP_META[p.status].label}</Badge></dd></div>
                <div className="flex justify-between"><dt className="text-muted">Client approval</dt><dd className="capitalize text-ink">{p.clientApproval.replace("_", " ")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Final delivery</dt><dd className="capitalize text-ink">{p.delivery.replace("_", " ")}{p.deliveredAt ? ` · ${fmtDate(p.deliveredAt)}` : ""}</dd></div>
              </dl>
              {p.clientComment && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2 ring-1 ring-line">Client: “{p.clientComment}”</p>}
              {exp.can.edit && (
                <div className="flex flex-wrap gap-2">
                  {(p.status === "in_progress" || p.status === "changes_requested") && <Button variant="primary" disabled={!allDrafted || p.missing.length > 0} title={!allDrafted ? "Upload every form first" : p.missing.length ? "Resolve missing information first" : undefined} onClick={() => { exp.submitForReview(c.id); toast("Sent for internal review"); }}>Submit for internal review</Button>}
                  {p.status === "ready_for_review" && <><Button onClick={() => { setChanges(true); setNote(""); }}>Request changes</Button><Button variant="primary" icon={ShieldCheck} onClick={() => { exp.internalReview(c.id, true, p.reviewerId); toast(`Approved by ${staffById(p.reviewerId).name}`); }}>Approve (quality review)</Button></>}
                  {p.status === "internally_approved" && c.status === "Preparing" && <Button variant="primary" icon={Send} onClick={() => { exp.sendForApproval(c.id); toast("Sent to the client for approval"); }}>Send to client for approval</Button>}
                  {c.status === "Awaiting Client Approval" && <Button onClick={() => { exp.clientDecision(c.id, true); toast("Client approval recorded"); }}>Record client approval (given by phone/email)</Button>}
                  {p.clientApproval === "approved" && p.delivery === "not_delivered" && <Button icon={Send} onClick={() => { exp.deliverDocs(c.id); toast("Final documents delivered to the client portal"); }}>Deliver final documents</Button>}
                </div>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader icon={FilePlus2} title="Information still missing" />
            <ul className="space-y-1 px-5 pb-3 sm:px-6">{p.missing.length === 0 && <li className="text-[13px] text-muted">Nothing missing.</li>}{p.missing.map((x, i) => <li key={i} className="flex items-center gap-2 text-[13px] text-ink-2"><span className="flex-1">{x}</span>{exp.can.edit && <button type="button" aria-label={`Resolve ${x}`} onClick={() => exp.updatePrep(c.id, { missing: p.missing.filter((_, j) => j !== i) })} className="text-[12px] font-semibold text-accent">Resolved</button>}</li>)}</ul>
            {exp.can.edit && <div className="flex gap-2 border-t border-line p-4 sm:px-6"><input aria-label="Missing information" value={miss} onChange={(e) => setMiss(e.target.value)} placeholder="Add missing item…" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink" /><Button size="sm" disabled={!miss.trim()} onClick={() => { exp.updatePrep(c.id, { missing: [...p.missing, miss.trim()] }); setMiss(""); }}>Add</Button></div>}
          </Card>
        </div>
      </div>
      <Modal open={!!up} onClose={() => setUp(null)} title="Upload prepared document" description={p.forms.find((f) => f.id === up)?.name} footer={<><Button onClick={() => setUp(null)}>Cancel</Button><Button variant="primary" disabled={!files.length} onClick={() => { exp.uploadForm(c.id, up!, toFiles(files)[0]); toast("Draft uploaded"); setUp(null); }}>Upload</Button></>}>
        <FilePicker files={files} setFiles={setFiles} label="Choose the file" multiple={false} required />
        <p className="mt-2 text-[12px] text-muted">Saved on the client record as “prepared by MKB, not filed”.</p>
      </Modal>
      <Modal open={changes} onClose={() => setChanges(false)} title="Request changes" footer={<><Button onClick={() => setChanges(false)}>Cancel</Button><Button variant="primary" disabled={!note.trim()} onClick={() => { exp.internalReview(c.id, false, p.reviewerId, note.trim()); toast("Changes requested"); setChanges(false); }}>Send back</Button></>}>
        <TextArea id="ch-note" label="What needs to change" required value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}

/* ================================================================== */

function FilingTab({ c, j, openFiling, openCourt }: { c: ExpCase; j?: Jurisdiction; openFiling: () => void; openCourt: () => void }) {
  const exp = useExp();
  const toast = useToast();
  const f = c.filing;
  const court = j?.localities.find((l) => l.id === c.localityId)?.courts[0];
  const [v, setV] = useState({ court: f.court, clerkContact: f.clerkContact, daContact: f.daContact ?? "", requirements: f.requirements ?? "" });
  useEffect(() => setV({ court: f.court, clerkContact: f.clerkContact, daContact: f.daContact ?? "", requirements: f.requirements ?? "" }), [f]);
  const canFile = c.status === "Ready for Filing";
  const filed = !!f.filedAt;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={Gavel} title="Filing details" subtitle={`${j?.stateName} · ${c.locality}`} action={<Button size="sm" disabled={!exp.can.edit} onClick={() => { exp.updateFiling(c.id, { court: v.court, clerkContact: v.clerkContact, daContact: v.daContact || undefined, requirements: v.requirements || undefined }); toast("Filing details saved"); }}>Save</Button>} />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
          <TextField id="fl-court" label="Court" value={v.court} onChange={(e) => setV({ ...v, court: e.target.value })} />
          <TextField id="fl-clerk" label="Clerk contact" value={v.clerkContact} onChange={(e) => setV({ ...v, clerkContact: e.target.value })} placeholder={court?.clerkContact} />
          <TextField id="fl-da" label="Prosecutor / DA contact (when applicable)" value={v.daContact} onChange={(e) => setV({ ...v, daContact: e.target.value })} placeholder={court?.daContact} />
          <TextField id="fl-req" label="Additional court requirements" value={v.requirements} onChange={(e) => setV({ ...v, requirements: e.target.value })} />
          {court && (!v.clerkContact || !v.daContact) && <p className="text-[12.5px] text-muted sm:col-span-2">From the jurisdiction configuration: {court.clerk} — {court.clerkContact}{court.daContact ? ` · DA ${court.daContact}` : ""}. <button type="button" className="font-semibold text-accent" onClick={() => setV({ ...v, court: v.court || court.name, clerkContact: v.clerkContact || court.clerkContact, daContact: v.daContact || court.daContact || "" })}>Use these</button></p>}
        </div>
      </Card>
      <Card>
        <CardHeader icon={ShieldCheck} title="Filing and court status" action={<StatusBadge s={c.status} />} />
        <dl className="grid gap-3 px-5 text-[13.5px] sm:grid-cols-3 sm:px-6">
          {[
            ["Filing date", f.filedAt ? fmtDate(`${f.filedAt}T12:00`) : "Not filed"],
            ["Filing method", f.method ?? "—"],
            ["Filing confirmation", f.confirmationNumber ? `${f.confirmationNumber}${f.confirmationVerified ? " · verified" : ""}` : "—"],
            ["Filing fee", f.filingFee != null ? `${usd(f.filingFee, 2)} · ${f.feeStatus.replace("_", " ")}` : "—"],
            ["Hearing", f.hearingAt ? fmtDateTime(f.hearingAt) : "—"],
            ["Court response", f.courtResponse ?? "—"],
            ["Final order", f.finalOrderDocId ? `On file${f.finalOrderVerified ? " · verified" : ""}` : "Not received"],
            ["Completion date", f.completedAt ? fmtDate(f.completedAt) : "—"],
          ].map(([k, val]) => <div key={k}><dt className="text-[12px] text-muted">{k}</dt><dd className="font-medium text-ink">{val}</dd></div>)}
        </dl>
        {exp.can.edit && (
          <div className="flex flex-wrap gap-2 px-5 py-4 sm:px-6">
            <Button variant={canFile ? "primary" : "secondary"} icon={Gavel} disabled={!canFile} title={canFile ? undefined : "Available when the case is Ready for Filing (client approved the documents)"} onClick={openFiling}>Record filing</Button>
            <Button icon={Gavel} disabled={!filed || ["Completed", "Denied", "Withdrawn"].includes(c.status)} onClick={openCourt}>Record court update</Button>
            <Button variant="primary" icon={ShieldCheck} disabled={c.status !== "Granted"} title={c.status !== "Granted" ? "Requires a granted case with a verified order" : undefined} onClick={() => { if (exp.complete(c.id, meId())) toast("Completed"); else toast("A verified court order is required"); }}>Complete case</Button>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-[12px] text-muted sm:px-6">“Submitted” needs a verified filing confirmation on file. “Granted” needs the court&rsquo;s order on file and verified. “Completed” only follows a verified grant. MKB never files on its own from this app.</p>
      </Card>
    </div>
  );
}

function FilingDialog({ c, open, onClose }: { c: ExpCase; open: boolean; onClose: () => void }) {
  const exp = useExp();
  const toast = useToast();
  const [v, setV] = useState({ date: today(), method: "In person", conf: "", fee: "", feeStatus: "unpaid" as "unpaid" | "paid" | "not_due", verified: false });
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => { if (open) { setV({ date: today(), method: "In person", conf: "", fee: "", feeStatus: "unpaid", verified: false }); setFiles([]); } }, [open]);
  const valid = v.conf.trim() && files.length && v.verified && v.date <= today();
  return (
    <Modal open={open} onClose={onClose} title="Record filing" description="Record a filing that was made with the court. This does not file anything." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { if (exp.recordFiling(c.id, { filedAt: v.date, method: v.method, confirmationNumber: v.conf.trim(), file: toFiles(files)[0], verified: v.verified, filingFee: v.fee === "" ? undefined : Number(v.fee), feeStatus: v.fee === "" ? "not_due" : v.feeStatus, byId: meId() })) { toast("Submitted — confirmation on file"); onClose(); } }}>Record filing</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="fd-date" label="Filing date" type="date" max={today()} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
          <SelectField id="fd-method" label="Filing method" value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })} options={["In person", "In person by the client", "E-filing", "Mail"].map((x) => [x, x])} />
          <TextField id="fd-conf" label="Filing confirmation number" required value={v.conf} onChange={(e) => setV({ ...v, conf: e.target.value })} />
          <TextField id="fd-fee" label="Filing fee ($)" type="number" min={0} step="0.01" value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} hint="as charged" />
          {v.fee !== "" && <SelectField id="fd-feest" label="Fee payment status" value={v.feeStatus} onChange={(e) => setV({ ...v, feeStatus: e.target.value as typeof v.feeStatus })} options={[["unpaid", "Unpaid"], ["paid", "Paid"]]} />}
        </div>
        <FilePicker files={files} setFiles={setFiles} label="Attach the filing confirmation (stamped copy or receipt)" multiple={false} required />
        <Checkbox label="I verified this filing confirmation against the court's record or receipt" checked={v.verified} onChange={() => setV({ ...v, verified: !v.verified })} />
      </div>
    </Modal>
  );
}

function CourtDialog({ c, open, onClose }: { c: ExpCase; open: boolean; onClose: () => void }) {
  const exp = useExp();
  const toast = useToast();
  const [kind, setKind] = useState<"awaiting" | "hearing" | "info" | "granted" | "denied" | "withdrawn">("awaiting");
  const [note, setNote] = useState("");
  const [hearing, setHearing] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [verified, setVerified] = useState(false);
  useEffect(() => { if (open) { setKind("awaiting"); setNote(""); setHearing(""); setFiles([]); setVerified(false); } }, [open]);
  const valid = note.trim() && (kind !== "hearing" || hearing) && (kind !== "granted" || (files.length && verified));
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Record court or agency update" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { if (exp.courtUpdate(c.id, { kind, note: note.trim(), hearingAt: hearing ? new Date(hearing).toISOString() : undefined, orderFile: toFiles(files)[0], verified, byId: meId() })) { toast("Court update recorded"); onClose(); } }}>Record</Button></>}>
      <div className="space-y-4">
        <SelectField id="cu-kind" label="Update" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} options={[["awaiting", "Awaiting agency / court response"], ["hearing", "Hearing scheduled"], ["info", "Additional information requested"], ["granted", "Granted — order received"], ["denied", "Denied"], ["withdrawn", "Withdrawn"]]} />
        {kind === "hearing" && <TextField id="cu-hearing" label="Hearing date and time" type="datetime-local" required value={hearing} onChange={(e) => setHearing(e.target.value)} />}
        <TextArea id="cu-note" label="Court response / notes" required value={note} onChange={(e) => setNote(e.target.value)} />
        {(kind === "granted" || kind === "denied") && <FilePicker files={files} setFiles={setFiles} label={kind === "granted" ? "Attach the signed order" : "Attach the court's response (optional)"} multiple={false} required={kind === "granted"} />}
        {kind === "granted" && <Checkbox label="I verified this order against the court's record" hint="A case can't be marked granted without a verified order on file." checked={verified} onChange={() => setVerified(!verified)} />}
      </div>
    </Modal>
  );
}

function HoldDialog({ c, mode, onClose }: { c: ExpCase; mode: "hold" | "override" | null; onClose: () => void }) {
  const exp = useExp();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [to, setTo] = useState<CaseStatus>("Not Started");
  useEffect(() => { setReason(""); setTo("Not Started"); }, [mode]);
  if (!mode) return null;
  return (
    <Modal open onClose={onClose} title={mode === "hold" ? "Put case on hold" : "Change status (override)"} footer={<><Button onClick={onClose}>Back</Button><Button variant="primary" disabled={!reason.trim()} onClick={() => { if (mode === "hold") exp.hold(c.id, reason.trim()); else exp.override(c.id, to, reason.trim()); toast(mode === "hold" ? "On hold" : `Status: ${to}`); onClose(); }}>{mode === "hold" ? "Put on hold" : "Change status"}</Button></>}>
      <div className="space-y-4">
        {mode === "override" && <><SelectField id="ov-to" label="New status" value={to} onChange={(e) => setTo(e.target.value as CaseStatus)} options={CASE_STATUSES.filter((s) => !["Granted", "Completed", "Submitted", c.status].includes(s)).map((s) => [s, s])} /><p className="text-[12px] text-muted">Submitted, Granted and Completed need verified confirmations and can&rsquo;t be set here.</p></>}
        <TextArea id="hd-reason" label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

/* ================================================================== */

function HistoryTab({ c }: { c: ExpCase }) {
  const exp = useExp();
  const toast = useToast();
  const [note, setNote] = useState("");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader icon={Activity} title="Case history" subtitle="Status changes and updates, newest first" />
        <ol className="relative mx-5 mb-5 space-y-3 border-l-2 border-line pl-5 sm:mx-6">
          {[...c.history].reverse().map((h, i) => <li key={i} className="relative"><span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-accent ring-4 ring-surface" /><div className="flex flex-wrap items-center gap-2">{h.status !== "note" ? <StatusBadge s={h.status} /> : <Badge tone="neutral">Update</Badge>}<span className="text-[12.5px] text-muted">{fmtDateTime(h.at)} · {h.byId === "client" ? "Client" : staffById(h.byId).name}</span></div>{h.note && <p className="mt-0.5 text-[13.5px] text-ink-2">{h.note}</p>}</li>)}
        </ol>
      </Card>
      <Card>
        <CardHeader icon={Lock} title="Internal case notes" subtitle="MKB only — never shown to the client" action={<Badge tone="neutral" icon={Lock}>Internal</Badge>} />
        <div className="mx-5 mb-3 flex gap-2 sm:mx-6"><input aria-label="Case note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-line-strong bg-surface-2 px-3 text-[14px] text-ink" /><Button disabled={!note.trim()} onClick={() => { exp.addCaseNote(c.id, note.trim()); setNote(""); toast("Internal note added"); }}>Add</Button></div>
        <ul className="space-y-2 px-5 pb-5 sm:px-6">{c.internalNotes.length === 0 && <li className="py-4 text-center text-[13px] text-muted">No internal notes.</li>}{c.internalNotes.map((n) => <li key={n.id} className="rounded-xl border border-dashed border-line-strong bg-surface-2 p-3 text-[13.5px]"><p className="text-ink-2">{n.body}</p><p className="mt-1 text-[12px] text-muted">{staffById(n.authorId).name} · {relTime(n.at)}</p></li>)}</ul>
      </Card>
    </div>
  );
}

export { ArrowRight, XCircle, Lock };
