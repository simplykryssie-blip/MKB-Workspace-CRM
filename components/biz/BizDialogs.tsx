"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Plus, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Label, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { EmailInput, PhoneInput } from "@/components/ui/FormattedInputs";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { STAFF, SAMPLE_NOW, staffById, meId, staffList } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { checklistFor, entityStates, requestDocs, requestInvoices, useBiz, type NewRequestInput } from "@/lib/store/biz-store";
import {
  AGENCY_KIND,
  AGENT_TYPE,
  CATEGORIES,
  COMPLIANCE_KIND,
  DOC_CATEGORIES,
  EIN_STATUS,
  ENTITY_TYPES,
  FREQUENCY,
  REG_KIND,
  dueLabel,
  ruleVerified,
  stateName,
  stateOptions,
  LINE_KIND,
  NATURE,
  REQUEST_STATUSES,
  type AgencyEvent,
  type BizEntity,
  type CatalogService,
  type ComplianceItem,
  type ComplianceKind,
  type ComplianceRule,
  type DocCategory,
  type EntityType,
  type Frequency,
  type InfoRequest,
  type QuoteLine,
  type RequestStatus,
  type ServiceNature,
  type ServiceRequest,
  type Standing,
  type StateChecklist,
  type StateRegistration,
} from "@/lib/biz/config";
import { fileSize, fmtDate, usd } from "@/lib/format";
import { validateEmail, validatePhone } from "@/lib/validation";
import { FeeBreakdown, NotLegalAdvice } from "./BizBits";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const today = () => SAMPLE_NOW.toISOString().slice(0, 10);
const toIso = (date: string, h = 17) => new Date(`${date}T${String(h).padStart(2, "0")}:00`).toISOString();
/** Read at render time, so it lists the real team once it has loaded. */
const staffOptsNow = () => staffList().map((s) => [s.id, s.name] as [string, string]);
const toFiles = (fs: File[]) => fs.map((f) => ({ name: f.name.replace(/\.[^.]+$/, ""), sizeKb: Math.max(1, Math.round(f.size / 1024)) }));

/** File picker that keeps files in the browser only. */
export function FilePicker({ files, setFiles, label = "Attach files", multiple = true, required = false }: { files: File[]; setFiles: (f: File[]) => void; label?: string; multiple?: boolean; required?: boolean }) {
  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong px-4 py-5 text-center hover:bg-surface-hover">
        <input type="file" multiple={multiple} className="sr-only" aria-label={label} onChange={(e) => { const add = Array.from(e.target.files ?? []); setFiles(multiple ? [...files, ...add] : add.slice(0, 1)); e.target.value = ""; }} />
        <UploadCloud size={22} className="text-muted" />
        <span className="mt-1 text-[13.5px] font-medium text-ink">{label}{required && <span className="text-danger"> *</span>}</span>
        <span className="text-[12px] text-muted">Preview mode — files stay in your browser and are not stored or sent anywhere.</span>
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px] text-ink-2">
              <FileText size={14} className="text-accent" /> <span className="flex-1 truncate">{f.name}</span> <span className="text-muted">{fileSize(Math.max(1, Math.round(f.size / 1024)))}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted hover:text-danger"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const Err = ({ show, msg }: { show: boolean; msg?: string | null }) => <p className="mt-1 min-h-4 text-[12px] leading-4 text-danger-ink" role={show && msg ? "alert" : undefined}>{show && msg ? msg : ""}</p>;

/* ================================================================== */
/* Service request intake                                              */
/* ================================================================== */

export function NewRequestDialog({ open, onClose, onCreated, preset }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void; preset?: { clientId?: string; entityId?: string; serviceId?: string } }) {
  const biz = useBiz();
  const { clients } = useClients();
  const toast = useToast();
  const active = biz.catalog.filter((s) => s.active);
  const [who, setWho] = useState<"client" | "prospect">("client");
  const [clientId, setClientId] = useState("");
  const [prospect, setProspect] = useState({ name: "", email: "", phone: "" });
  const [entityId, setEntityId] = useState("new");
  const [businessName, setBusinessName] = useState("");
  const [structure, setStructure] = useState<EntityType>("LLC");
  const [state, setState] = useState("GA");
  const [serviceId, setServiceId] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [assignedTo, setAssignedTo] = useState(meId());
  const [price, setPrice] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWho("client");
    setClientId(preset?.clientId ?? "");
    setProspect({ name: "", email: "", phone: "" });
    setEntityId(preset?.entityId ?? "new");
    setBusinessName("");
    setStructure("LLC");
    setState("GA");
    setServiceId(preset?.serviceId ?? "");
    setDescription("");
    setPreferredDate("");
    setAssignedTo(meId());
    setPrice("");
    setFiles([]);
    setNote("");
    setTried(false);
  }, [open, preset?.clientId, preset?.entityId, preset?.serviceId]);

  const ents = biz.entities.filter((e) => e.clientId === clientId);
  const ent = ents.find((e) => e.id === entityId);
  useEffect(() => {
    if (ent) {
      setBusinessName(ent.legalName);
      setStructure(ent.entityType);
      setState(ent.state);
    }
  }, [ent?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (clientId && !preset?.entityId) setEntityId(biz.entities.find((e) => e.clientId === clientId)?.id ?? "new");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps
  const svc = biz.catalog.find((s) => s.id === serviceId);
  useEffect(() => setPrice(svc ? String(svc.price) : ""), [serviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const errors = {
    client: who === "client" && !clientId ? "Choose the client" : null,
    pname: who === "prospect" && !prospect.name.trim() ? "Enter the prospect's name" : null,
    pemail: who === "prospect" ? validateEmail(prospect.email, true) : null,
    pphone: who === "prospect" ? validatePhone(prospect.phone, false) : null,
    business: !businessName.trim() ? (svc?.formation ? "Enter the proposed business name" : "Enter the business name") : null,
    service: !serviceId ? "Choose a service" : null,
    description: description.trim().length < 10 ? "Describe what the client needs (at least 10 characters)" : null,
    price: price === "" || isNaN(Number(price)) || Number(price) < 0 ? "Enter a quoted price of $0 or more" : null,
    date: preferredDate && preferredDate < today() ? "Preferred date can't be in the past" : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const submit = () => {
    setTried(true);
    if (!valid) return;
    const input: NewRequestInput = {
      clientId: who === "client" ? clientId : undefined,
      prospect: who === "prospect" ? { name: prospect.name.trim(), email: prospect.email.trim().toLowerCase(), phone: prospect.phone } : undefined,
      entityId: who === "client" && entityId !== "new" ? entityId : undefined,
      businessName,
      structure,
      state,
      serviceId,
      description,
      preferredDate: preferredDate ? toIso(preferredDate) : undefined,
      assignedTo,
      files: toFiles(files),
      note,
      quotedPrice: Number(price),
      source: "staff",
    };
    const id = biz.createRequest(input);
    toast(`${id} created`);
    onClose();
    onCreated?.(id);
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="New service request" description="Capture what the client needs. A quote, information requests and work assignment follow from the request." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Create request</Button></>}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Requested by" className="inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-line">
          {(["client", "prospect"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={who === k} onClick={() => setWho(k)} className={`h-8 rounded-lg px-3 text-[13px] font-medium ${who === k ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>{k === "client" ? "Existing MKB client" : "New prospect"}</button>
          ))}
        </div>
        {who === "client" ? (
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div>
              <SelectField id="nr-client" label="Client" required value={clientId} onChange={(e) => setClientId(e.target.value)} options={[["", "Choose a client…"], ...clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.name] as [string, string])]} />
              <Err show={tried} msg={errors.client} />
            </div>
            <div>
              <SelectField id="nr-entity" label="Business" value={entityId} onChange={(e) => setEntityId(e.target.value)} disabled={!clientId} options={[...ents.map((e) => [e.id, e.legalName] as [string, string]), ["new", ents.length ? "Another business…" : "New business…"]]} />
              <p className="mt-1 text-[12px] text-muted">{clientId ? `${ents.length} business${ents.length === 1 ? "" : "es"} on file for this client` : "Choose a client first"}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-x-4 sm:grid-cols-3">
            <div>
              <TextField id="nr-pname" label="Prospect name" required value={prospect.name} onChange={(e) => setProspect({ ...prospect, name: e.target.value })} />
              <Err show={tried} msg={errors.pname} />
            </div>
            <EmailInput id="nr-pemail" label="Email" required value={prospect.email} onChange={(v) => setProspect({ ...prospect, email: v })} showErrors={tried} />
            <PhoneInput id="nr-pphone" label="Phone" value={prospect.phone} onChange={(v) => setProspect({ ...prospect, phone: v })} showErrors={tried} />
            <p className="-mt-2 text-[12px] text-muted sm:col-span-3">Prospects are linked to a client record (existing or new) before any work starts — no duplicate records.</p>
          </div>
        )}
        <div>
          <SelectField id="nr-service" label="Requested service" required value={serviceId} onChange={(e) => setServiceId(e.target.value)} options={[["", "Choose a service…"], ...active.map((s) => [s.id, `${s.category} — ${s.name}`] as [string, string])]} />
          {svc ? <p className="mt-1 text-[12px] text-muted">{NATURE[svc.nature].label} · {svc.description}</p> : <Err show={tried} msg={errors.service} />}
        </div>
        <div className="grid gap-x-4 sm:grid-cols-[1.4fr_1fr_0.8fr]">
          <div>
            <TextField id="nr-biz" label={svc?.formation ? "Proposed business name" : "Business name"} required value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={!!ent} />
            <Err show={tried} msg={errors.business} />
          </div>
          <SelectField id="nr-structure" label="Business structure" value={structure} onChange={(e) => setStructure(e.target.value as EntityType)} disabled={!!ent} options={ENTITY_TYPES.map((t) => [t, t])} />
          <SelectField id="nr-state" label={svc?.formation ? "State of formation" : "State for this service"} value={state} onChange={(e) => setState(e.target.value)} options={stateOptions()} />
        </div>
        <div>
          <TextArea id="nr-desc" label="What the client needs" required value={description} onChange={(e) => setDescription(e.target.value)} />
          <Err show={tried} msg={errors.description} />
        </div>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <div>
            <TextField id="nr-date" label="Preferred completion" type="date" min={today()} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
            <Err show={tried} msg={errors.date} />
          </div>
          <SelectField id="nr-staff" label="Assigned staff" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} options={staffOptsNow()} />
          <div>
            <TextField id="nr-price" label="Quoted MKB fee ($)" type="number" min={0} step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} hint={svc?.filingFeeEstimate ? `+ ${usd(svc.filingFeeEstimate)} filing est.` : undefined} />
            <Err show={tried} msg={errors.price} />
          </div>
        </div>
        <FilePicker files={files} setFiles={setFiles} label="Supporting documents (optional)" />
        <TextArea id="nr-note" label="Internal note (MKB only)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Never shown to the client" />
        <p className="text-[12px] text-muted">Payment status starts as "Not quoted". The quote is reviewed and sent from the request.</p>
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Quote                                                               */
/* ================================================================== */

export function QuoteDialog({ r, open, onClose }: { r: ServiceRequest; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  // Mounted fresh each time it opens (see RequestWorkspace), so the starting lines never overwrite edits.
  const [lines, setLines] = useState<QuoteLine[]>(() => (r.quote.lines.length ? r.quote.lines.map((l) => ({ ...l })) : [{ id: uid("q"), kind: "service", label: r.serviceName, amount: 0 }]));
  const [note, setNote] = useState(r.quote.note ?? "");
  const valid = lines.length > 0 && lines.every((l) => l.label.trim() && !isNaN(l.amount) && l.amount >= 0);
  const locked = r.quote.status === "accepted";
  const save = (send: boolean) => {
    const clean = lines.map((l) => ({ ...l, label: l.label.trim() }));
    if (send) biz.sendQuote(r.id, clean, note.trim() || undefined);
    else biz.saveQuote(r.id, clean, note.trim() || undefined);
    toast(send ? "Quote sent to the client" : "Quote saved");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Quote" description={`${r.number} · ${r.serviceName} — MKB fees and pass-through government or third-party fees are listed separately.`} footer={<><Button onClick={onClose}>Cancel</Button>{!locked && <Button disabled={!valid} onClick={() => save(false)}>Save draft</Button>}<Button variant="primary" disabled={!valid || locked || !r.clientId} title={!r.clientId ? "Link the prospect to a client first" : undefined} onClick={() => save(true)}>{r.quote.status === "sent" ? "Resend quote" : "Send to client"}</Button></>}>
      {locked ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-success-soft px-3 py-2 text-[13px] text-success-ink">Accepted — invoiced. Add later fees from Billing as an additional charge.</p>
          <FeeBreakdown lines={r.quote.lines} />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={l.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line p-2.5 sm:grid-cols-[170px_1fr_110px_auto] sm:items-center">
                <select aria-label={`Line ${i + 1} type`} value={l.kind} onChange={(e) => setLines(lines.map((x) => (x.id === l.id ? { ...x, kind: e.target.value as QuoteLine["kind"] } : x)))} className="col-span-2 h-9 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink sm:col-span-1">
                  {Object.entries(LINE_KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input aria-label={`Line ${i + 1} description`} value={l.label} onChange={(e) => setLines(lines.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} placeholder="Description" className="col-span-2 h-9 rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink sm:col-span-1" />
                <input aria-label={`Line ${i + 1} amount`} type="number" min={0} step="0.01" value={Number.isNaN(l.amount) ? "" : l.amount} onChange={(e) => setLines(lines.map((x) => (x.id === l.id ? { ...x, amount: e.target.value === "" ? NaN : Number(e.target.value) } : x)))} className="h-9 rounded-lg border border-line bg-surface px-2.5 text-right text-[13.5px] tabular-nums text-ink" />
                <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setLines(lines.filter((x) => x.id !== l.id))} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {(["service", "additional", "filing", "third_party", "discount"] as const).map((k) => (
              <Button key={k} size="sm" variant="ghost" icon={Plus} onClick={() => setLines([...lines, { id: uid("q"), kind: k, label: k === "filing" ? `${stateName(r.state)} filing fee` : k === "discount" ? "Discount" : "", amount: k === "filing" ? NaN : 0 }])}>{k === "filing" ? `${r.state} filing fee` : LINE_KIND[k].label}</Button>
            ))}
          </div>
          {valid && <div className="rounded-xl bg-surface-2 p-3.5 ring-1 ring-line"><FeeBreakdown lines={lines} /></div>}
          {!valid && <p className="text-[12.5px] text-danger-ink">Every line needs a description and an amount of $0 or more.</p>}
          <p className="text-[12px] text-muted">State filing fees are never pre-filled — enter the fee confirmed with the {stateName(r.state)} agency. Government and third-party fees are passed through at cost and shown separately from MKB's fees.</p>
          <TextArea id="q-note" label="Note to client (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Filing fee is set by the state and may change." />
        </div>
      )}
    </Modal>
  );
}

/* ================================================================== */
/* Client information                                                  */
/* ================================================================== */

export function InfoRequestDialog({ r, open, onClose }: { r: ServiceRequest; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const already = new Set(r.info.map((i) => i.label));
  const cl = checklistFor(r, biz.catalog, biz.checklists);
  const stateItems = cl.state.filter((x) => !already.has(x.item));
  const suggestions = [...cl.service, ...stateItems.map((x) => x.item)].filter((n, i, arr) => !already.has(n) && arr.indexOf(n) === i);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState<{ label: string; detail: string; file: boolean }[]>([]);
  const [move, setMove] = useState(true);
  useEffect(() => {
    if (open) {
      setPicked(suggestions);
      setCustom([]);
      setMove(r.status === "Intake" || r.status === "Ready for Processing" || r.status === "In Progress");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = [...picked.map((label) => ({ label, file: /questionnaire|document|form|license|permit|statement|notice/i.test(label) })), ...custom.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), detail: c.detail.trim() || undefined, file: c.file }))];
  return (
    <Modal open={open} onClose={onClose} title="Request information from the client" description="Each item appears in the client's portal under “What we need from you”." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!items.length || !r.clientId} onClick={() => { biz.requestInfo(r.id, items, move); toast(`${items.length} request(s) sent to the client`); onClose(); }}>Send {items.length || ""} request{items.length === 1 ? "" : "s"}</Button></>}>
      <div className="space-y-3">
        {suggestions.length > 0 && <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">From the service and {stateName(r.state)} checklists</p>}
        {suggestions.map((n) => { const st = stateItems.find((x) => x.item === n); return <Checkbox key={n} label={n} hint={st ? `${stateName(r.state)} checklist${st.verified ? "" : " · not verified"}` : undefined} checked={picked.includes(n)} onChange={() => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))} />; })}
        {custom.map((c, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line p-3">
            <TextField id={`ir-label-${i}`} label="What you need" value={c.label} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <TextField id={`ir-detail-${i}`} label="Details for the client (optional)" value={c.detail} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} />
            <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={c.file} onChange={() => setCustom(custom.map((x, j) => (j === i ? { ...x, file: !x.file } : x)))} className="h-4 w-4 accent-[var(--accent)]" /> Needs a file upload</label>
          </div>
        ))}
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => setCustom([...custom, { label: "", detail: "", file: false }])}>Add a custom item</Button>
        <Checkbox label="Move the request to “Awaiting Client Information”" hint="Turn off for small questions that shouldn't pause the work." checked={move} onChange={() => setMove((v) => !v)} />
      </div>
    </Modal>
  );
}

export function RespondDialog({ r, item, by, onClose }: { r: ServiceRequest; item: InfoRequest | null; by: "client" | "staff"; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const [response, setResponse] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => {
    setResponse("");
    setFiles([]);
  }, [item?.id]);
  if (!item) return null;
  const valid = item.file ? files.length > 0 : response.trim().length > 0;
  return (
    <Modal open={!!item} onClose={onClose} title={item.label} description={by === "client" ? "Send this to MKB" : "Record the client's response (e.g. received by phone or email)"} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { biz.respondInfo(r.id, item.id, { response: response.trim() || undefined, files: toFiles(files), by }); toast(by === "client" ? "Sent to MKB" : "Response recorded"); onClose(); }}>{by === "client" ? "Send to MKB" : "Record response"}</Button></>}>
      <div className="space-y-4">
        {item.detail && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] text-ink-2 ring-1 ring-line">{item.detail}</p>}
        <TextArea id="rs-answer" label={item.file ? "Note (optional)" : "Your answer"} required={!item.file} value={response} onChange={(e) => setResponse(e.target.value)} />
        <FilePicker files={files} setFiles={setFiles} label={item.file ? "Attach the file(s)" : "Attach files (optional)"} required={item.file} />
      </div>
    </Modal>
  );
}

export function AskAgainDialog({ r, item, onClose }: { r: ServiceRequest; item: InfoRequest | null; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [item?.id]);
  if (!item) return null;
  return (
    <Modal open={!!item} onClose={onClose} title="Ask the client again" description={item.label} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!note.trim()} onClick={() => { biz.askAgain(r.id, item.id, note.trim()); toast("Sent back to the client"); onClose(); }}>Send</Button></>}>
      <TextArea id="aa-note" label="What's still needed" required value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}

/* ================================================================== */
/* Agency log                                                          */
/* ================================================================== */

export function AgencyDialog({ r, open, onClose, initialKind }: { r: ServiceRequest; open: boolean; onClose: () => void; initialKind?: AgencyEvent["kind"] }) {
  const biz = useBiz();
  const { clients } = useClients();
  const toast = useToast();
  const c = clients.find((x) => x.id === r.clientId);
  const prior = r.agency[r.agency.length - 1];
  const [kind, setKind] = useState<AgencyEvent["kind"]>("submitted");
  const [agency, setAgency] = useState("");
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState("");
  const [by, setBy] = useState(r.assignedTo);
  const [attest, setAttest] = useState(false);
  useEffect(() => {
    if (!open) return;
    setKind(initialKind ?? (r.agency.some((a) => a.kind === "submitted") ? "follow_up" : "submitted"));
    setAgency(prior?.agency ?? "");
    setDate(today());
    setReference(prior?.reference ?? "");
    setNote("");
    setVerified(false);
    setFiles([]);
    setExisting("");
    setBy(r.assignedTo);
    setAttest(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const docs = requestDocs(r, c).filter((d) => d.status !== "requested");
  const isApproval = kind === "approved";
  const errs = [
    !agency.trim() && "Enter the agency",
    date > today() && "Date can't be in the future",
    kind === "submitted" && !attest && "Confirm MKB submitted it",
    isApproval && !reference.trim() && "Enter the confirmation or filing number",
    isApproval && !verified && "Confirm you verified the approval with the agency",
    isApproval && !files.length && !existing && "Attach the confirmation",
    (kind === "rejected" || kind === "info_requested") && !note.trim() && "Describe what the agency said",
  ].filter(Boolean) as string[];
  const save = () => {
    biz.recordAgency(r.id, { agency: agency.trim(), kind, at: toIso(date, 12), byId: by, reference: reference.trim() || undefined, note: note.trim() || undefined, verified: isApproval ? verified : undefined, confirmationFile: toFiles(files)[0], confirmationDocId: existing || undefined });
    toast(kind === "approved" ? "Approval recorded — Approved" : kind === "submitted" ? "Submission recorded — Submitted to Agency" : "Agency update recorded");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Record agency activity" description="MKB files with agencies outside this app. Record what happened — this does not submit anything." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={errs.length > 0} onClick={save}>Record</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="ag-kind" label="What happened" value={kind} onChange={(e) => setKind(e.target.value as AgencyEvent["kind"])} options={Object.entries(AGENCY_KIND).map(([k, v]) => [k, v] as [string, string])} />
          <TextField id="ag-agency" label="Agency" required value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="e.g. Secretary of State, IRS, county clerk" />
          <TextField id="ag-date" label={kind === "approved" ? "Approval date" : kind === "submitted" ? "Submission date" : "Date"} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectField id="ag-by" label="Recorded by" value={by} onChange={(e) => setBy(e.target.value)} options={staffOptsNow()} />
        </div>
        <TextField id="ag-ref" label={isApproval ? "Confirmation / filing number" : "Reference or submission number (optional)"} required={isApproval} value={reference} onChange={(e) => setReference(e.target.value)} />
        <TextArea id="ag-note" label="Notes" required={kind === "rejected" || kind === "info_requested"} value={note} onChange={(e) => setNote(e.target.value)} />
        {kind === "submitted" && <Checkbox label="MKB submitted this filing to the agency" hint="Recorded after the fact — the app never files on its own." checked={attest} onChange={() => setAttest((v) => !v)} />}
        {isApproval && (
          <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft/40 p-3.5">
            <p className="flex items-start gap-2 text-[13px] text-warning-ink"><ShieldCheck size={16} className="mt-0.5 shrink-0" /> An approval is only recorded with a confirmation you verified directly with the agency (portal lookup, stamped copy or official letter).</p>
            <Checkbox label="I verified this approval with the agency" checked={verified} onChange={() => setVerified((v) => !v)} />
            {docs.length > 0 && <SelectField id="ag-existing" label="Confirmation already on file" value={existing} onChange={(e) => { setExisting(e.target.value); if (e.target.value) setFiles([]); }} options={[["", "— Upload a new file instead —"], ...docs.map((d) => [d.id, d.name] as [string, string])]} />}
            {!existing && <FilePicker files={files} setFiles={setFiles} label="Attach the confirmation" multiple={false} required />}
          </div>
        )}
        {errs.length > 0 && <p className="text-[12.5px] text-muted">To record: {errs.join(" · ")}.</p>}
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Status: hold / cancel / reopen / override                           */
/* ================================================================== */

export function ReasonDialog({ r, mode, onClose }: { r: ServiceRequest; mode: "hold" | "cancel" | "reopen" | "override" | null; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [to, setTo] = useState<RequestStatus>("In Progress");
  useEffect(() => {
    setReason("");
    setTo(r.status === "Intake" ? "Ready for Processing" : "In Progress");
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mode) return null;
  const meta = {
    hold: { title: "Put on hold", label: "Why is it on hold?", btn: "Put on hold" },
    cancel: { title: "Cancel request", label: "Reason for cancelling", btn: "Cancel request" },
    reopen: { title: "Reopen request", label: "Why is it being reopened?", btn: "Reopen" },
    override: { title: "Change status (override)", label: "Reason", btn: "Change status" },
  }[mode];
  const run = () => {
    const x = reason.trim();
    if (mode === "hold") biz.hold(r.id, x);
    if (mode === "cancel") biz.cancel(r.id, x);
    if (mode === "reopen") biz.reopen(r.id, x);
    if (mode === "override") biz.override(r.id, to, x);
    toast(mode === "hold" ? "On hold" : mode === "cancel" ? "Request cancelled" : mode === "reopen" ? "Reopened — In Progress" : `Status: ${to}`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={meta.title} description={`${r.number} · ${r.serviceName}`} footer={<><Button onClick={onClose}>Back</Button><Button variant="primary" disabled={!reason.trim()} onClick={run}>{meta.btn}</Button></>}>
      <div className="space-y-4">
        {mode === "override" && (
          <>
            <SelectField id="ov-to" label="New status" value={to} onChange={(e) => setTo(e.target.value as RequestStatus)} options={REQUEST_STATUSES.filter((s) => s !== r.status && s !== "Approved" && s !== "Completed").map((s) => [s, s])} />
            <p className="text-[12px] text-muted">“Approved” needs a verified agency confirmation and “Completed” needs completion approval, so they can't be set here.</p>
          </>
        )}
        {mode === "cancel" && requestInvoicesNote}
        <TextArea id="rs-reason" label={meta.label} required value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}
const requestInvoicesNote = <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">Cancelling doesn't change invoices. Record any refund or credit from the Billing tab.</p>;

export function CompletionDialog({ r, open, onClose }: { r: ServiceRequest; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const { clients } = useClients();
  const toast = useToast();
  const c = clients.find((x) => x.id === r.clientId);
  const due = requestInvoices(r, c).reduce((s, i) => s + (i.status === "draft" ? 0 : i.amount - i.paid), 0);
  const checks = ["Every deliverable was reviewed and delivered to the client", "Agency confirmations (if any) were verified and are on file", "The client was told the work is complete"];
  const [ok, setOk] = useState(checks.map(() => false));
  const [by, setBy] = useState(r.reviewerId);
  const [follow, setFollow] = useState("30");
  useEffect(() => {
    if (open) {
      setOk(checks.map(() => false));
      setBy(r.reviewerId);
      setFollow("30");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Approve completion" description={`${r.number} · ${r.serviceName}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={ShieldCheck} disabled={!ok.every(Boolean)} onClick={() => { biz.approveCompletion(r.id, by, Number(follow)); toast(`Completed — approved by ${staffById(by).name}`); onClose(); }}>Approve completion</Button></>}>
      <div className="space-y-3">
        <SelectField id="cp-by" label="Approver" value={by} onChange={(e) => setBy(e.target.value)} options={staffOptsNow()} />
        {by === r.assignedTo && <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">The approver also did the work — a second reviewer is recommended.</p>}
        {due > 0 && <p className="flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink"><AlertTriangle size={14} /> {usd(due, 2)} is still unpaid on this request.</p>}
        {checks.map((t, i) => <Checkbox key={t} label={t} checked={ok[i]} onChange={() => setOk(ok.map((v, j) => (j === i ? !v : v)))} />)}
        <SelectField id="cp-follow" label="Follow up with the client" value={follow} onChange={(e) => setFollow(e.target.value)} options={[["0", "No follow-up"], ["14", "In 2 weeks"], ["30", "In 30 days"], ["90", "In 90 days"], ["365", "In a year (renewal)"]]} />
      </div>
    </Modal>
  );
}

export function ConsultDialog({ r, open, onClose }: { r: ServiceRequest; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const scheduled = r.consultation?.status === "scheduled";
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [mode, setMode] = useState<"In person" | "Video" | "Phone">("Video");
  const [summary, setSummary] = useState("");
  useEffect(() => {
    if (open) {
      setDate("");
      setSummary("");
    }
  }, [open]);
  return scheduled ? (
    <Modal open={open} onClose={onClose} title="Consultation notes" description="Mark the consultation as held" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { biz.completeConsult(r.id, summary.trim()); toast("Consultation completed"); onClose(); }}>Mark held</Button></>}>
      <TextArea id="cs-sum" label="Summary (internal)" value={summary} onChange={(e) => setSummary(e.target.value)} />
    </Modal>
  ) : (
    <Modal open={open} onClose={onClose} title="Schedule consultation" description="Adds an appointment to the client's record" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!date || date < today() || !r.clientId} onClick={() => { biz.scheduleConsult(r.id, new Date(`${date}T${time}`).toISOString(), mode); toast("Consultation scheduled"); onClose(); }}>Schedule</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField id="cs-date" label="Date" type="date" min={today()} required value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField id="cs-time" label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <SelectField id="cs-mode" label="Format" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} options={["Video", "Phone", "In person"].map((v) => [v, v])} />
      </div>
    </Modal>
  );
}

export function DeliverableDialog({ r, delId, onClose }: { r: ServiceRequest; delId: string | null; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const d = r.deliverables.find((x) => x.id === delId);
  const [files, setFiles] = useState<File[]>([]);
  const [exp, setExp] = useState("");
  useEffect(() => {
    setFiles([]);
    setExp("");
  }, [delId]);
  if (!d) return null;
  const expires = d.category === "Business license";
  return (
    <Modal open onClose={onClose} title="Upload deliverable" description={d.name} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!files.length} onClick={() => { biz.uploadDeliverable(r.id, d.id, toFiles(files)[0], exp ? toIso(exp) : undefined); toast("Ready for review"); onClose(); }}>Upload for review</Button></>}>
      <div className="space-y-4">
        <FilePicker files={files} setFiles={setFiles} label="Choose the file" multiple={false} required />
        {expires && <TextField id="dl-exp" label="Expiration date" type="date" value={exp} onChange={(e) => setExp(e.target.value)} />}
        <p className="text-[12px] text-muted">The reviewer ({staffById(r.reviewerId).name}) approves it before it can be delivered to the client.</p>
      </div>
    </Modal>
  );
}

export function ChargeDialog({ r, open, onClose }: { r: ServiceRequest; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const [kind, setKind] = useState<QuoteLine["kind"]>("additional");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  useEffect(() => {
    if (open) {
      setKind("additional");
      setLabel("");
      setAmount("");
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Additional charge" description="Issued as a separate invoice on the client's record" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!label.trim() || !(Number(amount) > 0)} onClick={() => { biz.addCharge(r.id, { kind, label: label.trim(), amount: Number(amount) }); toast("Invoice sent"); onClose(); }}>Invoice charge</Button></>}>
      <div className="space-y-4">
        <SelectField id="ch-kind" label="Type" value={kind} onChange={(e) => setKind(e.target.value as QuoteLine["kind"])} options={(["additional", "filing", "third_party"] as const).map((k) => [k, LINE_KIND[k].label])} />
        <TextField id="ch-label" label="Description" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Expedited processing" />
        <TextField id="ch-amount" label="Amount ($)" type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
    </Modal>
  );
}

export function AdjustDialog({ r, open, onClose }: { r: ServiceRequest; open: boolean; onClose: () => void }) {
  const store = useClients();
  const toast = useToast();
  const c = store.clients.find((x) => x.id === r.clientId);
  const inv = requestInvoices(r, c).filter((i) => i.status !== "draft");
  const [id, setId] = useState("");
  const [kind, setKind] = useState<"refund" | "credit" | "correction">("refund");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setId(inv[0]?.id ?? "");
      setKind("refund");
      setAmount("");
      setNote("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = inv.find((i) => i.id === id);
  const n = Number(amount);
  const max = !sel ? 0 : kind === "refund" ? sel.paid : kind === "credit" ? sel.amount - sel.paid : Infinity;
  const valid = sel && n > 0 && n <= max && note.trim();
  return (
    <Modal open={open} onClose={onClose} title="Refund or adjustment" description="Kept in the invoice's adjustment history" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { store.adjustInvoice(c!.id, id, { kind, amount: n, note: note.trim(), byId: meId() }); toast("Adjustment recorded"); onClose(); }}>Record</Button></>}>
      {inv.length === 0 ? (
        <p className="text-[14px] text-muted">No invoices on this request yet.</p>
      ) : (
        <div className="space-y-4">
          <SelectField id="ad-inv" label="Invoice" value={id} onChange={(e) => setId(e.target.value)} options={inv.map((i) => [i.id, `${i.number} — ${usd(i.amount, 2)} (paid ${usd(i.paid, 2)})`])} />
          <SelectField id="ad-kind" label="Type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} options={[["refund", "Refund (money returned to the client)"], ["credit", "Credit (reduce what's owed)"], ["correction", "Correction (increase the total)"]]} />
          <TextField id="ad-amount" label="Amount ($)" type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} hint={max !== Infinity ? `Max ${usd(max, 2)}` : undefined} />
          <TextArea id="ad-note" label="Reason" required value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}

/* ================================================================== */
/* Compliance                                                          */
/* ================================================================== */

export function ReminderChips({ days, setDays }: { days: number[]; setDays: (d: number[]) => void }) {
  const [custom, setCustom] = useState("");
  const all = [...new Set([60, 30, 14, 7, ...days])].sort((a, b) => b - a);
  return (
    <div>
      <Label>Reminders (days before the deadline)</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {all.map((d) => (
          <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => b - a))} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${days.includes(d) ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{d} days</button>
        ))}
        <input aria-label="Custom reminder days" type="number" min={1} max={365} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Other" className="h-8 w-20 rounded-full border border-line bg-surface px-3 text-[12.5px] text-ink" />
        <Button size="sm" variant="ghost" disabled={!(Number(custom) >= 1 && Number(custom) <= 365)} onClick={() => { setDays([...new Set([...days, Math.round(Number(custom))])].sort((a, b) => b - a)); setCustom(""); }}>Add</Button>
      </div>
    </div>
  );
}

export function ComplianceItemDialog({ entity, item, open, onClose }: { entity: BizEntity; item?: ComplianceItem; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const states = entityStates(entity);
  const [mode, setMode] = useState<"rule" | "manual">("rule");
  const [state, setState] = useState(entity.state);
  const [ruleId, setRuleId] = useState("");
  const [v, setV] = useState({ kind: "annual_report" as ComplianceKind, title: "", description: "", agency: "", agencyUrl: "", due: "", fee: "", source: "", frequency: "annual" as Frequency, status: "upcoming" as ComplianceItem["status"], notes: "" });
  const [days, setDays] = useState<number[]>(biz.reminderDefaults);
  const [ownerId, setOwnerId] = useState(entity.ownerId);
  const domestic = state === entity.state;
  const rules = biz.rules.filter((r) => (r.state === state || r.state === "LOCAL") && (r.entityTypes === "any" || r.entityTypes.includes(entity.entityType)) && (r.appliesTo === "both" || r.appliesTo === (domestic ? "domestic" : "foreign")));
  useEffect(() => {
    if (!open) return;
    setMode(item ? "manual" : "rule");
    setState(item?.state === "LOCAL" ? entity.state : item?.state ?? entity.state);
    setRuleId("");
    setV({ kind: item?.kind ?? "annual_report", title: item?.title ?? "", description: item?.description ?? "", agency: item?.agency ?? "", agencyUrl: item?.agencyUrl ?? "", due: item ? item.dueAt.slice(0, 10) : "", fee: item?.filingFee != null ? String(item.filingFee) : "", source: item?.source ?? "", frequency: item?.frequency ?? "annual", status: item?.status ?? "upcoming", notes: item?.notes ?? "" });
    setDays(item?.reminderDays ?? biz.reminderDefaults);
    setOwnerId(item?.ownerId ?? entity.ownerId);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setRuleId(rules[0]?.id ?? ""), [state, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const rule = rules.find((r) => r.id === ruleId);
  const anniversaryBase = domestic ? entity.formationDate : entity.registrations.find((r) => r.state === state)?.effectiveAt;
  const ruleNeedsDate = rule && (rule.due === "manual" || (rule.due === "anniversary" && !anniversaryBase));
  const valid = mode === "rule" ? !!rule && (!ruleNeedsDate || !!v.due) : v.title.trim() && v.due && v.source.trim() && v.agency.trim() && (v.fee === "" || Number(v.fee) >= 0);
  const save = () => {
    if (mode === "rule" && !item) {
      const id = biz.applyRule(entity.id, ruleId, rule!.state === "LOCAL" ? state : state, v.due ? toIso(v.due) : undefined, ownerId);
      biz.updateItem(id, { reminderDays: days });
      toast(`${rule!.label} added`);
    } else {
      const patch = { state, kind: v.kind, title: v.title.trim(), description: v.description.trim() || undefined, agency: v.agency.trim(), agencyUrl: v.agencyUrl.trim() || undefined, dueAt: toIso(v.due), filingFee: v.fee === "" ? undefined : Number(v.fee), source: v.source.trim(), frequency: v.frequency, reminderDays: days, ownerId, notes: v.notes.trim() || undefined };
      if (item) {
        biz.updateItem(item.id, { ...patch, status: v.status });
        toast("Deadline updated");
      } else {
        biz.addItem({ ...patch, entityId: entity.id, status: "upcoming" });
        toast("Deadline added");
      }
    }
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={item ? "Edit deadline" : "Add a compliance deadline"} description={`${entity.legalName} · ${entity.entityType} · formed in ${stateName(entity.state)}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>{item ? "Save" : "Add deadline"}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="ci-state" label="State" value={state} onChange={(e) => setState(e.target.value)} options={states.map((s) => [s, `${stateName(s)}${s === entity.state ? " (formation state)" : " (registered)"}`] as [string, string])} />
          {!item && (
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Source</span>
              <div role="radiogroup" aria-label="Deadline source" className="inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-line">
                {(["rule", "manual"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`h-8 rounded-lg px-3 text-[13px] font-medium ${mode === k ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>{k === "rule" ? "From a state rule" : "Enter manually"}</button>)}
              </div>
            </div>
          )}
        </div>
        {mode === "rule" && !item ? (
          rules.length ? (
            <>
              <SelectField id="ci-rule" label="Requirement" value={ruleId} onChange={(e) => setRuleId(e.target.value)} options={rules.map((r) => [r.id, `${r.label}${r.state === "LOCAL" ? " (local / provider)" : ""}${ruleVerified(r) ? "" : " · not verified"}`] as [string, string])} />
              {rule && (
                <div className={`space-y-1 rounded-xl px-3 py-2.5 text-[12.5px] ${ruleVerified(rule) ? "bg-surface-2 text-ink-2 ring-1 ring-line" : "bg-warning-soft text-warning-ink"}`}>
                  <p>{rule.description}</p>
                  <p>Agency: {rule.agency} · {FREQUENCY[rule.frequency]} · due: {dueLabel(rule.due)} · fee: {rule.filingFee != null && ruleVerified(rule) ? usd(rule.filingFee, 2) : "not set"}</p>
                  <p>Source: {rule.source}{rule.lastVerifiedAt ? ` · verified ${fmtDate(rule.lastVerifiedAt)}` : " · NOT VERIFIED — confirm the requirement, date and fee before relying on it."}</p>
                </div>
              )}
              {ruleNeedsDate && <TextField id="ci-due" label="Due date" type="date" required value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} hint={rule?.due === "anniversary" ? "No formation/registration date on file" : "Set per business"} />}
            </>
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2 ring-1 ring-line">No requirement rules are configured for {stateName(state)} {entity.entityType}s ({domestic ? "domestic" : "foreign"}). Add one under State requirements, or enter this deadline manually.</p>
          )
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField id="ci-kind" label="Type" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as ComplianceKind })} options={Object.entries(COMPLIANCE_KIND).map(([k, x]) => [k, x] as [string, string])} />
              <TextField id="ci-title" label="Requirement" required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
              <TextField id="ci-agency" label="Filing agency" required value={v.agency} onChange={(e) => setV({ ...v, agency: e.target.value })} />
              <TextField id="ci-url" label="Official agency website" type="url" value={v.agencyUrl} onChange={(e) => setV({ ...v, agencyUrl: e.target.value })} placeholder="https://" />
              <TextField id="ci-due2" label="Due date" type="date" required value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} />
              <SelectField id="ci-freq" label="Renewal frequency" value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value as Frequency })} options={Object.entries(FREQUENCY).map(([k, x]) => [k, x] as [string, string])} />
              <TextField id="ci-fee" label="Filing fee ($)" type="number" min={0} step="0.01" value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} hint="leave blank if not confirmed" />
              {item && <SelectField id="ci-status" label="Status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as ComplianceItem["status"] })} options={[["upcoming", "Upcoming"], ["in_progress", "In progress"], ["filed", "Filed"], ["not_applicable", "Not applicable"]]} />}
            </div>
            <TextArea id="ci-desc" label="Requirement description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
            <TextField id="ci-source" label="Source" required value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} placeholder="Where this requirement and date come from" />
          </>
        )}
        <SelectField id="ci-owner" label="Responsible MKB staff" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} options={staffOptsNow()} />
        <ReminderChips days={days} setDays={setDays} />
        {(item || mode === "manual") && <TextArea id="ci-notes" label="Renewal notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />}
      </div>
    </Modal>
  );
}

/** Record that a deadline (or a rule) was checked against the official source. */
export function VerifyDialog({ title, current, onVerify, open, onClose }: { title: string; current?: string; onVerify: (by: string, source: string) => void; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [by, setBy] = useState(meId());
  const [source, setSource] = useState("");
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (open) {
      setSource(current ?? "");
      setOk(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Record verification" description={title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={ShieldCheck} disabled={!ok || !source.trim()} onClick={() => { onVerify(by, source.trim()); toast("Verification recorded"); onClose(); }}>Mark verified</Button></>}>
      <div className="space-y-4">
        <TextField id="vf-source" label="Official source checked" required value={source} onChange={(e) => setSource(e.target.value)} placeholder="Agency website page, notice or letter" />
        <SelectField id="vf-by" label="Verified by" value={by} onChange={(e) => setBy(e.target.value)} options={staffOptsNow()} />
        <Checkbox label="I confirmed the requirement, due date and fee against the official source" checked={ok} onChange={() => setOk((x) => !x)} />
      </div>
    </Modal>
  );
}

export function RegistrationDialog({ entity, reg, open, onClose }: { entity: BizEntity; reg?: StateRegistration; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const taken = new Set([entity.state, ...entity.registrations.filter((r) => r.id !== reg?.id).map((r) => r.state)]);
  const [v, setV] = useState<Omit<StateRegistration, "id">>({ state: "", kind: "foreign_qualification", status: "pending" });
  useEffect(() => {
    if (open) setV(reg ? { ...reg } : { state: "", kind: "foreign_qualification", status: "pending" });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = v.state && !taken.has(v.state) && (v.status !== "active" || !!v.effectiveAt);
  return (
    <Modal open={open} onClose={onClose} title={reg ? "Edit state registration" : "Add a state registration"} description={`${entity.legalName} — formed in ${stateName(entity.state)}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { const clean = { ...v, stateIdNumber: v.stateIdNumber?.trim() || undefined, agency: v.agency?.trim() || undefined, notes: v.notes?.trim() || undefined }; if (reg) biz.updateRegistration(entity.id, reg.id, clean); else biz.addRegistration(entity.id, clean); toast(reg ? "Registration updated" : `${stateName(v.state)} registration added`); onClose(); }}>{reg ? "Save" : "Add registration"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <SelectField id="rg-state" label="State" required value={v.state} disabled={!!reg} onChange={(e) => setV({ ...v, state: e.target.value })} options={[["", "Choose a state…"], ...stateOptions().filter(([c]) => !taken.has(c) || c === reg?.state)]} />
        </div>
        <SelectField id="rg-kind" label="Type" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as StateRegistration["kind"] })} options={Object.entries(REG_KIND).map(([k, x]) => [k, x] as [string, string])} />
        <SelectField id="rg-status" label="Status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as StateRegistration["status"] })} options={[["pending", "Pending / not filed"], ["active", "Active (approval confirmed)"], ["withdrawn", "Withdrawn"]]} />
        <TextField id="rg-date" label="Effective date" type="date" required={v.status === "active"} value={v.effectiveAt ?? ""} onChange={(e) => setV({ ...v, effectiveAt: e.target.value || undefined })} />
        <TextField id="rg-id" label="State ID number" value={v.stateIdNumber ?? ""} onChange={(e) => setV({ ...v, stateIdNumber: e.target.value })} />
        <TextField id="rg-agency" label="Agency" value={v.agency ?? ""} onChange={(e) => setV({ ...v, agency: e.target.value })} />
        <div className="sm:col-span-2"><TextArea id="rg-notes" label="Registration details / notes" value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
        {v.status === "active" && !v.effectiveAt && <p className="text-[12.5px] text-muted sm:col-span-2">An active registration needs the effective date from the state's approval.</p>}
      </div>
    </Modal>
  );
}

export function StandingDialog({ entity, open, onClose }: { entity: BizEntity; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const [status, setStatus] = useState<Standing["status"]>("verified_active");
  const [state, setState] = useState(entity.state);
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [by, setBy] = useState(meId());
  useEffect(() => {
    if (open) {
      setStatus("verified_active");
      setState(entity.state);
      setSource("");
      setNote("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Record a standing check" description="Only record what you confirmed in the state's own records today." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={status !== "not_verified" && !source.trim()} onClick={() => { biz.recordStanding(entity.id, status === "not_verified" ? { status } : { status, state, source: source.trim(), note: note.trim() || undefined, byId: by, checkedAt: SAMPLE_NOW.toISOString() }); toast("Standing recorded"); onClose(); }}>Save</Button></>}>
      <div className="space-y-4">
        <SelectField id="st-status" label="Result" value={status} onChange={(e) => setStatus(e.target.value as Standing["status"])} options={[["verified_active", "Active — confirmed in the state's records"], ["verified_issue", "Issue found (e.g. past due, inactive)"], ["not_verified", "Clear — mark as not verified"]]} />
        {status !== "not_verified" && (
          <>
            <SelectField id="st-state" label="State checked" value={state} onChange={(e) => setState(e.target.value)} options={entityStates(entity).map((s) => [s, stateName(s)] as [string, string])} />
            <TextField id="st-source" label="Where you checked" required value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. state business entity search" />
            <SelectField id="st-by" label="Checked by" value={by} onChange={(e) => setBy(e.target.value)} options={staffOptsNow()} />
            <TextArea id="st-note" label="Notes" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}
      </div>
    </Modal>
  );
}

export function RuleDialog({ rule, open, onClose, defaultState }: { rule?: ComplianceRule; open: boolean; onClose: () => void; defaultState?: string }) {
  const biz = useBiz();
  const toast = useToast();
  const blank = (): ComplianceRule => ({ id: uid("rule"), state: defaultState ?? "GA", entityTypes: ["LLC"], appliesTo: "both", kind: "annual_report", label: "", description: "", agency: "", frequency: "annual", due: "manual", source: "" });
  // Mounted fresh (keyed) each time it opens, so initial values never overwrite what the user types.
  const [v, setV] = useState<ComplianceRule>(() => (rule ? structuredClone(rule) : blank()));
  const [dueType, setDueType] = useState<"fixed" | "anniversary" | "manual">(() => (rule ? (typeof rule.due === "object" ? "fixed" : rule.due) : "manual"));
  const [fee, setFee] = useState(() => (rule?.filingFee != null ? String(rule.filingFee) : ""));
  const [verifiedNow, setVerifiedNow] = useState(false);
  const fixed = typeof v.due === "object" ? v.due : { month: 1, day: 1 };
  const due: ComplianceRule["due"] = dueType === "fixed" ? fixed : dueType;
  const valid = v.label.trim() && v.agency.trim() && v.source.trim() && (v.entityTypes === "any" || v.entityTypes.length > 0) && (dueType !== "fixed" || (fixed.month >= 1 && fixed.month <= 12 && fixed.day >= 1 && fixed.day <= 31)) && (fee === "" || Number(fee) >= 0);
  const changedFacts = rule && (JSON.stringify(rule.due) !== JSON.stringify(due) || String(rule.filingFee ?? "") !== fee || rule.source !== v.source);
  const save = () => {
    const out: ComplianceRule = { ...v, due, label: v.label.trim(), agency: v.agency.trim(), source: v.source.trim(), agencyUrl: v.agencyUrl?.trim() || undefined, filingFee: fee === "" ? undefined : Number(fee) };
    // Changing a date, fee or source clears the verification unless it was re-verified now.
    if (verifiedNow) Object.assign(out, { lastVerifiedAt: SAMPLE_NOW.toISOString(), verifiedBy: meId() });
    else if (changedFacts) Object.assign(out, { lastVerifiedAt: undefined, verifiedBy: undefined });
    biz.saveRule(out);
    toast("Rule saved");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={rule ? "Edit state requirement" : "New state requirement"} description="Requirements differ by state and entity type. Leave dates and fees blank until they are confirmed with the official source." footer={<>{rule && <Button variant="ghost" onClick={() => { biz.deleteRule(rule.id); toast("Rule removed"); onClose(); }}>Delete</Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>Save rule</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField id="ru-state" label="State" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} options={[...stateOptions(), ["LOCAL", "Local / provider (not a state rule)"]]} />
          <SelectField id="ru-kind" label="Requirement type" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as ComplianceKind })} options={Object.entries(COMPLIANCE_KIND).map(([k, x]) => [k, x] as [string, string])} />
          <SelectField id="ru-applies" label="Applies to" value={v.appliesTo} onChange={(e) => setV({ ...v, appliesTo: e.target.value as ComplianceRule["appliesTo"] })} options={[["both", "Domestic and foreign"], ["domestic", "Businesses formed in this state"], ["foreign", "Foreign-qualified businesses"]]} />
        </div>
        <TextField id="ru-label" label="Requirement name" required value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
        <TextArea id="ru-desc" label="Requirement description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <div>
          <Label>Entity types</Label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={v.entityTypes === "any"} onClick={() => setV({ ...v, entityTypes: v.entityTypes === "any" ? [] : "any" })} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${v.entityTypes === "any" ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>All entity types</button>
            {v.entityTypes !== "any" && ENTITY_TYPES.map((t) => { const on = (v.entityTypes as EntityType[]).includes(t); return <button key={t} type="button" aria-pressed={on} onClick={() => setV({ ...v, entityTypes: on ? (v.entityTypes as EntityType[]).filter((x) => x !== t) : [...(v.entityTypes as EntityType[]), t] })} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{t}</button>; })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="ru-agency" label="Filing agency" required value={v.agency} onChange={(e) => setV({ ...v, agency: e.target.value })} />
          <TextField id="ru-url" label="Official agency website" type="url" value={v.agencyUrl ?? ""} onChange={(e) => setV({ ...v, agencyUrl: e.target.value })} placeholder="https://" />
          <SelectField id="ru-freq" label="Renewal frequency" value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value as Frequency })} options={Object.entries(FREQUENCY).map(([k, x]) => [k, x] as [string, string])} />
          <TextField id="ru-fee" label="Filing fee ($)" type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} hint="blank until confirmed" />
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-3">
          <SelectField id="ru-due" label="Due date" value={dueType} onChange={(e) => setDueType(e.target.value as typeof dueType)} options={[["manual", "Set per business"], ["fixed", "Same date each period"], ["anniversary", "Anniversary of formation / registration"]]} />
          {dueType === "fixed" && <TextField id="ru-month" label="Month (1–12)" type="number" min={1} max={12} value={fixed.month} onChange={(e) => setV({ ...v, due: { month: Number(e.target.value), day: fixed.day } })} />}
          {dueType === "fixed" && <TextField id="ru-day" label="Day" type="number" min={1} max={31} value={fixed.day} onChange={(e) => setV({ ...v, due: { month: fixed.month, day: Number(e.target.value) } })} />}
        </div>
        <TextField id="ru-source" label="Source" required value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} placeholder="Statute, agency page or notice this comes from" />
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2 ring-1 ring-line">{rule?.lastVerifiedAt ? `Last verified ${fmtDate(rule.lastVerifiedAt)} by ${staffById(rule.verifiedBy ?? meId()).name}. Changing the date, fee or source clears this unless you re-verify.` : "Not verified yet — the rule is flagged everywhere it's used."}</p>
        <Checkbox label="I verified this against the official source today" checked={verifiedNow} onChange={() => setVerifiedNow((x) => !x)} />
        <TextArea id="ru-notes" label="Notes" value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value || undefined })} />
      </div>
    </Modal>
  );
}

export function ChecklistDialog({ list, state, open, onClose }: { list?: StateChecklist; state: string; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const [serviceId, setServiceId] = useState("any");
  const [items, setItems] = useState("");
  const [source, setSource] = useState("");
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (!open) return;
    setServiceId(list?.serviceId ?? "any");
    setItems(list?.items.join("\n") ?? "");
    setSource(list?.source ?? "");
    setVerified(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = items.split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <Modal open={open} onClose={onClose} title={`${stateName(state)} document checklist`} description="Added to the client checklist for requests in this state" footer={<>{list && <Button variant="ghost" onClick={() => { biz.deleteChecklist(list.id); toast("Checklist removed"); onClose(); }}>Delete</Button>}<Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!lines.length || !source.trim()} onClick={() => { biz.saveChecklist({ id: list?.id ?? uid("cl"), state, serviceId, items: lines, source: source.trim(), lastVerifiedAt: verified ? SAMPLE_NOW.toISOString() : list?.lastVerifiedAt }); toast("Checklist saved"); onClose(); }}>Save</Button></>}>
      <div className="space-y-4">
        <SelectField id="cl-svc" label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)} options={[["any", "Any service in this state"], ...biz.catalog.map((s) => [s.id, s.name] as [string, string])]} />
        <TextArea id="cl-items" label="Checklist items (one per line)" rows={5} required value={items} onChange={(e) => setItems(e.target.value)} />
        <TextField id="cl-source" label="Source" required value={source} onChange={(e) => setSource(e.target.value)} />
        <Checkbox label="Verified against the official source today" checked={verified} onChange={() => setVerified((x) => !x)} />
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Catalog (admin)                                                     */
/* ================================================================== */

export function ServiceDialog({ svc, open, onClose }: { svc?: CatalogService; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const cats = useMemo(() => [...new Set([...CATEGORIES, ...biz.catalog.map((s) => s.category)])], [biz.catalog]);
  const blank = (): CatalogService => ({ id: uid("svc"), category: "Business Consulting", name: "", description: "", nature: "administrative", price: 0, agency: false, formation: false, turnaroundDays: 14, needs: [], deliverables: [], active: true, custom: true });
  const [v, setV] = useState<CatalogService>(blank());
  const [newCat, setNewCat] = useState("");
  const [needs, setNeeds] = useState("");
  const [dels, setDels] = useState("");
  useEffect(() => {
    if (!open) return;
    const s = svc ? structuredClone(svc) : blank();
    setV(s);
    setNewCat("");
    setNeeds(s.needs.join("\n"));
    setDels(s.deliverables.join("\n"));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const dupe = biz.catalog.some((s) => s.id !== v.id && s.name.trim().toLowerCase() === v.name.trim().toLowerCase());
  const category = v.category === "__new" ? newCat.trim() : v.category;
  const legalWord = /\blegal\b|attorney|lawyer/i.test(`${v.name} ${v.description}`);
  const valid = v.name.trim() && !dupe && category && v.price >= 0 && !isNaN(v.price) && v.turnaroundDays > 0;
  const save = () => {
    biz.saveService({ ...v, category, name: v.name.trim(), description: v.description.trim(), needs: needs.split("\n").map((x) => x.trim()).filter(Boolean), deliverables: dels.split("\n").map((x) => x.trim()).filter(Boolean), filingFeeEstimate: v.filingFeeEstimate || undefined });
    toast(svc ? "Service updated" : "Service added to the catalog");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={svc ? "Edit service" : "Add a custom service"} description="Changes apply to new requests. Existing requests keep the name and price they were quoted." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>{svc ? "Save" : "Add service"}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <TextField id="sv-name" label="Service name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            <Err show={dupe} msg="A service with this name already exists" />
          </div>
          <SelectField id="sv-cat" label="Category" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} options={[...cats.map((c) => [c, c] as [string, string]), ["__new", "New category…"]]} />
          {v.category === "__new" && <TextField id="sv-newcat" label="New category name" required value={newCat} onChange={(e) => setNewCat(e.target.value)} />}
          <SelectField id="sv-nature" label="Type of service" value={v.nature} onChange={(e) => setV({ ...v, nature: e.target.value as ServiceNature })} options={Object.entries(NATURE).map(([k, x]) => [k, x.label] as [string, string])} />
        </div>
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2 ring-1 ring-line">{NATURE[v.nature].note}</p>
        <TextArea id="sv-desc" label="Description (shown to clients)" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        {legalWord && <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Avoid describing a service as legal work or legal advice — MKB is not a law firm.</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField id="sv-price" label="MKB fee ($)" type="number" min={0} step="0.01" required value={Number.isNaN(v.price) ? "" : v.price} onChange={(e) => setV({ ...v, price: e.target.value === "" ? NaN : Number(e.target.value) })} />
          <TextField id="sv-fee" label="Filing fee estimate ($)" hint="optional · varies by state" type="number" min={0} step="0.01" value={v.filingFeeEstimate ?? ""} onChange={(e) => setV({ ...v, filingFeeEstimate: e.target.value === "" ? undefined : Number(e.target.value) })} />
          <TextField id="sv-days" label="Turnaround (days)" type="number" min={1} required value={v.turnaroundDays} onChange={(e) => setV({ ...v, turnaroundDays: Number(e.target.value) })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox label="Goes to a government agency" hint="Enables the agency log and agency statuses" checked={v.agency} onChange={() => setV({ ...v, agency: !v.agency })} />
          <Checkbox label="Uses the formation workspace" hint="Names, organizer, owners, registered agent, EIN" checked={v.formation} onChange={() => setV({ ...v, formation: !v.formation })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea id="sv-needs" label="Information needed from the client (one per line)" rows={4} value={needs} onChange={(e) => setNeeds(e.target.value)} />
          <TextArea id="sv-dels" label="Deliverables (one per line)" rows={4} value={dels} onChange={(e) => setDels(e.target.value)} />
        </div>
        <Checkbox label="Available for new requests" checked={v.active} onChange={() => setV({ ...v, active: !v.active })} />
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Businesses                                                          */
/* ================================================================== */

export function EntityDialog({ entity, clientId, open, onClose, onSaved }: { entity?: BizEntity; clientId?: string; open: boolean; onClose: () => void; onSaved?: (id: string) => void }) {
  const biz = useBiz();
  const { clients } = useClients();
  const toast = useToast();
  const blank = (): Omit<BizEntity, "id" | "createdAt"> => ({ clientId: clientId ?? "", legalName: "", entityType: "LLC", state: "GA", status: "active", einStatus: "not_started", principalAddress: "", ownerId: meId(), registrations: [], standing: { status: "not_verified" } });
  const [v, setV] = useState<Omit<BizEntity, "id" | "createdAt">>(blank());
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) {
      setV(entity ? structuredClone(entity) : blank());
      setTried(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const dupe = biz.entities.some((e) => e.id !== entity?.id && e.clientId === v.clientId && e.legalName.trim().toLowerCase() === v.legalName.trim().toLowerCase());
  const errs = { client: !v.clientId ? "Choose the client" : null, name: !v.legalName.trim() ? "Enter the legal name" : dupe ? "This client already has a business with this name" : null, date: v.formationDate && v.formationDate > today() ? "Formation date can't be in the future" : null };
  const save = () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    const clean = { ...v, legalName: v.legalName.trim(), dba: v.dba?.trim() || undefined };
    if (entity) {
      biz.updateEntity(entity.id, clean);
      toast("Business updated");
      onSaved?.(entity.id);
    } else {
      const id = biz.addEntity(clean);
      toast("Business added");
      onSaved?.(id);
    }
    onClose();
  };
  const agent = v.agent ?? { type: "mkb_coordinated" as const, name: "", address: "" };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={entity ? "Edit business" : "Add a business"} description="Businesses are linked to an existing client record — one client can own or manage several." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{entity ? "Save" : "Add business"}</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div>
            <SelectField id="en-client" label="Client" required value={v.clientId} disabled={!!entity || !!clientId} onChange={(e) => setV({ ...v, clientId: e.target.value })} options={[["", "Choose a client…"], ...clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.name] as [string, string])]} />
            <Err show={tried} msg={errs.client} />
          </div>
          <div>
            <TextField id="en-name" label="Legal name" required value={v.legalName} onChange={(e) => setV({ ...v, legalName: e.target.value })} />
            <Err show={tried || dupe} msg={errs.name} />
          </div>
          <div>
            <TextField id="en-dba" label="Trade name / DBA" value={v.dba ?? ""} onChange={(e) => setV({ ...v, dba: e.target.value })} />
            <Err show={false} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField id="en-type" label="Entity type" value={v.entityType} onChange={(e) => setV({ ...v, entityType: e.target.value as EntityType })} options={ENTITY_TYPES.map((t) => [t, t])} />
            <SelectField id="en-state" label="State of formation" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} options={stateOptions()} />
          </div>
          <TextField id="en-stateid" label="State ID number (formation state)" value={v.stateIdNumber ?? ""} onChange={(e) => setV({ ...v, stateIdNumber: e.target.value || undefined })} />
          <SelectField id="en-status" label="Status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as BizEntity["status"] })} options={[["forming", "Forming"], ["active", "Active"], ["inactive", "Inactive"], ["dissolved", "Dissolved"]]} />
          <div>
            <TextField id="en-formed" label="Formation date" type="date" max={today()} value={v.formationDate ?? ""} onChange={(e) => setV({ ...v, formationDate: e.target.value || undefined })} />
            <Err show={tried} msg={errs.date} />
          </div>
          <SelectField id="en-ein" label="EIN status" value={v.einStatus} onChange={(e) => setV({ ...v, einStatus: e.target.value as BizEntity["einStatus"] })} options={Object.entries(EIN_STATUS).map(([k, x]) => [k, x] as [string, string])} />
          <SelectField id="en-owner" label="Responsible MKB staff" value={v.ownerId} onChange={(e) => setV({ ...v, ownerId: e.target.value })} options={staffOptsNow()} />
        </div>
        <TextField id="en-addr" label="Principal business address" value={v.principalAddress} onChange={(e) => setV({ ...v, principalAddress: e.target.value })} />
        <div className="grid gap-4 rounded-xl border border-line p-3 sm:grid-cols-3">
          <SelectField id="en-ra" label="Registered agent" value={v.agent ? agent.type : "none"} onChange={(e) => setV({ ...v, agent: e.target.value === "none" ? undefined : { ...agent, type: e.target.value as typeof agent.type } })} options={[["none", "Not recorded"], ...Object.entries(AGENT_TYPE).map(([k, x]) => [k, x] as [string, string])]} />
          {v.agent && <TextField id="en-ra-name" label="Agent name" value={agent.name} onChange={(e) => setV({ ...v, agent: { ...agent, name: e.target.value } })} />}
          {v.agent && <TextField id="en-ra-addr" label="Agent address" value={agent.address} onChange={(e) => setV({ ...v, agent: { ...agent, address: e.target.value } })} />}
        </div>
        <p className="text-[12px] text-muted">Add other states where the business is registered from the business page. The full EIN is stored with the client's tax identifiers (secure vault in Phase 3), not here.</p>
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Documents                                                           */
/* ================================================================== */

export function DocUploadDialog({ clientId, entityId, requestId, open, onClose }: { clientId: string; entityId?: string; requestId?: string; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const reqs = biz.requests.filter((r) => r.clientId === clientId && (!entityId || r.entityId === entityId));
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<DocCategory>("Client-provided document");
  const [req, setReq] = useState(requestId ?? "");
  const [exp, setExp] = useState("");
  useEffect(() => {
    if (open) {
      setFiles([]);
      setCategory("Client-provided document");
      setReq(requestId ?? "");
      setExp("");
    }
  }, [open, requestId]);
  return (
    <Modal open={open} onClose={onClose} title="Upload document" description="Stored on the client's record and linked to the business and request" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!files.length} onClick={() => { toFiles(files).forEach((f) => biz.uploadDoc({ clientId, entityId: entityId ?? reqs.find((r) => r.id === req)?.entityId, requestId: req || undefined, name: f.name, category, sizeKb: f.sizeKb, expiresAt: exp ? toIso(exp) : undefined })); toast(`${files.length} file(s) uploaded`); onClose(); }}>Upload</Button></>}>
      <div className="space-y-4">
        <FilePicker files={files} setFiles={setFiles} label="Choose files" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="du-cat" label="Category" value={category} onChange={(e) => setCategory(e.target.value as DocCategory)} options={DOC_CATEGORIES.map((c) => [c, c])} />
          <SelectField id="du-req" label="Service request" value={req} disabled={!!requestId} onChange={(e) => setReq(e.target.value)} options={[["", "Business only (no request)"], ...reqs.map((r) => [r.id, `${r.number} · ${r.serviceName}`] as [string, string])]} />
        </div>
        <TextField id="du-exp" label="Expiration date (licenses, permits)" type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
      </div>
    </Modal>
  );
}

export { NotLegalAdvice };
