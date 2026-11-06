"use client";

import { useCallback, useEffect, useState } from "react";
import { useClientGate } from "@/components/team/AccessGuard";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  Archive,
  AtSign,
  Building2,
  CalendarDays,
  CalendarPlus,
  Download,
  FilePlus2,
  FileText,
  Layers,
  LayoutGrid,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  PenLine,
  Pencil,
  Phone,
  Receipt,
  Send,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { useToast } from "@/components/ui/Toast";
import { balanceDue, openRequirements, staffById, SAMPLE_NOW } from "@/lib/sample/clients";
import { useClient, useClients } from "@/lib/store/clients-store";
import { clientStatus, portalStatus } from "@/lib/status";
import { fmtDate, fmtDateTime, usd } from "@/lib/format";
import { formatPhone } from "@/lib/validation";
import { missingTaxInfo } from "./ProfileTabs";
import type { ClientDocument, ServiceKey } from "@/lib/types";
import {
  DocPreviewDialog,
  EditClientDialog,
  EnrollDialog,
  InvoiceDialog,
  PaymentDialog,
  RequestDocDialog,
  ScheduleDialog,
  SignatureDialog,
  UploadDocDialog,
} from "./dialogs";
import {
  ActivityTab,
  AppointmentsTab,
  DocumentsTab,
  InvoicesTab,
  MessagesTab,
  NotesTab,
  OverviewTab,
  ServicesTab,
  SignaturesTab,
  type Act,
} from "./ProfileTabs";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "services", label: "Services", icon: Layers },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "appointments", label: "Appointments", icon: CalendarDays },
  { key: "invoices", label: "Invoices & payments", icon: Receipt },
  { key: "signatures", label: "Signatures", icon: PenLine },
  { key: "notes", label: "Internal notes", icon: NotebookPen },
  { key: "activity", label: "Activity", icon: ActivityIcon },
] as const;
export type TabKey = (typeof TABS)[number]["key"];
export type DialogKind = "edit" | "enroll" | "request" | "upload" | "preview" | "schedule" | "invoice" | "payment" | "signature";

export function ClientProfile({ id }: { id: string }) {
  const c = useClient(id);
  const store = useClients();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("overview");
  const [dialog, setDialog] = useState<{ kind: DialogKind; arg?: unknown } | null>(null);

  // Keep the tab in the URL hash so links like /clients/c-1001#documents work.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as TabKey;
      if (TABS.some((t) => t.key === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const go = useCallback((k: TabKey) => {
    setTab(k);
    history.replaceState(null, "", `#${k}`);
  }, []);
  const open = useCallback((kind: DialogKind, arg?: unknown) => setDialog({ kind, arg }), []);
  const close = useCallback(() => setDialog(null), []);

  const gate = useClientGate(c?.id, "this client's profile");
  if (gate) return gate;
  if (!c)
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <h1 className="text-[20px] font-bold text-ink">Client not found</h1>
          <p className="mt-1 text-[14px] text-muted">This record doesn&rsquo;t exist in the sample data (new clients reset when the page reloads).</p>
          <Link href="/clients" className="mt-4 inline-block text-[14px] font-semibold text-accent">Back to clients</Link>
        </div>
      </div>
    );

  const act: Act = { go, open };
  const st = clientStatus[c.status];
  const ps = portalStatus[c.portal];
  const bal = balanceDue(c);
  const openReq = openRequirements(c) + (missingTaxInfo(c).length ? 1 : 0);
  const next = c.appointments.find((a) => a.status === "scheduled" && a.at >= SAMPLE_NOW.toISOString());
  const unread = c.messages.filter((m) => m.from === "client" && !m.read).length;
  const services = [...new Set(c.enrollments.map((e) => e.service))];

  const counts: Partial<Record<TabKey, number>> = {
    services: c.enrollments.length,
    documents: c.documents.length,
    messages: unread || undefined,
    signatures: c.signatures.filter((s) => s.status === "pending").length || undefined,
    notes: c.notes.length || undefined,
  };

  const exportRecord = () => {
    const blob = new Blob([JSON.stringify({ note: "SAMPLE DATA — design preview export", client: c }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.id}-sample-export.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Client record exported (sample data) — logged");
  };

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Clients", href: "/clients" }, { label: c.name }]} />

      {/* Header card */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 gap-4">
            <Avatar name={c.name} size={60} square={c.type === "business"} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{c.name}</h1>
                <Badge tone={st.tone}>{st.label}</Badge>
                <Badge tone={ps.tone}>{ps.label}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  {c.type === "business" ? <Building2 size={14} /> : <User size={14} />}
                  {c.type === "business" ? `${c.business?.entityType} · ${c.business?.industry}` : "Individual"}
                </span>
                {c.contactName && <span>Contact: {c.contactName}</span>}
                <span>Client since {fmtDate(c.since, { month: "short", year: "numeric" })}</span>
                <span className="font-mono text-[11.5px] text-faint">{c.id.toUpperCase()}</span>
                {c.leadId && (
                  <Link href={`/leads/${c.leadId}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                    Converted from lead {c.leadId}
                  </Link>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ink-2">
                <a href={`mailto:${c.email}`} className="inline-flex min-w-0 items-center gap-1.5 break-all hover:text-accent">
                  <AtSign size={14} className="shrink-0 text-muted" /> {c.email}
                </a>
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                  <Phone size={14} className="text-muted" /> {c.phone && c.phone !== "—" ? formatPhone(c.phone) : "No phone"}
                </a>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-muted" /> {c.address.city && c.address.city !== "—" ? `${c.address.city}, ${c.address.state}` : "No address"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {services.map((s) => (
                  <button key={s} onClick={() => go("services")} title="View service details">
                    <ServiceTag service={s} />
                  </button>
                ))}
                {c.tags.map((t) => (
                  <span key={t} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2 lg:max-w-[380px] lg:justify-end">
            <Button size="sm" icon={Mail} onClick={() => go("messages")}>Message</Button>
            <Button size="sm" icon={CalendarPlus} onClick={() => open("schedule")}>Schedule</Button>
            <Button size="sm" icon={FilePlus2} onClick={() => open("request")}>Request docs</Button>
            <Button size="sm" variant="primary" icon={Receipt} onClick={() => open("invoice")}>New invoice</Button>
            <Button size="sm" icon={Pencil} onClick={() => open("edit")}>Edit</Button>
            <Menu
              label="More client actions"
              trigger={({ toggle, open: isOpen }) => (
                <Button size="sm" icon={MoreHorizontal} onClick={toggle} aria-expanded={isOpen} aria-label="More client actions">
                  <span className="sr-only">More</span>
                </Button>
              )}
              items={[
                { label: c.portal === "active" ? "Portal is active" : c.portal === "invited" ? "Resend portal invite" : "Send portal invite", icon: Send, disabled: c.portal === "active", onSelect: () => { store.sendInvite(c.id); toast(`Portal invitation sent to ${c.email}`); } },
                c.status === "active"
                  ? { label: "Mark inactive", icon: UserX, onSelect: () => { store.updateClient(c.id, { status: "inactive" }, "Marked client inactive"); toast("Client marked inactive"); } }
                  : { label: "Mark active", icon: UserCheck, onSelect: () => { store.updateClient(c.id, { status: "active" }, "Marked client active"); toast("Client marked active"); } },
                { label: "Export client record", icon: Download, onSelect: exportRecord },
                "divider",
                { label: "Archive client", icon: Archive, danger: true, disabled: c.status === "inactive", onSelect: () => { if (confirm(`Archive ${c.name}? Their record is kept and can be reactivated.`)) { store.updateClient(c.id, { status: "inactive", portal: c.portal }, "Archived client"); toast(`${c.name} archived`); } } },
              ]}
            />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Stat label="Balance due" value={usd(bal)} tone={bal > 0 ? "text-ink" : "text-faint"} onClick={() => go("invoices")} />
          <Stat label="Open requirements" value={String(openReq)} tone={openReq > 0 ? "text-warning-ink" : "text-faint"} onClick={() => go("documents")} />
          <Stat label="Next appointment" value={next ? fmtDateTime(next.at) : "None scheduled"} small onClick={() => go("appointments")} />
          <div>
            <dt className="text-[12px] text-muted">Assigned staff</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {c.staffIds.map((sid) => (
                <span key={sid} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-[12.5px] font-medium text-ink-2 ring-1 ring-line">
                  <Avatar name={staffById(sid).name} size={22} />
                  {staffById(sid).name}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tabs */}
      <div className="sticky top-16 z-20 -mx-4 mt-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Client record" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => go(t.key)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium transition-colors ${on ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}
              >
                <t.icon size={16} />
                {t.label}
                {counts[t.key] ? (
                  <span className={`rounded-full px-1.5 text-[11px] font-semibold ${on ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-muted ring-1 ring-line"}`}>{counts[t.key]}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" className="pt-5">
        {tab === "overview" && <OverviewTab c={c} act={act} />}
        {tab === "services" && <ServicesTab c={c} act={act} />}
        {tab === "documents" && <DocumentsTab c={c} act={act} />}
        {tab === "messages" && <MessagesTab c={c} />}
        {tab === "appointments" && <AppointmentsTab c={c} act={act} />}
        {tab === "invoices" && <InvoicesTab c={c} act={act} />}
        {tab === "signatures" && <SignaturesTab c={c} act={act} />}
        {tab === "notes" && <NotesTab c={c} />}
        {tab === "activity" && <ActivityTab c={c} />}
      </div>

      {/* Dialogs */}
      <EditClientDialog client={c} open={dialog?.kind === "edit"} onClose={close} />
      <EnrollDialog client={c} open={dialog?.kind === "enroll"} onClose={close} initial={dialog?.arg as ServiceKey | undefined} />
      <RequestDocDialog client={c} open={dialog?.kind === "request"} onClose={close} />
      <UploadDocDialog client={c} open={dialog?.kind === "upload"} onClose={close} replace={dialog?.kind === "upload" ? (dialog.arg as ClientDocument | undefined) : undefined} />
      <DocPreviewDialog client={c} doc={dialog?.kind === "preview" ? (dialog.arg as ClientDocument) : null} onClose={close} />
      <ScheduleDialog client={c} open={dialog?.kind === "schedule"} onClose={close} />
      <InvoiceDialog client={c} open={dialog?.kind === "invoice"} onClose={close} />
      <PaymentDialog client={c} open={dialog?.kind === "payment"} onClose={close} invoiceId={dialog?.kind === "payment" ? (dialog.arg as string | undefined) : undefined} />
      <SignatureDialog client={c} open={dialog?.kind === "signature"} onClose={close} />
    </>
  );
}

function Stat({ label, value, tone = "text-ink", small, onClick }: { label: string; value: string; tone?: string; small?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="-m-1.5 rounded-xl p-1.5 text-left hover:bg-surface-hover">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`mt-0.5 font-bold tabular-nums ${small ? "text-[14px]" : "text-[19px]"} ${tone}`}>{value}</dd>
    </button>
  );
}
