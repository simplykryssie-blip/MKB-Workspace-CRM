"use client";

import { useEffect, useState } from "react";
import { Building2, CircleCheck, Eye, EyeOff, Gavel, Lock, Plus, Scale, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useExp } from "@/lib/store/exp-store";
import { DISPOSITIONS, EXP_ROLES, NOT_LEGAL_ADVICE_EXP, OUTCOME_TONE, STATUS_TONE, mask, type CaseStatus, type Docket, type ExpCase, type ExpRole, type Phase, type ScreeningOutcome, type Tri } from "@/lib/expunge/config";
import type { NewCaseInput } from "@/lib/store/exp-store";

export const caseHref = (c: { id: string }, tab?: string) => `/services/record-expungement/cases/${c.id}${tab ? `#${tab}` : ""}`;
export const matterHref = (m: { id: string }, tab?: string) => `/services/record-expungement/matters/${m.id}${tab ? `#${tab}` : ""}`;
export const portalHref = (clientId: string) => `/services/record-expungement/portal/${clientId}`;
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export const StatusBadge = ({ s }: { s: CaseStatus }) => <Badge tone={STATUS_TONE[s]}>{s}</Badge>;
export const OutcomeBadge = ({ o }: { o: ScreeningOutcome }) => <Badge tone={OUTCOME_TONE[o]}>{o}</Badge>;
const PHASE_TONE: Partial<Record<Phase, "info" | "warning" | "danger" | "success" | "neutral">> = { "Flagged for legal review": "danger", "Awaiting client approval": "warning", "Intake awaiting completion": "warning", "Completed": "success", "Order received — finishing": "success", "On hold": "neutral", "Closed — not granted": "neutral", "Hearing scheduled": "warning" };
export const PhaseBadge = ({ p }: { p: Phase }) => <Badge tone={PHASE_TONE[p] ?? "info"}>{p}</Badge>;
const OWNER_ICON = { MKB: Building2, Client: UserRound, "Court / agency": Gavel, "Legal reviewer": Scale, Done: CircleCheck } as const;
export function OwnerBadge({ o }: { o: keyof typeof OWNER_ICON }) {
  return <Badge tone={o === "Client" ? "warning" : o === "Legal reviewer" ? "danger" : o === "Done" ? "success" : o === "MKB" ? "info" : "neutral"} icon={OWNER_ICON[o]}>{o}</Badge>;
}

export function NotLegalAdvice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`flex items-start gap-2 rounded-xl border border-line bg-surface-2 text-ink-2 ${compact ? "px-3 py-2 text-[12px]" : "px-4 py-3 text-[12.5px]"}`}>
      <Scale size={compact ? 14 : 16} className="mt-0.5 shrink-0 text-muted" />
      <span>{NOT_LEGAL_ADVICE_EXP}</span>
    </p>
  );
}

export function SecurityNote() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-line-strong px-3.5 py-2 text-[12.5px] text-muted">
      <Lock size={13} className="mt-0.5 shrink-0" />
      <span>Prototype only — not production-secure. Criminal-history details here are fictional, held in memory and cleared on reload. Phase 3 adds encrypted storage, role-based access and audit logs enforced on the server.</span>
    </p>
  );
}

/** Preview the module as different staff roles (permissions are enforced server-side in Phase 3). */
export function RoleSwitcher() {
  const exp = useExp();
  return (
    <label className="inline-flex max-w-full items-center gap-2 rounded-xl border border-dashed border-line-strong px-2.5 py-1.5 text-[12.5px] text-ink-2">
      <Eye size={14} className="text-muted" /> Viewing as
      <select aria-label="Viewing as" value={exp.role} onChange={(e) => exp.setRole(e.target.value as ExpRole)} className="h-7 min-w-0 max-w-[190px] rounded-lg border border-line bg-surface px-1.5 text-[12.5px] text-ink">
        {Object.entries(EXP_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </label>
  );
}

export function Restricted({ what = "Criminal-history details" }: { what?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-[13.5px] text-muted">
      <Lock size={16} className="shrink-0" /> {what} are restricted. This role doesn&rsquo;t have criminal-history access.
    </div>
  );
}

/** Masked identifier with a logged reveal. */
export function Masked({ value, label, matterId, caseId }: { value?: string; label: string; matterId: string; caseId?: string }) {
  const exp = useExp();
  const [shown, setShown] = useState(false);
  if (!value) return <span className="text-muted">—</span>;
  if (!exp.can.criminalHistory) return <span className="inline-flex items-center gap-1 font-mono text-[12.5px] text-muted"><Lock size={11} /> restricted</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-ink">
      {shown ? value : mask(value)}
      <button type="button" aria-label={shown ? `Hide ${label}` : `Reveal ${label}`} title={shown ? "Hide" : "Reveal (logged)"} onClick={() => { if (!shown) exp.logAccess(matterId, `Revealed ${label}`, caseId); setShown(!shown); }} className="text-muted hover:text-accent">
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  );
}

export const triOpts: [string, string][] = [["unknown", "Unknown"], ["yes", "Yes"], ["no", "No"]];
export function TriField({ id, label, value, onChange }: { id: string; label: string; value: Tri; onChange: (v: Tri) => void }) {
  return <SelectField id={id} label={label} value={value} onChange={(e) => onChange(e.target.value as Tri)} options={triOpts} />;
}

/* ================================================================== */
/* Case editor — arrests, dockets and charges                          */
/* ================================================================== */

export type CaseDraft = NewCaseInput;
export const blankCase = (jurisdictionId = "J-LA", state = "LA"): CaseDraft => ({ jurisdictionId, state, locality: "", arrestingAgency: "", dockets: [{ id: uid("dk"), court: "", docketNumber: "", charges: [{ id: uid("ch"), description: "", disposition: "Unknown" }] }], sentenceCompleted: "unknown", obligations: "unknown" });
export const draftFrom = (c: ExpCase): CaseDraft => ({ jurisdictionId: c.jurisdictionId, state: c.state, localityId: c.localityId, locality: c.locality, arrestingAgency: c.arrestingAgency, arrestDate: c.arrestDate, arrestNumber: c.arrestNumber, arrestingJurisdiction: c.arrestingJurisdiction, dockets: structuredClone(c.dockets), supervision: c.supervision, sentenceCompleted: c.sentenceCompleted, obligations: c.obligations, resolution: c.resolution, notes: c.notes });
export const caseErrors = (v: CaseDraft, client: boolean) =>
  [
    !v.jurisdictionId && "Choose a state",
    !v.locality.trim() && "Enter the parish or county",
    !client && !v.arrestingAgency.trim() && "Enter the arresting agency (or “Unknown”)",
    v.arrestDate && v.arrestDate > new Date().toISOString().slice(0, 10) && "Arrest date can't be in the future",
    v.dockets.some((d) => !d.charges.length) && "Each docket needs at least one charge",
    v.dockets.some((d) => d.charges.some((c) => !c.description.trim())) && "Describe every charge (or write “Not sure”)",
  ].filter(Boolean) as string[];

/** Edits one arrest/case: multiple dockets per arrest, multiple charges per docket. */
export function CaseEditor({ v, setV, client = false }: { v: CaseDraft; setV: (v: CaseDraft) => void; client?: boolean }) {
  const exp = useExp();
  const j = exp.jurisdictions.find((x) => x.id === v.jurisdictionId);
  const upD = (id: string, fn: (d: Docket) => Docket) => setV({ ...v, dockets: v.dockets.map((d) => (d.id === id ? fn(d) : d)) });
  const pre = client ? "pc" : "sc";
  const [custom, setCustom] = useState(!v.localityId && !!v.locality);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField id={`${pre}-state`} label="State" required value={v.jurisdictionId} onChange={(e) => { const jj = exp.jurisdictions.find((x) => x.id === e.target.value)!; setCustom(false); setV({ ...v, jurisdictionId: jj.id, state: jj.state, localityId: undefined, locality: "" }); }} options={exp.jurisdictions.filter((x) => x.active).map((x) => [x.id, x.stateName] as [string, string])} />
        <div>
          <SelectField id={`${pre}-loc`} label={j?.localityLabel ?? "Parish / county"} required value={custom ? "__other" : v.localityId ?? ""} onChange={(e) => { const l = j?.localities.find((x) => x.id === e.target.value); setCustom(e.target.value === "__other"); setV({ ...v, localityId: l?.id, locality: l?.name ?? "" }); }} options={[["", `Choose a ${j?.localityLabel.toLowerCase() ?? "locality"}…`], ...(j?.localities ?? []).map((l) => [l.id, l.name] as [string, string]), ["__other", "Other / not listed"]]} />
          {custom && <input aria-label={`${j?.localityLabel ?? "Locality"} name`} value={v.locality} onChange={(e) => setV({ ...v, locality: e.target.value })} placeholder={`${j?.localityLabel ?? "Parish / county"} name`} className="mt-2 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink" />}
        </div>
        <TextField id={`${pre}-agency`} label="Arresting agency" required={!client} value={v.arrestingAgency} onChange={(e) => setV({ ...v, arrestingAgency: e.target.value })} placeholder={client ? "If you know it" : ""} />
        <TextField id={`${pre}-date`} label="Arrest date" type="date" value={v.arrestDate ?? ""} onChange={(e) => setV({ ...v, arrestDate: e.target.value || undefined })} />
        <TextField id={`${pre}-num`} label="Arrest or incident number" value={v.arrestNumber ?? ""} onChange={(e) => setV({ ...v, arrestNumber: e.target.value || undefined })} />
        <TextField id={`${pre}-ajur`} label="Arresting jurisdiction" value={v.arrestingJurisdiction ?? ""} onChange={(e) => setV({ ...v, arrestingJurisdiction: e.target.value || undefined })} />
      </div>
      <div className="space-y-3">
        {v.dockets.map((d, di) => (
          <fieldset key={d.id} className="rounded-2xl border border-line p-3.5">
            <legend className="px-1 text-[12.5px] font-semibold text-ink-2">Court case / docket {di + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
              <TextField id={`${pre}-court-${di}`} label="Court name" value={d.court} onChange={(e) => upD(d.id, (x) => ({ ...x, court: e.target.value }))} list={`${pre}-courts`} />
              <TextField id={`${pre}-docket-${di}`} label="Docket or case number" value={d.docketNumber} onChange={(e) => upD(d.id, (x) => ({ ...x, docketNumber: e.target.value }))} />
              {v.dockets.length > 1 && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setV({ ...v, dockets: v.dockets.filter((x) => x.id !== d.id) })}>Remove docket</Button>}
            </div>
            <datalist id={`${pre}-courts`}>{(j?.localities ?? []).flatMap((l) => l.courts).map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <ul className="mt-3 space-y-2">
              {d.charges.map((c, ci) => (
                <li key={c.id} className="rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-muted">Charge {ci + 1}{d.charges.length > 1 && <button type="button" aria-label={`Remove charge ${ci + 1}`} onClick={() => upD(d.id, (x) => ({ ...x, charges: x.charges.filter((y) => y.id !== c.id) }))} className="text-muted hover:text-danger"><Trash2 size={14} /></button>}</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField id={`${pre}-ch-${di}-${ci}`} label="Charge" required value={c.description} onChange={(e) => upD(d.id, (x) => ({ ...x, charges: x.charges.map((y) => (y.id === c.id ? { ...y, description: e.target.value } : y)) }))} />
                    <TextField id={`${pre}-st-${di}-${ci}`} label="Statute or article (if known)" value={c.statute ?? ""} onChange={(e) => upD(d.id, (x) => ({ ...x, charges: x.charges.map((y) => (y.id === c.id ? { ...y, statute: e.target.value || undefined } : y)) }))} />
                    <SelectField id={`${pre}-cl-${di}-${ci}`} label="Classification" value={c.classification ?? ""} onChange={(e) => upD(d.id, (x) => ({ ...x, charges: x.charges.map((y) => (y.id === c.id ? { ...y, classification: e.target.value || undefined } : y)) }))} options={[["", "Not sure"], ...(j?.classifications ?? []).map((x) => [x, x] as [string, string])]} />
                    <SelectField id={`${pre}-dp-${di}-${ci}`} label="Disposition" value={c.disposition} onChange={(e) => upD(d.id, (x) => ({ ...x, charges: x.charges.map((y) => (y.id === c.id ? { ...y, disposition: e.target.value as typeof c.disposition } : y)) }))} options={DISPOSITIONS.map((x) => [x, x])} />
                    {c.disposition === "Convicted" && <TextField id={`${pre}-cd-${di}-${ci}`} label="Conviction date" type="date" value={c.convictionDate ?? ""} onChange={(e) => upD(d.id, (x) => ({ ...x, charges: x.charges.map((y) => (y.id === c.id ? { ...y, convictionDate: e.target.value || undefined } : y)) }))} />}
                    {c.disposition !== "Convicted" && <TextField id={`${pre}-dd-${di}-${ci}`} label="Disposition date" type="date" value={c.dispositionDate ?? ""} onChange={(e) => upD(d.id, (x) => ({ ...x, charges: x.charges.map((y) => (y.id === c.id ? { ...y, dispositionDate: e.target.value || undefined } : y)) }))} />}
                    <TextField id={`${pre}-se-${di}-${ci}`} label="Sentence (if any)" value={c.sentence ?? ""} onChange={(e) => upD(d.id, (x) => ({ ...x, charges: x.charges.map((y) => (y.id === c.id ? { ...y, sentence: e.target.value || undefined } : y)) }))} />
                  </div>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={() => upD(d.id, (x) => ({ ...x, charges: [...x.charges, { id: uid("ch"), description: "", disposition: "Unknown" }] }))}>Add charge to this docket</Button>
          </fieldset>
        ))}
        <Button size="sm" icon={Plus} onClick={() => setV({ ...v, dockets: [...v.dockets, { id: uid("dk"), court: "", docketNumber: "", charges: [{ id: uid("ch"), description: "", disposition: "Unknown" }] }] })}>Add another docket for this arrest</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField id={`${pre}-sup`} label="Probation or parole" value={v.supervision ?? ""} onChange={(e) => setV({ ...v, supervision: e.target.value || undefined })} placeholder="e.g. completed in 2019" />
        <TriField id={`${pre}-done`} label="Sentence completed?" value={v.sentenceCompleted ?? "unknown"} onChange={(x) => setV({ ...v, sentenceCompleted: x })} />
        <SelectField id={`${pre}-fines`} label="Fines, restitution or court costs" value={v.obligations ?? "unknown"} onChange={(e) => setV({ ...v, obligations: e.target.value as CaseDraft["obligations"] })} options={[["unknown", "Not sure"], ["paid", "Paid in full"], ["outstanding", "Still owe some"], ["none", "None were owed"]]} />
      </div>
      <TextField id={`${pre}-res`} label="How was the case resolved? (dismissed, acquitted, diverted, set aside, other)" value={v.resolution ?? ""} onChange={(e) => setV({ ...v, resolution: e.target.value || undefined })} />
      <TextArea id={`${pre}-notes`} label="Additional notes" value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value || undefined })} />
      {j && !j.lastVerifiedAt && !client && <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">{j.stateName} rules haven&rsquo;t been verified by an administrator yet. Its checklist and classifications are configuration only; nothing is applied from another state.</p>}
    </div>
  );
}

export function useHashTab<T extends string>(keys: readonly T[], first: T): [T, (t: T) => void] {
  const [tab, setTab] = useState<T>(first);
  useEffect(() => {
    const h = window.location.hash.slice(1) as T;
    if (keys.includes(h)) setTab(h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [tab, (t: T) => { setTab(t); history.replaceState(null, "", `#${t}`); }];
}
