"use client";

import Link from "next/link";
import { useClientGate } from "@/components/team/AccessGuard";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Briefcase, CalendarClock, ClipboardList, Download, FileText, FolderOpen, Landmark, Pencil, Plus, Send, ShieldAlert, ShieldCheck, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Breadcrumbs } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { downloadPlaceholder } from "@/components/crm/dialogs";
import { SAMPLE_NOW, staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { STANDING_META, deadlineSummary, dueState, entityStates, payState, useBiz } from "@/lib/store/biz-store";
import { AGENT_TYPE, COMPLIANCE_KIND, EIN_STATUS, FREQ_MONTHS, FREQUENCY, REG_KIND, stateName, type ComplianceItem, type StateRegistration } from "@/lib/biz/config";
import { fmtDate, relTime } from "@/lib/format";
import { PayBadge, StatusBadge, money, portalHref, reqHref } from "./BizBits";
import { ComplianceItemDialog, DocUploadDialog, EntityDialog, NewRequestDialog, RegistrationDialog, StandingDialog, VerifyDialog } from "./BizDialogs";

export function EntityPage({ id }: { id: string }) {
  const biz = useBiz();
  const clientStore = useClients();
  const toast = useToast();
  const router = useRouter();
  const e = biz.entities.find((x) => x.id === id);
  const c = clientStore.clients.find((x) => x.id === e?.clientId);
  const [edit, setEdit] = useState(false);
  const [standing, setStanding] = useState(false);
  const [reg, setReg] = useState<StateRegistration | null | undefined>(undefined);
  const [item, setItem] = useState<ComplianceItem | null | undefined>(undefined);
  const [verify, setVerify] = useState<ComplianceItem | null>(null);
  const [newReq, setNewReq] = useState(false);
  const [upload, setUpload] = useState(false);
  const gate = useClientGate(e?.clientId, "this business");
  if (gate) return gate;
  if (!e || !c)
    return (
      <div className="py-20 text-center">
        <h1 className="text-[20px] font-bold text-ink">Business not found</h1>
        <Link href="/services/business-services#businesses" className="mt-4 inline-block text-[14px] font-semibold text-accent">Back to businesses</Link>
      </div>
    );
  const items = biz.compliance.filter((i) => i.entityId === e.id);
  const open = items.filter((i) => i.status !== "filed" && i.status !== "not_applicable").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const filed = items.filter((i) => i.status === "filed").sort((a, b) => (b.filedAt ?? "").localeCompare(a.filedAt ?? "")).slice(0, 5);
  const reqs = biz.requests.filter((r) => r.entityId === e.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const docs = c.documents.filter((d) => d.entityId === e.id).sort((a, b) => (b.uploadedAt ?? b.requestedAt).localeCompare(a.uploadedAt ?? a.requestedAt));
  const states = entityStates(e);
  const sm = STANDING_META[e.standing.status];
  const ds = deadlineSummary(items);
  const siblings = biz.entities.filter((x) => x.clientId === e.clientId && x.id !== e.id);

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Business Services", href: "/services/business-services" }, { label: "Businesses", href: "/services/business-services#businesses" }, { label: e.legalName }]} />
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-svc-biz-soft text-svc-biz"><Briefcase size={26} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[24px]">{e.legalName}</h1>
                <Badge tone={e.status === "active" ? "success" : e.status === "forming" ? "info" : "neutral"}>{e.status === "forming" ? "Forming" : e.status[0].toUpperCase() + e.status.slice(1)}</Badge>
                <Badge tone={sm.tone} icon={e.standing.status === "not_verified" ? ShieldAlert : ShieldCheck}>{sm.label}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span>Client: <Link href={`/clients/${c.id}`} className="font-medium text-accent hover:underline">{c.name}</Link></span>
                <span>{e.entityType} · formed in {stateName(e.state)}{e.stateIdNumber ? ` · ID ${e.stateIdNumber}` : ""}</span>
                {e.dba && <span>dba {e.dba}</span>}
                <span>Registered in {states.length} state{states.length > 1 ? "s" : ""}</span>
              </div>
              {siblings.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">Other businesses for this client: {siblings.map((s) => <Link key={s.id} href={`/services/business-services/businesses/${s.id}`} className="rounded-full border border-line px-2.5 py-0.5 font-medium text-ink-2 hover:border-accent">{s.legalName}</Link>)}</div>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button size="sm" icon={Pencil} onClick={() => setEdit(true)}>Edit</Button>
            <Button size="sm" icon={ShieldCheck} onClick={() => setStanding(true)}>Record standing check</Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setNewReq(true)}>New request</Button>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2 ring-1 ring-line">
          {e.standing.status === "not_verified" ? "Standing hasn't been verified. MKB doesn't label a business compliant or in good standing without checking the state's own records." : `${sm.label} in ${stateName(e.standing.state ?? e.state)} on ${fmtDate(e.standing.checkedAt!)} by ${staffById(e.standing.byId ?? "s-mk").name} — ${e.standing.source}.${e.standing.note ? ` ${e.standing.note}` : ""}`}
        </p>
      </section>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader icon={Briefcase} title="Business details" action={<Button size="sm" variant="ghost" onClick={() => { biz.markReviewed(e.id, 90); toast("Reviewed — next review in 90 days"); }}>Mark reviewed</Button>} />
            <dl className="grid gap-x-6 gap-y-3 px-5 pb-5 text-[13.5px] sm:grid-cols-2 sm:px-6">
              {[
                ["Entity type", e.entityType],
                ["State of formation", stateName(e.state)],
                ["State ID number", e.stateIdNumber ?? "Not recorded"],
                ["Formation date", e.formationDate ? fmtDate(`${e.formationDate}T12:00`) : "—"],
                ["EIN", EIN_STATUS[e.einStatus]],
                ["Responsible MKB staff", staffById(e.ownerId).name],
                ["Principal address", e.principalAddress || "—"],
                ["Registered agent", e.agent ? `${e.agent.name || "—"} (${AGENT_TYPE[e.agent.type]})` : "Not recorded"],
                ["Last reviewed", e.lastReviewedAt ? fmtDate(e.lastReviewedAt) : "Never"],
                ["Next review", e.nextReviewAt ? fmtDate(e.nextReviewAt) : "—"],
              ].map(([k, v]) => <div key={k}><dt className="text-[12px] text-muted">{k}</dt><dd className={`font-medium ${k === "Next review" && e.nextReviewAt && e.nextReviewAt < SAMPLE_NOW.toISOString() ? "text-danger-ink" : "text-ink"}`}>{v}</dd></div>)}
            </dl>
          </Card>
          <Card>
            <CardHeader icon={Landmark} title="State registrations" subtitle="Formation state plus every state where the business is registered or authorized to operate" action={<Button size="sm" icon={Plus} onClick={() => setReg(null)}>Add state</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              <li className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="grid h-9 w-11 place-items-center rounded-lg bg-accent-soft text-[12.5px] font-bold text-accent-ink">{e.state}</span>
                <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-ink">{stateName(e.state)} — formation (domestic)</div><div className="text-[12px] text-muted">{e.stateIdNumber ? `ID ${e.stateIdNumber}` : "State ID not recorded"}{e.formationDate ? ` · formed ${fmtDate(`${e.formationDate}T12:00`)}` : ""}</div></div>
                <Badge tone={e.status === "forming" ? "info" : "success"}>{e.status === "forming" ? "Forming" : "Formed"}</Badge>
              </li>
              {e.registrations.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <span className="grid h-9 w-11 place-items-center rounded-lg bg-surface-2 text-[12.5px] font-bold text-ink ring-1 ring-line">{r.state}</span>
                  <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-ink">{stateName(r.state)} — {REG_KIND[r.kind].toLowerCase()}</div><div className="text-[12px] text-muted">{r.stateIdNumber ? `ID ${r.stateIdNumber}` : "ID not recorded"}{r.effectiveAt ? ` · effective ${fmtDate(`${r.effectiveAt}T12:00`)}` : ""}{r.notes ? ` · ${r.notes}` : ""}</div></div>
                  <Badge tone={r.status === "active" ? "success" : r.status === "pending" ? "warning" : "neutral"}>{r.status === "active" ? "Active" : r.status === "pending" ? "Pending" : "Withdrawn"}</Badge>
                  <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${stateName(r.state)} registration`} onClick={() => setReg(r)} />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={CalendarClock} title="Compliance deadlines" subtitle={`${open.length} open · ${ds.label.toLowerCase()} · grouped by state`} action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setItem(null)}>Add deadline</Button>} />
            <div className="border-t border-line">
              {open.length === 0 && <p className="px-6 py-8 text-center text-[13.5px] text-muted">No deadlines tracked. Add them from a configured state rule or enter them manually.</p>}
              {[...new Set(open.map((i) => i.state))].map((st) => (
                <div key={st}>
                  <div className="bg-surface-2 px-5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted sm:px-6">{st === "LOCAL" ? "Local / provider" : `${stateName(st)}${st === e.state ? " · formation state" : " · registered"}`}</div>
                  <ul className="divide-y divide-line">
                    {open.filter((i) => i.state === st).map((i) => {
                      const s = dueState(i);
                      return (
                        <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                          <div className="min-w-0 flex-1 basis-[55%] sm:basis-auto">
                            <div className="text-[14px] font-medium text-ink">{i.title}</div>
                            <div className="text-[12px] text-muted">{COMPLIANCE_KIND[i.kind]} · due {fmtDate(i.dueAt)} · {FREQUENCY[i.frequency].toLowerCase()} · {i.agency ?? "agency not set"} · fee {i.filingFee != null ? money(i.filingFee) : "not confirmed"} · {staffById(i.ownerId).name}</div>
                            <div className="text-[12px] text-muted">Source: {i.source}{i.lastVerifiedAt ? ` · verified ${fmtDate(i.lastVerifiedAt)} by ${staffById(i.verifiedBy ?? "s-mk").name}` : ""}</div>
                            {i.notes && <div className="text-[12px] text-ink-2">{i.notes}</div>}
                          </div>
                          <Badge tone={s.tone}>{s.label}</Badge>
                          {i.lastVerifiedAt ? <Badge tone="success" icon={BadgeCheck}>Verified</Badge> : <Badge tone="warning" icon={ShieldAlert}>Not verified</Badge>}
                          <div className="flex flex-wrap gap-1.5">
                            {!i.lastVerifiedAt && <Button size="sm" variant="ghost" onClick={() => setVerify(i)}>Verify</Button>}
                            <Button size="sm" variant="ghost" icon={Send} aria-label={`Send reminder for ${i.title}`} onClick={() => { biz.sendReminder(i.id, []); toast("Reminder sent to the client"); }} />
                            {i.requestId ? <Button size="sm" variant="ghost" href={reqHref({ id: i.requestId })}>{i.requestId}</Button> : <Button size="sm" variant="ghost" onClick={() => { const rid = biz.startRequestFor(i.id); toast(`${rid} created`); router.push(reqHref({ id: rid })); }}>Start request</Button>}
                            <Button size="sm" onClick={() => { biz.markFiled(i.id); toast(FREQ_MONTHS[i.frequency] ? "Filed — next period added (needs verification)" : "Marked filed"); }}>Mark filed</Button>
                            <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${i.title}`} onClick={() => setItem(i)} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {filed.length > 0 && <div className="border-t border-line px-5 py-3 text-[12.5px] text-muted sm:px-6">Recently filed: {filed.map((i) => `${i.title} (${i.filedAt ? fmtDate(i.filedAt) : ""})`).join(" · ")}</div>}
          </Card>

          <Card>
            <CardHeader icon={ClipboardList} title="Service requests" subtitle={`${reqs.length} for this business`} action={<Button size="sm" variant="ghost" href={portalHref(c.id)}>Client portal view</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {reqs.length === 0 && <li className="px-6 py-6 text-center text-[13.5px] text-muted">No requests yet.</li>}
              {reqs.map((r) => (
                <li key={r.id}>
                  <Link href={reqHref(r)} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6">
                    <div className="min-w-0 flex-1"><div className="text-[14px] font-medium text-ink">{r.serviceName}</div><div className="text-[12px] text-muted">{r.number} · {r.state} · {relTime(r.createdAt)} · {staffById(r.assignedTo).name}</div></div>
                    <StatusBadge s={r.status} />
                    <PayBadge s={payState(r, c).state} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader icon={FolderOpen} title="Documents" subtitle="Formation documents, licenses, confirmations and deliverables for this business" action={<Button size="sm" icon={UploadCloud} onClick={() => setUpload(true)}>Upload</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {docs.length === 0 && <li className="px-6 py-6 text-center text-[13.5px] text-muted">No documents yet.</li>}
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                  <FileText size={16} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium text-ink">{d.name}</div><div className="text-[12px] text-muted">{d.category} · {d.uploadedAt ? fmtDate(d.uploadedAt) : `requested ${relTime(d.requestedAt)}`}{d.expiresAt ? ` · expires ${fmtDate(d.expiresAt)}` : ""}{d.bizRequestId ? ` · ${d.bizRequestId}` : ""}</div></div>
                  {d.status === "requested" ? <Badge tone="warning">Requested</Badge> : d.deliveredAt ? <Badge tone="success">Delivered</Badge> : <Badge tone="neutral">On file</Badge>}
                  {d.status !== "requested" && <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${d.name}`} onClick={() => { clientStore.logDocumentAccess(c.id, d.id, "Downloaded"); downloadPlaceholder(d.name); }} />}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <EntityDialog entity={e} open={edit} onClose={() => setEdit(false)} />
      <StandingDialog entity={e} open={standing} onClose={() => setStanding(false)} />
      <RegistrationDialog entity={e} reg={reg ?? undefined} open={reg !== undefined} onClose={() => setReg(undefined)} />
      <ComplianceItemDialog entity={e} item={item ?? undefined} open={item !== undefined} onClose={() => setItem(undefined)} />
      <VerifyDialog title={verify ? `${e.legalName} — ${verify.title}` : ""} current={verify?.source.startsWith("Sample data") ? "" : verify?.source} open={!!verify} onClose={() => setVerify(null)} onVerify={(by, src) => verify && biz.verifyItem(verify.id, by, src)} />
      <NewRequestDialog open={newReq} preset={{ clientId: c.id, entityId: e.id }} onClose={() => setNewReq(false)} onCreated={(rid) => router.push(reqHref({ id: rid }))} />
      <DocUploadDialog clientId={c.id} entityId={e.id} open={upload} onClose={() => setUpload(false)} />
    </>
  );
}
