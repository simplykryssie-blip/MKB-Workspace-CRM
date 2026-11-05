"use client";

import { useEffect, useState } from "react";
import { FileText, Lock, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, SelectField, TextArea, TextField, Label } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_FEES, DEFAULT_TITLES, useClients, nowIso } from "@/lib/store/clients-store";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { STAFF, SAMPLE_NOW } from "@/lib/sample/clients";
import { fileSize, fmtDate, usd } from "@/lib/format";
import type { Client, ClientDocument, ServiceKey } from "@/lib/types";

type DialogProps = { client: Client; open: boolean; onClose: () => void };

const svcOptions = (only?: ServiceKey[]): [string, string][] => (only?.length ? only : SERVICE_ORDER).map((s) => [s, SERVICES[s].label]);
const clientServices = (c: Client) => [...new Set(c.enrollments.map((e) => e.service))];
const isoDate = (daysFromNow: number) => {
  const d = new Date(SAMPLE_NOW);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

/** Offline "download": a small text placeholder — no real files exist in the preview. */
export function downloadPlaceholder(filename: string, body = "MKB Business Suite — sample placeholder file.\nNo real client documents exist in this design preview.\n") {
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w.-]+/g, "_") + ".txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */

export function EditClientDialog({ client: c, open, onClose }: DialogProps) {
  const store = useClients();
  const toast = useToast();
  const [f, setF] = useState(() => formFrom(c));
  useEffect(() => {
    if (open) setF(formFrom(c));
  }, [open, c]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggleStaff = (id: string) => setF((x) => ({ ...x, staffIds: x.staffIds.includes(id) ? x.staffIds.filter((s) => s !== id) : [...x.staffIds, id] }));
  const valid = f.name.trim() && f.email.includes("@") && f.staffIds.length > 0;

  const save = () => {
    store.updateClient(c.id, {
      name: f.name.trim(),
      contactName: f.contactName.trim() || undefined,
      email: f.email.trim(),
      phone: f.phone.trim(),
      preferredContact: f.preferredContact as Client["preferredContact"],
      address: { line1: f.line1, city: f.city, state: f.state, zip: f.zip },
      status: f.status as Client["status"],
      staffIds: f.staffIds,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      business: c.business ? { ...c.business, legalName: f.legalName || c.business.legalName, entityType: f.entityType as NonNullable<Client["business"]>["entityType"], industry: f.industry } : undefined,
    });
    toast("Client details saved");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit client" description={c.name} size="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>Save changes</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextField label={c.type === "business" ? "Business name" : "Full name"} required value={f.name} onChange={set("name")} /></div>
        {c.type === "business" && (
          <>
            <TextField label="Legal name" value={f.legalName} onChange={set("legalName")} />
            <TextField label="Primary contact" value={f.contactName} onChange={set("contactName")} />
            <SelectField label="Entity type" value={f.entityType} onChange={set("entityType")} options={["LLC", "S-Corp", "C-Corp", "Sole Prop", "Partnership", "Nonprofit"].map((v) => [v, v])} />
            <TextField label="Industry" value={f.industry} onChange={set("industry")} />
          </>
        )}
        <TextField label="Email" type="email" required value={f.email} onChange={set("email")} />
        <TextField label="Phone" type="tel" value={f.phone} onChange={set("phone")} />
        <div className="sm:col-span-2"><TextField label="Street address" value={f.line1} onChange={set("line1")} /></div>
        <TextField label="City" value={f.city} onChange={set("city")} />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="State" value={f.state} onChange={set("state")} maxLength={2} />
          <TextField label="ZIP" value={f.zip} onChange={set("zip")} inputMode="numeric" />
        </div>
        <SelectField label="Preferred contact" value={f.preferredContact} onChange={set("preferredContact")} options={["Email", "Phone", "Text", "Portal"].map((v) => [v, v])} />
        <SelectField label="Status" value={f.status} onChange={set("status")} options={[["active", "Active"], ["onboarding", "Onboarding"], ["inactive", "Inactive"]]} />
        <div className="sm:col-span-2"><TextField label="Tags" hint="Comma-separated" value={f.tags} onChange={set("tags")} /></div>
        <fieldset className="sm:col-span-2">
          <Label required>Assigned staff</Label>
          <div className="flex flex-wrap gap-2">
            {STAFF.map((s) => {
              const on = f.staffIds.includes(s.id);
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleStaff(s.id)} className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
                  {s.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <p className="flex items-center gap-1.5 text-[12px] text-muted sm:col-span-2"><Lock size={12} /> SSN / EIN and date of birth are edited separately with the sensitive-data permission.</p>
      </div>
    </Modal>
  );
}

function formFrom(c: Client) {
  return {
    name: c.name,
    contactName: c.contactName ?? "",
    email: c.email,
    phone: c.phone,
    preferredContact: c.preferredContact,
    line1: c.address.line1,
    city: c.address.city,
    state: c.address.state,
    zip: c.address.zip,
    status: c.status,
    staffIds: c.staffIds,
    tags: c.tags.join(", "),
    legalName: c.business?.legalName ?? "",
    entityType: c.business?.entityType ?? "LLC",
    industry: c.business?.industry ?? "",
  };
}

/* ------------------------------------------------------------------ */

export function EnrollDialog({ client: c, open, onClose, initial }: DialogProps & { initial?: ServiceKey }) {
  const store = useClients();
  const toast = useToast();
  const [service, setService] = useState<ServiceKey>(initial ?? "tax");
  const [title, setTitle] = useState(DEFAULT_TITLES[initial ?? "tax"]);
  const [staffId, setStaffId] = useState(c.staffIds[0]);
  const [fee, setFee] = useState(String(DEFAULT_FEES[initial ?? "tax"]));
  const [due, setDue] = useState("");
  useEffect(() => {
    if (!open) return;
    const s = initial ?? "tax";
    setService(s);
    setTitle(DEFAULT_TITLES[s]);
    setFee(String(DEFAULT_FEES[s]));
    setStaffId(c.staffIds[0]);
    setDue("");
  }, [open, initial, c.staffIds]);
  const pick = (s: ServiceKey) => {
    setService(s);
    setTitle(DEFAULT_TITLES[s]);
    setFee(String(DEFAULT_FEES[s]));
  };
  const valid = title.trim() && Number(fee) >= 0;
  const save = () => {
    store.enroll(c.id, { service, title: title.trim(), staffId, fee: Number(fee), dueAt: due ? new Date(due + "T17:00").toISOString() : undefined });
    toast(`${c.name} enrolled in ${SERVICES[service].label}`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Enroll in a service" description="Adds an engagement to this same client record — no duplicate profile." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>Enroll</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_ORDER.map((s) => (
            <button key={s} type="button" aria-pressed={service === s} onClick={() => pick(s)} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-[13.5px] font-medium ${service === s ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
              <span className="h-6 w-1.5 rounded-full" style={{ background: `var(--svc-${s})` }} />
              {SERVICES[s].label}
            </button>
          ))}
        </div>
        <TextField label="Engagement title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Assigned to" value={staffId} onChange={(e) => setStaffId(e.target.value)} options={STAFF.map((s) => [s.id, s.name])} />
          <TextField label="Fee ($)" type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
          <TextField label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        {service === "expunge" && (
          <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">Eligibility is reviewed by staff. The system never presents screening results as legal advice or guarantees an outcome.</p>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

const DOC_PRESETS: Record<ServiceKey, { name: string; category: string; sensitive: boolean }[]> = {
  tax: [
    { name: "W-2 — additional employer", category: "Income", sensitive: false },
    { name: "1099-INT / 1099-DIV", category: "Income", sensitive: false },
    { name: "1098 mortgage interest", category: "Deductions", sensitive: false },
    { name: "Childcare provider statement", category: "Credits", sensitive: false },
    { name: "Government photo ID", category: "Identity", sensitive: true },
    { name: "Prior-year tax return", category: "Tax return", sensitive: true },
  ],
  books: [
    { name: "Bank statement — current month", category: "Statements", sensitive: false },
    { name: "Credit card statement — current month", category: "Statements", sensitive: false },
    { name: "Loan statement", category: "Statements", sensitive: false },
    { name: "Payroll summary", category: "Payroll", sensitive: false },
  ],
  biz: [
    { name: "Owner photo ID", category: "Identity", sensitive: true },
    { name: "Operating agreement (signed)", category: "Formation", sensitive: false },
    { name: "Lease or proof of address", category: "Licensing", sensitive: false },
    { name: "Prior business license", category: "Licensing", sensitive: false },
  ],
  expunge: [
    { name: "Government photo ID", category: "Identity", sensitive: true },
    { name: "Court disposition", category: "Court records", sensitive: true },
    { name: "Proof of completed sentence / probation", category: "Court records", sensitive: true },
    { name: "Character reference letter", category: "Supporting", sensitive: false },
  ],
};

export function RequestDocDialog({ client: c, open, onClose }: DialogProps) {
  const store = useClients();
  const toast = useToast();
  const svcs = clientServices(c);
  const [service, setService] = useState<ServiceKey>(svcs[0] ?? "tax");
  const [preset, setPreset] = useState("0");
  const [custom, setCustom] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [notify, setNotify] = useState(true);
  const presets = DOC_PRESETS[service];
  useEffect(() => {
    if (open) {
      setService(svcs[0] ?? "tax");
      setPreset("0");
      setCustom("");
      setNotify(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (preset !== "custom") setSensitive(presets[Number(preset)]?.sensitive ?? false);
  }, [preset, presets]);
  const name = preset === "custom" ? custom.trim() : presets[Number(preset)]?.name;
  const save = () => {
    store.requestDocument(c.id, { name: name!, service, category: preset === "custom" ? "Other" : presets[Number(preset)].category, sensitive });
    toast(notify ? `Requested "${name}" — client notified in portal` : `Added "${name}" to the client's checklist`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Request a document" description="Appears on the client's portal checklist." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name} onClick={save}>Send request</Button></>}>
      <div className="space-y-4">
        <SelectField label="Service" value={service} onChange={(e) => { setService(e.target.value as ServiceKey); setPreset("0"); }} options={svcOptions(svcs)} />
        <SelectField label="Document" value={preset} onChange={(e) => setPreset(e.target.value)} options={[...presets.map((p, i) => [String(i), p.name] as [string, string]), ["custom", "Other (type a name)…"]]} />
        {preset === "custom" && <TextField label="Document name" required value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Signed lease agreement" />}
        <Checkbox label="Mark as restricted" hint="IDs, tax returns and court records — only staff with sensitive-document access can open it." checked={sensitive} onChange={() => setSensitive((v) => !v)} />
        <Checkbox label="Notify client now" hint="Sends a portal notification and email reminder." checked={notify} onChange={() => setNotify((v) => !v)} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function UploadDocDialog({ client: c, open, onClose, replace }: DialogProps & { replace?: ClientDocument }) {
  const store = useClients();
  const toast = useToast();
  const svcs = clientServices(c);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [service, setService] = useState<ServiceKey>(svcs[0] ?? "tax");
  const [sensitive, setSensitive] = useState(false);
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    if (open) {
      setFile(null);
      setName(replace?.name ?? "");
      setService(replace?.service ?? svcs[0] ?? "tax");
      setSensitive(replace?.sensitive ?? false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, replace]);
  const take = (f?: File | null) => {
    if (!f) return;
    setFile(f);
    if (!replace) setName(f.name.replace(/\.[^.]+$/, ""));
  };
  const save = () => {
    store.uploadDocument(c.id, { name: name.trim(), service, category: replace?.category ?? "Staff upload", sensitive, sizeKb: Math.max(1, Math.round((file?.size ?? 0) / 1024)), replaces: replace?.id });
    toast(`Uploaded "${name.trim()}"`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={replace ? `Upload: ${replace.name}` : "Upload document"} description="Preview mode — the file stays in your browser and is not stored anywhere." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!file || !name.trim()} onClick={save}>Upload</Button></>}>
      <div className="space-y-4">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files[0]); }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${drag ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-surface-hover"}`}
        >
          <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx,.csv" onChange={(e) => take(e.target.files?.[0])} />
          {file ? (
            <>
              <FileText size={28} className="text-accent" />
              <span className="mt-2 text-[14px] font-medium text-ink">{file.name}</span>
              <span className="text-[12px] text-muted">{fileSize(Math.round(file.size / 1024))} · click to choose another</span>
            </>
          ) : (
            <>
              <UploadCloud size={28} className="text-muted" />
              <span className="mt-2 text-[14px] font-medium text-ink">Drop a file or click to browse</span>
              <span className="text-[12px] text-muted">PDF, images, Word or Excel</span>
            </>
          )}
        </label>
        {!replace && (
          <>
            <TextField label="Document name" required value={name} onChange={(e) => setName(e.target.value)} />
            <SelectField label="Service" value={service} onChange={(e) => setService(e.target.value as ServiceKey)} options={svcOptions(svcs)} />
            <Checkbox label="Mark as restricted" hint="Only staff with sensitive-document access can open it." checked={sensitive} onChange={() => setSensitive((v) => !v)} />
          </>
        )}
      </div>
    </Modal>
  );
}

export function DocPreviewDialog({ client: c, doc, onClose }: { client: Client; doc: ClientDocument | null; onClose: () => void }) {
  return (
    <Modal open={!!doc} onClose={onClose} title={doc?.name ?? ""} description={doc ? `${c.name} · ${SERVICES[doc.service].label} · ${doc.category}` : ""} size="lg" footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" onClick={() => doc && downloadPlaceholder(doc.name)}>Download</Button></>}>
      <div className="grid aspect-[8.5/11] max-h-[60vh] w-full place-items-center rounded-xl border border-line bg-surface-2">
        <div className="px-6 text-center">
          <FileText size={36} className="mx-auto text-faint" />
          <p className="mt-2 text-[14px] font-medium text-ink-2">Sample document preview</p>
          <p className="mt-1 text-[12.5px] text-muted">Real files open here in Phase 3 through short-lived, private links. This view is recorded in the audit log.</p>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function ScheduleDialog({ client: c, open, onClose }: DialogProps) {
  const store = useClients();
  const toast = useToast();
  const svcs = clientServices(c);
  const [service, setService] = useState<ServiceKey>(svcs[0] ?? "tax");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(isoDate(2));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [mode, setMode] = useState<"Video" | "Phone" | "In person">("Video");
  const [staffId, setStaffId] = useState(c.staffIds[0]);
  useEffect(() => {
    if (open) {
      setService(svcs[0] ?? "tax");
      setTitle(`${SERVICES[svcs[0] ?? "tax"].label} check-in`);
      setDate(isoDate(2));
      setStaffId(c.staffIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = () => {
    const at = new Date(`${date}T${time}`).toISOString();
    store.schedule(c.id, { title: title.trim(), service, at, durationMin: Number(duration), mode, staffId });
    toast(`Scheduled for ${fmtDate(at, { weekday: "short", month: "short", day: "numeric" })} at ${time} — confirmation sent to client`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Schedule appointment" description={c.name} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!title.trim() || !date} onClick={save}>Schedule</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <SelectField label="Service" value={service} onChange={(e) => setService(e.target.value as ServiceKey)} options={svcOptions(svcs)} />
        <SelectField label="With" value={staffId} onChange={(e) => setStaffId(e.target.value)} options={STAFF.map((s) => [s.id, s.name])} />
        <TextField label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} step={900} />
        <SelectField label="Duration" value={duration} onChange={(e) => setDuration(e.target.value)} options={[["15", "15 min"], ["30", "30 min"], ["45", "45 min"], ["60", "1 hour"], ["90", "1.5 hours"]]} />
        <SelectField label="Meeting type" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} options={[["Video", "Video"], ["Phone", "Phone"], ["In person", "In person"]]} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function InvoiceDialog({ client: c, open, onClose }: DialogProps) {
  const store = useClients();
  const toast = useToast();
  const svcs = clientServices(c);
  const [service, setService] = useState<ServiceKey>(svcs[0] ?? "tax");
  const [lines, setLines] = useState([{ desc: "", amount: "" }]);
  const [due, setDue] = useState(isoDate(14));
  useEffect(() => {
    if (open) {
      const s = svcs[0] ?? "tax";
      setService(s);
      setLines([{ desc: c.enrollments.find((e) => e.service === s)?.title ?? SERVICES[s].label, amount: "" }]);
      setDue(isoDate(14));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const valid = total > 0 && lines.every((l) => l.desc.trim() && Number(l.amount) > 0);
  const save = (draft: boolean) => {
    const num = store.createInvoice(c.id, { service, description: lines.map((l) => l.desc.trim()).join("; "), amount: total, dueAt: new Date(due + "T17:00").toISOString(), draft });
    toast(draft ? `Saved ${num} as a draft` : `${num} sent — client can pay it in the portal`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="New invoice" description={c.name} size="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => save(true)}>Save draft</Button><Button variant="primary" disabled={!valid} onClick={() => save(false)}>Send invoice</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Service" value={service} onChange={(e) => setService(e.target.value as ServiceKey)} options={svcOptions(svcs)} />
          <TextField label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div>
          <Label>Line items</Label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Line ${i + 1} description`} value={l.desc} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, desc: e.target.value } : y)))} placeholder="Description" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink focus:border-accent focus:outline-none" />
                <input aria-label={`Line ${i + 1} amount`} value={l.amount} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} type="number" min={0} placeholder="0.00" className="h-10 w-28 rounded-xl border border-line bg-surface px-3 text-right text-[14px] text-ink tabular-nums focus:border-accent focus:outline-none" />
                {lines.length > 1 && <Button variant="ghost" aria-label={`Remove line ${i + 1}`} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}>×</Button>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setLines((x) => [...x, { desc: "", amount: "" }])} className="mt-2 text-[13px] font-semibold text-accent">
            + Add line
          </button>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 ring-1 ring-line">
          <span className="text-[13.5px] text-muted">Total</span>
          <span className="text-[18px] font-bold text-ink tabular-nums">{usd(total, 2)}</span>
        </div>
      </div>
    </Modal>
  );
}

export function PaymentDialog({ client: c, open, onClose, invoiceId }: DialogProps & { invoiceId?: string }) {
  const store = useClients();
  const toast = useToast();
  const unpaid = c.invoices.filter((i) => i.status === "open" || i.status === "overdue" || i.status === "partial");
  const [inv, setInv] = useState(invoiceId ?? unpaid[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Card");
  const sel = c.invoices.find((i) => i.id === inv);
  useEffect(() => {
    if (open) {
      const id = invoiceId ?? unpaid[0]?.id ?? "";
      setInv(id);
      const i = c.invoices.find((x) => x.id === id);
      setAmount(i ? String(i.amount - i.paid) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);
  const max = sel ? sel.amount - sel.paid : 0;
  const valid = sel && Number(amount) > 0 && Number(amount) <= max;
  const save = () => {
    store.recordPayment(c.id, inv, Number(amount), method.toLowerCase());
    toast(`Recorded ${usd(Number(amount), 2)} on ${sel!.number}`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Record payment" description="For payments taken outside the portal (cash, check, card in person)." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>Record payment</Button></>}>
      {unpaid.length === 0 ? (
        <p className="text-[14px] text-muted">This client has no unpaid invoices.</p>
      ) : (
        <div className="space-y-4">
          <SelectField label="Invoice" value={inv} onChange={(e) => { setInv(e.target.value); const i = c.invoices.find((x) => x.id === e.target.value); setAmount(i ? String(i.amount - i.paid) : ""); }} options={unpaid.map((i) => [i.id, `${i.number} — ${usd(i.amount - i.paid)} due`])} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Amount ($)" type="number" min={0} max={max} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`Max ${usd(max, 2)}`} />
            <SelectField label="Method" value={method} onChange={(e) => setMethod(e.target.value)} options={["Card", "Cash", "Check", "ACH", "Other"].map((v) => [v, v])} />
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

const SIGN_PRESETS: Record<ServiceKey, string[]> = {
  tax: ["Engagement letter — tax preparation", "Form 8879 (e-file authorization)", "Form 8821 (tax information authorization)"],
  books: ["Bookkeeping services agreement", "Bank access authorization"],
  biz: ["Engagement letter — business services", "Registered agent consent", "Operating agreement"],
  expunge: ["Engagement letter — record expungement", "Records release authorization", "Petition review sign-off"],
};

export function SignatureDialog({ client: c, open, onClose }: DialogProps) {
  const store = useClients();
  const toast = useToast();
  const svcs = clientServices(c);
  const [service, setService] = useState<ServiceKey>(svcs[0] ?? "tax");
  const [doc, setDoc] = useState(SIGN_PRESETS[svcs[0] ?? "tax"][0]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (open) {
      const s = svcs[0] ?? "tax";
      setService(s);
      setDoc(SIGN_PRESETS[s][0]);
      setMessage("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = () => {
    store.requestSignature(c.id, { document: doc, service });
    toast(`"${doc}" sent to ${c.contactName ?? c.name} for signature`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Send for signature" description="The client signs in their portal." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Send</Button></>}>
      <div className="space-y-4">
        <SelectField label="Service" value={service} onChange={(e) => { const s = e.target.value as ServiceKey; setService(s); setDoc(SIGN_PRESETS[s][0]); }} options={svcOptions(svcs)} />
        <SelectField label="Document" value={doc} onChange={(e) => setDoc(e.target.value)} options={SIGN_PRESETS[service].map((d) => [d, d])} />
        <TextArea label="Message to client (optional)" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please review and sign at your convenience." />
      </div>
    </Modal>
  );
}

export { nowIso };
