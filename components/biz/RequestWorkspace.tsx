"use client";

import Link from "next/link";
import { useClientGate } from "@/components/team/AccessGuard";
import { useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Building2,
  CalendarPlus,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  Landmark,
  LayoutGrid,
  ListChecks,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { PaymentDialog, downloadPlaceholder } from "@/components/crm/dialogs";
import { STAFF, SAMPLE_NOW, staffById, staffList } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { isClosed, nextStep, openInfo, payState, paymentCleared, requestDocs, requestInvoices, requestMessages, useBiz } from "@/lib/store/biz-store";
import { AGENCY_KIND, AGENT_TYPE, DELIVERABLE_META, DOC_CATEGORIES, EIN_STATUS, ENTITY_TYPES, NATURE, STATE_FILING, stateName, stateOptions, type DocCategory, type EinStatus, type EntityType, type FormationDetails, type InfoRequest, type ServiceRequest } from "@/lib/biz/config";
import { fileSize, fmtDate, fmtDateTime, relTime, usd } from "@/lib/format";
import type { Client } from "@/lib/types";
import { EngagementCard } from "./BizEngagement";
import { BACKEND } from "@/lib/sync/remote";
import { FeeBreakdown, NotLegalAdvice, OwnerBadge, PayBadge, RequestStepper, StatusBadge, entityHref, money, portalHref } from "./BizBits";
import { AdjustDialog, AgencyDialog, AskAgainDialog, ChargeDialog, CompletionDialog, ConsultDialog, DeliverableDialog, DocUploadDialog, InfoRequestDialog, QuoteDialog, ReasonDialog, RespondDialog } from "./BizDialogs";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "formation", label: "Formation", icon: Building2 },
  { key: "client", label: "Client requests", icon: UserRound },
  { key: "work", label: "Tasks & notes", icon: ListChecks },
  { key: "agency", label: "Agency", icon: Landmark },
  { key: "documents", label: "Documents & deliverables", icon: FolderOpen },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "activity", label: "History", icon: ActivityIcon },
] as const;
type Tab = (typeof TABS)[number]["key"];
type Dlg = "quote" | "info" | "agency" | "agency-approve" | "agency-follow" | "completion" | "consult" | "payment" | "charge" | "adjust" | "upload" | null;

export function RequestWorkspace({ id }: { id: string }) {
  const biz = useBiz();
  const clientStore = useClients();
  const toast = useToast();
  const r = biz.requests.find((x) => x.id === id);
  const c = clientStore.clients.find((x) => x.id === r?.clientId);
  const svc = biz.catalog.find((s) => s.id === r?.serviceId);
  const [tab, setTab] = useState<Tab>("overview");
  const [dlg, setDlg] = useState<Dlg>(null);
  const [reason, setReason] = useState<"hold" | "cancel" | "reopen" | "override" | null>(null);
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === h)) setTab(h);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };
  const gate = useClientGate(r?.clientId, "this service request");
  if (gate) return gate;
  if (!r)
    return (
      <div className="py-20 text-center">
        <h1 className="text-[20px] font-bold text-ink">Request not found</h1>
        <p className="mt-1 text-[14px] text-muted">Sample data resets when the page reloads, so requests created in this session disappear after a refresh.</p>
        <Link href="/services/business-services" className="mt-4 inline-block text-[14px] font-semibold text-accent">Back to Business Services</Link>
      </div>
    );
  const agency = !!svc?.agency || r.agency.length > 0;
  const tabs = TABS.filter((t) => (t.key !== "formation" || r.formation) && (t.key !== "agency" || agency));
  const entity = biz.entities.find((e) => e.id === r.entityId);
  const pay = payState(r, c);
  const open = (d: Dlg) => setDlg(d);

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Business Services", href: "/services/business-services" }, { label: "Service requests", href: "/services/business-services#requests" }, { label: r.number }]} />
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-svc-biz-soft text-svc-biz"><ClipboardList size={26} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{r.serviceName}</h1>
                <StatusBadge s={r.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span className="font-mono text-[12px] text-faint">{r.number}</span>
                <span>{c ? <>Client: <Link href={`/clients/${c.id}`} className="font-medium text-accent hover:underline">{c.name}</Link></> : <>Prospect: <span className="font-medium text-ink-2">{r.prospect?.name}</span> <Badge tone="warning">Not a client yet</Badge></>}</span>
                <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{entity ? <Link href={entityHref(entity)} className="font-medium text-accent hover:underline">{r.businessName}</Link> : r.businessName} · {r.structure} · {r.state}</span>
                {svc && <span>{svc.category} · {NATURE[svc.nature].label}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            {c && <Button size="sm" icon={Eye} href={portalHref(c.id)}>Client portal view</Button>}
            <Menu
              label="Request actions"
              trigger={({ toggle }) => <Button size="sm" icon={MoreHorizontal} onClick={toggle} aria-label="Request actions">More</Button>}
              items={[
                { label: "Request information…", icon: FilePlus2, onSelect: () => open("info"), disabled: !c || isClosed(r) },
                { label: r.consultation?.status === "scheduled" ? "Record consultation…" : "Schedule consultation…", icon: CalendarPlus, onSelect: () => open("consult"), disabled: !c || isClosed(r) },
                { label: "Edit quote…", icon: Receipt, onSelect: () => open("quote") },
                "divider",
                r.status === "On Hold" ? { label: "Resume", icon: Play, onSelect: () => { biz.resume(r.id); toast("Resumed"); } } : { label: "Put on hold…", icon: Pause, onSelect: () => setReason("hold"), disabled: isClosed(r) },
                { label: "Change status (override)…", icon: RotateCcw, onSelect: () => setReason("override"), disabled: isClosed(r) },
                isClosed(r) ? { label: "Reopen…", icon: RotateCcw, onSelect: () => setReason("reopen") } : { label: "Cancel request…", icon: XCircle, danger: true, onSelect: () => setReason("cancel") },
              ]}
            />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          {(["assignedTo", "reviewerId"] as const).map((role) => (
            <label key={role} className="block">
              <span className="text-[12px] text-muted">{role === "assignedTo" ? "Assigned staff" : "Reviewer / approver"}</span>
              <select aria-label={role === "assignedTo" ? "Assigned staff" : "Reviewer"} value={r[role]} onChange={(e) => { biz.assign(r.id, role, e.target.value); toast(`${role === "assignedTo" ? "Assigned to" : "Reviewer:"} ${staffById(e.target.value).name}`); }} className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] font-medium text-ink">
                {staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          ))}
          <label className="block">
            <span className="text-[12px] text-muted">Due date</span>
            <input aria-label="Due date" type="date" value={r.dueAt?.slice(0, 10) ?? ""} onChange={(e) => { biz.updateRequest(r.id, { dueAt: e.target.value ? new Date(`${e.target.value}T17:00`).toISOString() : undefined }, `Due date ${e.target.value ? `set to ${e.target.value}` : "cleared"}`); }} className={`mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] font-medium ${r.dueAt && !isClosed(r) && r.dueAt < SAMPLE_NOW.toISOString() ? "text-danger-ink" : "text-ink"}`} />
          </label>
          <div>
            <span className="text-[12px] text-muted">Payment</span>
            <button onClick={() => go("billing")} className="mt-1 flex items-center gap-2 text-left"><PayBadge s={pay.state} />{pay.due > 0 && <span className="text-[13px] font-semibold tabular-nums text-danger-ink">{money(pay.due)} due</span>}</button>
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-20 -mx-4 mt-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Request" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              <t.icon size={16} /> {t.label}
              {t.key === "client" && openInfo(r).length > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink">{openInfo(r).length}</span>}
              {t.key === "documents" && r.deliverables.some((d) => d.status === "ready_for_review") && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink">review</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {tab === "overview" && <OverviewTab r={r} c={c} agency={agency} go={go} open={open} />}
        {tab === "formation" && r.formation && <FormationTab r={r} f={r.formation} go={go} />}
        {tab === "client" && <ClientTab r={r} c={c} open={open} />}
        {tab === "work" && <WorkTab r={r} />}
        {tab === "agency" && <AgencyTab r={r} c={c} open={open} />}
        {tab === "documents" && <DocsTab r={r} c={c} open={open} />}
        {tab === "billing" && <BillingTab r={r} c={c} open={open} />}
        {tab === "activity" && <HistoryTab r={r} />}
      </div>

      {dlg === "quote" && <QuoteDialog r={r} open onClose={() => setDlg(null)} />}
      <InfoRequestDialog r={r} open={dlg === "info"} onClose={() => setDlg(null)} />
      <AgencyDialog r={r} open={dlg === "agency" || dlg === "agency-approve" || dlg === "agency-follow"} initialKind={dlg === "agency-approve" ? "approved" : dlg === "agency-follow" ? "follow_up" : undefined} onClose={() => setDlg(null)} />
      <CompletionDialog r={r} open={dlg === "completion"} onClose={() => setDlg(null)} />
      <ConsultDialog r={r} open={dlg === "consult"} onClose={() => setDlg(null)} />
      <ChargeDialog r={r} open={dlg === "charge"} onClose={() => setDlg(null)} />
      <AdjustDialog r={r} open={dlg === "adjust"} onClose={() => setDlg(null)} />
      {c && <PaymentDialog client={c} open={dlg === "payment"} invoiceId={requestInvoices(r, c).find((i) => i.status !== "paid" && i.status !== "draft")?.id} onClose={() => setDlg(null)} />}
      {c && <DocUploadDialog clientId={c.id} entityId={r.entityId} requestId={r.id} open={dlg === "upload"} onClose={() => setDlg(null)} />}
      <ReasonDialog r={r} mode={reason} onClose={() => setReason(null)} />
    </>
  );
}

/* ================================================================== */

type Act = { label: string; run: () => void; icon?: typeof Send; disabled?: boolean } | null;

function OverviewTab({ r, c, agency, go, open }: { r: ServiceRequest; c?: Client; agency: boolean; go: (t: Tab) => void; open: (d: Dlg) => void }) {
  const biz = useBiz();
  const clientStore = useClients();
  const toast = useToast();
  const svc = biz.catalog.find((s) => s.id === r.serviceId);
  const pay = payState(r, c);
  const info = openInfo(r);
  const n = nextStep(r, c, svc);
  const [linkTo, setLinkTo] = useState("");
  const approved = r.deliverables.filter((d) => d.status === "approved");
  const review = r.deliverables.filter((d) => d.status === "ready_for_review");
  const pending = r.deliverables.filter((d) => d.status === "pending");
  const proceed: Act = { label: "Proceed before payment…", run: () => { const why = prompt("Why is work starting before payment? (recorded in the history)"); if (why?.trim()) { biz.waivePayment(r.id, why.trim()); toast("Recorded — work can start"); } } };
  let primary: Act = null;
  let secondary: Act = null;
  switch (r.status) {
    case "Intake":
      if (!r.clientId) break;
      if (r.consultation?.status === "scheduled") { primary = { label: "Record consultation", icon: CheckCircle2, run: () => open("consult") }; secondary = { label: "Prepare quote", run: () => open("quote") }; }
      else if (pay.state === "not_quoted" || pay.state === "quote_draft") { primary = { label: "Prepare & send quote", icon: Receipt, run: () => open("quote") }; secondary = { label: "Schedule consultation", run: () => open("consult") }; }
      else if (pay.state === "quote_sent") { primary = { label: "Accept on client's behalf", icon: CheckCircle2, run: () => { biz.acceptQuote(r.id, "staff"); toast("Quote accepted — invoice sent"); } }; secondary = { label: "Edit quote", run: () => open("quote") }; }
      else if (!paymentCleared(r, c)) { primary = { label: "Record payment", icon: CreditCard, run: () => open("payment") }; secondary = proceed; }
      else { primary = info.length ? { label: "Request information", icon: FilePlus2, run: () => open("info") } : { label: "Mark ready for processing", icon: ArrowRight, run: () => { biz.markReady(r.id); toast("Ready for Processing"); } }; secondary = info.length ? null : { label: "Request information first", run: () => open("info") }; }
      break;
    case "Awaiting Client Information":
      primary = info.length ? { label: "Remind client", icon: Send, run: () => { const k = biz.remind(r.id); toast(`Reminder sent (${k} open)`); } } : { label: "Mark ready for processing", icon: ArrowRight, run: () => { biz.markReady(r.id); toast("Ready for Processing"); } };
      secondary = info.length ? { label: "Review responses", run: () => go("client") } : { label: "Request more information", run: () => open("info") };
      break;
    case "Ready for Processing":
      if (BACKEND && r.clientId && !r.engagement) { primary = { label: "Record engagement letter acceptance", icon: CheckCircle2, run: () => document.getElementById("biz-engagement")?.querySelector("button")?.click() }; break; }
      primary = paymentCleared(r, c) ? { label: `Start work (${staffById(r.assignedTo).name})`, icon: Play, run: () => { biz.startWork(r.id); toast("In Progress"); } } : { label: "Record payment", icon: CreditCard, run: () => open("payment") };
      secondary = paymentCleared(r, c) ? null : proceed;
      break;
    case "In Progress":
      if (review.length) primary = { label: `Review ${review.length} deliverable${review.length > 1 ? "s" : ""}`, icon: ShieldCheck, run: () => go("documents") };
      else if (agency && !r.agency.some((a) => a.kind === "submitted")) primary = { label: "Record submission to agency", icon: Landmark, run: () => open("agency") };
      else if (!agency && !pending.length && r.deliverables.length) primary = { label: "Move to Approved", icon: ShieldCheck, run: () => { if (biz.internalApprove(r.id)) toast("Approved"); } };
      else primary = { label: "Upload deliverables", icon: UploadCloud, run: () => go("documents") };
      secondary = agency ? { label: "Upload deliverables", run: () => go("documents") } : { label: "Request information", run: () => open("info") };
      break;
    case "Submitted to Agency":
      primary = { label: "Record follow-up", icon: Landmark, run: () => open("agency-follow") };
      secondary = { label: "Record verified approval", run: () => open("agency-approve") };
      break;
    case "Awaiting Agency Response":
      primary = { label: "Record agency response", icon: ShieldCheck, run: () => open("agency-approve") };
      secondary = { label: "Record follow-up", run: () => open("agency-follow") };
      break;
    case "Approved":
      primary = approved.length ? { label: `Deliver ${approved.length} document${approved.length > 1 ? "s" : ""} to client`, icon: Send, run: () => { const k = biz.deliver(r.id); toast(`${k} delivered`); } } : { label: "Review deliverables", icon: ShieldCheck, run: () => go("documents") };
      secondary = { label: "Documents", run: () => go("documents") };
      break;
    case "Documents Delivered":
      primary = { label: "Approve completion", icon: ShieldCheck, run: () => open("completion") };
      break;
    case "On Hold":
      primary = { label: `Resume (${r.holdFrom ?? "In Progress"})`, icon: Play, run: () => { biz.resume(r.id); toast("Resumed"); } };
      break;
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="space-y-4 p-5 sm:p-6">
          <RequestStepper r={r} agency={agency} />
          <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${n.owner === "Client" ? "border-warning/40 bg-warning-soft/50" : n.owner === "Done" ? "border-success/30 bg-success-soft/40" : "border-accent/30 bg-accent-soft/40"}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Next step <OwnerBadge o={n.owner} /></div>
              <p className="mt-1 text-[14.5px] font-medium text-ink">{n.text}</p>
              {r.status === "On Hold" && <p className="text-[13px] text-ink-2">Paused from “{r.holdFrom}” — {r.holdReason}</p>}
              {r.status === "Cancelled" && <p className="text-[13px] text-ink-2">{r.cancelReason}</p>}
              {r.status === "Completed" && <p className="text-[13px] text-ink-2">Completed {r.completedAt ? fmtDate(r.completedAt) : ""}{r.approvedBy ? ` · approved by ${staffById(r.approvedBy).name}` : ""}{r.followUpAt ? ` · follow-up ${fmtDate(r.followUpAt)}` : ""}</p>}
              {r.paymentWaived && !isClosed(r) && pay.due > 0 && <p className="text-[12.5px] text-muted">Proceeding before payment: {r.paymentWaived}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {secondary && <Button onClick={secondary.run}>{secondary.label}</Button>}
              {primary && <Button variant="primary" icon={primary.icon} onClick={primary.run}>{primary.label}</Button>}
            </div>
          </div>
          {!r.clientId && r.prospect && (
            <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft/40 p-4">
              <p className="text-[13.5px] text-ink"><strong>{r.prospect.name}</strong> isn't an MKB client yet ({r.prospect.email}{r.prospect.phone ? ` · ${r.prospect.phone}` : ""}). Link this request to their existing record, or create one — never both.</p>
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Link to existing client" value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="h-9 min-w-[200px] rounded-lg border border-line bg-surface px-2 text-[13.5px] text-ink">
                  <option value="">Choose an existing client…</option>
                  {clientStore.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <Button size="sm" disabled={!linkTo} onClick={() => { biz.linkClient(r.id, linkTo); toast("Linked to the client record"); }}>Link</Button>
                <span className="text-[12.5px] text-muted">or</span>
                <Button size="sm" variant="primary" onClick={() => { biz.createClientFromProspect(r.id); toast("Client record created and linked"); }}>Create client record</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {r.clientId && <div id="biz-engagement"><EngagementCard r={r} /></div>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={ClipboardList} title="Request details" subtitle={`Requested ${fmtDate(r.createdAt)} via ${r.source}`} />
          <dl className="grid gap-x-6 gap-y-3 px-5 pb-5 text-[13.5px] sm:grid-cols-2 sm:px-6">
            {[
              ["Business", r.businessName],
              ["Structure · state", `${r.structure} · ${r.state}`],
              ["Requested service", r.serviceName],
              ["Type of work", svc ? NATURE[svc.nature].label : "—"],
              ["Preferred completion", r.preferredDate ? fmtDate(r.preferredDate) : "—"],
              ["Consultation", r.consultation ? `${r.consultation.status === "scheduled" ? "Scheduled" : "Held"} · ${fmtDateTime(r.consultation.at)}` : "Not scheduled"],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-[12px] text-muted">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>
            ))}
            <div className="sm:col-span-2"><dt className="text-[12px] text-muted">What the client needs</dt><dd className="whitespace-pre-wrap text-ink-2">{r.description}</dd></div>
          </dl>
          {svc && <div className="px-5 pb-5 sm:px-6"><p className="text-[12.5px] text-muted">{NATURE[svc.nature].note}</p></div>}
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={UserRound} title="Waiting on the client" subtitle={info.length ? `${info.length} open` : "Nothing outstanding"} action={<Button size="sm" variant="ghost" onClick={() => go("client")}>Open</Button>} />
            <ul className="px-5 pb-4 sm:px-6">
              {r.info.length === 0 && <li className="py-2 text-[13px] text-muted">No information requested yet.</li>}
              {r.info.slice(0, 5).map((i) => <li key={i.id} className="flex items-center gap-2 py-1 text-[13.5px]">{i.status === "open" ? <CircleDot size={14} className="text-warning" /> : <CheckCircle2 size={14} className="text-success" />}<span className={`flex-1 ${i.status === "open" ? "text-ink" : "text-muted"}`}>{i.label}</span><span className="text-[12px] text-muted">{i.status === "open" ? "Open" : i.status === "responded" ? "Responded" : "Accepted"}</span></li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={FileText} title="Deliverables" subtitle={`${r.deliverables.filter((d) => d.status === "delivered").length} of ${r.deliverables.length} delivered`} action={<Button size="sm" variant="ghost" onClick={() => go("documents")}>Open</Button>} />
            <ul className="px-5 pb-4 sm:px-6">
              {r.deliverables.length === 0 && <li className="py-2 text-[13px] text-muted">No deliverables defined.</li>}
              {r.deliverables.map((d) => <li key={d.id} className="flex items-center gap-2 py-1 text-[13.5px]"><span className="flex-1 text-ink-2">{d.name}</span><Badge tone={DELIVERABLE_META[d.status].tone}>{DELIVERABLE_META[d.status].label}</Badge></li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={Receipt} title="Quote & payment" action={<PayBadge s={pay.state} />} />
            <div className="px-5 pb-5 sm:px-6">{r.quote.lines.length ? <FeeBreakdown lines={r.quote.lines} /> : <p className="text-[13px] text-muted">Not quoted yet.</p>}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */

function FormationTab({ r, f, go }: { r: ServiceRequest; f: FormationDetails; go: (t: Tab) => void }) {
  const biz = useBiz();
  const toast = useToast();
  const [v, setV] = useState<FormationDetails>(structuredClone(f));
  const [alt, setAlt] = useState("");
  useEffect(() => setV(structuredClone(f)), [f]);
  const pct = v.owners.reduce((s, o) => s + (Number(o.pct) || 0), 0);
  const dirty = JSON.stringify(v) !== JSON.stringify(f);
  const errs = [
    !v.proposedName.trim() && "Proposed name is required",
    v.owners.length > 0 && pct !== 100 && `Ownership adds up to ${pct}% (should be 100%)`,
    v.owners.some((o) => !o.name.trim()) && "Every owner needs a name",
    v.organizer.email && !/^\S+@\S+\.\S+$/.test(v.organizer.email) && "Organizer email looks invalid",
  ].filter(Boolean) as string[];
  const locked = isClosed(r);
  const save = () => {
    const { stateFiling: _s, confirmationNumber: _c, confirmationVerified: _v, confirmationDocId: _d, docsDelivered: _dd, completedAt: _ca, ...editable } = v;
    biz.updateFormation(r.id, { ...editable, proposedName: v.proposedName.trim() });
    toast("Formation details saved");
  };
  const agent = v.agent ?? { type: "mkb_coordinated" as const, name: "", address: "" };
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={Building2} title="Filing status" subtitle="Updated only from the agency log — never assumed" action={<Button size="sm" variant="ghost" onClick={() => go("agency")}>Agency log</Button>} />
        <dl className="grid gap-x-6 gap-y-3 px-5 pb-5 text-[13.5px] sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
          <div><dt className="text-[12px] text-muted">State filing</dt><dd><Badge tone={f.stateFiling === "approved" ? "success" : f.stateFiling === "rejected" ? "danger" : f.stateFiling === "not_submitted" ? "neutral" : "info"}>{STATE_FILING[f.stateFiling]}</Badge></dd></div>
          <div><dt className="text-[12px] text-muted">Filing confirmation</dt><dd className="font-medium text-ink">{f.confirmationNumber ? <>{f.confirmationNumber} {f.confirmationVerified && <Badge tone="success" icon={ShieldCheck}>Verified</Badge>}</> : "Not yet — recorded once verified with the agency"}</dd></div>
          <div><dt className="text-[12px] text-muted">Formation documents delivered</dt><dd className="font-medium text-ink">{f.docsDelivered ? "Yes" : "Not yet"}</dd></div>
          <div><dt className="text-[12px] text-muted">Completion date</dt><dd className="font-medium text-ink">{f.completedAt ? fmtDate(f.completedAt) : "—"}</dd></div>
        </dl>
      </Card>
      <Card>
        <CardHeader icon={ClipboardList} title="Formation details" subtitle="Collected from the client — MKB prepares the filing from this information" action={!locked && <Button size="sm" variant="primary" disabled={!dirty || errs.length > 0} onClick={save}>Save changes</Button>} />
        <fieldset disabled={locked} className="space-y-5 px-5 pb-6 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            <TextField id="fm-name" label="Proposed business name" required value={v.proposedName} onChange={(e) => setV({ ...v, proposedName: e.target.value })} />
            <SelectField id="fm-state" label="State of formation" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} options={stateOptions()} />
            <SelectField id="fm-structure" label="Business structure" value={v.structure} onChange={(e) => setV({ ...v, structure: e.target.value as EntityType })} options={ENTITY_TYPES.map((t) => [t, t])} />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Alternate names</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {v.alternates.length === 0 && <span className="text-[13px] text-muted">None yet.</span>}
              {v.alternates.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] text-ink-2">{a}<button type="button" aria-label={`Remove ${a}`} onClick={() => setV({ ...v, alternates: v.alternates.filter((_, j) => j !== i) })} className="text-muted hover:text-danger"><XCircle size={13} /></button></span>)}
              <input aria-label="Add alternate name" value={alt} onChange={(e) => setAlt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && alt.trim()) { e.preventDefault(); setV({ ...v, alternates: [...v.alternates, alt.trim()] }); setAlt(""); } }} placeholder="Add alternate…" className="h-8 w-48 rounded-full border border-line bg-surface px-3 text-[12.5px] text-ink" />
              <Button size="sm" variant="ghost" disabled={!alt.trim()} onClick={() => { setV({ ...v, alternates: [...v.alternates, alt.trim()] }); setAlt(""); }}>Add</Button>
            </div>
          </div>
          <TextArea id="fm-purpose" label="Business purpose" value={v.purpose} onChange={(e) => setV({ ...v, purpose: e.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <TextField id="fm-addr" label="Business address" value={v.businessAddress} onChange={(e) => setV({ ...v, businessAddress: e.target.value })} />
            <TextField id="fm-loc" label="Principal business location" value={v.principalLocation} onChange={(e) => setV({ ...v, principalLocation: e.target.value })} />
          </div>
          <div>
            <h3 className="mb-2 text-[13.5px] font-bold text-ink">Responsible party / organizer</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <TextField id="fm-org-name" label="Name" value={v.organizer.name} onChange={(e) => setV({ ...v, organizer: { ...v.organizer, name: e.target.value } })} />
              <TextField id="fm-org-title" label="Title" value={v.organizer.title ?? ""} onChange={(e) => setV({ ...v, organizer: { ...v.organizer, title: e.target.value } })} />
              <TextField id="fm-org-email" label="Email" type="email" value={v.organizer.email ?? ""} onChange={(e) => setV({ ...v, organizer: { ...v.organizer, email: e.target.value } })} />
              <TextField id="fm-org-phone" label="Phone" type="tel" value={v.organizer.phone ?? ""} onChange={(e) => setV({ ...v, organizer: { ...v.organizer, phone: e.target.value } })} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted"><Lock size={12} /> SSN/ITIN for the EIN application is collected through the secure identifier vault on the client record — never in this form.</p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[13.5px] font-bold text-ink">Ownership</h3><span className={`text-[12.5px] font-semibold ${v.owners.length && pct !== 100 ? "text-danger-ink" : "text-muted"}`}>Total {pct}%</span></div>
            <ul className="space-y-2">
              {v.owners.map((o, i) => (
                <li key={o.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.4fr_1fr_100px_auto]">
                  <input aria-label={`Owner ${i + 1} name`} value={o.name} onChange={(e) => setV({ ...v, owners: v.owners.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)) })} placeholder="Name" className="col-span-2 h-9 rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink sm:col-span-1" />
                  <input aria-label={`Owner ${i + 1} role`} value={o.role} onChange={(e) => setV({ ...v, owners: v.owners.map((x) => (x.id === o.id ? { ...x, role: e.target.value } : x)) })} placeholder="Role" className="h-9 rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink" />
                  <input aria-label={`Owner ${i + 1} percent`} type="number" min={0} max={100} value={o.pct} onChange={(e) => setV({ ...v, owners: v.owners.map((x) => (x.id === o.id ? { ...x, pct: Number(e.target.value) } : x)) })} className="h-9 rounded-lg border border-line bg-surface px-2.5 text-right text-[13.5px] tabular-nums text-ink" />
                  <button type="button" aria-label={`Remove owner ${i + 1}`} onClick={() => setV({ ...v, owners: v.owners.filter((x) => x.id !== o.id) })} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => setV({ ...v, owners: [...v.owners, { id: `o-${Date.now()}`, name: "", role: "Member", pct: Math.max(0, 100 - pct) }] })}>Add owner</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField id="fm-ra" label="Registered agent" value={v.agent ? agent.type : "none"} onChange={(e) => setV({ ...v, agent: e.target.value === "none" ? undefined : { ...agent, type: e.target.value as typeof agent.type } })} options={[["none", "Not chosen yet"], ...Object.entries(AGENT_TYPE).map(([k, x]) => [k, x] as [string, string])]} />
            {v.agent && <TextField id="fm-ra-name" label="Agent name" value={agent.name} onChange={(e) => setV({ ...v, agent: { ...agent, name: e.target.value } })} />}
            {v.agent && <TextField id="fm-ra-addr" label="Agent address" value={agent.address} onChange={(e) => setV({ ...v, agent: { ...agent, address: e.target.value } })} />}
          </div>
          <SelectField id="fm-ein" label="EIN assistance status" value={v.einStatus} onChange={(e) => setV({ ...v, einStatus: e.target.value as EinStatus })} options={Object.entries(EIN_STATUS).map(([k, x]) => [k, x] as [string, string])} />
          {errs.length > 0 && <p className="text-[12.5px] text-danger-ink" role="alert">{errs.join(" · ")}</p>}
        </fieldset>
      </Card>
    </div>
  );
}

/* ================================================================== */

function ClientTab({ r, c, open }: { r: ServiceRequest; c?: Client; open: (d: Dlg) => void }) {
  const biz = useBiz();
  const clientStore = useClients();
  const toast = useToast();
  const [responding, setResponding] = useState<InfoRequest | null>(null);
  const [again, setAgain] = useState<InfoRequest | null>(null);
  const [msg, setMsg] = useState("");
  const msgs = requestMessages(r, c);
  const docs = requestDocs(r, c);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader icon={UserRound} title="Information requested from the client" subtitle="Shown in the client portal under “What we need from you”" action={<Button size="sm" variant="primary" icon={FilePlus2} disabled={!c || isClosed(r)} onClick={() => open("info")}>Request information</Button>} />
        <ul className="divide-y divide-line border-t border-line">
          {r.info.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">{c ? "Nothing requested yet." : "Link the prospect to a client record first."}</li>}
          {r.info.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5 sm:px-6">
              {i.status === "open" ? <CircleDot size={18} className="mt-0.5 shrink-0 text-warning" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />}
              <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                <div className="text-[14px] font-medium text-ink">{i.label} {i.file && <span className="text-[12px] text-muted">· file</span>}</div>
                {i.detail && <div className="text-[13px] text-ink-2">{i.detail}</div>}
                {i.response && <div className="mt-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink-2 ring-1 ring-line">“{i.response}”</div>}
                {i.docIds.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{i.docIds.map((d) => { const doc = docs.find((x) => x.id === d); return doc ? <span key={d} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] ${doc.status === "requested" ? "border border-dashed border-line-strong text-muted" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}><FileText size={12} /> {doc.name}{doc.status === "requested" ? " (awaiting upload)" : ""}</span> : null; })}</div>}
                <div className="text-[12px] text-muted">Requested {relTime(i.createdAt)}{i.respondedAt ? ` · responded ${relTime(i.respondedAt)}` : ""}</div>
              </div>
              <Badge tone={i.status === "open" ? "warning" : i.status === "responded" ? "info" : "success"}>{i.status === "open" ? "Open" : i.status === "responded" ? "Responded" : "Accepted"}</Badge>
              <div className="flex gap-1.5">
                {i.status === "open" && <Button size="sm" variant="ghost" onClick={() => setResponding(i)}>Record response</Button>}
                {i.status === "responded" && <><Button size="sm" variant="ghost" onClick={() => setAgain(i)}>Ask again</Button><Button size="sm" onClick={() => { biz.acceptInfo(r.id, i.id); toast("Accepted"); }}>Accept</Button></>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={MessageSquare} title="Messages about this request" subtitle="Visible to the client in their portal" action={<Badge tone="info" icon={Eye}>Client can see</Badge>} />
        <div className="scrollbar-thin max-h-[380px] space-y-2.5 overflow-y-auto border-y border-line bg-surface-2 px-4 py-3 sm:px-5">
          {msgs.length === 0 && <p className="py-4 text-center text-[13px] text-muted">No messages yet.</p>}
          {msgs.map((x) => (
            <div key={x.id} className={`flex ${x.from === "staff" ? "justify-end" : ""}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13.5px] ${x.from === "staff" ? "rounded-tr-md bg-accent text-white" : "rounded-tl-md border border-line bg-surface text-ink"}`}>
                {x.body}
                <div className={`mt-0.5 text-[11px] ${x.from === "staff" ? "text-white/80" : "text-muted"}`}>{x.author} · {fmtDateTime(x.at)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 p-4 sm:px-5">
          <input aria-label="Message to client" disabled={!c} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={c ? `Message ${c.contactName ?? c.name}…` : "Link a client record to send messages"} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
          <Button variant="primary" icon={Send} disabled={!msg.trim() || !c} onClick={() => { clientStore.sendMessage(c!.id, msg.trim(), "biz", { bizRequestId: r.id, author: staffById(r.assignedTo).name }); setMsg(""); toast("Message sent to client"); }}>Send</Button>
        </div>
      </Card>
      <RespondDialog r={r} item={responding} by="staff" onClose={() => setResponding(null)} />
      <AskAgainDialog r={r} item={again} onClose={() => setAgain(null)} />
    </div>
  );
}

/* ================================================================== */

function WorkTab({ r }: { r: ServiceRequest }) {
  const biz = useBiz();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [who, setWho] = useState(r.assignedTo);
  const [note, setNote] = useState("");
  const tasks = [...r.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader icon={ListChecks} title="Internal tasks" subtitle={`${r.tasks.filter((t) => !t.done).length} open · MKB only`} />
        <ul className="divide-y divide-line border-t border-line">
          {tasks.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No tasks yet.</li>}
          {tasks.map((t) => {
            const late = !t.done && t.dueAt && t.dueAt < SAMPLE_NOW.toISOString();
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <input type="checkbox" aria-label={`Done: ${t.title}`} checked={t.done} onChange={() => biz.toggleTask(r.id, t.id)} className="h-4 w-4 accent-[var(--accent)]" />
                <div className="min-w-0 flex-1"><div className={`text-[14px] ${t.done ? "text-muted line-through" : "text-ink"}`}>{t.title}</div><div className={`text-[12px] ${late ? "font-semibold text-danger-ink" : "text-muted"}`}>{staffById(t.assigneeId).name}{t.dueAt ? ` · due ${fmtDate(t.dueAt, { month: "short", day: "numeric" })}` : ""}{t.done && t.doneAt ? ` · done ${relTime(t.doneAt)}` : ""}</div></div>
                <Avatar name={staffById(t.assigneeId).name} size={26} />
              </li>
            );
          })}
        </ul>
        <form className="grid gap-2 border-t border-line p-4 sm:grid-cols-[1fr_150px_150px_auto] sm:px-6" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; biz.addTask(r.id, { title: title.trim(), dueAt: due ? new Date(`${due}T17:00`).toISOString() : undefined, assigneeId: who }); setTitle(""); setDue(""); toast("Task added"); }}>
          <input aria-label="New task" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task…" className="h-10 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
          <input aria-label="Task due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2 text-[13.5px] text-ink" />
          <select aria-label="Task assignee" value={who} onChange={(e) => setWho(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2 text-[13.5px] text-ink">{staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <Button type="submit" icon={Plus} disabled={!title.trim()}>Add</Button>
        </form>
      </Card>
      <Card>
        <CardHeader icon={Lock} title="Internal notes" subtitle="MKB only — never shown to the client" action={<Badge tone="neutral" icon={Lock}>Internal</Badge>} />
        <div className="mx-5 mb-3 flex gap-2 sm:mx-6">
          <input aria-label="Internal note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-line-strong bg-surface-2 px-3 text-[14px] text-ink" />
          <Button disabled={!note.trim()} onClick={() => { biz.addNote(r.id, note.trim()); setNote(""); toast("Internal note added"); }}>Add</Button>
        </div>
        <ul className="space-y-2 px-5 pb-5 sm:px-6">
          {r.notes.length === 0 && <li className="py-4 text-center text-[13px] text-muted">No internal notes.</li>}
          {r.notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-dashed border-line-strong bg-surface-2 p-3 text-[13.5px]">
              <p className="text-ink-2">{n.body}</p>
              <p className="mt-1 text-[12px] text-muted">{staffById(n.authorId).name} · {relTime(n.at)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ================================================================== */

function AgencyTab({ r, c, open }: { r: ServiceRequest; c?: Client; open: (d: Dlg) => void }) {
  const docs = requestDocs(r, c);
  return (
    <Card>
      <CardHeader icon={Landmark} title="Agency log" subtitle="Submissions, follow-ups and responses. MKB files outside this app — this log records what happened." action={<Button size="sm" variant="primary" icon={Plus} disabled={isClosed(r) || r.status === "On Hold"} onClick={() => open("agency")}>Record activity</Button>} />
      <p className="mx-5 mb-3 flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2 sm:mx-6"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-muted" /> “Approved” is only recorded with a confirmation number, a confirmation file and a staff member's attestation that they verified it with the agency.</p>
      <ol className="relative mx-5 mb-5 space-y-4 border-l-2 border-line pl-5 sm:mx-6">
        {r.agency.length === 0 && <li className="text-[13.5px] text-muted">Nothing recorded yet.</li>}
        {[...r.agency].reverse().map((a) => {
          const doc = docs.find((d) => d.id === a.confirmationDocId);
          return (
            <li key={a.id} className="relative">
              <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-surface ${a.kind === "approved" ? "bg-success" : a.kind === "rejected" ? "bg-danger" : "bg-accent"}`} />
              <div className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-semibold text-ink">{AGENCY_KIND[a.kind]}</span>{a.verified && <Badge tone="success" icon={ShieldCheck}>Verified</Badge>}</div>
              <div className="text-[12.5px] text-muted">{a.agency} · {fmtDate(a.at)} · {staffById(a.byId).name}{a.reference ? ` · ref ${a.reference}` : ""}</div>
              {a.note && <p className="mt-1 text-[13.5px] text-ink-2">{a.note}</p>}
              {doc && <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[12px] text-ink-2 ring-1 ring-line"><FileText size={12} /> {doc.name}</span>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ================================================================== */

function DocsTab({ r, c, open }: { r: ServiceRequest; c?: Client; open: (d: Dlg) => void }) {
  const biz = useBiz();
  const clientStore = useClients();
  const toast = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cat, setCat] = useState<DocCategory>("Completed deliverable");
  const docs = requestDocs(r, c).sort((a, b) => (b.uploadedAt ?? b.requestedAt).localeCompare(a.uploadedAt ?? a.requestedAt));
  const approved = r.deliverables.filter((d) => d.status === "approved").length;
  const closed = isClosed(r);
  const agencyFirst = (biz.catalog.find((s) => s.id === r.serviceId)?.agency ?? false) && !["Approved", "Documents Delivered"].includes(r.status);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          icon={ShieldCheck}
          title="Deliverables"
          subtitle={`Prepared by ${staffById(r.assignedTo).name} · reviewed by ${staffById(r.reviewerId).name} before delivery`}
          action={<Button size="sm" variant="primary" icon={Send} disabled={!approved || closed || agencyFirst} title={agencyFirst ? "Agency work is delivered after the approval is verified" : undefined} onClick={() => { const k = biz.deliver(r.id); toast(`${k} delivered to the client portal`); }}>Deliver {approved || ""} approved</Button>}
        />
        <ul className="divide-y divide-line border-t border-line">
          {r.deliverables.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No deliverables yet.</li>}
          {r.deliverables.map((d) => {
            const doc = docs.find((x) => x.id === d.docId);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${doc ? "bg-surface-2 text-ink-2 ring-1 ring-line" : "border-2 border-dashed border-line-strong text-faint"}`}><FileText size={16} /></span>
                <div className="min-w-0 flex-1 basis-[50%] sm:basis-auto">
                  <div className="text-[14px] font-medium text-ink">{d.name}</div>
                  <div className="text-[12px] text-muted">{d.category}{doc?.uploadedAt ? ` · uploaded ${relTime(doc.uploadedAt)}` : ""}{d.reviewedBy ? ` · approved by ${staffById(d.reviewedBy).name}` : ""}{d.deliveredAt ? ` · delivered ${fmtDate(d.deliveredAt)}` : ""}</div>
                </div>
                <Badge tone={DELIVERABLE_META[d.status].tone}>{DELIVERABLE_META[d.status].label}</Badge>
                {!closed && (
                  <div className="flex flex-wrap gap-1.5">
                    {d.status === "pending" && <Button size="sm" icon={UploadCloud} disabled={!c} onClick={() => setUploading(d.id)}>Upload</Button>}
                    {d.status === "ready_for_review" && <><Button size="sm" variant="ghost" onClick={() => { biz.reviewDeliverable(r.id, d.id, false, r.reviewerId); toast("Sent back for changes"); }}>Send back</Button><Button size="sm" variant="primary" icon={ShieldCheck} onClick={() => { biz.reviewDeliverable(r.id, d.id, true, r.reviewerId); toast(`Approved by ${staffById(r.reviewerId).name}`); }}>Approve</Button></>}
                  </div>
                )}
                {doc && <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${d.name}`} onClick={() => { clientStore.logDocumentAccess(c!.id, doc.id, "Downloaded"); downloadPlaceholder(d.name); }} />}
              </li>
            );
          })}
        </ul>
        {!closed && (
          <form className="flex flex-wrap gap-2 border-t border-line p-4 sm:px-6" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; biz.addDeliverable(r.id, name.trim(), cat); setName(""); toast("Deliverable added"); }}>
            <input aria-label="New deliverable" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a deliverable…" className="h-10 min-w-[200px] flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
            <select aria-label="Deliverable category" value={cat} onChange={(e) => setCat(e.target.value as DocCategory)} className="h-10 rounded-xl border border-line bg-surface px-2 text-[13.5px] text-ink">{DOC_CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <Button type="submit" icon={Plus} disabled={!name.trim()}>Add</Button>
          </form>
        )}
      </Card>
      <Card>
        <CardHeader icon={FolderOpen} title="All documents for this request" subtitle="Stored on the client's record, tagged to this business and request" action={<Button size="sm" icon={UploadCloud} disabled={!c} onClick={() => open("upload")}>Upload</Button>} />
        <ul className="divide-y divide-line border-t border-line">
          {docs.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No documents yet.</li>}
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${d.status === "requested" ? "border-2 border-dashed border-line-strong text-faint" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}><FileText size={16} /></span>
              <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                <div className="text-[13.5px] font-medium text-ink">{d.name}</div>
                <div className="text-[12px] text-muted">{d.category} · {d.uploadedAt ? `${d.uploadedBy === "client" ? "client" : "MKB"} · ${fmtDate(d.uploadedAt)}${d.sizeKb ? ` · ${fileSize(d.sizeKb)}` : ""}` : `requested ${relTime(d.requestedAt)}`}{d.expiresAt ? ` · expires ${fmtDate(d.expiresAt)}` : ""}</div>
              </div>
              {d.status === "requested" ? <Badge tone="warning">Requested</Badge> : d.deliveredAt ? <Badge tone="success">Delivered</Badge> : <Badge tone="neutral">On file</Badge>}
              {d.status !== "requested" && <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${d.name}`} onClick={() => { clientStore.logDocumentAccess(c!.id, d.id, "Downloaded"); downloadPlaceholder(d.name); }} />}
            </li>
          ))}
        </ul>
      </Card>
      <DeliverableDialog r={r} delId={uploading} onClose={() => setUploading(null)} />
    </div>
  );
}

/* ================================================================== */

function BillingTab({ r, c, open }: { r: ServiceRequest; c?: Client; open: (d: Dlg) => void }) {
  const biz = useBiz();
  const toast = useToast();
  const inv = requestInvoices(r, c).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const pay = payState(r, c);
  const mkb = inv.flatMap((i) => i.lines ?? []).filter((l) => l.kind === "service" || l.kind === "additional" || l.kind === "discount").reduce((s, l) => s + l.amount, 0);
  const pass = inv.flatMap((i) => i.lines ?? []).filter((l) => l.kind === "filing" || l.kind === "third_party").reduce((s, l) => s + l.amount, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["MKB service fees billed", money(mkb), ""], ["Government & third-party fees billed", money(pass), ""], ["Paid", money(pay.paid), "text-success-ink"], ["Balance due", money(pay.due), pay.due > 0 ? "text-danger-ink" : "text-faint"]].map(([k, v, cls]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4 shadow-soft"><div className="text-[12px] text-muted">{k}</div><div className={`text-[20px] font-bold tabular-nums ${cls || "text-ink"}`}>{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader icon={Receipt} title="Quote" subtitle={r.quote.status === "accepted" ? `Accepted ${r.quote.acceptedAt ? fmtDate(r.quote.acceptedAt) : ""}` : r.quote.status === "sent" ? `Sent ${r.quote.sentAt ? relTime(r.quote.sentAt) : ""} — awaiting the client` : r.quote.status === "declined" ? "Declined" : "Draft — not sent"} action={<Button size="sm" onClick={() => open("quote")}>{r.quote.status === "accepted" ? "View" : "Edit"}</Button>} />
          <div className="px-5 pb-5 sm:px-6">
            {r.quote.lines.length ? <FeeBreakdown lines={r.quote.lines} /> : <p className="text-[13px] text-muted">No quote yet.</p>}
            {r.quote.note && <p className="mt-3 text-[12.5px] text-muted">Note: {r.quote.note}</p>}
            {r.quote.status === "sent" && c && <Button className="mt-4" variant="primary" icon={CheckCircle2} onClick={() => { biz.acceptQuote(r.id, "staff"); toast("Quote accepted — invoice sent"); }}>Accept on client's behalf</Button>}
          </div>
        </Card>
        <Card>
          <CardHeader
            icon={CreditCard}
            title="Invoices & payments"
            subtitle="Invoices live on the client record"
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={Plus} disabled={!c || r.status === "Cancelled"} onClick={() => open("charge")}>Additional charge</Button>
                <Button size="sm" disabled={!inv.length} onClick={() => open("adjust")}>Refund / adjust</Button>
                <Button size="sm" variant="primary" icon={CreditCard} disabled={pay.due <= 0} onClick={() => open("payment")}>Record payment</Button>
              </div>
            }
          />
          <ul className="divide-y divide-line border-t border-line">
            {inv.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No invoices yet — accepting the quote issues one.</li>}
            {inv.map((i) => (
              <li key={i.id} className="space-y-2 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold text-ink">{i.number}</span>
                  <Badge tone={i.status === "paid" ? "success" : i.status === "overdue" ? "danger" : i.status === "partial" ? "warning" : "info"}>{i.status === "paid" ? "Paid" : i.status === "overdue" ? "Overdue" : i.status === "partial" ? "Partially paid" : i.status === "draft" ? "Draft" : "Open"}</Badge>
                  <span className="ml-auto text-[13px] tabular-nums text-ink-2">{usd(i.paid, 2)} of {usd(i.amount, 2)} paid</span>
                </div>
                <div className="text-[12px] text-muted">Issued {fmtDate(i.issuedAt)} · due {fmtDate(i.dueAt)}{i.paidAt ? ` · paid in full ${fmtDate(i.paidAt)}` : ""}</div>
                {i.lines && i.lines.length > 0 && <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-line"><FeeBreakdown lines={i.lines} /></div>}
                {i.adjustments && i.adjustments.length > 0 && (
                  <ul className="space-y-1">
                    {i.adjustments.map((a) => <li key={a.id} className="flex items-center gap-2 text-[12.5px] text-ink-2"><RotateCcw size={13} className="text-muted" /> <span className="capitalize">{a.kind}</span> {usd(a.amount, 2)} — {a.note} <span className="text-muted">· {fmtDate(a.at)} · {staffById(a.byId).name}</span></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== */

function HistoryTab({ r }: { r: ServiceRequest }) {
  return (
    <Card>
      <CardHeader icon={ActivityIcon} title="Status history" subtitle="Every status change and update, newest first" />
      <ol className="relative mx-5 mb-5 space-y-3 border-l-2 border-line pl-5 sm:mx-6">
        {[...r.history].reverse().map((h, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-accent ring-4 ring-surface" />
            <div className="flex flex-wrap items-center gap-2"><StatusBadge s={h.status} /><span className="text-[12.5px] text-muted">{fmtDateTime(h.at)} · {h.byId === "client" ? "Client" : staffById(h.byId)?.name ?? h.byId}</span></div>
            {h.note && <p className="mt-0.5 text-[13.5px] text-ink-2">{h.note}</p>}
          </li>
        ))}
      </ol>
      <div className="border-t border-line p-5 sm:px-6"><NotLegalAdvice compact /></div>
    </Card>
  );
}

export { Checkbox };
