"use client";

import Link from "next/link";
import { useClientGate } from "@/components/team/AccessGuard";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, CreditCard, Download, FileText, Plus, Receipt, Send, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { downloadPlaceholder } from "@/components/crm/dialogs";
import { SAMPLE_NOW, staffById, meId } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { isClosed, openInfo, requestInvoices, useBiz } from "@/lib/store/biz-store";
import { ENTITY_TYPES, FLOW, NATURE, STATUS_META, stateOptions, type EntityType, type InfoRequest, type ServiceRequest } from "@/lib/biz/config";
import { fmtDate, usd } from "@/lib/format";
import { FeeBreakdown, NotLegalAdvice } from "./BizBits";
import { FilePicker, RespondDialog } from "./BizDialogs";

const toFiles = (fs: File[]) => fs.map((f) => ({ name: f.name.replace(/\.[^.]+$/, ""), sizeKb: Math.max(1, Math.round(f.size / 1024)) }));

export function ClientPortal({ clientId }: { clientId: string }) {
  const biz = useBiz();
  const clientStore = useClients();
  const toast = useToast();
  const c = clientStore.clients.find((x) => x.id === clientId);
  const [responding, setResponding] = useState<{ r: ServiceRequest; i: InfoRequest } | null>(null);
  const [quote, setQuote] = useState<ServiceRequest | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const gate = useClientGate(clientId, "this client portal");
  if (gate) return gate;
  if (!c) return <p className="py-20 text-center text-muted">Client not found.</p>;
  // Only this client's own businesses and requests are ever shown.
  const reqs = biz.requests.filter((r) => r.clientId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ents = biz.entities.filter((e) => e.clientId === c.id);
  const active = reqs.filter((r) => !isClosed(r));
  const needs = reqs.flatMap((r) => openInfo(r).map((i) => ({ r, i })));
  const quotes = reqs.filter((r) => r.quote.status === "sent");
  const invoices = c.invoices.filter((i) => i.service === "biz" && i.status !== "draft").sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const delivered = c.documents.filter((d) => d.service === "biz" && d.deliveredAt).sort((a, b) => b.deliveredAt!.localeCompare(a.deliveredAt!));
  const todo = needs.length + quotes.length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/60 px-4 py-2.5 text-[13px] text-accent-ink">
        <span className="font-semibold">Client portal preview</span> — what {c.contactName ?? c.name} sees for business services. Internal notes, tasks and staff review details are never shown.
        <Link href="/services/business-services#requests" className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline"><ArrowLeft size={14} /> Back to Business Services</Link>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <p className="text-[13px] text-muted">Hi {(c.contactName ?? c.name).split(" ")[0]},</p>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">Your business services</h1>
        {ents.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Your businesses">{ents.map((e) => <span key={e.id} className="rounded-full border border-line px-3 py-1 text-[12.5px] font-medium text-ink-2">{e.legalName} · {e.state}</span>)}</div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" icon={Plus} onClick={() => setNewOpen(true)}>Request a service</Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[["To do", todo], ["In progress", active.length], ["Ready to download", delivered.length]].map(([k, v]) => <div key={k} className="rounded-xl border border-line p-2.5"><div className="text-[20px] font-bold tabular-nums text-ink">{v}</div><div className="text-[12px] text-muted">{k}</div></div>)}
        </div>
      </section>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="What we need from you" subtitle={todo ? `${todo} to do` : "You're all caught up"} />
            <ul className="divide-y divide-line border-t border-line">
              {todo === 0 && <li className="flex items-center gap-2 px-6 py-6 text-[14px] text-success-ink"><CheckCircle2 size={18} /> Nothing to do right now.</li>}
              {quotes.map((r) => (
                <li key={`q-${r.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                  <Receipt size={20} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto"><div className="text-[14.5px] font-medium text-ink">Review your quote</div><div className="text-[12px] text-muted">{r.serviceName} · {r.businessName}</div></div>
                  <Button variant="primary" onClick={() => setQuote(r)}>Review quote</Button>
                </li>
              ))}
              {needs.map(({ r, i }) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                  <Circle size={20} className="shrink-0 text-line-strong" />
                  <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
                    <div className="text-[14.5px] font-medium text-ink">{i.label}</div>
                    {i.detail && <div className="text-[13px] text-ink-2">{i.detail}</div>}
                    <div className="text-[12px] text-muted">{r.serviceName} · {r.businessName}</div>
                  </div>
                  <Button variant="primary" icon={i.file ? UploadCloud : Send} onClick={() => setResponding({ r, i })}>{i.file ? "Upload" : "Respond"}</Button>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Your requests" subtitle={`${active.length} in progress`} />
            <ul className="divide-y divide-line border-t border-line">
              {reqs.length === 0 && <li className="px-6 py-8 text-center text-[13.5px] text-muted">No requests yet — start one above.</li>}
              {reqs.map((r) => {
                const steps = FLOW.filter((s) => s !== "Submitted to Agency" && s !== "Awaiting Agency Response" ? true : biz.catalog.find((x) => x.id === r.serviceId)?.agency);
                const idx = steps.indexOf((r.status === "On Hold" ? r.holdFrom : r.status) as (typeof FLOW)[number]);
                const pct = r.status === "Completed" ? 100 : r.status === "Cancelled" ? 0 : Math.max(8, Math.round((idx / (steps.length - 1)) * 100));
                return (
                  <li key={r.id} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[14.5px] font-semibold text-ink">{r.serviceName}</span><Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].client}</Badge></div>
                    <div className="text-[12.5px] text-muted">{r.businessName} · {r.state} · {r.number}{r.dueAt && !isClosed(r) ? ` · target ${fmtDate(r.dueAt)}` : ""} · your contact: {staffById(r.assignedTo).name}</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.serviceName} progress`}><div className={`h-full rounded-full ${r.status === "Completed" ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>
                    {r.status === "On Hold" && <p className="mt-1 text-[12.5px] text-ink-2">Paused — your MKB contact will be in touch.</p>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={FileText} title="Completed documents" />
            <ul className="divide-y divide-line border-t border-line">
              {delivered.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">Your documents appear here when MKB delivers them.</li>}
              {delivered.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{d.name}</span><span className="block text-[12px] text-muted">Delivered {fmtDate(d.deliveredAt!)}</span></span>
                  <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${d.name}`} onClick={() => downloadPlaceholder(d.name)} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={CreditCard} title="Invoices & payments" />
            <ul className="divide-y divide-line border-t border-line">
              {invoices.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">No invoices yet.</li>}
              {invoices.map((i) => (
                <li key={i.id} className="px-5 py-3 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[13px] font-semibold text-ink">{i.number}</span><Badge tone={i.status === "paid" ? "success" : i.status === "overdue" ? "danger" : i.status === "partial" ? "warning" : "info"}>{i.status === "paid" ? "Paid" : i.status === "overdue" ? "Past due" : i.status === "partial" ? "Partially paid" : "Due"}</Badge><span className="ml-auto text-[14px] font-semibold tabular-nums text-ink">{usd(i.amount, 2)}</span></div>
                  <div className="text-[12px] text-muted">{i.description} · {i.status === "paid" ? `paid${i.paidAt ? ` ${fmtDate(i.paidAt)}` : ""}` : `${usd(i.amount - i.paid, 2)} due ${fmtDate(i.dueAt)}`}</div>
                  {i.adjustments?.map((a) => <div key={a.id} className="text-[12px] text-ink-2">{a.kind === "refund" ? "Refunded" : "Adjusted"} {usd(a.amount, 2)} on {fmtDate(a.at)}</div>)}
                </li>
              ))}
            </ul>
            <div className="border-t border-line p-4 sm:px-5"><Button disabled className="w-full" icon={CreditCard} title="Available in Phase 3">Pay online (coming soon)</Button></div>
          </Card>
          <NotLegalAdvice compact />
        </div>
      </div>

      {responding && <RespondDialog r={responding.r} item={responding.i} by="client" onClose={() => setResponding(null)} />}
      <Modal open={!!quote} onClose={() => setQuote(null)} title="Your quote" description={quote ? `${quote.serviceName} · ${quote.businessName}` : ""} footer={<><Button onClick={() => setQuote(null)}>Not now</Button><Button variant="primary" icon={CheckCircle2} onClick={() => { biz.acceptQuote(quote!.id, "client"); toast("Quote accepted — your invoice is ready"); setQuote(null); }}>Accept quote</Button></>}>
        {quote && (
          <div className="space-y-3">
            <FeeBreakdown lines={quote.quote.lines} />
            {quote.quote.note && <p className="text-[13px] text-ink-2">{quote.quote.note}</p>}
            <p className="text-[12px] text-muted">Government and third-party fees are passed through at cost and set by those agencies or providers.</p>
            <p className="text-[12px] text-muted">{NATURE[biz.catalog.find((s) => s.id === quote.serviceId)?.nature ?? "administrative"].note}</p>
          </div>
        )}
      </Modal>
      <PortalRequestDialog clientId={c.id} open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}

/** Simple, mobile-friendly request form for clients. */
function PortalRequestDialog({ clientId, open, onClose }: { clientId: string; open: boolean; onClose: () => void }) {
  const biz = useBiz();
  const toast = useToast();
  const ents = biz.entities.filter((e) => e.clientId === clientId);
  const [entityId, setEntityId] = useState(ents[0]?.id ?? "new");
  const [name, setName] = useState("");
  const [structure, setStructure] = useState<EntityType>("LLC");
  const [state, setState] = useState(ents[0]?.state ?? "GA");
  const [serviceId, setServiceId] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [tried, setTried] = useState(false);
  const ent = ents.find((e) => e.id === entityId);
  const today = SAMPLE_NOW.toISOString().slice(0, 10);
  const errs = { svc: !serviceId && "Choose a service", name: !ent && !name.trim() && "Enter the business name", desc: desc.trim().length < 10 && "Tell us a little more (at least 10 characters)", date: date && date < today && "Choose a future date" };
  const reset = () => { setEntityId(ents[0]?.id ?? "new"); setName(""); setServiceId(""); setDesc(""); setDate(""); setFiles([]); setTried(false); };
  const submit = () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    const id = biz.createRequest({ clientId, entityId: ent?.id, businessName: ent?.legalName ?? name.trim(), structure: ent?.entityType ?? structure, state, serviceId, description: desc, preferredDate: date ? new Date(`${date}T17:00`).toISOString() : undefined, assignedTo: meId(), files: toFiles(files), source: "portal" });
    toast(`Request ${id} sent to MKB`);
    reset();
    onClose();
  };
  const cats = [...new Set(biz.catalog.filter((s) => s.active).map((s) => s.category))];
  const svc = biz.catalog.find((s) => s.id === serviceId);
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Request a service" description="Tell us what you need. MKB will follow up with a quote." footer={<><Button onClick={() => { reset(); onClose(); }}>Cancel</Button><Button variant="primary" icon={Send} onClick={submit}>Send request</Button></>}>
      <div className="space-y-3">
        <SelectField id="pr-ent" label="Which business?" value={entityId} onChange={(e) => { setEntityId(e.target.value); const x = ents.find((y) => y.id === e.target.value); if (x) setState(x.state); }} options={[...ents.map((e) => [e.id, e.legalName] as [string, string]), ["new", "A new or different business"]]} />
        {!ent && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><TextField id="pr-name" label="Business name (or proposed name)" required value={name} onChange={(e) => setName(e.target.value)} />{tried && errs.name && <p className="mt-1 text-[12px] text-danger-ink" role="alert">{errs.name}</p>}</div>
            <SelectField id="pr-structure" label="Business type" value={structure} onChange={(e) => setStructure(e.target.value as EntityType)} options={ENTITY_TYPES.map((t) => [t, t])} />
          </div>
        )}
        <div>
          <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Service <span className="text-danger">*</span></span>
            <select id="pr-svc" aria-label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">
              <option value="">Choose a service…</option>
              {cats.map((cat) => <optgroup key={cat} label={cat}>{biz.catalog.filter((s) => s.active && s.category === cat).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
            </select>
          </label>
          {svc ? <p className="mt-1 text-[12px] text-muted">{svc.description} {NATURE[svc.nature].note}</p> : tried && errs.svc && <p className="mt-1 text-[12px] text-danger-ink" role="alert">{errs.svc}</p>}
        </div>
        <SelectField id="pr-state" label="State" value={state} onChange={(e) => setState(e.target.value)} options={stateOptions()} />
        <div><TextArea id="pr-desc" label="What do you need?" required value={desc} onChange={(e) => setDesc(e.target.value)} />{tried && errs.desc && <p className="mt-1 text-[12px] text-danger-ink" role="alert">{errs.desc}</p>}</div>
        <div><TextField id="pr-date" label="When do you need it? (optional)" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />{tried && errs.date && <p className="mt-1 text-[12px] text-danger-ink" role="alert">{errs.date}</p>}</div>
        <FilePicker files={files} setFiles={setFiles} label="Attach documents (optional)" />
        <NotLegalAdvice compact />
      </div>
    </Modal>
  );
}
