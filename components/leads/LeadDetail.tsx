"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AtSign,
  BellPlus,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Download,
  MapPin,
  MessageSquarePlus,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Phone,
  Pin,
  PinOff,
  RotateCcw,
  Tag,
  Trash2,
  User,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Menu } from "@/components/ui/Menu";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { useToast } from "@/components/ui/Toast";
import { Timeline, kindMeta } from "@/components/crm/ProfileTabs";
import { SAMPLE_NOW, STAFF, staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { useLead, useLeads } from "@/lib/store/leads-store";
import { fmtDate, fmtDateTime, relTime, usd } from "@/lib/format";
import { formatPhone } from "@/lib/validation";
import type { ActivityKind, LeadPriority } from "@/lib/types";
import { FollowUpChip, PriorityBadge, StatusBadge } from "./LeadBits";
import { ConvertDialog, EditLeadDialog, LogActivityDialog, LostDialog, ReminderDialog } from "./LeadDialogs";

type DialogKind = "edit" | "reminder" | "log" | "lost" | "convert";

export function LeadDetail({ id }: { id: string }) {
  const lead = useLead(id);
  const store = useLeads();
  const { clients } = useClients();
  const toast = useToast();
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [showDone, setShowDone] = useState(false);

  if (!lead)
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <h1 className="text-[20px] font-bold text-ink">Lead not found</h1>
          <p className="mt-1 text-[14px] text-muted">It may have been created in an earlier preview session (sample data resets on reload).</p>
          <Link href="/leads" className="mt-4 inline-block text-[14px] font-semibold text-accent">Back to leads</Link>
        </div>
      </div>
    );

  const l = lead;
  const open = l.status === "open";
  const stageIdx = store.stages.findIndex((s) => s.id === l.stageId);
  const client = l.convertedClientId ? clients.find((c) => c.id === l.convertedClientId) : undefined;
  const reminders = [...l.reminders].sort((a, b) => a.at.localeCompare(b.at));
  const openReminders = reminders.filter((r) => !r.done);
  const doneReminders = reminders.filter((r) => r.done);
  const kinds = [...new Set(l.activity.map((a) => a.kind))];
  const notes = [...l.notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at));

  const exportLead = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ note: "SAMPLE DATA — design preview export", lead: l }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${l.id}-sample-export.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Lead exported (sample data)");
  };

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Leads", href: "/leads" }, { label: l.name }]} />

      {l.status === "converted" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-[13.5px] text-success-ink">
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="flex-1">
            Converted to a client {l.convertedAt ? `on ${fmtDate(l.convertedAt)}` : ""}. This lead&rsquo;s history is preserved here and on the client record.
          </span>
          {client ? (
            <Button size="sm" variant="primary" href={`/clients/${client.id}`}>View client: {client.name}</Button>
          ) : (
            <span className="text-[12.5px]">Client record not in this preview session</span>
          )}
        </div>
      )}
      {l.status === "lost" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-ink-2">
          <XCircle size={18} className="shrink-0 text-muted" />
          <span className="flex-1">Marked lost{l.lostReason ? `: ${l.lostReason}` : ""}.</span>
          <Button size="sm" icon={RotateCcw} onClick={() => { store.reopen(l.id); toast("Lead reopened"); }}>Reopen lead</Button>
        </div>
      )}

      {/* Header */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 gap-4">
            <Avatar name={l.name} size={56} square={l.type === "business"} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{l.name}</h1>
                <StatusBadge s={l.status} />
                <PriorityBadge p={l.priority} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  {l.type === "business" ? <Building2 size={14} /> : <User size={14} />}
                  {l.type === "business" ? `${l.business?.entityType ?? "Business"} · ${l.business?.industry ?? ""}` : "Individual"}
                </span>
                {l.contactName && <span>Contact: {l.contactName}</span>}
                <span className="inline-flex items-center gap-1"><Tag size={13} /> {l.source}{l.sourceDetail ? ` — ${l.sourceDetail}` : ""}</span>
                <span className="font-mono text-[11.5px] text-faint">{l.id}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ink-2">
                {l.email && (
                  <a href={`mailto:${l.email}`} className="inline-flex min-w-0 items-center gap-1.5 break-all hover:text-accent">
                    <AtSign size={14} className="shrink-0 text-muted" /> {l.email}
                  </a>
                )}
                {l.phone && (
                  <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                    <Phone size={14} className="text-muted" /> {formatPhone(l.phone)}
                  </a>
                )}
                {l.address?.city && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} className="text-muted" /> {l.address.city}, {l.address.state}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {l.interests.map((s) => <ServiceTag key={s} service={s} />)}
                {l.tags.map((t) => <span key={t} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">{t}</span>)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:max-w-[400px] lg:justify-end">
            {open && <Button size="sm" icon={MessageSquarePlus} onClick={() => setDialog("log")}>Log activity</Button>}
            {open && <Button size="sm" icon={BellPlus} onClick={() => setDialog("reminder")}>Follow-up</Button>}
            {open && <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setDialog("convert")}>Convert to client</Button>}
            <Button size="sm" icon={Pencil} onClick={() => setDialog("edit")}>Edit</Button>
            <Menu
              label="More lead actions"
              trigger={({ toggle }) => (
                <Button size="sm" icon={MoreHorizontal} onClick={toggle} aria-label="More lead actions">
                  <span className="sr-only">More</span>
                </Button>
              )}
              items={[
                open ? { label: "Mark as lost", icon: XCircle, danger: true, onSelect: () => setDialog("lost") } : l.status === "lost" ? { label: "Reopen lead", icon: RotateCcw, onSelect: () => { store.reopen(l.id); toast("Lead reopened"); } } : { label: "Converted — view client", icon: CheckCircle2, disabled: !client, onSelect: () => client && router.push(`/clients/${client.id}`) },
                { label: "Export lead", icon: Download, onSelect: exportLead },
              ]}
            />
          </div>
        </div>

        {/* Stage stepper — click to move */}
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 text-[12px] text-muted">{open ? "Pipeline stage — click to move" : "Pipeline stage"}</div>
          <ol className="flex flex-wrap gap-1.5" aria-label="Pipeline stages">
            {store.stages.map((s, i) => {
              const cur = i === stageIdx;
              const done = i < stageIdx || l.status === "converted";
              return (
                <li key={s.id}>
                  <button
                    disabled={!open || cur}
                    aria-current={cur ? "step" : undefined}
                    onClick={() => { store.setStage(l.id, s.id); toast(`Moved to "${s.name}"`); }}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${cur && open ? "bg-accent text-white" : done ? "bg-success-soft text-success-ink" : "bg-surface-2 text-muted ring-1 ring-line"} ${open && !cur ? "hover:ring-accent" : ""} disabled:cursor-default`}
                  >
                    {done && <Check size={12} strokeWidth={3} />}
                    {s.name}
                  </button>
                </li>
              );
            })}
            {l.status === "converted" && <li><span className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-[12.5px] font-semibold text-white"><CheckCircle2 size={13} /> Converted</span></li>}
          </ol>
        </div>

        {/* Quick fields */}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-[12px] text-muted">Assigned to</dt>
            <dd className="mt-1">
              <select aria-label="Assigned to" disabled={!open} value={l.ownerId} onChange={(e) => { store.setOwner(l.id, e.target.value); toast(`Assigned to ${staffById(e.target.value).name}`); }} className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] font-medium text-ink disabled:opacity-70">
                {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Priority</dt>
            <dd className="mt-1">
              <select aria-label="Priority" disabled={!open} value={l.priority} onChange={(e) => { store.setPriority(l.id, e.target.value as LeadPriority); toast("Priority updated"); }} className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] font-medium text-ink disabled:opacity-70">
                {(["urgent", "high", "medium", "low"] as const).map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Estimated value</dt>
            <dd className="mt-1 flex h-9 items-center gap-1.5 text-[16px] font-bold text-ink tabular-nums"><CircleDollarSign size={15} className="text-muted" />{usd(l.estValue)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Created</dt>
            <dd className="mt-1 flex h-9 items-center text-[13.5px] font-medium text-ink">{fmtDate(l.createdAt)} <span className="ml-1 text-[12px] font-normal text-muted">({relTime(l.createdAt)})</span></dd>
          </div>
        </dl>
      </section>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          {/* Follow-ups */}
          <Card>
            <CardHeader title="Follow-ups & reminders" subtitle={openReminders.length ? `Next: ${fmtDateTime(openReminders[0].at)}` : "Nothing scheduled"} action={open ? <Button size="sm" variant="primary" icon={BellPlus} onClick={() => setDialog("reminder")}>Add</Button> : undefined} />
            <ul className="px-3 pb-2 sm:px-4">
              {openReminders.length === 0 && <li className="px-2 pb-3 text-[13.5px] text-muted">{open ? "No follow-up scheduled — add one so this lead doesn't go cold." : "No open follow-ups."}</li>}
              {openReminders.map((r) => {
                const overdue = r.at < SAMPLE_NOW.toISOString();
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
                    <button onClick={() => { store.completeReminder(l.id, r.id); toast("Follow-up completed"); }} aria-label={`Complete: ${r.note}`} className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-line-strong text-transparent hover:border-success hover:text-success">
                      <Check size={13} strokeWidth={3} />
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-ink">{r.note}</span>
                      <span className={`flex items-center gap-1 text-[12px] ${overdue ? "font-semibold text-danger-ink" : "text-muted"}`}>
                        <Clock size={12} /> {overdue ? "Overdue · " : ""}{fmtDateTime(r.at)} · {staffById(r.ownerId).name}
                      </span>
                    </span>
                    <button onClick={() => { store.deleteReminder(l.id, r.id); toast("Follow-up removed"); }} aria-label={`Remove follow-up: ${r.note}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-danger">
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {doneReminders.length > 0 && (
              <div className="border-t border-line px-5 py-2.5 sm:px-6">
                <button onClick={() => setShowDone((v) => !v)} className="text-[12.5px] font-semibold text-accent">{showDone ? "Hide" : "Show"} {doneReminders.length} completed</button>
                {showDone && (
                  <ul className="mt-2 space-y-1.5">
                    {doneReminders.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 text-[13px] text-muted">
                        <CheckCircle2 size={14} className="text-success" /> <span className="line-through">{r.note}</span> · {fmtDate(r.at, { month: "short", day: "numeric" })}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader title="Notes" subtitle="Internal — carried over to the client record on conversion" />
            <div className="mx-5 mb-4 rounded-xl border border-line bg-surface-2 p-3 sm:mx-6">
              <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} placeholder="Add a note…" aria-label="New lead note" className="w-full resize-none bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none" />
              <div className="flex justify-end">
                <Button size="sm" variant="primary" icon={NotebookPen} disabled={!noteDraft.trim()} onClick={() => { store.addNote(l.id, noteDraft.trim()); setNoteDraft(""); toast("Note added"); }}>Add note</Button>
              </div>
            </div>
            <ul className="space-y-3 px-5 pb-5 sm:px-6">
              {notes.length === 0 && <li className="text-[13.5px] text-muted">No notes yet.</li>}
              {notes.map((n) => (
                <li key={n.id} className={`rounded-xl border p-3.5 ${n.pinned ? "border-warning/30 bg-warning-soft/50" : "border-line"}`}>
                  <div className="flex items-center gap-2">
                    <Avatar name={staffById(n.authorId).name} size={24} />
                    <span className="text-[13px] font-semibold text-ink">{staffById(n.authorId).name}</span>
                    <span className="text-[12px] text-muted">· {relTime(n.at)}</span>
                    <span className="ml-auto flex">
                      <button onClick={() => store.togglePin(l.id, n.id)} aria-label={n.pinned ? "Unpin note" : "Pin note"} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink">{n.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
                      <button onClick={() => { if (confirm("Delete this note?")) { store.deleteNote(l.id, n.id); toast("Note deleted"); } }} aria-label="Delete note" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-danger"><Trash2 size={14} /></button>
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-2">{n.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Activity */}
        <Card>
          <CardHeader title="Activity history" subtitle="Calls, emails, stage changes — preserved after conversion" action={open ? <Button size="sm" icon={MessageSquarePlus} onClick={() => setDialog("log")}>Log</Button> : undefined} />
          <div className="flex flex-wrap gap-2 px-5 pb-4 sm:px-6">
            {(["all", ...kinds] as const).map((k) => (
              <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${kind === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-hover"}`}>
                {k === "all" ? "All" : kindMeta[k].label}
              </button>
            ))}
          </div>
          <Timeline items={l.activity.filter((a) => kind === "all" || a.kind === kind)} />
        </Card>
      </div>

      <EditLeadDialog lead={l} open={dialog === "edit"} onClose={() => setDialog(null)} />
      <ReminderDialog lead={l} open={dialog === "reminder"} onClose={() => setDialog(null)} />
      <LogActivityDialog lead={l} open={dialog === "log"} onClose={() => setDialog(null)} onScheduleFollowUp={() => setDialog("reminder")} />
      <LostDialog leadIds={[l.id]} open={dialog === "lost"} onClose={() => setDialog(null)} label={l.name} />
      <ConvertDialog lead={l} open={dialog === "convert"} onClose={() => setDialog(null)} onConverted={(cid) => { setDialog(null); router.push(`/clients/${cid}`); }} />
    </>
  );
}
