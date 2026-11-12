"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Copy, Mail, Play, ShieldCheck } from "lucide-react";
import { NewRequestDialog } from "@/components/biz/BizDialogs";
import { bizPresetFrom, reliefFrom, type BizPreset } from "@/lib/intakes/from-intake";
import { useBiz } from "@/lib/store/biz-store";
import { useExp } from "@/lib/store/exp-store";
import type { Answers } from "@/lib/tax/interview/engine";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ServiceIntakeRows, type SvcItem } from "@/components/leads/LeadIntakes";
import { SERVICE_INTAKES, SERVICE_INTAKE_KINDS, type ServiceIntakeKind } from "@/lib/intakes/service";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import type { Client } from "@/lib/types";

/**
 * Client profile: send the payroll, Business Solutions or Record Relief intake by
 * private link, and follow each one (opened, submitted, signed PDF).
 */
export function ClientServiceIntakesCard({ c }: { c: Client }) {
  const toast = useToast();
  const team = useTeam();
  const [items, setItems] = useState<SvcItem[] | null>(null);
  const [sending, setSending] = useState<ServiceIntakeKind | null>(null);
  const [email, setEmail] = useState(c.email ?? "");
  const [busy, setBusy] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const biz = useBiz();
  const exp = useExp();
  const router = useRouter();
  const [preset, setPreset] = useState<BizPreset | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const answersOf = async (id: string) => (await call<{ intake: { answers: Answers; submittedAt?: string } }>("GET", `/api/service-intakes/${id}`)).intake;
  /** Business Solutions → pre-filled New request form. */
  const startRequest = async (x: SvcItem) => {
    setStarting(x.id);
    try { const it = await answersOf(x.id); setPreset(bizPresetFrom(x.id, c.id, it.answers, it.submittedAt)); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't open the intake", "info"); }
    setStarting(null);
  };
  /** Record Relief → matter with the client's details and one draft case per record (staff review each). */
  const openMatter = async (x: SvcItem) => {
    setStarting(x.id);
    try {
      const it = await answersOf(x.id);
      const f = reliefFrom(it.answers);
      // Each step must land in the store before the next one reads it.
      const settle = async (ok: () => boolean) => { for (let i = 0; i < 80 && !ok(); i++) await new Promise((res) => setTimeout(res, 25)); };
      const id = exp.createInquiry(c.id, "website", f.notes || undefined);
      await settle(() => exp.exists("matter", id));
      exp.linkIntake(id, x.id, f.intake);
      for (const k of f.cases) { const cid = exp.addCase(id, k, "client"); await settle(() => exp.exists("case", cid)); }
      toast(`Matter ${id} opened — ${f.cases.length} record${f.cases.length === 1 ? "" : "s"} to review`);
      router.push(`/services/record-expungement/matters/${encodeURIComponent(id)}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't open the intake", "info"); }
    setStarting(null);
  };
  const rowAction = (x: SvcItem) => {
    if (x.kind === "biz" && team.can("biz", "create")) {
      const r = biz.requests.find((q) => q.intakeId === x.id);
      return r ? <Button size="sm" icon={ArrowRight} href={`/services/business-services/requests/${encodeURIComponent(r.id)}`}>Open {r.number}</Button>
        : <Button size="sm" variant="primary" icon={Play} disabled={starting === x.id} onClick={() => void startRequest(x)}>Start request</Button>;
    }
    if (x.kind === "relief" && team.can("exp", "create")) {
      const m = exp.matters.find((q) => q.intakeId === x.id);
      return m ? <Button size="sm" icon={ArrowRight} href={`/services/record-expungement/matters/${encodeURIComponent(m.id)}`}>Open {m.number}</Button>
        : <Button size="sm" variant="primary" icon={Play} disabled={starting === x.id} onClick={() => void openMatter(x)}>Open matter</Button>;
    }
    return null;
  };
  const load = useCallback(() => { if (BACKEND) call<{ intakes: SvcItem[] }>("GET", `/api/clients/${c.id}/service-intakes`).then((r) => setItems(r.intakes)).catch(() => setItems([])); }, [c.id]);
  useEffect(() => { load(); }, [load]);
  if (!BACKEND) return null;
  const can = (k: ServiceIntakeKind) => team.can(SERVICE_INTAKES[k].module, "edit");
  const kinds = SERVICE_INTAKE_KINDS.filter(can);
  if (!kinds.length && !items?.length) return null;

  const send = async () => {
    if (!sending) return;
    setBusy(true);
    try {
      const r = await call<{ url: string; emailed: boolean }>("POST", `/api/clients/${c.id}/service-intakes`, { kind: sending, email });
      setSentUrl(r.url);
      toast(r.emailed ? `${SERVICE_INTAKES[sending].label} intake emailed to ${email}` : "Link created — the email is queued");
      load();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send", "info"); }
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader icon={ClipboardList} title="Service intakes" subtitle="Payroll, Business Solutions and Record Relief — sent by private link; the signed PDF lands in Documents."
        action={kinds.length ? <div className="flex flex-wrap justify-end gap-2">{kinds.map((k) => <Button key={k} size="sm" icon={Mail} onClick={() => { setSentUrl(null); setEmail(c.email ?? ""); setSending(k); }}>{SERVICE_INTAKES[k].label}</Button>)}</div> : undefined} />
      {items === null ? <p className="border-t border-line px-6 py-4 text-[13px] text-muted">Loading…</p>
        : items.length ? <ServiceIntakeRows items={items} clientId={c.id} action={rowAction} />
        : <p className="border-t border-line px-6 py-4 text-[13.5px] text-muted">None sent yet. They fill it in on their phone or computer, sign and submit — no login.</p>}
      {preset && preset.others.length > 0 && <p className="border-t border-line bg-warning-soft/40 px-6 py-3 text-[12.5px] text-ink-2">They also asked for: {preset.others.join(", ")}. Start a separate request for each after this one.</p>}
      <NewRequestDialog open={!!preset} onClose={() => setPreset(null)} preset={preset ?? undefined} onCreated={(id) => { setPreset(null); router.push(`/services/business-services/requests/${encodeURIComponent(id)}`); }} />
      <Modal open={!!sending} onClose={() => setSending(null)} title={sending ? `Send ${SERVICE_INTAKES[sending].label} intake` : ""} description="The client fills it in on their phone or computer, signs and submits — no portal login."
        footer={sentUrl ? <Button variant="primary" onClick={() => setSending(null)}>Done</Button> : <><Button onClick={() => setSending(null)}>Cancel</Button><Button variant="primary" icon={Mail} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email the intake"}</Button></>}>
        {sentUrl ? (
          <div className="space-y-3 text-[13.5px] text-ink-2">
            <p>Sent to <b>{email}</b>. The link works for 14 days and closes once they submit.</p>
            <p className="text-[12.5px] text-muted">Need to text it instead? Copy it now — it isn&rsquo;t shown again. Only send it to the client.</p>
            <Button size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(sentUrl).then(() => toast("Link copied"), () => toast("Couldn't copy", "info"))}>Copy link</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-[13px] font-medium text-ink-2">Client&rsquo;s email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" /></label>
            <p className="flex gap-2 text-[12.5px] text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />Private link: opens only this intake, expires in 14 days, closes once submitted. It asks no Social Security or account numbers — documents with those are requested as secure portal uploads.</p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
