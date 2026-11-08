"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FileUp,
  Lock,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  PenLine,
  Phone,
  PhoneCall,
  UserPlus,
  Pin,
  PinOff,
  Plus,
  Receipt,
  RefreshCcw,
  Send,
  ShieldAlert,
  SkipForward,
  Trash2,
  Video,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { Progress } from "@/components/ui/Progress";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { useToast } from "@/components/ui/Toast";
import { SERVICES } from "@/lib/sample-data";
import { STAGES, SAMPLE_NOW, staffById, meId } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { docStatus, enrollmentStatus, invoiceStatus, signatureStatus } from "@/lib/status";
import { fileSize, fmtDate, fmtDateTime, fmtTime, relTime, usd } from "@/lib/format";
import { formatPhone, formatZip, isoToDob, maskDOB, maskEIN, maskTaxId } from "@/lib/validation";
import type { ActivityKind, Client, ClientDocument, Enrollment, ServiceKey } from "@/lib/types";
import { downloadPlaceholder } from "./dialogs";
import type { DialogKind, TabKey } from "./ClientProfile";
import { useTax } from "@/lib/store/tax-store";
import { useBooks } from "@/lib/store/books-store";
import { useBiz } from "@/lib/store/biz-store";
import { useExp } from "@/lib/store/exp-store";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND } from "@/lib/sync/remote";
import { ReturnStatusBadge } from "@/components/tax/TaxBits";

export type Act = {
  go: (k: TabKey) => void;
  open: (kind: DialogKind, arg?: unknown) => void;
};

const svcColor = (s: ServiceKey) => `var(--svc-${s})`;
const isPast = (iso: string) => iso < SAMPLE_NOW.toISOString();

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function OverviewTab({ c, act }: { c: Client; act: Act }) {
  const requested = c.documents.filter((d) => d.status === "requested" || d.status === "rejected");
  const pendingSig = c.signatures.filter((s) => s.status === "pending");
  const unpaid = c.invoices.filter((i) => i.status === "open" || i.status === "overdue" || i.status === "partial");
  const pinned = c.notes.filter((n) => n.pinned);
  const active = c.enrollments.filter((e) => e.status !== "complete");
  const done = c.enrollments.filter((e) => e.status === "complete");
  const missingTax = missingTaxInfo(c);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Active services"
            subtitle={done.length ? `${done.length} completed engagement${done.length > 1 ? "s" : ""} in Services` : "One client record, enrolled across divisions"}
            action={<Button size="sm" variant="ghost" icon={Plus} onClick={() => act.open("enroll")}>Add service</Button>}
          />
          <ul className="space-y-3 px-5 pb-5 sm:px-6">
            {active.length ? active.map((e) => <EnrollmentRow key={e.id} c={c} e={e} compact />) : <li className="text-[13.5px] text-muted">No active engagements.</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Outstanding requirements" subtitle="What's blocking progress right now" />
          <div className="px-3 pb-3 sm:px-4">
            {requested.length + pendingSig.length + unpaid.length + missingTax.length === 0 ? (
              <p className="flex items-center gap-2 px-2 pb-3 text-[13.5px] text-muted">
                <CheckCircle2 size={16} className="text-success" /> Nothing outstanding — all caught up.
              </p>
            ) : (
              <ul>
                {missingTax.length > 0 && (
                  <ReqRow icon={ShieldAlert} title={`Missing ${missingTax.join(" and ")}`} sub="Required before preparing the return" service="tax" tone="danger" label="Tax ID" onClick={() => act.open("edit")} />
                )}
                {requested.map((d) => (
                  <ReqRow key={d.id} icon={FileUp} title={d.name} sub={d.status === "rejected" ? "Re-upload requested" : `Requested ${relTime(d.requestedAt)}`} service={d.service} tone="warning" label="Document" onClick={() => act.go("documents")} />
                ))}
                {pendingSig.map((s) => (
                  <ReqRow key={s.id} icon={PenLine} title={s.document} sub={`Sent ${relTime(s.sentAt)}`} service={s.service} tone="warning" label="Signature" onClick={() => act.go("signatures")} />
                ))}
                {unpaid.map((i) => (
                  <ReqRow key={i.id} icon={Receipt} title={`${i.number} · ${usd(i.amount - i.paid)} due`} sub={i.status === "overdue" ? `Overdue since ${fmtDate(i.dueAt)}` : `Due ${fmtDate(i.dueAt)}`} service={i.service} tone={i.status === "overdue" ? "danger" : "info"} label="Invoice" onClick={() => act.go("invoices")} />
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title={c.type === "business" ? "Business information" : "Contact information"} action={<Button size="sm" variant="ghost" onClick={() => act.open("edit")}>Edit</Button>} />
          {missingTax.length > 0 && (
            <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-[12.5px] text-warning-ink sm:mx-6">
              <AlertCircle size={15} className="mt-px shrink-0" />
              <span className="flex-1">
                <strong>Needed for tax preparation:</strong> {missingTax.join(", ")}.{" "}
                <button onClick={() => act.open("edit")} className="font-semibold underline underline-offset-2">Add now</button>
              </span>
            </div>
          )}
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 px-5 pb-5 text-[13.5px] sm:px-6">
            {c.business && (
              <>
                <Dt>Legal name</Dt><Dd>{c.business.legalName}</Dd>
                <Dt>Entity</Dt><Dd>{c.business.entityType} · {c.business.state}</Dd>
                <Dt>Industry</Dt><Dd>{c.business.industry}</Dd>
                {c.business.formedAt && (<><Dt>Formed</Dt><Dd>{fmtDate(c.business.formedAt)}</Dd></>)}
                <Dt>EIN</Dt><Dd><Sensitive c={c} field="ein" masked={maskEIN(c.business.einLast4)} /></Dd>
                <Dt>Responsible party</Dt>
                <Dd>
                  {c.business.responsibleParty ? (
                    <>
                      {c.business.responsibleParty.name} <span className="font-normal text-muted">· {c.business.responsibleParty.title}</span>
                      <br />
                      <span className="text-[12px] font-normal text-muted">{c.business.responsibleParty.taxIdType ?? "SSN"} </span>
                      <Sensitive c={c} field="rpTaxId" masked={maskTaxId(c.business.responsibleParty.taxIdLast4)} />
                    </>
                  ) : (
                    <span className="text-faint">Not on file</span>
                  )}
                </Dd>
                <Dt>Fiscal year end</Dt><Dd>{c.business.fiscalYearEnd}</Dd>
                <Dt>Primary contact</Dt><Dd>{c.contactName ?? "—"}</Dd>
              </>
            )}
            {!c.business && (
              <>
                <Dt>Date of birth</Dt><Dd><Sensitive c={c} field="dob" masked={maskDOB(c.dob)} /></Dd>
                <Dt>{c.taxIdType ?? "SSN / ITIN"}</Dt><Dd><Sensitive c={c} field="taxId" masked={maskTaxId(c.taxIdLast4)} /></Dd>
              </>
            )}
            <Dt>Email</Dt><Dd>{c.email}</Dd>
            <Dt>Phone</Dt><Dd>{c.phone && c.phone !== "—" ? formatPhone(c.phone) : <span className="text-faint">Not on file</span>}</Dd>
            <Dt>Address</Dt>
            <Dd>
              {c.address.line1 && c.address.line1 !== "—" ? (
                <>
                  {c.address.line1}
                  {c.address.line2 && <>, {c.address.line2}</>}
                  <br />
                  {c.address.city}, {c.address.state} {formatZip(c.address.zip)}
                </>
              ) : (
                <span className="text-faint">Not on file</span>
              )}
            </Dd>
            <Dt>Preferred contact</Dt><Dd>{c.preferredContact}</Dd>
            <Dt>Source</Dt><Dd>{c.source}</Dd>
          </dl>
        </Card>

        {pinned.length > 0 && (
          <Card>
            <CardHeader title="Pinned notes" subtitle="Internal — never visible to the client" action={<Button size="sm" variant="ghost" onClick={() => act.go("notes")}>All notes</Button>} />
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

        <TaxReturnsCard c={c} />

        <Card>
          <CardHeader title="Recent activity" action={<Button size="sm" variant="ghost" onClick={() => act.go("activity")}>View all</Button>} />
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

/** Fields required before tax preparation can proceed. */
export function missingTaxInfo(c: Client): string[] {
  if (!c.enrollments.some((e) => e.service === "tax" && e.status !== "complete")) return [];
  if (c.type === "business") {
    const rp = c.business?.responsibleParty;
    return [!c.business?.einLast4 && "EIN", !rp?.name && "responsible party", rp?.name && !rp.taxIdLast4 && "responsible party SSN/ITIN"].filter(Boolean) as string[];
  }
  return [!c.dob && "date of birth", !c.taxIdLast4 && "SSN or ITIN"].filter(Boolean) as string[];
}

/** Masked identifier with an audited, auto-hiding reveal. */
export function Sensitive({ c, field, masked }: { c: Client; field: "taxId" | "ein" | "dob" | "rpTaxId"; masked: string }) {
  const store = useClients();
  const toast = useToast();
  const team = useTeam();
  // A client-record view permission never implies these: each reveal needs its own sensitive permission.
  const allowed = field === "ein" ? team.sensitive("tax.ein") : field === "dob" ? team.sensitive("tax.viewMasked") || team.sensitive("exp.viewMasked") : team.sensitive("tax.revealSsn") || team.sensitive("exp.revealSsn");
  const [shown, setShown] = useState<string | null>(null);
  // If the stored value changes (edited), drop any revealed copy immediately.
  useEffect(() => setShown(null), [masked]);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 30000);
    return () => clearTimeout(t);
  }, [shown]);
  if (!masked) return <span className="text-faint">Not on file</span>;
  const label = field === "taxId" ? `full ${c.taxIdType ?? "tax ID"}` : field === "ein" ? "full EIN" : field === "rpTaxId" ? "responsible party tax ID" : "date of birth";
  const reveal = () => {
    if (shown) return setShown(null);
    if (!allowed) {
      team.log({ action: "Sensitive reveal", resource: `Client ${c.id} — ${label}`, meta: "Denied: role lacks the reveal permission", success: false });
      return toast("Your role can't reveal this — it needs the separate sensitive-information permission.", "info");
    }
    if (BACKEND) {
      // The server checks record access and the reveal permission, and writes the audit entry.
      store.revealRemote(c.id, field).then((v) => { if (!v) return toast("Full value isn't available for this record", "info"); setShown(field === "dob" ? isoToDob(v) : v); toast("Revealed for 30 seconds — recorded in the audit log", "info"); }).catch((e) => toast(e instanceof Error ? e.message : "Couldn't reveal", "info"));
      return;
    }
    team.log({ action: "Sensitive reveal", resource: `Client ${c.id} — ${label}` });
    const full = field === "dob" ? isoToDob(c.dob) : store.reveal(c.id, field);
    if (field === "dob") store.reveal(c.id, "dob");
    if (!full) return toast("Full value isn't available for this record", "info");
    setShown(full);
    toast("Revealed for 30 seconds — recorded in the activity log", "info");
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[13px] tabular-nums">{shown ?? masked}</span>
      {!allowed && !shown && <span className="sr-only">Reveal not permitted for this role</span>}
      <button onClick={reveal} title={shown ? "Hide" : allowed ? "Reveal (logged)" : "Your role can't reveal this"} aria-label={shown ? "Hide" : `Reveal ${field === "taxId" ? c.taxIdType ?? "tax ID" : field === "ein" ? "EIN" : field === "rpTaxId" ? "responsible party tax ID" : "date of birth"}`} className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-surface-hover hover:text-ink">
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  );
}

/** Every tax year for this client, newest first — each links to its return. */
function TaxReturnsCard({ c }: { c: Client }) {
  const returns = useTax().returns.filter((r) => r.clientId === c.id).sort((a, b) => b.taxYear - a.taxYear);
  if (!returns.length) return null;
  return (
    <Card>
      <CardHeader title="Tax returns" subtitle="One return per tax year" action={<Button size="sm" variant="ghost" href="/services/tax-preparation">Tax Center</Button>} />
      <ul className="px-3 pb-3 sm:px-4">
        {returns.map((r) => (
          <li key={r.id}>
            <Link href={`/services/tax-preparation/returns/${r.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
              <span className="w-12 text-[14px] font-bold text-ink tabular-nums">{r.taxYear}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{r.form}</span>
              <ReturnStatusBadge status={r.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

function EnrollmentRow({ c, e, compact }: { c: Client; e: Enrollment; compact?: boolean }) {
  const store = useClients();
  const toast = useToast();
  const st = enrollmentStatus[e.status];
  const stages = STAGES[e.service];
  const idx = Math.max(0, stages.indexOf(e.stage));
  const last = idx >= stages.length - 1;
  const advance = () => {
    store.advanceStage(c.id, e.id);
    toast(last ? "Already at the final stage" : `Moved to "${stages[idx + 1]}"`, last ? "info" : "success");
  };
  const taxReturn = useTax().returns.find((r) => r.enrollmentId === e.id);
  const booksWs = useBooks().workspaces.find((w) => w.enrollmentId === e.id);
  const bizReq = useBiz().requests.find((r) => r.enrollmentId === e.id);
  const expMatter = useExp().matters.find((x) => x.enrollmentId === e.id);
  const isTax = e.service === "tax" || !!booksWs || !!bizReq || !!expMatter;
  const setStatus = (s: Enrollment["status"]) => {
    store.setEnrollmentStatus(c.id, e.id, s);
    toast(`Status set to "${enrollmentStatus[s].label}"`);
  };
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
        {!compact && (
          <div className="flex items-start gap-3">
            <div className="text-right text-[13px]">
              <div className="font-semibold text-ink tabular-nums">{usd(e.fee)}</div>
              <div className="text-[12px] text-muted">Fee</div>
            </div>
            {e.status !== "complete" && !isTax && (
              <Menu
                label={`Actions for ${e.title}`}
                trigger={({ toggle }) => (
                  <button onClick={toggle} aria-label={`Actions for ${e.title}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink">
                    <MoreHorizontal size={18} />
                  </button>
                )}
                items={[
                  { label: last ? "Final stage reached" : `Move to "${stages[idx + 1]}"`, icon: SkipForward, onSelect: advance, disabled: last },
                  "divider",
                  { label: "Mark in progress", icon: RefreshCcw, onSelect: () => setStatus("active"), disabled: e.status === "active" },
                  { label: "Waiting on client", icon: Clock, onSelect: () => setStatus("waiting_on_client"), disabled: e.status === "waiting_on_client" },
                  { label: "In review", icon: Eye, onSelect: () => setStatus("in_review"), disabled: e.status === "in_review" },
                  { label: "Put on hold", icon: XCircle, onSelect: () => setStatus("on_hold"), disabled: e.status === "on_hold" },
                ]}
              />
            )}
          </div>
        )}
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
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${cur ? "bg-accent text-white" : done ? "bg-success-soft text-success-ink" : "bg-surface-2 text-muted ring-1 ring-line"}`}
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
      {isTax && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[12px] text-muted">{expMatter ? `Managed in Record Expungement as ${expMatter.number}.` : bizReq ? `Managed in Business Services as ${bizReq.number}.` : booksWs ? "Monthly close is managed in the Bookkeeping workspace." : "Workflow is managed in the Tax Preparation Center."}</span>
          {expMatter ? (
            <Button size="sm" variant={compact ? "ghost" : "secondary"} href={`/services/record-expungement/matters/${expMatter.id}`}>Open expungement matter</Button>
          ) : bizReq ? (
            <Button size="sm" variant={compact ? "ghost" : "secondary"} href={`/services/business-services/requests/${bizReq.id}`}>Open service request</Button>
          ) : booksWs ? (
            <Button size="sm" variant={compact ? "ghost" : "secondary"} href={`/services/bookkeeping/${booksWs.id}`}>Open bookkeeping workspace</Button>
          ) : (
            <Button size="sm" variant={compact ? "ghost" : "secondary"} href={taxReturn ? `/services/tax-preparation/returns/${taxReturn.id}` : "/services/tax-preparation"}>
              {taxReturn ? "Open return in Tax Center" : "Set up return in Tax Center"}
            </Button>
          )}
        </div>
      )}
      {!compact && e.status !== "complete" && !isTax && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" icon={SkipForward} onClick={advance}>
            {idx + 1 === stages.length - 1 ? `Complete: "${stages[idx + 1]}"` : `Next stage: "${stages[idx + 1]}"`}
          </Button>
        </div>
      )}
    </li>
  );
}

export function ServicesTab({ c, act }: { c: Client; act: Act }) {
  const enrolled = new Set(c.enrollments.map((e) => e.service));
  const [filter, setFilter] = useState<"all" | "active" | "complete">("all");
  const list = c.enrollments.filter((e) => filter === "all" || (filter === "complete" ? e.status === "complete" || e.status === "cancelled" : e.status !== "complete" && e.status !== "cancelled"));
  return (
    <Card>
      <CardHeader
        title="Service enrollments"
        subtitle={`${c.enrollments.length} engagement${c.enrollments.length === 1 ? "" : "s"} across ${enrolled.size} division${enrolled.size === 1 ? "" : "s"}`}
        action={<Button size="sm" variant="primary" icon={Plus} onClick={() => act.open("enroll")}>Enroll in a service</Button>}
      />
      <div className="flex gap-2 px-5 pb-3 sm:px-6">
        {(["all", "active", "complete"] as const).map((f) => (
          <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "active" ? "Active" : "Completed"}</Chip>
        ))}
      </div>
      <ul className="space-y-3 px-5 pb-5 sm:px-6">
        {list.length ? list.map((e) => <EnrollmentRow key={e.id} c={c} e={e} />) : <li className="py-4 text-center text-[13.5px] text-muted">No engagements in this view.</li>}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export function DocumentsTab({ c, act }: { c: Client; act: Act }) {
  const store = useClients();
  const toast = useToast();
  const [svc, setSvc] = useState<ServiceKey | "all">("all");
  const [state, setState] = useState<"all" | "requested" | "on_file">("all");
  const [canSensitive, setCanSensitive] = useState(true);
  const docs = c.documents.filter((d) => (svc === "all" || d.service === svc) && (state === "all" || (state === "requested" ? d.status === "requested" || d.status === "rejected" : d.status === "received" || d.status === "reviewed")));
  const services = [...new Set([...c.documents.map((d) => d.service), ...c.enrollments.map((e) => e.service)])];
  const fileUrl = (d: ClientDocument, inline = false) => `/api/clients/${c.id}/files/${d.id}${inline ? "?inline=1" : ""}`;
  const view = (d: ClientDocument) => {
    // Stored files open from the server, which checks permission and records the view.
    if (BACKEND && d.hasFile) return void window.open(fileUrl(d, true), "_blank", "noopener");
    store.logDocumentAccess(c.id, d.id, "Viewed");
    act.open("preview", d);
  };
  const download = (d: ClientDocument) => {
    if (BACKEND && d.hasFile) {
      const a = document.createElement("a");
      a.href = fileUrl(d);
      a.download = d.fileName ?? d.name;
      a.click();
      return;
    }
    store.logDocumentAccess(c.id, d.id, "Downloaded");
    downloadPlaceholder(d.name);
    toast(`Downloaded "${d.name}" (sample placeholder) — logged`);
  };
  const remind = (d: ClientDocument) => {
    store.remindDocument(c.id, d.id);
    toast(`Reminder sent to ${c.contactName ?? c.name}`);
  };
  const setStatus = (d: ClientDocument, s: ClientDocument["status"]) => {
    store.setDocStatus(c.id, d.id, s);
    toast(s === "reviewed" ? `Marked "${d.name}" reviewed` : `Asked client to re-upload "${d.name}"`);
  };
  return (
    <Card>
      <CardHeader
        title="Documents"
        subtitle={`${c.documents.filter((d) => d.status === "requested" || d.status === "rejected").length} outstanding · ${c.documents.filter((d) => d.status === "received" || d.status === "reviewed").length} on file`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={FilePlus2} onClick={() => act.open("request")}>Request document</Button>
            <Button size="sm" variant="primary" icon={FileUp} onClick={() => act.open("upload")}>Upload</Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 sm:px-6">
        <Chip on={svc === "all"} onClick={() => setSvc("all")}>All services</Chip>
        {services.map((s) => (
          <Chip key={s} on={svc === s} onClick={() => setSvc(s)} dot={svcColor(s)}>{SERVICES[s].short}</Chip>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        {(["all", "requested", "on_file"] as const).map((k) => (
          <Chip key={k} on={state === k} onClick={() => setState(k)}>{k === "all" ? "Any status" : k === "requested" ? "Outstanding" : "On file"}</Chip>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-strong px-2.5 py-1 text-[12px] text-muted" title="Preview how this tab looks for a staff member without the sensitive-documents permission">
          <input type="checkbox" checked={!canSensitive} onChange={() => setCanSensitive((v) => !v)} className="accent-[var(--accent)]" />
          Preview as staff without sensitive-doc access
        </label>
      </div>
      {docs.length === 0 ? (
        <p className="border-t border-line px-6 py-8 text-center text-[13.5px] text-muted">No documents in this view.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {docs.map((d) => {
            const st = docStatus[d.status];
            const locked = d.sensitive && !canSensitive;
            const outstanding = d.status === "requested" || d.status === "rejected";
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap sm:px-6">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${outstanding ? "border-2 border-dashed border-line-strong text-faint" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}>
                  {locked ? <Lock size={17} /> : <FileUp size={17} />}
                </span>
                <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`truncate text-[14px] font-medium ${locked ? "text-muted" : "text-ink"}`}>{locked ? "Restricted document" : d.name}</span>
                    {d.sensitive && <Badge tone="danger" icon={ShieldAlert}>Restricted</Badge>}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {d.taxYear ? `TY ${d.taxYear} · ` : ""}{d.category} · {d.uploadedAt && !outstanding ? `Uploaded ${relTime(d.uploadedAt)} by ${d.uploadedBy}${d.sizeKb ? ` · ${fileSize(d.sizeKb)}` : ""}` : `Requested ${relTime(d.requestedAt)}`}
                  </div>
                </div>
                <ServiceTag service={d.service} short />
                <Badge tone={st.tone}>{st.label}</Badge>
                <div className="flex items-center gap-1">
                  {outstanding ? (
                    <>
                      <Button size="sm" variant="ghost" icon={Send} onClick={() => remind(d)}>Remind</Button>
                      <IconAction icon={FileUp} label="Upload on client's behalf" onClick={() => act.open("upload", d)} />
                    </>
                  ) : (
                    <>
                      <IconAction icon={Eye} label={locked ? "Requires sensitive-document permission" : "Preview"} disabled={locked} onClick={() => view(d)} />
                      <IconAction icon={Download} label={locked ? "Requires sensitive-document permission" : "Download (logged)"} disabled={locked} onClick={() => download(d)} />
                      <Menu
                        label={`More actions for ${d.name}`}
                        trigger={({ toggle }) => <IconAction icon={MoreHorizontal} label="More actions" disabled={locked} onClick={toggle} />}
                        items={[
                          { label: "Mark reviewed", icon: CheckCircle2, onSelect: () => setStatus(d, "reviewed"), disabled: d.status === "reviewed" },
                          { label: "Ask client to re-upload", icon: RefreshCcw, onSelect: () => setStatus(d, "rejected"), danger: true },
                        ]}
                      />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-[12px] text-muted sm:px-6">
        <Lock size={12} className="shrink-0" /> Restricted files (IDs, tax returns, court records) need the sensitive-documents permission. Every view and download is recorded in the audit log.
      </p>
    </Card>
  );
}

function IconAction({ icon: Icon, label, disabled, onClick }: { icon: LucideIcon; label: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">
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
  const store = useClients();
  const [draft, setDraft] = useState("");
  const svcs = [...new Set(c.enrollments.map((e) => e.service))];
  const [service, setService] = useState<ServiceKey | "">(svcs[0] ?? "");
  const [svcFilter, setSvcFilter] = useState<ServiceKey | "all">("all");
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = c.messages.filter((m) => svcFilter === "all" || m.service === svcFilter);
  const unreadIds = useMemo(() => c.messages.filter((m) => !m.read).map((m) => m.id), [c.messages]);
  const [highlight] = useState(unreadIds);
  useEffect(() => {
    if (unreadIds.length) store.markMessagesRead(c.id);
  }, [unreadIds.length, c.id, store]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [msgs.length]);
  const send = () => {
    if (!draft.trim()) return;
    store.sendMessage(c.id, draft.trim(), service || undefined);
    setDraft("");
  };
  return (
    <Card className="flex flex-col">
      <CardHeader title="Secure messages" subtitle="Shared with the client in their portal" />
      {svcs.length > 1 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6">
          <Chip on={svcFilter === "all"} onClick={() => setSvcFilter("all")}>All threads</Chip>
          {svcs.map((s) => (
            <Chip key={s} on={svcFilter === s} onClick={() => setSvcFilter(s)} dot={svcColor(s)}>{SERVICES[s].short}</Chip>
          ))}
        </div>
      )}
      <div className="scrollbar-thin max-h-[520px] space-y-3 overflow-y-auto border-y border-line bg-surface-2 px-4 py-4 sm:px-6">
        {msgs.length === 0 && <p className="py-6 text-center text-[13.5px] text-muted">No messages yet. Start the conversation below.</p>}
        {msgs.map((m) => {
          const mine = m.from === "staff";
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar name={m.author} size={30} />
              <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
                <div className={`inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-left text-[14px] leading-relaxed ${mine ? "rounded-tr-md bg-accent text-white" : "rounded-tl-md border border-line bg-surface text-ink"}`}>{m.body}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted" style={{ justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <span>{m.author}</span>·<span>{fmtDateTime(m.at)}</span>
                  {m.service && <>· {SERVICES[m.service].short}</>}
                  {highlight.includes(m.id) && <Badge tone="info">New</Badge>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="space-y-2 p-4 sm:px-6">
        <div className="flex items-end gap-2">
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
          <Button variant="primary" icon={Send} onClick={send} disabled={!draft.trim()}>Send</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
          {svcs.length > 0 ? (
            <label className="inline-flex items-center gap-2">
              Thread:
              <select value={service} onChange={(e) => setService(e.target.value as ServiceKey)} className="rounded-lg border border-line bg-surface px-2 py-1 text-[12.5px] text-ink-2">
                {svcs.map((s) => <option key={s} value={s}>{SERVICES[s].label}</option>)}
              </select>
            </label>
          ) : <span />}
          <span>Ctrl/⌘ + Enter to send</span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

const modeIcon = { Video, Phone, "In person": MapPin } as const;

export function AppointmentsTab({ c, act }: { c: Client; act: Act }) {
  const store = useClients();
  const toast = useToast();
  const upcoming = c.appointments.filter((a) => a.status === "scheduled" && !isPast(a.at));
  const needsUpdate = c.appointments.filter((a) => a.status === "scheduled" && isPast(a.at));
  const past = c.appointments.filter((a) => a.status !== "scheduled").reverse();
  const set = (id: string, s: "completed" | "cancelled" | "no_show", title: string) => {
    store.setAppointmentStatus(c.id, id, s);
    toast(s === "cancelled" ? `Cancelled "${title}" — client notified` : s === "completed" ? `Marked "${title}" completed` : `Marked "${title}" as no-show`);
  };
  const Row = ({ a, actions }: { a: (typeof c.appointments)[number]; actions?: boolean }) => {
    const M = modeIcon[a.mode];
    const dt = new Date(a.at);
    return (
      <li className="flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-surface-hover">
        <div className="w-14 shrink-0 rounded-xl border border-line bg-surface-2 py-1.5 text-center">
          <div className="text-[10.5px] font-semibold uppercase text-muted">{dt.toLocaleDateString("en-US", { month: "short" })}</div>
          <div className="text-[18px] font-bold leading-none text-ink">{dt.getDate()}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[14px] font-medium ${a.status === "cancelled" ? "text-muted line-through" : "text-ink"}`}>{a.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
            <span>{fmtTime(a.at)} · {a.durationMin} min</span>
            <span className="inline-flex items-center gap-1"><M size={12} /> {a.mode}</span>
            <span>with {staffById(a.staffId).name}</span>
          </div>
        </div>
        <span className="hidden sm:block"><ServiceTag service={a.service} short /></span>
        {a.status === "completed" && <Badge tone="success" icon={Check}>Completed</Badge>}
        {a.status === "cancelled" && <Badge tone="neutral">Cancelled</Badge>}
        {a.status === "no_show" && <Badge tone="danger">No-show</Badge>}
        {actions && (
          <Menu
            label={`Actions for ${a.title}`}
            trigger={({ toggle }) => <IconAction icon={MoreHorizontal} label="Appointment actions" onClick={toggle} />}
            items={[
              { label: "Mark completed", icon: CheckCircle2, onSelect: () => set(a.id, "completed", a.title) },
              { label: "Mark no-show", icon: AlertCircle, onSelect: () => set(a.id, "no_show", a.title) },
              "divider",
              { label: "Cancel appointment", icon: XCircle, onSelect: () => set(a.id, "cancelled", a.title), danger: true },
            ]}
          />
        )}
      </li>
    );
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Upcoming" subtitle={`${upcoming.length} scheduled`} action={<Button size="sm" variant="primary" icon={CalendarPlus} onClick={() => act.open("schedule")}>Schedule</Button>} />
        {needsUpdate.length > 0 && (
          <div className="mx-5 mb-2 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink sm:mx-6">{needsUpdate.length} past appointment{needsUpdate.length > 1 ? "s" : ""} still need an outcome.</div>
        )}
        <ul className="px-3 pb-3 sm:px-4">
          {[...needsUpdate, ...upcoming].length ? [...needsUpdate, ...upcoming].map((a) => <Row key={a.id} a={a} actions />) : <li className="px-2 pb-3 text-[13.5px] text-muted">Nothing scheduled.</li>}
        </ul>
      </Card>
      <Card>
        <CardHeader title="History" />
        <ul className="px-3 pb-3 sm:px-4">{past.length ? past.map((a) => <Row key={a.id} a={a} />) : <li className="px-2 pb-3 text-[13.5px] text-muted">No past appointments.</li>}</ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Invoices & payments                                                 */
/* ------------------------------------------------------------------ */

export function InvoicesTab({ c, act }: { c: Client; act: Act }) {
  const store = useClients();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const billed = c.invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + i.amount, 0);
  const paid = c.invoices.reduce((s, i) => s + i.paid, 0);
  const list = c.invoices.filter((i) => filter === "all" || (filter === "paid" ? i.status === "paid" : i.status !== "paid"));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {([
          ["Total billed", billed, "text-ink"],
          ["Collected", paid, "text-success-ink"],
          ["Outstanding", billed - paid, billed - paid > 0 ? "text-danger-ink" : "text-faint"],
        ] as const).map(([l, v, cls]) => (
          <div key={l} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
            <div className="text-[12px] text-muted">{l}</div>
            <div className={`mt-0.5 text-[18px] font-bold tabular-nums sm:text-[20px] ${cls}`}>{usd(v)}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader
          title="Invoices"
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={CreditCard} onClick={() => act.open("payment")}>Record payment</Button>
              <Button size="sm" variant="primary" icon={Plus} onClick={() => act.open("invoice")}>New invoice</Button>
            </div>
          }
        />
        <div className="flex gap-2 px-5 pb-3 sm:px-6">
          {(["all", "unpaid", "paid"] as const).map((f) => (
            <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "unpaid" ? "Unpaid" : "Paid"}</Chip>
          ))}
        </div>
        {/* Table on wide screens, stacked rows on phones */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-[13.5px]">
            <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5 sm:px-6">Invoice</th>
                <th className="px-3 py-2.5">Service</th>
                <th className="px-3 py-2.5">Due</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
                <th className="px-5 py-2.5 sm:px-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
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
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{i.amount - i.paid > 0 ? usd(i.amount - i.paid) : <span className="font-normal text-faint">$0</span>}</td>
                    <td className="px-5 py-3 text-right sm:px-6"><InvoiceActions c={c} i={i} act={act} store={store} toast={toast} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-line border-t border-line md:hidden">
          {list.map((i) => {
            const st = invoiceStatus[i.status];
            return (
              <li key={i.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-semibold text-ink tabular-nums">{i.number}</span><Badge tone={st.tone}>{st.label}</Badge></div>
                  <div className="truncate text-[12px] text-muted">{i.description}</div>
                  <div className="text-[12px] text-muted">Due {fmtDate(i.dueAt)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-ink tabular-nums">{usd(i.amount - i.paid)}</div>
                  <div className="text-[11.5px] text-muted">of {usd(i.amount)}</div>
                </div>
                <InvoiceActions c={c} i={i} act={act} store={store} toast={toast} />
              </li>
            );
          })}
        </ul>
        {list.length === 0 && <p className="border-t border-line px-6 py-8 text-center text-[13.5px] text-muted">No invoices in this view.</p>}
      </Card>
    </div>
  );
}

function InvoiceActions({ c, i, act, store, toast }: { c: Client; i: Client["invoices"][number]; act: Act; store: ReturnType<typeof useClients>; toast: ReturnType<typeof useToast> }) {
  const unpaid = i.status === "open" || i.status === "overdue" || i.status === "partial";
  return (
    <Menu
      label={`Actions for ${i.number}`}
      trigger={({ toggle }) => <IconAction icon={MoreHorizontal} label={`Actions for ${i.number}`} onClick={toggle} />}
      items={[
        ...(i.status === "draft" ? [{ label: "Send invoice", icon: Send, onSelect: () => { store.sendInvoice(c.id, i.id); toast(`${i.number} sent to client`); } }] : []),
        ...(unpaid
          ? [
              { label: "Record payment", icon: CreditCard, onSelect: () => act.open("payment", i.id) },
              { label: "Send payment reminder", icon: Send, onSelect: () => toast(`Payment reminder for ${i.number} sent`) },
            ]
          : []),
        { label: "Download PDF", icon: Download, onSelect: () => downloadPlaceholder(i.number, `${i.number}\n${i.description}\nAmount: ${usd(i.amount, 2)}\nPaid: ${usd(i.paid, 2)}\n\nSAMPLE INVOICE — design preview only.\n`) },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Signatures                                                          */
/* ------------------------------------------------------------------ */

export function SignaturesTab({ c, act }: { c: Client; act: Act }) {
  const store = useClients();
  const toast = useToast();
  return (
    <Card>
      <CardHeader title="Signatures" subtitle="Engagement letters, authorizations and consents" action={<Button size="sm" variant="primary" icon={PenLine} onClick={() => act.open("signature")}>Send for signature</Button>} />
      {c.signatures.length === 0 ? (
        <p className="border-t border-line px-6 py-8 text-center text-[13.5px] text-muted">No signature requests yet.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {c.signatures.map((s) => {
            const st = signatureStatus[s.status];
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap sm:px-6">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.status === "signed" ? "bg-success-soft text-success" : s.status === "pending" ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted ring-1 ring-line"}`}>
                  {s.status === "signed" ? <CheckCircle2 size={18} /> : s.status === "pending" ? <Clock size={18} /> : <XCircle size={18} />}
                </span>
                <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
                  <div className="truncate text-[14px] font-medium text-ink">{s.document}</div>
                  <div className="text-[12px] text-muted">Sent {relTime(s.sentAt)}{s.signedAt && ` · Signed ${fmtDate(s.signedAt)}`}</div>
                </div>
                <ServiceTag service={s.service} short />
                <Badge tone={st.tone}>{st.label}</Badge>
                {s.status === "pending" ? (
                  <Menu
                    label={`Actions for ${s.document}`}
                    trigger={({ toggle }) => <IconAction icon={MoreHorizontal} label="Signature actions" onClick={toggle} />}
                    items={[
                      { label: "Resend request", icon: RefreshCcw, onSelect: () => { store.resendSignature(c.id, s.id); toast(`Resent "${s.document}"`); } },
                      { label: "Void request", icon: XCircle, danger: true, onSelect: () => { store.cancelSignature(c.id, s.id); toast(`Voided "${s.document}"`); } },
                    ]}
                  />
                ) : s.status === "signed" ? (
                  <IconAction icon={Download} label="Download signed copy" onClick={() => downloadPlaceholder(`${s.document} (signed)`)} />
                ) : (
                  <span className="w-8" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Internal notes                                                      */
/* ------------------------------------------------------------------ */

export function NotesTab({ c }: { c: Client }) {
  const store = useClients();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const svcs = [...new Set(c.enrollments.map((e) => e.service))];
  const [service, setService] = useState<ServiceKey | "">("");
  const add = () => {
    if (!draft.trim()) return;
    store.addNote(c.id, draft.trim(), service || undefined);
    setDraft("");
    toast("Note added");
  };
  const notes = [...c.notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at));
  return (
    <Card>
      <CardHeader title="Internal notes" subtitle="Staff only — never visible in the client portal" />
      <div className="mx-5 mb-4 rounded-xl border border-line bg-surface-2 p-3 sm:mx-6">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Add an internal note…" aria-label="New internal note" className="w-full resize-none bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <Lock size={12} /> Internal
            <select value={service} onChange={(e) => setService(e.target.value as ServiceKey | "")} aria-label="Related service" className="rounded-lg border border-line bg-surface px-2 py-1 text-[12.5px] text-ink-2">
              <option value="">General</option>
              {svcs.map((s) => <option key={s} value={s}>{SERVICES[s].label}</option>)}
            </select>
          </div>
          <Button size="sm" variant="primary" icon={NotebookPen} onClick={add} disabled={!draft.trim()}>Add note</Button>
        </div>
      </div>
      <ul className="space-y-3 px-5 pb-5 sm:px-6">
        {notes.length === 0 && <li className="py-4 text-center text-[13.5px] text-muted">No notes yet.</li>}
        {notes.map((n) => {
          const author = staffById(n.authorId);
          return (
            <li key={n.id} className={`rounded-xl border p-4 ${n.pinned ? "border-warning/30 bg-warning-soft/50" : "border-line"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Avatar name={author.name} size={26} />
                <span className="text-[13px] font-semibold text-ink">{author.name}</span>
                <span className="text-[12px] text-muted">· {relTime(n.at)}</span>
                {n.service && <ServiceTag service={n.service} short />}
                <span className="ml-auto flex items-center gap-1">
                  {n.pinned && <span className="mr-1 inline-flex items-center gap-1 text-[12px] font-medium text-warning-ink"><Pin size={12} /> Pinned</span>}
                  <IconAction icon={n.pinned ? PinOff : Pin} label={n.pinned ? "Unpin" : "Pin to overview"} onClick={() => { store.togglePin(c.id, n.id); toast(n.pinned ? "Note unpinned" : "Note pinned to overview"); }} />
                  {n.authorId === meId() && <IconAction icon={Trash2} label="Delete note" onClick={() => { if (confirm("Delete this note?")) { store.deleteNote(c.id, n.id); toast("Note deleted"); } }} />}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-2">{n.body}</p>
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

export const kindMeta: Record<ActivityKind, { icon: LucideIcon; cls: string; label: string }> = {
  upload: { icon: FileUp, cls: "bg-accent-soft text-accent", label: "Documents" },
  payment: { icon: CreditCard, cls: "bg-success-soft text-success", label: "Payments" },
  signature: { icon: PenLine, cls: "bg-svc-books-soft text-svc-books", label: "Signatures" },
  message: { icon: MessageSquare, cls: "bg-svc-expunge-soft text-svc-expunge", label: "Messages" },
  intake: { icon: ClipboardCheck, cls: "bg-svc-biz-soft text-svc-biz", label: "Intake" },
  status: { icon: RefreshCcw, cls: "bg-surface-2 text-ink-2 ring-1 ring-line", label: "Status" },
  appointment: { icon: CalendarPlus, cls: "bg-accent-soft text-accent", label: "Appointments" },
  note: { icon: NotebookPen, cls: "bg-warning-soft text-warning", label: "Notes" },
  invoice: { icon: Receipt, cls: "bg-surface-2 text-ink-2 ring-1 ring-line", label: "Invoices" },
  call: { icon: PhoneCall, cls: "bg-svc-books-soft text-svc-books", label: "Calls" },
  lead: { icon: UserPlus, cls: "bg-accent-soft text-accent", label: "Lead history" },
};

export function Timeline({ items }: { items: Client["activity"] }) {
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
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const kinds = [...new Set(c.activity.map((a) => a.kind))];
  const items = c.activity.filter((a) => kind === "all" || a.kind === kind);
  return (
    <Card>
      <CardHeader title="Activity history" subtitle="Everything that has happened on this client record" />
      <div className="flex flex-wrap gap-2 px-5 pb-4 sm:px-6">
        <Chip on={kind === "all"} onClick={() => setKind("all")}>All</Chip>
        {kinds.map((k) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{kindMeta[k].label}</Chip>)}
      </div>
      <Timeline items={items} />
    </Card>
  );
}
