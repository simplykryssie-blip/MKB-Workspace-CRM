"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Search, Trash2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { call } from "@/lib/sync/remote";
import { COLORS, LOCATIONS, PRIORITIES, REPEATS, SERVICES, STATUS_LABEL, contactHref, type Appt, type ApptType, type CalMember, type Contact, type Task } from "@/lib/calendar/config";

const pad = (n: number) => String(n).padStart(2, "0");
/** yyyy-mm-dd and hh:mm in the browser's time zone. */
export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toIso = (date: string, time: string) => new Date(`${date}T${time || "09:00"}:00`).toISOString();
const area = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

/** Find a client, lead or Monarch firm to link. */
export function ContactPicker({ value, onChange, disabled }: { value: Contact | null; onChange: (c: Contact | null) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<(Contact & { detail: string })[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(() => { call<{ contacts: (Contact & { detail: string })[] }>("GET", `/api/calendar/contacts?q=${encodeURIComponent(q)}`).then((r) => setRes(r.contacts)).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const label = { client: "Client", lead: "Lead", office: "Monarch firm" } as const;
  if (value) return (
    <div><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Client or lead</span>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2"><span className="min-w-0 flex-1 truncate text-[14px] text-ink"><b>{value.name}</b> <span className="text-[12px] text-muted">{label[value.type]}</span></span>{!disabled && <button type="button" aria-label="Remove" onClick={() => onChange(null)} className="text-muted hover:text-ink"><X size={16} /></button>}</div>
    </div>
  );
  return (
    <div className="relative">
      <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Client or lead <span className="font-normal text-muted">(optional)</span></span>
        <span className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input disabled={disabled} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or phone" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" /></span></label>
      {res.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-surface shadow-pop">
          {res.map((c) => <li key={`${c.type}-${c.id}`}><button type="button" onClick={() => { onChange({ type: c.type, id: c.id, name: c.name }); setQ(""); setRes([]); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover"><span className="min-w-0 flex-1"><span className="block truncate text-[14px] text-ink">{c.name}</span><span className="block truncate text-[12px] text-muted">{c.detail}</span></span><span className="text-[11.5px] text-muted">{label[c.type]}</span></button></li>)}
        </ul>
      )}
    </div>
  );
}

/* ================================================================ appointment / time block */
export type ApptDraft = Partial<Appt> & { kind: Appt["kind"] };
export function ApptDialog({ draft, types, members, meId, canAll, onClose, onSaved }: { draft: ApptDraft | null; types: ApptType[]; members: CalMember[]; meId: string; canAll: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState<ApptDraft | null>(draft);
  const [date, setDate] = useState(""), [time, setTime] = useState(""), [dur, setDur] = useState(30);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setV(draft);
    if (draft) {
      const st = draft.startsAt ? new Date(draft.startsAt) : new Date(Math.ceil(Date.now() / 1800e3) * 1800e3);
      setDate(localDate(st)); setTime(localTime(st));
      setDur(draft.startsAt && draft.endsAt ? Math.round((Date.parse(draft.endsAt) - Date.parse(draft.startsAt)) / 60e3) : draft.kind === "block" ? 60 : 30);
    }
  }, [draft]);
  if (!v) return null;
  const isNew = !v.id, block = v.kind === "block";
  const set = (p: Partial<ApptDraft>) => setV({ ...v, ...p });
  const active = types.filter((t) => t.active || t.id === v.typeId);
  const chooseType = (id: string) => { const t = types.find((x) => x.id === id); if (!t) return set({ typeId: undefined }); setDur(t.durationMin); set({ typeId: t.id, brand: t.brand, service: t.service, location: t.location, locationNote: v.locationNote || t.locationNote }); };
  const editable = isNew || canAll || v.memberId === meId;
  const save = async () => {
    setBusy(true);
    try {
      const startsAt = toIso(date, time);
      const r = await call<{ clashes: string[] }>("POST", "/api/calendar/appointments", { ...v, startsAt, endsAt: new Date(Date.parse(startsAt) + dur * 60e3).toISOString(), memberId: v.memberId ?? meId });
      toast(r.clashes.length ? `Saved — note: overlaps ${r.clashes[0]}` : isNew ? (block ? "Time blocked" : "Appointment added") : "Saved", r.clashes.length ? "info" : undefined);
      onSaved();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  const status = async (s: Appt["status"]) => {
    try { await call("POST", `/api/calendar/appointments/${v.id}/status`, { status: s }); toast(`Marked ${STATUS_LABEL[s].toLowerCase()}`); onSaved(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't update", "info"); }
  };
  const remove = async () => {
    if (!window.confirm(block ? "Remove this time block?" : "Delete this appointment?")) return;
    try { await call("DELETE", `/api/calendar/appointments/${v.id}`); onSaved(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "info"); }
  };
  const href = contactHref(v.contact ?? null);
  return (
    <Modal open onClose={onClose} size="lg" title={isNew ? (block ? "Block time" : "New appointment") : block ? "Time block" : v.title ?? "Appointment"}
      description={!isNew && !block && v.status !== "scheduled" ? `Status: ${STATUS_LABEL[v.status!]}` : undefined}
      footer={<div className="flex w-full flex-wrap items-center gap-2">
        {!isNew && editable && !block && v.status === "scheduled" && <><Button size="sm" icon={CheckCircle2} onClick={() => void status("completed")}>Completed</Button><Button size="sm" onClick={() => void status("no_show")}>No-show</Button><Button size="sm" variant="ghost" icon={XCircle} onClick={() => void status("cancelled")}>Cancel it</Button></>}
        {!isNew && editable && !block && v.status !== "scheduled" && <Button size="sm" onClick={() => void status("scheduled")}>Put back on calendar</Button>}
        {!isNew && editable && (block || !v.contact || v.status === "cancelled") && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void remove()}>Delete</Button>}
        <span className="flex-1" />
        <Button onClick={onClose}>Close</Button>{editable && <Button variant="primary" disabled={busy || !date || !time} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>}
      </div>}>
      <fieldset disabled={!editable} className="grid min-w-0 gap-3 sm:grid-cols-2">
        {!block && <div className="sm:col-span-2"><SelectField label="Type" value={v.typeId ?? ""} onChange={(e) => chooseType(e.target.value)} options={[["", "Other (no type)"], ...active.map((t) => [t.id, `${t.name} · ${t.durationMin} min${t.brand === "monarch" ? " · Monarch" : ""}`] as [string, string])]} /></div>}
        {!block && <div className="sm:col-span-2"><ContactPicker value={v.contact ?? null} onChange={(contact) => set({ contact })} /></div>}
        <div className="sm:col-span-2"><TextField label={block ? "What's this time for?" : "Title (optional — filled in from the type and person)"} value={v.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder={block ? "e.g. Lunch, Focus time, Out of office" : ""} /></div>
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3"><TextField label="Start" type="time" value={time} onChange={(e) => setTime(e.target.value)} /><SelectField label="Length" value={String(dur)} onChange={(e) => setDur(Number(e.target.value))} options={[15, 30, 45, 60, 90, 120, 180, 240, 480].concat([dur]).filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b).map((m) => [String(m), m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`] as [string, string])} /></div>
        <SelectField label="Calendar" value={v.memberId ?? meId} onChange={(e) => set({ memberId: e.target.value })} options={members.filter((m) => canAll || m.id === meId || m.id === v.memberId).map((m) => [m.id, m.me ? `${m.name} (me)` : m.name] as [string, string])} />
        {!block && <SelectField label="Where" value={v.location ?? "video"} onChange={(e) => set({ location: e.target.value as Appt["location"] })} options={Object.entries(LOCATIONS)} />}
        {!block && <div className="sm:col-span-2"><TextField label={v.location === "in_person" ? "Address" : v.location === "phone" ? "Phone details" : "Video link (Zoom links will be added automatically in the next step)"} value={v.locationNote ?? ""} onChange={(e) => set({ locationNote: e.target.value })} /></div>}
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Notes</span><textarea rows={3} value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} className={area} /></label>
        {href && <p className="text-[13px] sm:col-span-2"><a href={href} className="font-semibold text-accent">Open {v.contact!.name}&rsquo;s record →</a></p>}
      </fieldset>
    </Modal>
  );
}

/* ================================================================ task */
export function TaskDialog({ draft, members, meId, canAll, onClose, onSaved }: { draft: Partial<Task> | null; members: CalMember[]; meId: string; canAll: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState<Partial<Task> | null>(draft);
  const [date, setDate] = useState(""), [time, setTime] = useState("");
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setV(draft);
    if (draft) {
      if (!draft.dueAt) { setDate(""); setTime(""); }
      else if (/^\d{4}-\d{2}-\d{2}$/.test(draft.dueAt)) { setDate(draft.dueAt); setTime(""); }
      else { const d = new Date(draft.dueAt); setDate(localDate(d)); setTime(localTime(d)); }
    }
  }, [draft]);
  if (!v) return null;
  const isNew = !v.id;
  const set = (p: Partial<Task>) => setV({ ...v, ...p });
  const list = v.checklist ?? [];
  const save = async () => {
    setBusy(true);
    try { await call("POST", "/api/calendar/tasks", { ...v, dueAt: date ? (time ? toIso(date, time) : date) : "", assigneeId: v.assigneeId ?? meId }); toast(isNew ? "Task added" : "Saved"); onSaved(); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  const remove = async () => {
    if (!window.confirm("Delete this task?")) return;
    try { await call("DELETE", `/api/calendar/tasks/${v.id}`); onSaved(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "info"); }
  };
  const href = contactHref(v.contact ?? null);
  return (
    <Modal open onClose={onClose} size="lg" title={isNew ? "New task" : "Task"}
      footer={<div className="flex w-full items-center gap-2">{!isNew && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void remove()}>Delete</Button>}<span className="flex-1" /><Button onClick={onClose}>Close</Button><Button variant="primary" disabled={busy || !v.title?.trim()} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button></div>}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextField label="Task" value={v.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Call Dana about her missing W-2" autoFocus /></div>
        <TextField label="Due date (optional)" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Time (optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
        <SelectField label="Priority" value={v.priority ?? "normal"} onChange={(e) => set({ priority: e.target.value as Task["priority"] })} options={Object.entries(PRIORITIES)} />
        <SelectField label="Repeats" value={v.repeat ?? "none"} onChange={(e) => set({ repeat: e.target.value as Task["repeat"] })} options={Object.entries(REPEATS)} />
        <SelectField label="For" value={v.assigneeId ?? meId} onChange={(e) => set({ assigneeId: e.target.value })} options={members.filter((m) => canAll || m.id === meId || m.id === v.assigneeId).map((m) => [m.id, m.me ? `${m.name} (me)` : m.name] as [string, string])} />
        <SelectField label="Area" value={`${v.brand ?? "mkb"}:${v.service ?? "other"}`} onChange={(e) => { const [brand, service] = e.target.value.split(":"); set({ brand: brand as Task["brand"], service }); }} options={[...Object.entries(SERVICES).filter(([k]) => k !== "monarch").map(([k, l]) => [`mkb:${k}`, `MKB · ${l}`] as [string, string]), ["monarch:monarch", "Monarch"]]} />
        <div className="sm:col-span-2"><ContactPicker value={v.contact ?? null} onChange={(contact) => set({ contact })} /></div>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Checklist</span>
          <ul className="space-y-1">{list.map((c) => <li key={c.id} className="flex items-center gap-2"><input type="checkbox" checked={c.done} onChange={() => set({ checklist: list.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} className="h-4 w-4 accent-[var(--accent)]" /><span className={`flex-1 text-[14px] ${c.done ? "text-muted line-through" : "text-ink"}`}>{c.text}</span><button type="button" aria-label="Remove item" onClick={() => set({ checklist: list.filter((x) => x.id !== c.id) })} className="text-faint hover:text-ink"><X size={14} /></button></li>)}</ul>
          <div className="mt-1.5 flex gap-2"><input value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) { e.preventDefault(); set({ checklist: [...list, { id: `n${Date.now()}`, text: item.trim(), done: false }] }); setItem(""); } }} placeholder="Add a step and press Enter" className="h-9 flex-1 rounded-xl border border-line bg-surface px-3 text-[13.5px]" /><Button size="sm" icon={Plus} disabled={!item.trim()} onClick={() => { set({ checklist: [...list, { id: `n${Date.now()}`, text: item.trim(), done: false }] }); setItem(""); }}>Add</Button></div>
        </div>
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Notes</span><textarea rows={3} value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} className={area} /></label>
        {href && <p className="text-[13px] sm:col-span-2"><a href={href} className="font-semibold text-accent">Open {v.contact!.name}&rsquo;s record →</a></p>}
      </div>
    </Modal>
  );
}

/* ================================================================ settings */
export function TypesDialog({ open, types, members, meId, canSettings, onClose, onSaved }: { open: boolean; types: ApptType[]; members: CalMember[]; meId: string; canSettings: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<ApptType> | null>(null);
  const me = members.find((m) => m.id === meId);
  const saveType = async () => {
    try { await call("POST", "/api/calendar/types", edit); toast("Appointment type saved"); setEdit(null); onSaved(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
  };
  const color = async (c: string) => { try { await call("PUT", "/api/calendar/me", { color: c }); onSaved(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); } };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Calendar settings" description="Appointment types are shared by MKB and Monarch. Prices and online booking are used by booking pages (coming next).">
      <div className="space-y-5">
        <div><p className="mb-2 text-[13px] font-medium text-ink-2">My calendar color</p><div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => void color(c)} className={`h-8 w-8 rounded-full border-2 ${me?.color === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} />)}</div></div>
        <div>
          <div className="mb-2 flex items-center justify-between"><p className="text-[13px] font-medium text-ink-2">Appointment types</p>{canSettings && <Button size="sm" icon={Plus} onClick={() => setEdit({ name: "", brand: "mkb", service: "other", durationMin: 30, location: "video", locationNote: "", color: COLORS[1], priceCents: 0, bufferMin: 15, description: "", bookable: true, active: true })}>New type</Button>}</div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {types.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="min-w-0 flex-1"><span className={`block text-[14px] font-medium ${t.active ? "text-ink" : "text-muted line-through"}`}>{t.name}{t.brand === "monarch" ? " · Monarch" : ""}</span><span className="block text-[12px] text-muted">{t.durationMin} min · {LOCATIONS[t.location]} · {t.priceCents ? `$${(t.priceCents / 100).toFixed(2)}` : "Free"}{t.bookable ? "" : " · not bookable online"}</span></span>
                {canSettings && <Button size="sm" variant="ghost" onClick={() => setEdit(t)}>Edit</Button>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} size="lg" title={edit?.id ? "Edit appointment type" : "New appointment type"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" disabled={!edit?.name?.trim()} onClick={() => void saveType()}>Save</Button></>}>
        {edit && <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><TextField label="Name" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
          <SelectField label="Business" value={edit.brand ?? "mkb"} onChange={(e) => setEdit({ ...edit, brand: e.target.value as ApptType["brand"] })} options={[["mkb", "MKB Financial Group"], ["monarch", "Monarch Tax Suite"]]} />
          <SelectField label="Service" value={edit.service ?? "other"} onChange={(e) => setEdit({ ...edit, service: e.target.value })} options={Object.entries(SERVICES)} />
          <TextField label="Length (minutes)" type="number" value={String(edit.durationMin ?? 30)} onChange={(e) => setEdit({ ...edit, durationMin: Number(e.target.value) })} />
          <TextField label="Break after (minutes)" type="number" value={String(edit.bufferMin ?? 0)} onChange={(e) => setEdit({ ...edit, bufferMin: Number(e.target.value) })} />
          <SelectField label="Where" value={edit.location ?? "video"} onChange={(e) => setEdit({ ...edit, location: e.target.value as ApptType["location"] })} options={Object.entries(LOCATIONS)} />
          <TextField label="Price ($ — 0 for free)" type="number" value={String((edit.priceCents ?? 0) / 100)} onChange={(e) => setEdit({ ...edit, priceCents: Math.round(Number(e.target.value) * 100) })} />
          <div className="sm:col-span-2"><TextField label={edit.location === "in_person" ? "Address" : "Location details (optional)"} value={edit.locationNote ?? ""} onChange={(e) => setEdit({ ...edit, locationNote: e.target.value })} /></div>
          <div className="sm:col-span-2"><TextField label="Description (shown when booking)" value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
          <div className="sm:col-span-2"><p className="mb-1.5 text-[13px] font-medium text-ink-2">Color</p><div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setEdit({ ...edit, color: c })} className={`h-7 w-7 rounded-full border-2 ${edit.color === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} />)}</div></div>
          <label className="flex items-center gap-2 text-[14px] text-ink"><input type="checkbox" checked={edit.bookable !== false} onChange={(e) => setEdit({ ...edit, bookable: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />Offer for online booking</label>
          <label className="flex items-center gap-2 text-[14px] text-ink"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />Active</label>
        </div>}
      </Modal>
    </Modal>
  );
}
