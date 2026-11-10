"use client";

import Link from "next/link";
import { useClientGate } from "@/components/team/AccessGuard";
import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileUp,
  FolderOpen,
  Lock,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Menu } from "@/components/ui/Menu";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { Sensitive, Timeline } from "@/components/crm/ProfileTabs";
import { PaymentDialog, downloadPlaceholder } from "@/components/crm/dialogs";
import { STAFF, staffById, staffList } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { billing, effectiveDue, isPastDue, itemStatus, outstandingItems, useTax, type ItemStatus } from "@/lib/store/tax-store";
import { FILING_STATUSES, FORM_LABEL, ORGANIZERS, STATUS_META, STATUS_PATH, dueDates, priceTotal, type FilingStatus, type TaxReturn } from "@/lib/tax/config";
import { fmtDate, fmtDateTime, relTime, usd } from "@/lib/format";
import { formatPhone, maskDOB, maskEIN, maskTaxId } from "@/lib/validation";
import type { Client } from "@/lib/types";
import { InterviewTab } from "./InterviewTab";
import { InvoiceEditor } from "@/components/billing/BillingPage";
import { BACKEND } from "@/lib/sync/remote";
import { DueDiligenceCard, ExtensionCard, ExtensionDialog, FinalApprovalCard } from "./ReviewParts";
import { ddComplete } from "@/lib/tax/due-diligence";
import { useTeam } from "@/lib/store/team-store";
import { useRouter } from "next/navigation";
import { AccessPreviewBar, DueChip, NoAccess, ReturnStatusBadge } from "./TaxBits";
import { AckDialog, AddItemDialog, AddLineDialog, ResolveDialog, SignOffDialog, StatusDialog, TaxInvoiceDialog, TransmitDialog, WaiveDialog } from "./TaxDialogs";

const TABS = [
  { key: "overview", label: "Overview", icon: ClipboardList },
  { key: "organizer", label: "Interview", icon: NotebookPen },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "review", label: "Review & approval", icon: ShieldCheck },
  { key: "efile", label: "E-file", icon: Send },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "activity", label: "Activity", icon: ActivityIcon },
] as const;
type Tab = (typeof TABS)[number]["key"];
type Dlg = "signoff" | "extension" | "transmit" | "resolve" | "status" | "additem" | "addline" | "invoice" | "payment" | null;

export function ReturnDetail({ id }: { id: string }) {
  const tax = useTax();
  const team = useTeam();
  const router = useRouter();
  const { clients } = useClients();
  const toast = useToast();
  const r = tax.returns.find((x) => x.id === id);
  const client = clients.find((c) => c.id === r?.clientId);
  const [tab, setTab] = useState<Tab>("overview");
  const [dlg, setDlg] = useState<Dlg>(null);
  const [ackId, setAckId] = useState<string | null>(null);
  const [waiveId, setWaiveId] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some((t) => t.key === h)) setTab(h);
    };
    read();
    // A bell link to another tab of this same return.
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  const gate = useClientGate(r?.clientId, "this tax return");
  if (gate) return gate;
  if ((!r || !client) && !tax.ready) return <div className="grid min-h-[50vh] place-items-center text-[14px] text-muted" role="status">Loading…</div>;
  if (!r || !client)
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <h1 className="text-[20px] font-bold text-ink">Return not found</h1>
          <p className="mt-1 text-[14px] text-muted">It doesn&rsquo;t exist, or isn&rsquo;t available to you.</p>
          <Link href="/services/tax-preparation" className="mt-4 inline-block text-[14px] font-semibold text-accent">Back to Tax Center</Link>
        </div>
      </div>
    );

  const A = tax.access;
  const out = outstandingItems(r, client);
  const b = billing(r, client);
  const otherYears = tax.returns.filter((x) => x.clientId === r.clientId && x.id !== r.id).sort((p, q) => q.taxYear - p.taxYear);
  const sig = r.approvalSignatureId ? client.signatures.find((s) => s.id === r.approvalSignatureId) : undefined;

  /* ---------------- Guided next step ---------------- */
  const next = (() => {
    const s = r.status;
    if (r.extensionOnly && !r.extension)
      return { text: "Extension only: file the extension in the tax software, then record it here.", primary: { label: "File extension", icon: Send, run: () => setDlg("extension"), can: A.edit } };
    if (r.extensionOnly)
      return { text: `Extension filed — new due date ${fmtDate(r.extension!.dueAt)}. Start the full return when the client is ready.`, primary: { label: "Start full return", icon: ArrowRight, run: () => { tax.startFullReturn(r.id); toast("Full return started"); }, can: A.edit } };
    if (s === "Intake")
      return { text: "Send the tax interview to the client portal. Documents are requested automatically once they submit it, based on their answers.", primary: { label: "Send interview to portal", icon: Send, run: () => { tax.sendOrganizer(r.id); toast("Interview sent to the client portal — documents are requested when they submit it"); }, can: A.edit }, secondary: { label: "Fill interview with client", run: () => go("organizer"), can: A.edit } };
    if (s === "Awaiting Documents")
      return out.length
        ? { text: `${out.length} required document${out.length > 1 ? "s" : ""} still outstanding.`, primary: { label: "Remind client", icon: Send, run: () => { const n = tax.remindAll(r.id) + tax.requestAllMissing(r.id); toast(n ? "Client reminded" : "Nothing to remind — mark items received on the Documents tab"); }, can: A.edit }, secondary: { label: "Mark ready anyway", run: () => { if (confirm(`${out.length} required documents are outstanding. Move to Ready for Review anyway?`)) { tax.markReadyForReview(r.id, `override — ${out.length} documents outstanding`); toast("Moved to Ready for Review"); } }, can: A.edit } }
        : { text: "All required documents are in.", primary: { label: "Mark ready for review", icon: FileCheck2, run: () => { tax.markReadyForReview(r.id); toast("Ready for Review"); }, can: A.edit } };
    if (s === "Ready for Review") return { text: `Documents are in. ${staffById(r.preparerId).name} reviews them and starts the return.`, primary: { label: "Start preparation", icon: ArrowRight, run: () => { tax.startPreparation(r.id); toast("In Preparation"); }, can: A.edit } };
    if (s === "In Preparation" && r.kind === "individual" && !r.reviewSignoff && !ddComplete(r.dueDiligence))
      return { text: "Complete the due diligence checklist (or mark it not applicable) before the reviewer signs off.", primary: { label: "Due diligence", icon: ShieldCheck, run: () => go("review"), can: A.edit } };
    if (s === "Awaiting Final Approval")
      return team.myRole?.isOwner
        ? { text: "The client approved and signed. Your final approval unlocks e-filing.", primary: { label: "Review & approve", icon: ShieldCheck, run: () => go("review"), can: true } }
        : { text: "Waiting for the Owner's final approval before e-filing.", primary: null };
    if (s === "In Preparation")
      return r.reviewSignoff
        ? { text: `Reviewed by ${staffById(r.reviewSignoff.by).name}. Send the return and e-file authorization to the client.`, primary: { label: "Send for client approval", icon: Send, run: () => { tax.sendForApproval(r.id); toast("Sent for client approval — signature request on the client profile"); }, can: A.edit } }
        : { text: `Needs reviewer sign-off from ${staffById(r.reviewerId).name} before the client sees it.`, primary: { label: "Reviewer sign-off", icon: ShieldCheck, run: () => setDlg("signoff"), can: A.review } };
    if (s === "Awaiting Client Approval") return { text: `Waiting for the client to approve and sign ${sig?.document ?? "the e-file authorization"}.`, primary: { label: "Record client approval", icon: CheckCircle2, run: () => { tax.recordApproval(r.id); toast("Client approval recorded — Ready to E-file"); }, can: A.edit }, secondary: { label: "Open signatures", run: () => go("review"), can: true } };
    if (s === "Ready to E-file") return { text: "Approved. Transmit the return in your tax software, then record it here with the submission IDs.", primary: { label: "Record e-file", icon: Send, run: () => setDlg("transmit"), can: A.efile } };
    if (s === "Submitted") {
      const pending = r.efile.filter((e) => e.result === "pending");
      return { text: `Waiting for acknowledgement (${pending.map((p) => p.jurisdiction).join(", ") || "none pending"}).`, primary: { label: "Record acknowledgement", icon: CheckCircle2, run: () => pending[0] && setAckId(pending[0].id), can: A.efile && pending.length > 0 } };
    }
    if (s === "Rejected") {
      const rej = r.efile.find((e) => e.result === "rejected");
      return { text: `Rejected: ${rej?.code} — ${rej?.reason}`, primary: { label: "Resolve rejection", icon: RotateCcw, run: () => setDlg("resolve"), can: A.efile }, tone: "danger" as const };
    }
    if (s === "Accepted")
      return { text: b.balance > 0 || b.unbilled > 0 ? `Accepted. ${usd(b.balance + b.unbilled)} still to bill/collect before completing.` : "Accepted and paid. Deliver the final copy and complete.", primary: { label: "Complete return", icon: ShieldCheck, run: () => { if (b.balance + b.unbilled > 0 && !confirm(`${usd(b.balance + b.unbilled)} is still unbilled or unpaid. Complete anyway?`)) return; tax.completeReturn(r.id); toast("Return completed — copy delivered to client portal"); }, can: A.edit } };
    return { text: `Completed ${r.completedAt ? fmtDate(r.completedAt) : ""}. Nothing left to do.`, primary: null };
  })();

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Tax Preparation", href: "/services/tax-preparation" }, { label: client.name, href: `/clients/${client.id}` }, { label: `TY ${r.taxYear} ${r.form}` }]} />
      <AccessPreviewBar />

      {/* Header */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 gap-4">
            <Avatar name={client.name} size={56} square={client.type === "business"} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">
                  {client.name} <span className="font-semibold text-muted">· TY {r.taxYear}</span>
                </h1>
                <ReturnStatusBadge status={r.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5">{r.kind === "business" ? <Building2 size={14} /> : <User size={14} />}{FORM_LABEL[r.form]}</span>
                {r.filingStatus && <span>{r.filingStatus}</span>}
                <span>States: {r.states.join(", ") || "none"}</span>
                <span className="font-mono text-[11.5px] text-faint">{r.id}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
                <DueChip r={r} />
                <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                  Open client profile <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            {r.extensionOnly && <Badge tone="info">Extension only</Badge>}
            {r.dueAt && !r.extension && !["Submitted", "Accepted", "Completed"].includes(r.status) && (
              <Button size="sm" disabled={!A.edit} onClick={() => setDlg("extension")}>File extension</Button>
            )}
            {r.extensionOnly && r.extension && <Button size="sm" variant="primary" disabled={!A.edit} onClick={() => { tax.startFullReturn(r.id); toast("Full return started — return fees added"); }}>Start full return</Button>}
            <Menu
              label="More return actions"
              trigger={({ toggle }) => <Button size="sm" icon={MoreHorizontal} onClick={toggle} aria-label="More return actions"><span className="sr-only">More</span></Button>}
              items={[
                { label: "Change status (override)…", icon: RotateCcw, disabled: !A.review, onSelect: () => setDlg("status") },
                { label: "Amend this return", icon: FilePlus2, disabled: !A.edit || !["Submitted", "Accepted", "Completed"].includes(r.status), onSelect: () => {
                  if (!confirm(`Start an amended return for ${r.taxYear}? It's created as a new, linked return (${r.kind === "individual" ? "Form 1040-X" : `amended ${r.form}`}).`)) return;
                  const id = tax.createReturn({ clientId: r.clientId, taxYear: r.taxYear, form: r.kind === "individual" ? "1040-X" : r.form, filingStatus: r.filingStatus, preparerId: r.preparerId, reviewerId: r.reviewerId, states: r.states, amendsReturnId: r.id });
                  toast("Amended return created");
                  router.push(`/services/tax-preparation/returns/${id}`);
                } },
                { label: "Export return summary", icon: Download, onSelect: () => downloadPlaceholder(`${r.id}-summary`, `SAMPLE — ${client.name} TY ${r.taxYear} ${r.form}\nStatus: ${r.status}\nPreparer: ${staffById(r.preparerId).name}\nReviewer: ${staffById(r.reviewerId).name}\n(No tax data in the design preview.)\n`) },
              ]}
            />
          </div>
        </div>

        {/* Stepper */}
        <ol className="mt-5 flex flex-wrap gap-1.5 border-t border-line pt-4" aria-label="Return workflow">
          {STATUS_PATH.map((s, i) => {
            const idx = STATUS_PATH.indexOf(r.status === "Rejected" ? "Submitted" : r.status);
            const done = i < idx || r.status === "Completed";
            const cur = i === idx && r.status !== "Completed";
            return (
              <li key={s} className="flex items-center gap-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${cur ? (r.status === "Rejected" ? "bg-danger text-white" : "bg-accent text-white") : done ? "bg-success-soft text-success-ink" : "bg-surface-2 text-muted ring-1 ring-line"}`} aria-current={cur ? "step" : undefined}>
                  {done && <Check size={12} strokeWidth={3} />}
                  {cur && r.status === "Rejected" ? "Rejected" : s}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Next step */}
        <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${"tone" in next && next.tone === "danger" ? "border-danger/30 bg-danger-soft" : "border-accent/25 bg-accent-soft/50"}`}>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Next step</div>
            <p className={`text-[14px] ${"tone" in next && next.tone === "danger" ? "text-danger-ink" : "text-ink"}`}>{next.text}</p>
          </div>
          {"secondary" in next && next.secondary && <Button size="sm" disabled={!next.secondary.can} onClick={next.secondary.run}>{next.secondary.label}</Button>}
          {next.primary && <Button size="sm" variant="primary" icon={next.primary.icon} disabled={!next.primary.can} onClick={next.primary.run}>{next.primary.label}</Button>}
        </div>

        {/* Assignments */}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["preparer", "reviewer"] as const).map((role) => (
            <div key={role}>
              <dt className="text-[12px] capitalize text-muted">{role}</dt>
              <dd className="mt-1">
                <select aria-label={role === "preparer" ? "Preparer" : "Reviewer"} disabled={!A.edit} value={role === "preparer" ? r.preparerId : r.reviewerId} onChange={(e) => { tax.assign(r.id, role, e.target.value); toast(`${role === "preparer" ? "Preparer" : "Reviewer"}: ${staffById(e.target.value).name}`); }} className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] font-medium text-ink disabled:opacity-70">
                  {staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-[12px] text-muted">Documents</dt>
            <dd className="mt-1 text-[16px] font-bold text-ink tabular-nums"><button onClick={() => go("documents")} className="hover:text-accent">{out.length ? `${out.length} outstanding` : "All in"}</button></dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Balance</dt>
            <dd className="mt-1 text-[16px] font-bold tabular-nums">{A.billing ? <button onClick={() => go("billing")} className={b.balance > 0 ? "text-danger-ink hover:text-accent" : "text-faint"}>{usd(b.balance)}</button> : <span className="text-faint">—</span>}</dd>
          </div>
        </dl>
      </section>

      {/* Tabs */}
      <div className="sticky top-16 z-20 -mx-4 mt-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Return" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              <t.icon size={16} /> {t.label}
              {t.key === "documents" && out.length > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink">{out.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-5">
        {tab === "overview" && <OverviewTab r={r} client={client} otherYears={otherYears} />}
        {tab === "organizer" && <InterviewTab r={r} />}
        {tab === "documents" && <DocumentsTab r={r} client={client} onAdd={() => setDlg("additem")} onWaive={setWaiveId} />}
        {tab === "review" && <ReviewTab r={r} client={client} onSignoff={() => setDlg("signoff")} />}
        {tab === "efile" && <EfileTab r={r} onTransmit={() => setDlg("transmit")} onAck={setAckId} onResolve={() => setDlg("resolve")} />}
        {tab === "billing" && (A.billing ? <BillingTab r={r} client={client} onAddLine={() => setDlg("addline")} onInvoice={() => setDlg("invoice")} onPay={() => setDlg("payment")} /> : <NoAccess what="Return pricing and billing" />)}
        {tab === "activity" && (
          <Card>
            <CardHeader title="Return activity" subtitle="Status changes, documents, e-file and billing for this return" />
            <Timeline items={r.activity} />
          </Card>
        )}
      </div>

      <SignOffDialog r={r} open={dlg === "signoff"} onClose={() => setDlg(null)} />
      <TransmitDialog r={r} open={dlg === "transmit"} onClose={() => setDlg(null)} />
      <ExtensionDialog r={r} open={dlg === "extension"} onClose={() => setDlg(null)} />
      <ResolveDialog r={r} open={dlg === "resolve"} onClose={() => setDlg(null)} />
      <StatusDialog r={r} open={dlg === "status"} onClose={() => setDlg(null)} />
      <AddItemDialog r={r} open={dlg === "additem"} onClose={() => setDlg(null)} />
      <AddLineDialog r={r} open={dlg === "addline"} onClose={() => setDlg(null)} />
      {BACKEND ? (
        <InvoiceEditor open={dlg === "invoice"} onClose={() => setDlg(null)} onSaved={() => { setDlg(null); window.dispatchEvent(new CustomEvent("mkb:client-changed", { detail: r.clientId })); }}
          preset={{ clientId: r.clientId, service: "tax", taxReturnId: r.id, description: `${r.taxYear} tax preparation — ${r.form}`, lines: [...r.pricing.lines.map((l) => ({ label: l.qty > 1 ? `${l.description} × ${l.qty}` : l.description, amount: String(l.qty * l.unit), kind: "service" as const })), ...(r.pricing.discount ? [{ label: "Discount", amount: String(r.pricing.discount), kind: "discount" as const }] : [])] }} />
      ) : <TaxInvoiceDialog r={r} open={dlg === "invoice"} onClose={() => setDlg(null)} />}
      <PaymentDialog client={client} open={dlg === "payment"} onClose={() => setDlg(null)} invoiceId={b.invoices.find((i) => i.amount > i.paid && i.status !== "draft")?.id} />
      <AckDialog r={r} attempt={ackId ? r.efile.find((e) => e.id === ackId) ?? null : null} onClose={() => setAckId(null)} />
      <WaiveDialog r={r} itemId={waiveId} onClose={() => setWaiveId(null)} />
    </>
  );
}

/* ================================================================== */

function Masked({ c, field, masked }: { c: Client; field: "taxId" | "ein" | "dob" | "rpTaxId"; masked: string }) {
  const { access } = useTax();
  if (!masked) return <span className="text-faint">Not on file</span>;
  if (!access.revealIds)
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[13px]" title="Revealing requires the 'reveal tax IDs' permission">
        {masked} <Lock size={12} className="text-faint" />
      </span>
    );
  return <Sensitive c={c} field={field} masked={masked} />;
}

function OverviewTab({ r, client, otherYears }: { r: TaxReturn; client: Client; otherYears: TaxReturn[] }) {
  const tax = useTax();
  const toast = useToast();
  const [note, setNote] = useState("");
  const { due, extended } = dueDates(r.form, r.taxYear);
  const rp = client.business?.responsibleParty;
  const amendedBy = tax.returns.filter((x) => x.amendsReturnId === r.id);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      {(r.amendsReturnId || amendedBy.length > 0) && (
        <div role="note" className="rounded-xl border border-info/30 bg-info-soft/50 px-4 py-3 text-[13.5px] text-ink xl:col-span-2">
          {r.amendsReturnId && <p>This is an amended return. Original: <Link className="font-semibold text-accent hover:underline" href={`/services/tax-preparation/returns/${r.amendsReturnId}`}>{r.amendsReturnId}</Link></p>}
          {amendedBy.map((x) => <p key={x.id}>Amended by <Link className="font-semibold text-accent hover:underline" href={`/services/tax-preparation/returns/${x.id}`}>{x.id}</Link> ({x.status})</p>)}
        </div>
      )}
      <ExtensionCard r={r} />
      <Card>
        <CardHeader icon={r.kind === "business" ? Building2 : User} title={r.kind === "business" ? "Business tax profile" : "Taxpayer"} subtitle="From the central client profile — edit it there" action={<Button size="sm" variant="ghost" href={`/clients/${client.id}`}>Client profile</Button>} />
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 px-5 pb-5 text-[13.5px] sm:px-6">
          <dt className="text-muted">{r.kind === "business" ? "Legal name" : "Name"}</dt><dd className="font-medium text-ink">{client.business?.legalName ?? client.name}</dd>
          {r.kind === "business" ? (
            <>
              <dt className="text-muted">Entity</dt><dd className="font-medium text-ink">{client.business?.entityType} · {client.business?.state}</dd>
              <dt className="text-muted">EIN</dt><dd className="font-medium text-ink"><Masked c={client} field="ein" masked={maskEIN(client.business?.einLast4)} /></dd>
              <dt className="text-muted">Responsible party</dt>
              <dd className="font-medium text-ink">
                {rp ? <>{rp.name} <span className="font-normal text-muted">· {rp.title}</span><br /><span className="text-[12px] font-normal text-muted">{rp.taxIdType ?? "SSN"} </span><Masked c={client} field="rpTaxId" masked={maskTaxId(rp.taxIdLast4)} /></> : <span className="text-faint">Not on file</span>}
              </dd>
              <dt className="text-muted">Fiscal year end</dt><dd className="font-medium text-ink">{client.business?.fiscalYearEnd}</dd>
            </>
          ) : (
            <>
              <dt className="text-muted">Date of birth</dt><dd className="font-medium text-ink"><Masked c={client} field="dob" masked={maskDOB(client.dob)} /></dd>
              <dt className="text-muted">{client.taxIdType ?? "SSN / ITIN"}</dt><dd className="font-medium text-ink"><Masked c={client} field="taxId" masked={maskTaxId(client.taxIdLast4)} /></dd>
            </>
          )}
          <dt className="text-muted">Address</dt><dd className="font-medium text-ink">{client.address.line1 && client.address.line1 !== "—" ? <>{client.address.line1}{client.address.line2 ? `, ${client.address.line2}` : ""}<br />{client.address.city}, {client.address.state} {client.address.zip}</> : <span className="text-faint">Not on file</span>}</dd>
          <dt className="text-muted">Phone · email</dt><dd className="font-medium text-ink">{client.phone && client.phone !== "—" ? formatPhone(client.phone) : "—"} · {client.email}</dd>
        </dl>
        {r.kind === "business" && (!client.business?.einLast4 || !rp?.taxIdLast4) && (
          <p className="mx-5 mb-5 flex items-center gap-1.5 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink sm:mx-6"><AlertTriangle size={14} /> EIN or responsible party is missing — add it on the client profile.</p>
        )}
      </Card>

      <Card>
        <CardHeader icon={ClipboardList} title="Return details" />
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 px-5 pb-5 text-[13.5px] sm:px-6">
          <dt className="text-muted">Tax year</dt><dd className="font-medium text-ink">{r.taxYear}</dd>
          <dt className="text-muted">Form</dt><dd className="font-medium text-ink">{FORM_LABEL[r.form]}</dd>
          {r.kind === "individual" && (
            <>
              <dt className="text-muted">Filing status</dt>
              <dd>
                <select aria-label="Filing status" disabled={!tax.access.edit} value={r.filingStatus ?? "Single"} onChange={(e) => { tax.updateDetails(r.id, { filingStatus: e.target.value as FilingStatus }); toast("Filing status updated"); }} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink">
                  {FILING_STATUSES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </dd>
            </>
          )}
          <dt className="text-muted">Due date</dt><dd className="font-medium text-ink">{due ? fmtDate(due) : "No fixed deadline (amended)"}</dd>
          <dt className="text-muted">Extension</dt><dd className="font-medium text-ink">{r.extension ? `Filed ${fmtDate(r.extension.filedAt)} · due ${fmtDate(r.extension.dueAt)}` : extended ? "Not filed" : "—"}</dd>
          <dt className="text-muted">Engagement</dt><dd className="font-medium text-ink">{client.enrollments.find((e) => e.id === r.enrollmentId)?.title ?? (r.completedAt ? "Prior-year return" : "—")}</dd>
          <dt className="text-muted">Created</dt><dd className="font-medium text-ink">{fmtDate(r.createdAt)}</dd>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Other tax years" subtitle="Each year is its own return — records never mix" />
        <ul className="px-3 pb-3 sm:px-4">
          {otherYears.length === 0 && <li className="px-2 pb-3 text-[13.5px] text-muted">No other years on file.</li>}
          {otherYears.map((o) => (
            <li key={o.id}>
              <Link href={`/services/tax-preparation/returns/${o.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                <span className="w-14 text-[14px] font-bold text-ink tabular-nums">{o.taxYear}</span>
                <span className="flex-1 text-[13.5px] text-ink-2">{o.form}</span>
                <ReturnStatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader icon={NotebookPen} title="Notes & status history" />
        <div className="mx-5 mb-3 flex gap-2 sm:mx-6">
          <input aria-label="Return note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for this return…" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
          <Button disabled={!note.trim()} onClick={() => { tax.addNote(r.id, note.trim()); setNote(""); toast("Note added"); }}>Add</Button>
        </div>
        <ul className="space-y-2 px-5 pb-3 sm:px-6">
          {r.notes.map((n) => (
            <li key={n.id} className={`rounded-xl border p-3 text-[13.5px] ${n.pinned ? "border-warning/30 bg-warning-soft/50" : "border-line"}`}>
              <p className="text-ink-2">{n.body}</p>
              <p className="mt-1 text-[12px] text-muted">{staffById(n.authorId).name} · {relTime(n.at)}</p>
            </li>
          ))}
        </ul>
        <ol className="space-y-1.5 border-t border-line px-5 py-4 sm:px-6">
          {[...r.statusHistory].reverse().map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
              <ReturnStatusBadge status={h.status} />
              <span className="text-muted">{fmtDateTime(h.at)} · {h.by === "system" ? "system" : staffById(h.by)?.name ?? h.by}</span>
              {h.note && <span className="text-ink-2">— {h.note}</span>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

/* ================================================================== */

/* ================================================================== */

const ITEM_META: Record<ItemStatus, { label: string; tone: "neutral" | "warning" | "info" | "success" | "danger" }> = {
  needed: { label: "Not requested", tone: "neutral" },
  requested: { label: "Requested", tone: "warning" },
  received: { label: "Received", tone: "info" },
  reviewed: { label: "Reviewed", tone: "success" },
  rejected: { label: "Re-upload needed", tone: "danger" },
  waived: { label: "Not needed", tone: "neutral" },
};

function DocumentsTab({ r, client, onAdd, onWaive }: { r: TaxReturn; client: Client; onAdd: () => void; onWaive: (id: string) => void }) {
  const tax = useTax();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "outstanding" | "in">("all");
  const can = tax.access.edit;
  const items = r.checklist.filter((i) => {
    const s = itemStatus(i, client);
    return filter === "all" || (filter === "outstanding" ? ["needed", "requested", "rejected"].includes(s) && i.required : ["received", "reviewed"].includes(s));
  });
  const req = r.checklist.filter((i) => i.required && itemStatus(i, client) !== "waived");
  const got = req.filter((i) => ["received", "reviewed"].includes(itemStatus(i, client))).length;
  const pct = req.length ? Math.round((got / req.length) * 100) : 100;
  const source = { standard: "Standard", organizer: "From organizer", custom: "Added by staff" } as const;

  return (
    <Card>
      <CardHeader
        icon={FolderOpen}
        title="Document checklist"
        subtitle={`${got} of ${req.length} required received · files live on the client profile, tagged TY ${r.taxYear}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!can} onClick={() => { const n = tax.requestAllMissing(r.id); toast(n ? `Requested ${n} document(s)` : "Nothing left to request"); }}>Request missing</Button>
            <Button size="sm" icon={Send} disabled={!can} onClick={() => { const n = tax.remindAll(r.id); toast(n ? `Reminder sent for ${n} document(s)` : "No outstanding requests"); }}>Remind</Button>
            <Button size="sm" variant="primary" icon={Plus} disabled={!can} onClick={onAdd}>Add item</Button>
          </div>
        }
      />
      <div className="px-5 pb-3 sm:px-6">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Documents received">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--accent)" }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["outstanding", "Missing"],
              ["in", "Received"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${filter === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>{l}</button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {items.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">Nothing in this view.</li>}
        {items.map((i) => {
          const s = itemStatus(i, client);
          const locked = i.sensitive && !tax.access.sensitiveDocs;
          const m = ITEM_META[s];
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-2.5 px-5 py-3 sm:flex-nowrap sm:px-6">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${["received", "reviewed"].includes(s) ? "bg-success-soft text-success" : s === "waived" ? "bg-surface-2 text-faint ring-1 ring-line" : "border-2 border-dashed border-line-strong text-faint"}`}>
                {locked ? <Lock size={16} /> : ["received", "reviewed"].includes(s) ? <Check size={16} /> : <FileUp size={16} />}
              </span>
              <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[14px] font-medium ${s === "waived" ? "text-muted line-through" : locked ? "text-muted" : "text-ink"}`}>{locked ? "Restricted document" : i.name}</span>
                  {i.sensitive && <Badge tone="danger" icon={ShieldAlert}>Restricted</Badge>}
                  {!i.required && <span className="text-[11.5px] text-muted">optional</span>}
                </div>
                <div className="text-[12px] text-muted">{i.category} · {source[i.source]}{i.waivedReason ? ` · ${i.waivedReason}` : ""}{i.archived ? " · archived with this return" : ""}</div>
              </div>
              <Badge tone={m.tone}>{m.label}</Badge>
              <div className="flex items-center gap-1">
                {s === "needed" && <Button size="sm" variant="ghost" disabled={!can} onClick={() => { tax.requestItem(r.id, i.id); toast(`Requested: ${i.name}`); }}>Request</Button>}
                {(s === "requested" || s === "rejected") && <Button size="sm" variant="ghost" disabled={!can} onClick={() => { tax.remindItem(r.id, i.id); toast("Reminder sent"); }}>Remind</Button>}
                {["needed", "requested", "rejected"].includes(s) && <Button size="sm" variant="ghost" icon={FileUp} disabled={!can} onClick={() => { tax.receiveItem(r.id, i.id); toast(`Received: ${i.name}`); }}>Received</Button>}
                {s === "received" && <Button size="sm" variant="ghost" icon={CheckCircle2} disabled={!can || locked} onClick={() => { tax.reviewItem(r.id, i.id, true); toast(`Reviewed: ${i.name}`); }}>Review</Button>}
                {["received", "reviewed"].includes(s) && !i.archived && (
                  <button aria-label={locked ? "Requires sensitive-document permission" : `Preview ${i.name}`} title={locked ? "Requires sensitive-document permission" : "Preview (logged)"} disabled={locked} onClick={() => { const c = i.docId; if (c) { toast("Opened sample preview — access logged"); } }} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink disabled:opacity-30"><Eye size={15} /></button>
                )}
                <Menu
                  label={`More for ${i.name}`}
                  trigger={({ toggle }) => <button onClick={toggle} disabled={!can} aria-label={`More actions for ${i.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink disabled:opacity-30"><MoreHorizontal size={16} /></button>}
                  items={[
                    ...(s === "received" || s === "reviewed" ? [{ label: "Ask client to re-upload", icon: RotateCcw, onSelect: () => { tax.reviewItem(r.id, i.id, false); toast("Re-upload requested"); } }] : []),
                    s === "waived" ? { label: "Restore to checklist", icon: RotateCcw, onSelect: () => { tax.waiveItem(r.id, i.id, undefined); toast("Restored"); } } : { label: "Mark not needed…", icon: XCircle, onSelect: () => onWaive(i.id) },
                    ...(i.source === "custom" ? [{ label: "Remove item", icon: Trash2, danger: true, onSelect: () => { tax.removeItem(r.id, i.id); toast("Removed"); } }] : []),
                  ]}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-[12px] text-muted sm:px-6"><Lock size={12} className="shrink-0" /> No real tax documents exist in the preview. Restricted items need the sensitive-documents permission; every view is logged.</p>
    </Card>
  );
}

/* ================================================================== */

function ReviewTab({ r, client, onSignoff }: { r: TaxReturn; client: Client; onSignoff: () => void }) {
  const tax = useTax();
  const clientStore = useClients();
  const toast = useToast();
  const sig = r.approvalSignatureId ? client.signatures.find((s) => s.id === r.approvalSignatureId) : undefined;
  const ddOk = r.kind === "business" || ddComplete(r.dueDiligence);
  const canSignoff = ["In Preparation", "Ready for Review"].includes(r.status) && ddOk;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      {r.kind === "individual" && <div className="xl:col-span-2"><DueDiligenceCard r={r} /></div>}
      <Card>
        <CardHeader icon={ShieldCheck} title="Reviewer sign-off" subtitle={`Assigned reviewer: ${staffById(r.reviewerId).name}`} />
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          {r.reviewSignoff ? (
            <div className="rounded-xl border border-success/30 bg-success-soft/60 p-3.5">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-success-ink"><CheckCircle2 size={16} /> Signed off by {staffById(r.reviewSignoff.by).name}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">{fmtDateTime(r.reviewSignoff.at)}{r.reviewSignoff.note ? ` — ${r.reviewSignoff.note}` : ""}</p>
            </div>
          ) : (
            <p className="text-[13.5px] text-muted">Not reviewed yet. The return can&rsquo;t go to the client until a reviewer signs off.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {!r.reviewSignoff && <Button variant="primary" icon={ShieldCheck} disabled={!tax.access.review || !canSignoff} onClick={onSignoff}>Sign off</Button>}
            {r.reviewSignoff && ["In Preparation", "Awaiting Client Approval"].includes(r.status) && <Button disabled={!tax.access.review} onClick={() => { tax.clearSignOff(r.id); toast("Sign-off removed"); }}>Remove sign-off</Button>}
          </div>
          {!canSignoff && !r.reviewSignoff && <p className="text-[12px] text-muted">{ddOk ? "Available once the return is in preparation." : "Complete the due diligence checklist first."}</p>}
        </div>
      </Card>
      <Card>
        <CardHeader icon={CheckCircle2} title="Client approval" subtitle="Client reviews the return and signs the e-file authorization in the portal" />
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          {sig ? (
            <div className="flex items-center gap-3 rounded-xl border border-line p-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{sig.document}</span>
                <span className="block text-[12px] text-muted">Sent {fmtDate(sig.sentAt)}{sig.signedAt ? ` · signed ${fmtDate(sig.signedAt)}` : ""}</span>
              </span>
              <Badge tone={sig.status === "signed" ? "success" : sig.status === "pending" ? "warning" : "neutral"}>{sig.status === "signed" ? "Signed" : sig.status === "pending" ? "Awaiting signature" : sig.status}</Badge>
            </div>
          ) : (
            <p className="text-[13.5px] text-muted">{r.clientApprovedAt ? `Approved ${fmtDate(r.clientApprovedAt)}.` : "Not sent yet."}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {r.status === "In Preparation" && <Button variant="primary" icon={Send} disabled={!tax.access.edit || !r.reviewSignoff} onClick={() => { tax.sendForApproval(r.id); toast("Sent for client approval"); }}>Send for approval</Button>}
            {r.status === "Awaiting Client Approval" && sig?.status === "pending" && <Button icon={Send} disabled={!tax.access.edit} onClick={() => { clientStore.resendSignature(client.id, sig.id); toast("Signature request resent"); }}>Resend</Button>}
            {r.status === "Awaiting Client Approval" && <Button variant="primary" icon={CheckCircle2} disabled={!tax.access.edit} onClick={() => { tax.recordApproval(r.id); toast("Client approval recorded"); }}>Record approval</Button>}
          </div>
          {r.status === "In Preparation" && !r.reviewSignoff && <p className="text-[12px] text-muted">Needs reviewer sign-off first.</p>}
        </div>
      </Card>
      <div className="xl:col-span-2"><FinalApprovalCard r={r} /></div>
    </div>
  );
}

/* ================================================================== */

function EfileTab({ r, onTransmit, onAck, onResolve }: { r: TaxReturn; onTransmit: () => void; onAck: (id: string) => void; onResolve: () => void }) {
  const tax = useTax();
  return (
    <Card>
      <CardHeader
        icon={Send}
        title="E-file tracking"
        subtitle={`${r.efile.length} submission${r.efile.length === 1 ? "" : "s"}`}
        action={
          <div className="flex gap-2">
            {r.status === "Ready to E-file" && <Button size="sm" variant="primary" icon={Send} disabled={!tax.access.efile} onClick={onTransmit}>Record e-file</Button>}
            {r.status === "Rejected" && <Button size="sm" variant="primary" icon={RotateCcw} disabled={!tax.access.efile} onClick={onResolve}>Resolve rejection</Button>}
          </div>
        }
      />
      {r.efile.length === 0 ? (
        <p className="border-t border-line px-6 py-8 text-center text-[13.5px] text-muted">Not transmitted yet{r.status !== "Ready to E-file" ? " — available once the client has approved the return" : ""}.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {r.efile.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${e.result === "accepted" ? "bg-success-soft text-success" : e.result === "rejected" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"}`}>
                {e.result === "accepted" ? <CheckCircle2 size={17} /> : e.result === "rejected" ? <XCircle size={17} /> : <Send size={17} />}
              </span>
              <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                <div className="text-[14px] font-semibold text-ink">{e.jurisdiction} <span className="font-mono text-[12px] font-normal text-muted">{e.submissionId}</span></div>
                <div className="text-[12px] text-muted">Submitted {fmtDateTime(e.submittedAt)}{e.resultAt ? ` · acknowledged ${fmtDateTime(e.resultAt)}` : ""}</div>
                {e.result === "rejected" && <div className="mt-0.5 text-[12.5px] font-medium text-danger-ink">{e.code} — {e.reason}</div>}
              </div>
              <Badge tone={e.result === "accepted" ? "success" : e.result === "rejected" ? "danger" : "info"}>{e.result === "pending" ? "Awaiting ack" : e.result === "accepted" ? "Accepted" : "Rejected"}</Badge>
              {e.result === "pending" && <Button size="sm" disabled={!tax.access.efile} onClick={() => onAck(e.id)}>Record ack</Button>}
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line px-5 py-3 text-[12px] text-muted sm:px-6">Returns are transmitted in your tax software. Record the submission ID and the IRS/state acknowledgement here.</p>
    </Card>
  );
}

/* ================================================================== */

function BillingTab({ r, client, onAddLine, onInvoice, onPay }: { r: TaxReturn; client: Client; onAddLine: () => void; onInvoice: () => void; onPay: () => void }) {
  const tax = useTax();
  const toast = useToast();
  const b = billing(r, client);
  const editable = !["Completed"].includes(r.status);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["Price", b.price, "text-ink"],
            ["Billed", b.billed, "text-ink"],
            ["Paid", b.paid, "text-success-ink"],
            ["Balance due", b.balance, b.balance > 0 ? "text-danger-ink" : "text-faint"],
            ["Not yet billed", b.unbilled, b.unbilled > 0 ? "text-warning-ink" : "text-faint"],
          ] as const
        ).map(([l, v, cls], i) => (
          <div key={l} className={`rounded-2xl border border-line bg-surface p-4 shadow-soft ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
            <div className="text-[12px] text-muted">{l}</div>
            <div className={`mt-0.5 text-[19px] font-bold tabular-nums ${cls}`}>{usd(v, 2)}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader icon={Receipt} title="Pricing" subtitle="From the fee schedule — adjust per return" action={<Button size="sm" icon={Plus} disabled={!editable} onClick={onAddLine}>Add line</Button>} />
          <ul className="divide-y divide-line border-t border-line">
            {r.pricing.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-5 py-2.5 sm:px-6">
                <span className="min-w-0 flex-1 text-[13.5px] text-ink">{l.description}</span>
                <input aria-label={`Quantity for ${l.description}`} type="number" min={1} disabled={!editable} value={l.qty} onChange={(e) => tax.updateLine(r.id, l.id, { qty: Math.max(1, Number(e.target.value) || 1) })} className="h-8 w-14 rounded-lg border border-line bg-surface px-1.5 text-right text-[13px] tabular-nums" />
                <span className="text-[12px] text-muted">×</span>
                <input aria-label={`Price for ${l.description}`} type="number" min={0} disabled={!editable} value={l.unit} onChange={(e) => tax.updateLine(r.id, l.id, { unit: Math.max(0, Number(e.target.value) || 0) })} className="h-8 w-20 rounded-lg border border-line bg-surface px-1.5 text-right text-[13px] tabular-nums" />
                <span className="w-20 text-right text-[13.5px] font-semibold tabular-nums">{usd(l.qty * l.unit)}</span>
                <button aria-label={`Remove ${l.description}`} disabled={!editable} onClick={() => tax.removeLine(r.id, l.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-danger disabled:opacity-30"><Trash2 size={14} /></button>
              </li>
            ))}
            <li className="flex items-center gap-2 px-5 py-2.5 sm:px-6">
              <span className="flex-1 text-[13.5px] text-muted">Discount</span>
              <input aria-label="Discount" type="number" min={0} disabled={!editable} value={r.pricing.discount} onChange={(e) => tax.setDiscount(r.id, Math.max(0, Number(e.target.value) || 0))} className="h-8 w-24 rounded-lg border border-line bg-surface px-1.5 text-right text-[13px] tabular-nums" />
            </li>
            <li className="flex items-center justify-between px-5 py-3 sm:px-6">
              <span className="text-[14px] font-semibold text-ink">Total</span>
              <span className="text-[18px] font-bold text-ink tabular-nums">{usd(priceTotal(r), 2)}</span>
            </li>
          </ul>
        </Card>
        <Card>
          <CardHeader
            icon={CreditCard}
            title="Invoices & payments"
            subtitle="Shared with the client profile"
            action={
              <div className="flex gap-2">
                <Button size="sm" icon={CreditCard} disabled={b.balance <= 0} onClick={onPay}>Record payment</Button>
                <Button size="sm" variant="primary" icon={Receipt} disabled={b.unbilled <= 0} onClick={onInvoice}>Invoice</Button>
              </div>
            }
          />
          <ul className="divide-y divide-line border-t border-line">
            {b.invoices.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No invoices yet.</li>}
            {b.invoices.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink tabular-nums">{i.number}</span>
                  <span className="block truncate text-[12px] text-muted">{i.description} · due {fmtDate(i.dueAt)}</span>
                </span>
                <Badge tone={i.status === "paid" ? "success" : i.status === "overdue" ? "danger" : i.status === "partial" ? "warning" : "info"}>{i.status === "paid" ? "Paid" : i.status === "partial" ? "Partial" : i.status === "overdue" ? "Overdue" : i.status === "draft" ? "Draft" : "Open"}</Badge>
                <span className="w-24 text-right text-[13.5px] tabular-nums"><span className="font-semibold text-ink">{usd(i.amount - i.paid)}</span><span className="block text-[11px] text-muted">of {usd(i.amount)}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

