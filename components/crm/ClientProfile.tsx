"use client";

import { useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  AtSign,
  Building2,
  CalendarPlus,
  FileText,
  FilePlus2,
  LayoutGrid,
  Layers,
  Mail,
  MapPin,
  MessageSquare,
  NotebookPen,
  PenLine,
  Phone,
  Receipt,
  CalendarDays,
  User,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { balanceDue, openRequirements, staffById } from "@/lib/sample/clients";
import { clientStatus, portalStatus } from "@/lib/status";
import { fmtDate, fmtDateTime, usd } from "@/lib/format";
import type { Client } from "@/lib/types";
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

export function ClientProfile({ client: c }: { client: Client }) {
  const [tab, setTab] = useState<TabKey>("overview");

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
  const go = (k: TabKey) => {
    setTab(k);
    history.replaceState(null, "", `#${k}`);
  };

  const st = clientStatus[c.status];
  const ps = portalStatus[c.portal];
  const bal = balanceDue(c);
  const open = openRequirements(c);
  const next = c.appointments.find((a) => a.status === "scheduled");
  const unread = c.messages.filter((m) => m.from === "client" && !m.read).length;
  const services = [...new Set(c.enrollments.map((e) => e.service))];

  const counts: Partial<Record<TabKey, number>> = {
    services: c.enrollments.length,
    documents: c.documents.length,
    messages: unread || undefined,
    signatures: c.signatures.filter((s) => s.status === "pending").length || undefined,
    notes: c.notes.length,
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
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ink-2">
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                  <AtSign size={14} className="text-muted" /> {c.email}
                </a>
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                  <Phone size={14} className="text-muted" /> {c.phone}
                </a>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-muted" /> {c.address.city}, {c.address.state}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {services.map((s) => (
                  <ServiceTag key={s} service={s} />
                ))}
                {c.tags.map((t) => (
                  <span key={t} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-[340px] lg:justify-end">
            <Button size="sm" icon={Mail} onClick={() => go("messages")}>
              Message
            </Button>
            <Button size="sm" icon={CalendarPlus} onClick={() => go("appointments")}>
              Schedule
            </Button>
            <Button size="sm" icon={FilePlus2} onClick={() => go("documents")}>
              Request docs
            </Button>
            <Button size="sm" variant="primary" icon={Receipt} onClick={() => go("invoices")}>
              New invoice
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Stat label="Balance due" value={usd(bal)} tone={bal > 0 ? "text-ink" : "text-faint"} onClick={() => go("invoices")} />
          <Stat label="Open requirements" value={String(open)} tone={open > 0 ? "text-warning-ink" : "text-faint"} onClick={() => go("documents")} />
          <Stat label="Next appointment" value={next ? fmtDateTime(next.at) : "None scheduled"} small onClick={() => go("appointments")} />
          <div>
            <dt className="text-[12px] text-muted">Assigned staff</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {c.staffIds.map((id) => (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-[12.5px] font-medium text-ink-2 ring-1 ring-line">
                  <Avatar name={staffById(id).name} size={22} />
                  {staffById(id).name}
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
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium transition-colors ${
                  on ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <t.icon size={16} />
                {t.label}
                {counts[t.key] ? (
                  <span className={`rounded-full px-1.5 text-[11px] font-semibold ${on ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-muted ring-1 ring-line"}`}>
                    {counts[t.key]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" className="pt-5">
        {tab === "overview" && <OverviewTab c={c} go={go} />}
        {tab === "services" && <ServicesTab c={c} />}
        {tab === "documents" && <DocumentsTab c={c} />}
        {tab === "messages" && <MessagesTab c={c} />}
        {tab === "appointments" && <AppointmentsTab c={c} />}
        {tab === "invoices" && <InvoicesTab c={c} />}
        {tab === "signatures" && <SignaturesTab c={c} />}
        {tab === "notes" && <NotesTab c={c} />}
        {tab === "activity" && <ActivityTab c={c} />}
      </div>
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
