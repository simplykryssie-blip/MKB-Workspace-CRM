"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  FilePlus2,
  FileUp,
  Lock,
  MapPin,
  MessageSquare,
  NotebookPen,
  PenLine,
  Phone,
  Pin,
  Plus,
  Receipt,
  Send,
  ShieldAlert,
  Video,
  CalendarPlus,
  ClipboardCheck,
  RefreshCcw,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { STAGES, staffById } from "@/lib/sample/clients";
import { docStatus, enrollmentStatus, invoiceStatus, signatureStatus } from "@/lib/status";
import { fileSize, fmtDate, fmtDateTime, fmtTime, relTime, usd } from "@/lib/format";
import type { ActivityKind, Client, Enrollment, Message, Note, ServiceKey } from "@/lib/types";
import type { TabKey } from "./ClientProfile";

const svcColor = (s: ServiceKey) => `var(--svc-${s})`;

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function OverviewTab({ c, go }: { c: Client; go: (k: TabKey) => void }) {
  const requested = c.documents.filter((d) => d.status === "requested");
  const pendingSig = c.signatures.filter((s) => s.status === "pending");
  const unpaid = c.invoices.filter((i) => i.status === "open" || i.status === "overdue" || i.status === "partial");
  const pinned = c.notes.filter((n) => n.pinned);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Active services" subtitle="One client record, enrolled across divisions" action={<Button size="sm" variant="ghost" icon={Plus} onClick={() => go("services")}>Add service</Button>} />
          <ul className="space-y-3 px-5 pb-5 sm:px-6">
            {c.enrollments.map((e) => (
              <EnrollmentRow key={e.id} e={e} compact />
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Outstanding requirements" subtitle="What's blocking progress right now" />
          <div className="px-3 pb-3 sm:px-4">
            {requested.length + pendingSig.length + unpaid.length === 0 ? (
              <p className="flex items-center gap-2 px-2 pb-3 text-[13.5px] text-muted">
                <CheckCircle2 size={16} className="text-success" /> Nothing outstanding — all caught up.
              </p>
            ) : (
              <ul>
                {requested.map((d) => (
                  <ReqRow key={d.id} icon={FileUp} title={d.name} sub={`Requested ${relTime(d.requestedAt)}`} service={d.service} tone="warning" label="Document" onClick={() => go("documents")} />
                ))}
                {pendingSig.map((s) => (
                  <ReqRow key={s.id} icon={PenLine} title={s.document} sub={`Sent ${relTime(s.sentAt)}`} service={s.service} tone="warning" label="Signature" onClick={() => go("signatures")} />
                ))}
                {unpaid.map((i) => (
                  <ReqRow key={i.id} icon={Receipt} title={`${i.number} · ${usd(i.amount - i.paid)} due`} sub={i.status === "overdue" ? `Overdue since ${fmtDate(i.dueAt)}` : `Due ${fmtDate(i.dueAt)}`} service={i.service} tone={i.status === "overdue" ? "danger" : "info"} label="Invoice" onClick={() => go("invoices")} />
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title={c.type === "business" ? "Business information" : "Contact information"} />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 px-5 pb-5 text-[13.5px] sm:px-6">
            {c.business && (
              <>
                <Dt>Legal name</Dt><Dd>{c.business.legalName}</Dd>
                <Dt>Entity</Dt><Dd>{c.business.entityType} · {c.business.state}</Dd>
                <Dt>Industry</Dt><Dd>{c.business.industry}</Dd>
                {c.business.formedAt && (<><Dt>Formed</Dt><Dd>{fmtDate(c.business.formedAt)}</Dd></>)}
                <Dt>EIN</Dt><Dd><Masked value={c.business.einMasked} /></Dd>
                <Dt>Fiscal year end</Dt><Dd>{c.business.fiscalYearEnd}</Dd>
                <Dt>Primary contact</Dt><Dd>{c.contactName}</Dd>
              </>
            )}
            {!c.business && (
              <>
                {c.dob && (<><Dt>Date of birth</Dt><Dd><Masked value={`••/••/${c.dob.slice(0, 4)}`} /></Dd></>)}
                <Dt>SSN / ITIN</Dt><Dd><Masked value={c.taxIdMasked} /></Dd>
              </>
            )}
            <Dt>Email</Dt><Dd>{c.email}</Dd>
            <Dt>Phone</Dt><Dd>{c.phone}</Dd>
            <Dt>Address</Dt><Dd>{c.address.line1}<br />{c.address.city}, {c.address.state} {c.address.zip}</Dd>
            <Dt>Preferred contact</Dt><Dd>{c.preferredContact}</Dd>
            <Dt>Source</Dt><Dd>{c.source}</Dd>
          </dl>
        </Card>

        {pinned.length > 0 && (
          <Card>
            <CardHeader title="Pinned notes" subtitle="Internal — never visible to the client" action={<Button size="sm" variant="ghost" onClick={() => go("notes")}>All notes</Button>} />
            <ul className="space-y-2 px-5 pb-5 sm:px-6">
              {pinned.map((n) => (
                <li key={n.id} className="rounded-xl border border-warning/25 bg-warning-soft/60 p-3 text-[13.5px] text-ink-2">
                  <p>{n.body}</p>
                  <p className="mt-1.5 text-[12px] text-muted">{staffById(n.authorId).name} · {relTime(n.at)}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title="Recent activity" action={<Button size="sm" variant="ghost" onClick={() => go("activity")}>View all</Button>} />
          <Timeline items={c.activity.slice(0, 5)} />
        </Card>
      </div>
    </div>
  );
}

function ReqRow({ icon: Icon, title, sub, service, tone, label, onClick }: { icon: LucideIcon; title: string; sub: string; service: ServiceKey; tone: "warning" | "danger" | "info"; label: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-hover">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone === "danger" ? "bg-danger-soft text-danger" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"}`}>
          <Icon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink">{title}</span>
          <span className="block text-[12px] text-muted">{label} · {sub}</span>
        </span>
        <span className="hidden sm:block"><ServiceTag service={service} short /></span>
      </button>
    </li>
  );
}

const Dt = ({ children }: { children: React.ReactNode }) => <dt className="text-muted">{children}</dt>;
const Dd = ({ children }: { children: React.ReactNode }) => <dd className="min-w-0 break-words font-medium text-ink">{children}</dd>;

function Masked({ value }: { value?: string }) {
  if (!value) return <span className="text-faint">Not on file</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[13px]" title="Masked. Revealing requires the 'View sensitive data' permission and is logged.">
      {value}
      <Lock size={12} className="text-faint" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

function EnrollmentRow({ e, compact }: { e: Enrollment; compact?: boolean }) {
  const st = enrollmentStatus[e.status];
  const stages = STAGES[e.service];
  const idx = Math.max(0, stages.indexOf(e.stage));
  return (
    <li className="rounded-xl border border-line p-4" style={{ borderLeft: `4px solid ${svcColor(e.service)}` }}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ServiceTag service={e.service} />
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <div className="mt-1.5 text-[14.5px] font-semibold text-ink">{e.title}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">
            Stage: <span className="font-medium text-ink-2">{e.stage}</span> · {staffById(e.staffId).name}
            {e.dueAt && <> · Due {fmtDate(e.dueAt, { month: "short", day: "numeric" })}</>}
          </div>
        </div>
        {!compact && <div className="text-right text-[13px]"><div className="font-semibold text-ink tabular-nums">{usd(e.fee)}</div><div className="text-[12px] text-muted">Fee</div></div>}
      </div>
      <div className="mt-3">
        <Progress value={e.progress} color={svcColor(e.service)} label={`${e.title} progress`} />
      </div>
      {!compact && (
        <ol className="mt-4 flex flex-wrap gap-x-1 gap-y-2" aria-label="Workflow stages">
          {stages.map((s, i) => {
            const done = i < idx || e.status === "complete";
            const cur = i === idx && e.status !== "complete";
            return (
              <li key={s} className="flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                    cur ? "bg-accent text-white" : done ? "bg-success-soft text-success-ink" : "bg-surface-2 text-muted ring-1 ring-line"
                  }`}
                  aria-current={cur ? "step" : undefined}
                >
                  {done && <Check size={12} strokeWidth={3} />}
                  {s}
                </span>
                {i < stages.length - 1 && <span className="h-px w-2 bg-line-strong" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

export function ServicesTab({ c }: { c: Client }) {
  const [adding, setAdding] = useState(false);
  const enrolled = new Set(c.enrollments.map((e) => e.service));
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Service enrollments"
          subtitle={`${c.enrollments.length} engagement${c.enrollments.length === 1 ? "" : "s"} across ${enrolled.size} division${enrolled.size === 1 ? "" : "s"}`}
          action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setAdding((a) => !a)}>Enroll in a service</Button>}
        />
        {adding && (
          <div className="mx-5 mb-4 rounded-xl border border-accent/30 bg-accent-soft/50 p-4 sm:mx-6">
            <p className="text-[13.5px] font-medium text-ink">Add a new engagement to this same client record — no duplicate profile is created.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SERVICE_ORDER.map((s) => (
                <button key={s} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:border-accent">
                  <span className="h-8 w-1.5 rounded-full" style={{ background: svcColor(s) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-ink">{SERVICES[s].label}</span>
                    <span className="block text-[12px] text-muted">{enrolled.has(s) ? "Already enrolled — add another engagement" : "Start intake"}</span>
                  </span>
                  <Plus size={16} className="text-accent" />
                </button>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">Sample preview — enrollment is saved in Phase 3.</p>
          </div>
        )}
        <ul className="space-y-3 px-5 pb-5 sm:px-6">
          {c.enrollments.map((e) => (
            <EnrollmentRow key={e.id} e={e} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export function DocumentsTab({ c }: { c: Client }) {
  const [svc, setSvc] = useState<ServiceKey | "all">("all");
  const [canSensitive, setCanSensitive] = useState(true);
  const docs = c.documents.filter((d) => svc === "all" || d.service === svc);
  const services = [...new Set(c.documents.map((d) => d.service))];
  return (
    <Card>
      <CardHeader
        title="Documents"
        subtitle={`${c.documents.filter((d) => d.status === "requested").length} requested · ${c.documents.filter((d) => d.status !== "requested").length} on file`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={FilePlus2}>Request document</Button>
            <Button size="sm" variant="primary" icon={FileUp}>Upload</Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 sm:px-6">
        <Chip on={svc === "all"} onClick={() => setSvc("all")}>All</Chip>
        {services.map((s) => (
          <Chip key={s} on={svc === s} onClick={() => setSvc(s)} dot={svcColor(s)}>{SERVICES[s].label}</Chip>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-strong px-2.5 py-1 text-[12px] text-muted" title="Preview how this tab looks for a staff member without the sensitive-documents permission">
          <input type="checkbox" checked={!canSensitive} onChange={() => setCanSensitive((v) => !v)} className="accent-[var(--accent)]" />
          Preview as staff without sensitive-doc access
        </label>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {docs.map((d) => {
          const st = docStatus[d.status];
          const locked = d.sensitive && !canSensitive;
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap sm:px-6">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${d.status === "requested" ? "border-2 border-dashed border-line-strong text-faint" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}>
                {locked ? <Lock size={17} /> : <FileUp size={17} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`truncate text-[14px] font-medium ${locked ? "text-muted" : "text-ink"}`}>{locked ? "Restricted document" : d.name}</span>
                  {d.sensitive && <Badge tone="danger" icon={ShieldAlert}>Restricted</Badge>}
                </div>
                <div className="mt-0.5 text-[12px] text-muted">
                  {d.category} · {d.uploadedAt ? `Uploaded ${relTime(d.uploadedAt)} by ${d.uploadedBy}${d.sizeKb ? ` · ${fileSize(d.sizeKb)}` : ""}` : `Requested ${relTime(d.requestedAt)}`}
                </div>
              </div>
              <ServiceTag service={d.service} short />
              <Badge tone={st.tone}>{st.label}</Badge>
              <div className="flex gap-1">
                {d.status === "requested" ? (
                  <Button size="sm" variant="ghost" icon={Send}>Remind</Button>
                ) : (
                  <>
                    <IconAction icon={Eye} label={locked ? "Requires sensitive-document permission" : "Preview"} disabled={locked} />
                    <IconAction icon={Download} label={locked ? "Requires sensitive-document permission" : "Download (logged)"} disabled={locked} />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1.5 px-5 py-3 text-[12px] text-muted sm:px-6">
        <Lock size={12} /> Restricted files (IDs, tax returns, court records) need the sensitive-documents permission. Every view and download is recorded in the audit log.
      </p>
    </Card>
  );
}

function IconAction({ icon: Icon, label, disabled }: { icon: LucideIcon; label: string; disabled?: boolean }) {
  return (
    <button aria-label={label} title={label} disabled={disabled} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">
      <Icon size={16} />
    </button>
  );
}

function Chip({ on, onClick, dot, children }: { on: boolean; onClick: () => void; dot?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-hover"}`}>
      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export function MessagesTab({ c }: { c: Client }) {
  const [msgs, setMsgs] = useState<Message[]>(c.messages);
  const [draft, setDraft] = useState("");
  const send = () => {
    if (!draft.trim()) return;
    setMsgs((m) => [...m, { id: `local-${m.length}`, from: "staff", author: "MKB Owner", body: draft.trim(), at: new Date().toISOString(), read: true }]);
    setDraft("");
  };
  return (
    <Card className="flex flex-col">
      <CardHeader title="Secure messages" subtitle="Shared with the client in their portal" />
      <div className="scrollbar-thin max-h-[520px] space-y-3 overflow-y-auto border-y border-line bg-surface-2 px-4 py-4 sm:px-6">
        {msgs.map((m) => {
          const mine = m.from === "staff";
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar name={m.author} size={30} />
              <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
                <div className={`inline-block rounded-2xl px-3.5 py-2.5 text-left text-[14px] leading-relaxed ${mine ? "rounded-tr-md bg-accent text-white" : "rounded-tl-md border border-line bg-surface text-ink"}`}>
                  {m.body}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted" style={{ justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <span>{m.author}</span>·<span>{m.id.startsWith("local") ? "just now" : fmtDateTime(m.at)}</span>
                  {m.service && <>· {SERVICES[m.service].short}</>}
                  {!m.read && <Badge tone="info">New</Badge>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-2 p-4 sm:px-6">
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            rows={2}
            placeholder={`Message ${c.contactName ?? c.name}…`}
            className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
        </label>
        <Button variant="primary" icon={Send} onClick={send} disabled={!draft.trim()}>
          Send
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

const modeIcon = { Video, Phone, "In person": MapPin } as const;

export function AppointmentsTab({ c }: { c: Client }) {
  const upcoming = c.appointments.filter((a) => a.status === "scheduled");
  const past = c.appointments.filter((a) => a.status !== "scheduled").reverse();
  const Row = ({ a }: { a: (typeof c.appointments)[number] }) => {
    const M = modeIcon[a.mode];
    const dt = new Date(a.at);
    return (
      <li className="flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-surface-hover">
        <div className="w-14 shrink-0 rounded-xl border border-line bg-surface-2 py-1.5 text-center">
          <div className="text-[10.5px] font-semibold uppercase text-muted">{dt.toLocaleDateString("en-US", { month: "short" })}</div>
          <div className="text-[18px] font-bold leading-none text-ink">{dt.getDate()}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-ink">{a.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
            <span>{fmtTime(a.at)} · {a.durationMin} min</span>
            <span className="inline-flex items-center gap-1"><M size={12} /> {a.mode}</span>
            <span>with {staffById(a.staffId).name}</span>
          </div>
        </div>
        <span className="hidden sm:block"><ServiceTag service={a.service} short /></span>
        {a.status === "completed" && <Badge tone="success" icon={Check}>Completed</Badge>}
      </li>
    );
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Upcoming" subtitle={`${upcoming.length} scheduled`} action={<Button size="sm" variant="primary" icon={CalendarPlus}>Schedule</Button>} />
        <ul className="px-3 pb-3 sm:px-4">{upcoming.length ? upcoming.map((a) => <Row key={a.id} a={a} />) : <li className="px-2 pb-3 text-[13.5px] text-muted">Nothing scheduled.</li>}</ul>
      </Card>
      <Card>
        <CardHeader title="Past appointments" />
        <ul className="px-3 pb-3 sm:px-4">{past.map((a) => <Row key={a.id} a={a} />)}</ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Invoices & payments                                                 */
/* ------------------------------------------------------------------ */

export function InvoicesTab({ c }: { c: Client }) {
  const billed = c.invoices.reduce((s, i) => s + i.amount, 0);
  const paid = c.invoices.reduce((s, i) => s + i.paid, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Total billed", billed, "text-ink"],
          ["Collected", paid, "text-success-ink"],
          ["Outstanding", billed - paid, billed - paid > 0 ? "text-danger-ink" : "text-faint"],
        ].map(([l, v, cls]) => (
          <div key={l as string} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
            <div className="text-[12px] text-muted">{l}</div>
            <div className={`mt-0.5 text-[20px] font-bold tabular-nums ${cls}`}>{usd(v as number)}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader title="Invoices" action={<div className="flex gap-2"><Button size="sm" icon={CreditCard}>Record payment</Button><Button size="sm" variant="primary" icon={Plus}>New invoice</Button></div>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5 sm:px-6">Invoice</th>
                <th className="px-3 py-2.5">Service</th>
                <th className="px-3 py-2.5">Due</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-5 py-2.5 text-right sm:px-6">Balance</th>
              </tr>
            </thead>
            <tbody>
              {c.invoices.map((i) => {
                const st = invoiceStatus[i.status];
                return (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 sm:px-6">
                      <div className="font-semibold text-ink tabular-nums">{i.number}</div>
                      <div className="max-w-[260px] truncate text-[12px] text-muted">{i.description}</div>
                    </td>
                    <td className="px-3 py-3"><ServiceTag service={i.service} short /></td>
                    <td className="px-3 py-3 text-ink-2">{fmtDate(i.dueAt)}</td>
                    <td className="px-3 py-3"><Badge tone={st.tone} icon={i.status === "overdue" ? AlertCircle : i.status === "paid" ? Check : undefined}>{st.label}</Badge></td>
                    <td className="px-3 py-3 text-right tabular-nums">{usd(i.amount)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums sm:px-6">{i.amount - i.paid > 0 ? usd(i.amount - i.paid) : <span className="font-normal text-faint">$0</span>}</td>
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

/* ------------------------------------------------------------------ */
/* Signatures                                                          */
/* ------------------------------------------------------------------ */

export function SignaturesTab({ c }: { c: Client }) {
  return (
    <Card>
      <CardHeader title="Signatures" subtitle="Engagement letters, authorizations and consents" action={<Button size="sm" variant="primary" icon={PenLine}>Send for signature</Button>} />
      <ul className="divide-y divide-line border-t border-line">
        {c.signatures.map((s) => {
          const st = signatureStatus[s.status];
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap sm:px-6">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.status === "signed" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                {s.status === "signed" ? <CheckCircle2 size={18} /> : <Clock size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">{s.document}</div>
                <div className="text-[12px] text-muted">Sent {fmtDate(s.sentAt)}{s.signedAt && ` · Signed ${fmtDate(s.signedAt)}`}</div>
              </div>
              <ServiceTag service={s.service} short />
              <Badge tone={st.tone}>{st.label}</Badge>
              {s.status === "pending" ? <Button size="sm" variant="ghost" icon={RefreshCcw}>Resend</Button> : <IconAction icon={Download} label="Download signed copy" />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Internal notes                                                      */
/* ------------------------------------------------------------------ */

export function NotesTab({ c }: { c: Client }) {
  const [notes, setNotes] = useState<Note[]>(c.notes);
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    setNotes((n) => [{ id: `local-${n.length}`, authorId: "s-mk", body: draft.trim(), at: new Date().toISOString() }, ...n]);
    setDraft("");
  };
  return (
    <Card>
      <CardHeader title="Internal notes" subtitle="Staff only — never visible in the client portal" />
      <div className="mx-5 mb-4 rounded-xl border border-line bg-surface-2 p-3 sm:mx-6">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Add an internal note…" aria-label="New internal note" className="w-full resize-none bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none" />
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[12px] text-muted"><Lock size={12} /> Internal</span>
          <Button size="sm" variant="primary" icon={NotebookPen} onClick={add} disabled={!draft.trim()}>Add note</Button>
        </div>
      </div>
      <ul className="space-y-3 px-5 pb-5 sm:px-6">
        {notes.map((n) => {
          const author = staffById(n.authorId);
          return (
            <li key={n.id} className={`rounded-xl border p-4 ${n.pinned ? "border-warning/30 bg-warning-soft/50" : "border-line"}`}>
              <div className="flex items-center gap-2">
                <Avatar name={author.name} size={26} />
                <span className="text-[13px] font-semibold text-ink">{author.name}</span>
                <span className="text-[12px] text-muted">· {n.id.startsWith("local") ? "just now" : relTime(n.at)}</span>
                {n.service && <ServiceTag service={n.service} short />}
                {n.pinned && <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-warning-ink"><Pin size={12} /> Pinned</span>}
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{n.body}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

const kindMeta: Record<ActivityKind, { icon: LucideIcon; cls: string }> = {
  upload: { icon: FileUp, cls: "bg-accent-soft text-accent" },
  payment: { icon: CreditCard, cls: "bg-success-soft text-success" },
  signature: { icon: PenLine, cls: "bg-svc-books-soft text-svc-books" },
  message: { icon: MessageSquare, cls: "bg-svc-expunge-soft text-svc-expunge" },
  intake: { icon: ClipboardCheck, cls: "bg-svc-biz-soft text-svc-biz" },
  status: { icon: RefreshCcw, cls: "bg-surface-2 text-ink-2 ring-1 ring-line" },
  appointment: { icon: CalendarPlus, cls: "bg-accent-soft text-accent" },
  note: { icon: NotebookPen, cls: "bg-warning-soft text-warning" },
  invoice: { icon: Receipt, cls: "bg-surface-2 text-ink-2 ring-1 ring-line" },
};

function Timeline({ items }: { items: Client["activity"] }) {
  return (
    <ol className="px-5 pb-4 sm:px-6">
      {items.map((a, i) => {
        const m = kindMeta[a.kind];
        return (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-1">
            {i < items.length - 1 && <span className="absolute left-[17px] top-10 h-[calc(100%-32px)] w-px bg-line" aria-hidden="true" />}
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${m.cls}`}><m.icon size={16} /></span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13.5px] text-ink">{a.text}</p>
              <p className="mt-0.5 text-[12px] text-muted">{fmtDateTime(a.at)} · by {a.actor}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ActivityTab({ c }: { c: Client }) {
  return (
    <Card>
      <CardHeader title="Activity history" subtitle="Everything that has happened on this client record" />
      <Timeline items={c.activity} />
    </Card>
  );
}

