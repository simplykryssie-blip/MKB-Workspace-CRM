"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Building2, CheckCircle2, History, Lock, NotebookPen, Plus, Tag, Trash2, User, UserPlus, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, Label, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { AddressFields, DOBInput, EINInput, EmailInput, PhoneInput, ResponsiblePartyFields, TaxIdInput } from "@/components/ui/FormattedInputs";
import { useToast } from "@/components/ui/Toast";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { SAMPLE_NOW, STAFF, meId, staffList } from "@/lib/sample/clients";
import { LOST_REASONS } from "@/lib/sample/leads";
import { defaultTitleFor, useClients } from "@/lib/store/clients-store";
import { useLeads, type NewLeadInput } from "@/lib/store/leads-store";
import {
  digits,
  dobToIso,
  normalizeEmail,
  validateAddress,
  validateDOB,
  validateEIN,
  validateEmail,
  validatePhone,
  validateTaxId,
  type Address,
  type TaxIdType,
} from "@/lib/validation";
import type { Client, Lead, LeadPriority, ServiceKey } from "@/lib/types";

type Entity = NonNullable<Client["business"]>["entityType"];
const ENTITIES: Entity[] = ["LLC", "S-Corp", "C-Corp", "Sole Prop", "Partnership", "Nonprofit"];
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const dateInput = (daysFromNow: number) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + daysFromNow);
  return t.toISOString().slice(0, 10);
};

/* ================================================================== */
/* Lead form (new + edit)                                              */
/* ================================================================== */

export type LeadFormValue = {
  type: Lead["type"];
  name: string;
  contactName: string;
  entityType: Entity;
  industry: string;
  email: string;
  phone: string;
  address: Address;
  source: string;
  sourceDetail: string;
  interests: ServiceKey[];
  estValue: string;
  ownerId: string;
  priority: LeadPriority;
  stageId: string;
  tags: string;
  firstNote: string;
  followDate: string;
  followTime: string;
  followNote: string;
};

export function leadToForm(l?: Lead, defaults?: { stageId: string; source: string }): LeadFormValue {
  return {
    type: l?.type ?? "individual",
    name: l?.name ?? "",
    contactName: l?.contactName ?? "",
    entityType: l?.business?.entityType ?? "LLC",
    industry: l?.business?.industry ?? "",
    email: l?.email ?? "",
    phone: l?.phone ?? "",
    address: { line1: l?.address?.line1 ?? "", line2: l?.address?.line2 ?? "", city: l?.address?.city ?? "", state: l?.address?.state ?? "GA", zip: l?.address?.zip ?? "" },
    source: l?.source ?? defaults?.source ?? "Website",
    sourceDetail: l?.sourceDetail ?? "",
    interests: l?.interests ?? [],
    estValue: l ? String(l.estValue) : "",
    ownerId: l?.ownerId ?? meId(),
    priority: l?.priority ?? "medium",
    stageId: l?.stageId ?? defaults?.stageId ?? "",
    tags: l?.tags.join(", ") ?? "",
    firstNote: "",
    followDate: l ? "" : dateInput(1),
    followTime: "10:00",
    followNote: l ? "" : "Initial outreach call",
  };
}

export function leadFormErrors(f: LeadFormValue) {
  const hasContact = digits(f.phone) || f.email.trim();
  return {
    name: !f.name.trim() ? "Name is required" : null,
    contact: !hasContact ? "Add an email or a phone number" : null,
    email: validateEmail(f.email, false),
    phone: validatePhone(f.phone, false),
    address: Object.keys(validateAddress(f.address, false)).length ? "address" : null,
    estValue: f.estValue && (isNaN(Number(f.estValue)) || Number(f.estValue) < 0) ? "Enter a dollar amount" : null,
    follow: f.followDate && !f.followNote.trim() ? "Add what the follow-up is for" : null,
  };
}

export function formToLead(f: LeadFormValue): NewLeadInput {
  return {
    type: f.type,
    name: f.name.replace(/\s+/g, " ").trim(),
    contactName: f.type === "business" ? f.contactName.trim() || undefined : undefined,
    email: normalizeEmail(f.email),
    phone: f.phone,
    address: { ...f.address, line2: f.address.line2 || undefined },
    business: f.type === "business" ? { entityType: f.entityType, industry: f.industry.trim() || "—" } : undefined,
    source: f.source,
    sourceDetail: f.sourceDetail.trim() || undefined,
    interests: f.interests,
    estValue: Number(f.estValue) || 0,
    ownerId: f.ownerId,
    stageId: f.stageId,
    priority: f.priority,
    tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    firstNote: f.firstNote,
    followUp: f.followDate ? { at: new Date(`${f.followDate}T${f.followTime || "10:00"}`).toISOString(), note: f.followNote.trim() } : undefined,
  };
}

export function LeadFormFields({ f, set, mode, submitted }: { f: LeadFormValue; set: (p: Partial<LeadFormValue>) => void; mode: "new" | "edit"; submitted: boolean }) {
  const { stages, sources } = useLeads();
  const e = leadFormErrors(f);
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div role="radiogroup" aria-label="Lead type" className="grid grid-cols-2 gap-2">
          {(
            [
              ["individual", "Individual", User],
              ["business", "Business", Building2],
            ] as const
          ).map(([v, l, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={f.type === v} onClick={() => set({ type: v })} className={`flex items-center gap-2 rounded-xl border p-3 text-[14px] font-medium ${f.type === v ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
              <Icon size={18} /> {l}
            </button>
          ))}
        </div>
        <div>
          <TextField id="lead-name" label={f.type === "business" ? "Business name" : "Full name"} required value={f.name} onChange={(ev) => set({ name: ev.target.value })} autoComplete="off" aria-invalid={submitted && !!e.name} />
          {submitted && e.name && <p className="mt-1 text-[12px] text-danger-ink">{e.name}</p>}
        </div>
        {f.type === "business" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField id="lead-contact" label="Contact person" value={f.contactName} onChange={(ev) => set({ contactName: ev.target.value })} />
            <SelectField label="Entity type" value={f.entityType} onChange={(ev) => set({ entityType: ev.target.value as Entity })} options={ENTITIES.map((v) => [v, v])} />
            <TextField label="Industry" value={f.industry} onChange={(ev) => set({ industry: ev.target.value })} />
          </div>
        )}
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          <EmailInput id="lead-email" label="Email" value={f.email} onChange={(v) => set({ email: v })} showErrors={submitted} />
          <PhoneInput id="lead-phone" label="Phone" value={f.phone} onChange={(v) => set({ phone: v })} showErrors={submitted} />
        </div>
        {submitted && e.contact && <p className="-mt-3 text-[12px] text-danger-ink">{e.contact}</p>}
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Address (optional)</h3>
        <AddressFields idPrefix="lead-addr" value={f.address} onChange={(a) => set({ address: a })} showErrors={submitted} />
      </section>

      <section className="space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Pipeline</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="lead-source" label="Lead source" value={f.source} onChange={(ev) => set({ source: ev.target.value })} options={[...new Set([...sources, f.source])].map((s) => [s, s])} />
          <TextField id="lead-source-detail" label="Source detail" hint="Referrer, campaign…" value={f.sourceDetail} onChange={(ev) => set({ sourceDetail: ev.target.value })} placeholder="e.g. Referred by a current client" />
          {mode === "new" && <SelectField id="lead-stage" label="Stage" value={f.stageId} onChange={(ev) => set({ stageId: ev.target.value })} options={stages.map((s) => [s.id, s.name])} />}
          <SelectField id="lead-owner" label="Assigned to" value={f.ownerId} onChange={(ev) => set({ ownerId: ev.target.value })} options={staffList().map((s) => [s.id, s.name])} />
          <SelectField id="lead-priority" label="Priority" value={f.priority} onChange={(ev) => set({ priority: ev.target.value as LeadPriority })} options={[["urgent", "Urgent"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
          <div>
            <TextField id="lead-value" label="Estimated value ($)" type="number" min={0} inputMode="decimal" value={f.estValue} onChange={(ev) => set({ estValue: ev.target.value })} />
            {submitted && e.estValue && <p className="mt-1 text-[12px] text-danger-ink">{e.estValue}</p>}
          </div>
        </div>
        <fieldset>
          <Label>Interested in</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICE_ORDER.map((s) => {
              const on = f.interests.includes(s);
              return (
                <label key={s} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 ${on ? "border-accent bg-accent-soft/60" : "border-line hover:bg-surface-hover"}`}>
                  <input type="checkbox" checked={on} onChange={() => set({ interests: toggle(f.interests, s) })} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="h-5 w-1.5 rounded-full" style={{ background: `var(--svc-${s})` }} />
                  <span className="text-[13.5px] font-medium text-ink">{SERVICES[s].label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <TextField id="lead-tags" label="Tags" hint="Comma-separated" value={f.tags} onChange={(ev) => set({ tags: ev.target.value })} />
      </section>

      {mode === "new" && (
        <section className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">First follow-up & note</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField id="lead-follow-date" label="Follow-up date" type="date" value={f.followDate} onChange={(ev) => set({ followDate: ev.target.value })} />
            <TextField id="lead-follow-time" label="Time" type="time" step={900} value={f.followTime} onChange={(ev) => set({ followTime: ev.target.value })} />
            <div>
              <TextField id="lead-follow-note" label="Reminder" value={f.followNote} onChange={(ev) => set({ followNote: ev.target.value })} placeholder="e.g. Intro call" />
              {submitted && e.follow && <p className="mt-1 text-[12px] text-danger-ink">{e.follow}</p>}
            </div>
          </div>
          <TextArea id="lead-first-note" label="Note" value={f.firstNote} onChange={(ev) => set({ firstNote: ev.target.value })} placeholder="What do they need? How did they find us?" />
        </section>
      )}
    </div>
  );
}

export function EditLeadDialog({ lead, open, onClose }: { lead: Lead; open: boolean; onClose: () => void }) {
  const store = useLeads();
  const toast = useToast();
  const [f, setF] = useState(() => leadToForm(lead));
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (open) {
      setF(leadToForm(lead));
      setSubmitted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = () => {
    setSubmitted(true);
    if (Object.values(leadFormErrors(f)).some(Boolean)) return;
    const v = formToLead(f);
    const { firstNote: _n, followUp: _f, stageId: _s, ...patch } = v;
    if (patch.ownerId !== lead.ownerId) store.setOwner(lead.id, patch.ownerId);
    store.updateLead(lead.id, patch);
    toast("Lead updated");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Edit lead" description={lead.name} size="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save changes</Button></>}>
      <LeadFormFields f={f} set={(p) => setF((x) => ({ ...x, ...p }))} mode="edit" submitted={submitted} />
    </Modal>
  );
}

/* ================================================================== */
/* Follow-up reminder                                                  */
/* ================================================================== */

export function ReminderDialog({ lead, open, onClose }: { lead: Lead; open: boolean; onClose: () => void }) {
  const store = useLeads();
  const toast = useToast();
  const [date, setDate] = useState(dateInput(1));
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState(lead.ownerId);
  useEffect(() => {
    if (open) {
      setDate(dateInput(1));
      setTime("10:00");
      setNote("");
      setOwner(lead.ownerId);
    }
  }, [open, lead.ownerId]);
  const quick = (days: number) => setDate(dateInput(days));
  const save = () => {
    store.addReminder(lead.id, new Date(`${date}T${time}`).toISOString(), note.trim(), owner);
    toast(`Follow-up set for ${new Date(`${date}T${time}`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Schedule follow-up" description={lead.name} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!note.trim() || !date} onClick={save}>Save reminder</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            ["Tomorrow", 1],
            ["In 3 days", 3],
            ["Next week", 7],
            ["In 2 weeks", 14],
          ].map(([l, n]) => (
            <button key={l} type="button" onClick={() => quick(n as number)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${date === dateInput(n as number) ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="rem-date" label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField id="rem-time" label="Time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <TextField id="rem-note" label="What's the follow-up?" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Send quote, confirm consultation" />
        <SelectField label="Remind" value={owner} onChange={(e) => setOwner(e.target.value)} options={staffList().map((s) => [s.id, s.name])} />
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Log activity                                                        */
/* ================================================================== */

const OUTCOMES = ["Reached — interested", "Reached — needs time", "Left voicemail", "No answer", "Consultation booked", "Not interested"];

export function LogActivityDialog({ lead, open, onClose, onScheduleFollowUp }: { lead: Lead; open: boolean; onClose: () => void; onScheduleFollowUp: () => void }) {
  const store = useLeads();
  const toast = useToast();
  const [channel, setChannel] = useState<"Call" | "Email" | "Text" | "Meeting">("Call");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [advance, setAdvance] = useState(false);
  const [next, setNext] = useState(true);
  const stageIdx = store.stages.findIndex((s) => s.id === lead.stageId);
  const nextStage = store.stages[stageIdx + 1];
  useEffect(() => {
    if (open) {
      setChannel("Call");
      setSummary("");
      setOutcome(OUTCOMES[0]);
      setAdvance(false);
      setNext(true);
    }
  }, [open]);
  const save = () => {
    store.logActivity(lead.id, channel, summary.trim(), outcome);
    if (advance && nextStage) store.setStage(lead.id, nextStage.id);
    toast(`${channel} logged${advance && nextStage ? ` · moved to "${nextStage.name}"` : ""}`);
    onClose();
    if (next) setTimeout(onScheduleFollowUp, 50);
  };
  return (
    <Modal open={open} onClose={onClose} title="Log activity" description={lead.name} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!summary.trim()} onClick={save}>Log {channel.toLowerCase()}</Button></>}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Activity type" className="grid grid-cols-4 gap-2">
          {(["Call", "Email", "Text", "Meeting"] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)} className={`rounded-xl border py-2 text-[13px] font-medium ${channel === c ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
              {c}
            </button>
          ))}
        </div>
        <TextArea id="log-summary" label="Summary" required value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What was discussed?" />
        <SelectField id="log-outcome" label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} options={OUTCOMES.map((o) => [o, o])} />
        {nextStage && <Checkbox label={`Move to "${nextStage.name}"`} checked={advance} onChange={() => setAdvance((v) => !v)} />}
        <Checkbox label="Schedule the next follow-up" checked={next} onChange={() => setNext((v) => !v)} />
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Mark lost                                                           */
/* ================================================================== */

export function LostDialog({ leadIds, open, onClose, label }: { leadIds: string[]; open: boolean; onClose: () => void; label: string }) {
  const store = useLeads();
  const toast = useToast();
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [detail, setDetail] = useState("");
  useEffect(() => {
    if (open) {
      setReason(LOST_REASONS[0]);
      setDetail("");
    }
  }, [open]);
  const save = () => {
    store.markLost(leadIds, detail.trim() ? `${reason} — ${detail.trim()}` : reason);
    toast(leadIds.length > 1 ? `${leadIds.length} leads marked lost` : "Lead marked lost — history kept");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Mark as lost" description={label} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Mark lost</Button></>}>
      <div className="space-y-4">
        <SelectField id="lost-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={LOST_REASONS.map((r) => [r, r])} />
        <TextField label="Details (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} />
        <p className="text-[12.5px] text-muted">Lost leads keep their full history and can be reopened anytime.</p>
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Pipeline settings — customizable stages + sources                   */
/* ================================================================== */

export function PipelineSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useLeads();
  const toast = useToast();
  const [newStage, setNewStage] = useState("");
  const [newSource, setNewSource] = useState("");
  const [removing, setRemoving] = useState<{ id: string; moveTo: string } | null>(null);
  const counts = useMemo(() => Object.fromEntries(store.stages.map((s) => [s.id, store.leads.filter((l) => l.stageId === s.id && l.status === "open").length])), [store.stages, store.leads]);
  const sourceCounts = useMemo(() => Object.fromEntries(store.sources.map((s) => [s, store.leads.filter((l) => l.source === s).length])), [store.sources, store.leads]);

  return (
    <Modal open={open} onClose={onClose} title="Pipeline settings" description="Customize stages and lead sources. Changes apply to everyone." size="lg" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="space-y-7">
        <section>
          <h3 className="mb-1 text-[14px] font-semibold text-ink">Stages</h3>
          <p className="mb-3 text-[12.5px] text-muted">Left to right on the board. &ldquo;Converted&rdquo; and &ldquo;Lost&rdquo; are statuses, not stages.</p>
          <ol className="space-y-2">
            {store.stages.map((s, i) => (
              <li key={s.id} className="rounded-xl border border-line p-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-center text-[12px] font-semibold text-muted tabular-nums">{i + 1}</span>
                  <input aria-label={`Stage ${i + 1} name`} defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== s.name && (store.renameStage(s.id, e.target.value), toast(`Renamed to "${e.target.value.trim()}"`))} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[14px] text-ink focus:border-accent focus:outline-none" />
                  <span className="hidden text-[12px] text-muted sm:inline">{counts[s.id] ?? 0} open</span>
                  <IconBtn label={`Move ${s.name} left`} disabled={i === 0} onClick={() => store.moveStage(s.id, -1)} icon={ArrowUp} />
                  <IconBtn label={`Move ${s.name} right`} disabled={i === store.stages.length - 1} onClick={() => store.moveStage(s.id, 1)} icon={ArrowDown} />
                  <IconBtn label={`Remove ${s.name}`} disabled={store.stages.length <= 1} onClick={() => setRemoving({ id: s.id, moveTo: store.stages.find((x) => x.id !== s.id)!.id })} icon={Trash2} />
                </div>
                {removing?.id === s.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft p-2.5 text-[12.5px] text-warning-ink">
                    {counts[s.id] ? `Move its ${counts[s.id]} lead(s) to` : "Remove this stage?"}
                    {counts[s.id] ? (
                      <select aria-label="Move leads to" value={removing.moveTo} onChange={(e) => setRemoving({ ...removing, moveTo: e.target.value })} className="rounded-md border border-line bg-surface px-2 py-1 text-ink">
                        {store.stages.filter((x) => x.id !== s.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    ) : null}
                    <Button size="sm" variant="primary" onClick={() => { store.removeStage(s.id, removing.moveTo); setRemoving(null); toast(`Removed stage "${s.name}"`); }}>Remove</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <form onSubmit={(e) => { e.preventDefault(); if (newStage.trim()) { store.addStage(newStage); toast(`Added stage "${newStage.trim()}"`); setNewStage(""); } }} className="mt-2 flex gap-2">
            <input aria-label="New stage name" value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="New stage name" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink focus:border-accent focus:outline-none" />
            <Button type="submit" icon={Plus} disabled={!newStage.trim()}>Add stage</Button>
          </form>
        </section>

        <section>
          <h3 className="mb-1 text-[14px] font-semibold text-ink">Lead sources</h3>
          <p className="mb-3 text-[12.5px] text-muted">Removing a source hides it from new leads; existing leads keep it.</p>
          <div className="flex flex-wrap gap-2">
            {store.sources.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-[13px] text-ink-2">
                {s}
                <span className="text-[11px] text-muted">{sourceCounts[s] || ""}</span>
                <button type="button" aria-label={`Remove source ${s}`} onClick={() => { store.removeSource(s); toast(`Removed "${s}" from the source list`); }} className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-surface-hover hover:text-danger">
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (newSource.trim()) { store.addSource(newSource); toast(`Added source "${newSource.trim()}"`); setNewSource(""); } }} className="mt-3 flex gap-2">
            <input aria-label="New source" value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="e.g. TikTok, Radio ad, Church partner" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink focus:border-accent focus:outline-none" />
            <Button type="submit" icon={Plus} disabled={!newSource.trim()}>Add source</Button>
          </form>
        </section>
      </div>
    </Modal>
  );
}

function IconBtn({ label, icon: Icon, onClick, disabled }: { label: string; icon: typeof Plus; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-ink disabled:opacity-30">
      <Icon size={15} />
    </button>
  );
}

/* ================================================================== */
/* Convert lead → client                                               */
/* ================================================================== */

export function ConvertDialog({ lead, open, onClose, onConverted }: { lead: Lead; open: boolean; onClose: () => void; onConverted: (clientId: string) => void }) {
  const leads = useLeads();
  const clientStore = useClients();
  const clients = clientStore.clients;
  const toast = useToast();

  const init = () => ({
    type: lead.type,
    name: lead.name,
    contactName: lead.contactName ?? "",
    entityType: lead.business?.entityType ?? ("LLC" as Entity),
    email: lead.email,
    phone: lead.phone,
    address: { line1: lead.address?.line1 ?? "", line2: lead.address?.line2 ?? "", city: lead.address?.city ?? "", state: lead.address?.state ?? "GA", zip: lead.address?.zip ?? "" } as Address,
    services: lead.interests.length ? lead.interests : ([] as ServiceKey[]),
    titles: Object.fromEntries(SERVICE_ORDER.map((s) => [s, defaultTitleFor(s, lead.type, lead.business?.entityType)])) as Record<ServiceKey, string>,
    staffIds: [lead.ownerId],
    invite: true,
    taxMode: "portal" as "portal" | "now",
    dob: "",
    taxIdType: "SSN" as TaxIdType,
    taxId: "",
    ein: "",
    rpName: lead.contactName ?? "",
    rpTitle: "Owner",
    rpTaxIdType: "SSN" as TaxIdType,
    rpTaxId: "",
  });
  const [f, setF] = useState(init);
  const [submitted, setSubmitted] = useState(false);
  const [target, setTarget] = useState<"new" | string>("new");
  const set = (p: Partial<ReturnType<typeof init>>) => setF((x) => ({ ...x, ...p }));

  // Existing client that looks like this lead → offer to merge instead of duplicating.
  const findMatches = (email: string, phone: string) => {
    const e = normalizeEmail(email);
    const p = digits(phone);
    return clients.filter((c) => (e && c.email.toLowerCase() === e) || (p.length === 10 && digits(c.phone) === p));
  };
  const matches = useMemo(() => findMatches(f.email, f.phone), [clients, f.email, f.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const fresh = init();
    setF(fresh);
    setSubmitted(false);
    setTarget(findMatches(fresh.email, fresh.phone)[0]?.id ?? "new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const taxNow = f.services.includes("tax") && f.taxMode === "now";
  const errors = (target !== "new"
    ? [f.services.length === 0 && "Choose at least one service", f.staffIds.length === 0 && "Assign at least one staff member"]
    : [
        !f.name.trim() && "Name is required",
        validateEmail(f.email, true),
        validatePhone(f.phone),
        Object.keys(validateAddress(f.address, false)).length > 0 && "Fix the address",
        f.services.length === 0 && "Choose at least one service",
        f.staffIds.length === 0 && "Assign at least one staff member",
        taxNow && f.type === "individual" && (validateDOB(f.dob, true) || validateTaxId(f.taxId, f.taxIdType, true)),
        taxNow && f.type === "business" && (validateEIN(f.ein, true) || (!f.rpName.trim() && "Responsible party name is required") || validateTaxId(f.rpTaxId, f.rpTaxIdType, true)),
      ]
  ).filter(Boolean);

  const submit = () => {
    setSubmitted(true);
    if (errors.length) return;
    if (target !== "new") {
      const c = clients.find((x) => x.id === target)!;
      leads.convertToExisting(lead.id, c.id, f.services, f.staffIds[0], f.titles);
      toast(`${lead.name} merged into ${c.name} — ${f.services.length} service${f.services.length > 1 ? "s" : ""} added`);
      onConverted(c.id);
      return;
    }
    const clientId = leads.convert(lead.id, {
      client: {
        type: f.type,
        name: f.name,
        contactName: f.contactName,
        entityType: f.entityType,
        email: normalizeEmail(f.email),
        phone: f.phone,
        address: { ...f.address, line2: f.address.line2 || undefined },
        services: f.services,
        titles: f.titles,
        staffIds: f.staffIds,
        invite: f.invite,
        dob: taxNow && f.type === "individual" ? dobToIso(f.dob) ?? undefined : undefined,
        taxIdType: f.taxIdType,
        taxId: taxNow && f.type === "individual" ? f.taxId : undefined,
        ein: taxNow && f.type === "business" ? f.ein : undefined,
        responsibleParty: f.type === "business" && f.rpName.trim() ? { name: f.rpName.trim(), title: f.rpTitle, taxIdType: f.rpTaxIdType, taxId: taxNow ? f.rpTaxId : undefined } : undefined,
      },
    });
    // Individuals give their SSN and date of birth in the tax interview (and upload a photo ID there), so
    // nothing extra is requested. A business is asked only for its IRS EIN letter.
    if (f.services.includes("tax") && !taxNow && f.type === "business") {
      clientStore.requestDocument(clientId, {
        name: "EIN confirmation letter (CP 575 or 147C)",
        service: "tax",
        category: "Tax ID",
        sensitive: true,
      });
    }
    toast(`${f.name.trim()} is now a client${f.invite ? " — portal invitation sent" : ""}`);
    onConverted(clientId);
  };

  const pinned = lead.notes.length;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert to client"
      description="Everything below is pre-filled from the lead — review and confirm."
      size="lg"
      footer={
        <>
          {submitted && errors.length > 0 && <span className="mr-auto self-center text-[12.5px] text-danger-ink">{String(errors[0])}</span>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={UserPlus} onClick={submit}>
            {target === "new" ? "Convert to client" : "Add to existing client"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Carry-over summary */}
        <div className="rounded-xl border border-success/30 bg-success-soft/60 p-3.5 text-[13px] text-ink-2">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-success-ink">
            <CheckCircle2 size={15} /> Carries over automatically
          </div>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <li className="flex items-center gap-1.5"><User size={13} className="text-muted" /> Contact {lead.type === "business" ? "& business" : ""} details</li>
            <li className="flex items-center gap-1.5"><Tag size={13} className="text-muted" /> Source: {lead.source}{lead.sourceDetail ? ` — ${lead.sourceDetail}` : ""}</li>
            <li className="flex items-center gap-1.5"><NotebookPen size={13} className="text-muted" /> {pinned} note{pinned === 1 ? "" : "s"}</li>
            <li className="flex items-center gap-1.5"><History size={13} className="text-muted" /> {lead.activity.length} activity entries (also kept on the lead)</li>
          </ul>
        </div>

        {matches.length > 0 && (
          <fieldset className="rounded-xl border border-warning/40 bg-warning-soft p-3.5">
            <legend className="sr-only">Existing client found</legend>
            <p className="mb-2 text-[13px] font-semibold text-warning-ink">This lead matches an existing client.</p>
            <div className="space-y-2">
              {matches.map((c) => (
                <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-surface p-2.5 ${target === c.id ? "border-accent" : "border-line"}`}>
                  <input type="radio" name="convert-target" checked={target === c.id} onChange={() => setTarget(c.id)} className="accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1 text-[13.5px]">
                    <span className="font-semibold text-ink">Add services to {c.name}</span>
                    <span className="block text-[12px] text-muted">{c.email} · recommended — avoids a duplicate record</span>
                  </span>
                </label>
              ))}
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-surface p-2.5 ${target === "new" ? "border-accent" : "border-line"}`}>
                <input type="radio" name="convert-target" checked={target === "new"} onChange={() => setTarget("new")} className="accent-[var(--accent)]" />
                <span className="text-[13.5px] font-semibold text-ink">Create a new client anyway</span>
              </label>
            </div>
          </fieldset>
        )}

        {/* Services */}
        <section>
          <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Enroll in services</h3>
          <p className="mb-3 text-[12.5px] text-muted">Pre-selected from the lead&rsquo;s interests. Pick one or more.</p>
          <div className="space-y-2">
            {SERVICE_ORDER.map((s) => {
              const on = f.services.includes(s);
              return (
                <div key={s} className={`rounded-xl border p-3 ${on ? "border-accent bg-accent-soft/40" : "border-line"}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" aria-label={`Enroll in ${SERVICES[s].label}`} checked={on} onChange={() => set({ services: toggle(f.services, s) })} className="h-4 w-4 accent-[var(--accent)]" />
                    <span className="h-5 w-1.5 rounded-full" style={{ background: `var(--svc-${s})` }} />
                    <span className="text-[14px] font-medium text-ink">{SERVICES[s].label}</span>
                    {lead.interests.includes(s) && <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">From lead</span>}
                  </label>
                  {on && (
                    <input aria-label={`${SERVICES[s].label} engagement title`} value={f.titles[s]} onChange={(e) => set({ titles: { ...f.titles, [s]: e.target.value } })} className="mt-2 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink focus:border-accent focus:outline-none" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {target === "new" && (
          <>
            <section className="space-y-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Client details</h3>
              <TextField id="cv-name" label={f.type === "business" ? "Business name" : "Full legal name"} required value={f.name} onChange={(e) => set({ name: e.target.value })} />
              {f.type === "business" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField id="cv-contact" label="Primary contact" value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} />
                  <SelectField label="Entity type" value={f.entityType} onChange={(e) => set({ entityType: e.target.value as Entity })} options={ENTITIES.map((v) => [v, v])} />
                </div>
              )}
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <EmailInput id="cv-email" label="Email" required value={f.email} onChange={(v) => set({ email: v })} showErrors={submitted} />
                <PhoneInput id="cv-phone" label="Phone" value={f.phone} onChange={(v) => set({ phone: v })} showErrors={submitted} />
              </div>
              <AddressFields idPrefix="cv-addr" value={f.address} onChange={(a) => set({ address: a })} showErrors={submitted} />
            </section>

            {f.services.includes("tax") && (
              <section className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted"><Lock size={12} /> Tax identification</h3>
                <div role="radiogroup" aria-label="Tax ID collection" className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["portal", "Request in client portal", "Adds a secure request to their checklist"],
                      ["now", "Enter now", f.type === "business" ? "EIN + responsible party" : "Date of birth + SSN/ITIN"],
                    ] as const
                  ).map(([v, l, h]) => (
                    <button key={v} type="button" role="radio" aria-checked={f.taxMode === v} onClick={() => set({ taxMode: v })} className={`rounded-xl border p-3 text-left ${f.taxMode === v ? "border-accent bg-accent-soft text-accent-ink" : "border-line hover:bg-surface-hover"}`}>
                      <span className="block text-[13.5px] font-semibold">{l}</span>
                      <span className="block text-[12px] text-muted">{h}</span>
                    </button>
                  ))}
                </div>
                {taxNow && f.type === "individual" && (
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    <DOBInput id="cv-dob" label="Date of birth" required value={f.dob} onChange={(v) => set({ dob: v })} showErrors={submitted} />
                    <TaxIdInput id="cv-taxid" label={f.taxIdType} required value={f.taxId} onChange={(v) => set({ taxId: v })} type={f.taxIdType} onTypeChange={(t) => set({ taxIdType: t })} showErrors={submitted} />
                  </div>
                )}
                {taxNow && f.type === "business" && (
                  <div className="space-y-4">
                    <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      <EINInput id="cv-ein" label="EIN" required value={f.ein} onChange={(v) => set({ ein: v })} showErrors={submitted} />
                    </div>
                    <ResponsiblePartyFields idPrefix="cv-rp" required name={f.rpName} onName={(v) => set({ rpName: v })} title={f.rpTitle} onTitle={(v) => set({ rpTitle: v })} taxId={f.rpTaxId} onTaxId={(v) => set({ rpTaxId: v })} taxIdType={f.rpTaxIdType} onTaxIdType={(t) => set({ rpTaxIdType: t })} showErrors={submitted} />
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Assignment</h3>
          <div className="flex flex-wrap gap-2">
            {staffList().map((s) => {
              const on = f.staffIds.includes(s.id);
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => set({ staffIds: toggle(f.staffIds, s.id) })} className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
                  {s.name}
                  {s.id === lead.ownerId && <span className="ml-1 text-[11px] font-normal text-muted">(lead owner)</span>}
                </button>
              );
            })}
          </div>
          {target === "new" && <Checkbox label="Send client portal invitation" hint="They set their own password and multi-factor authentication." checked={f.invite} onChange={() => set({ invite: !f.invite })} />}
        </section>
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <ArrowRight size={12} /> The lead stays in the pipeline as &ldquo;Converted&rdquo; with its full history and a link to the client.
        </p>
      </div>
    </Modal>
  );
}
