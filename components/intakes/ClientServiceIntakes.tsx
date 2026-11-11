"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Copy, Mail, ShieldCheck } from "lucide-react";
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
        : items.length ? <ServiceIntakeRows items={items} clientId={c.id} />
        : <p className="border-t border-line px-6 py-4 text-[13.5px] text-muted">None sent yet. They fill it in on their phone or computer, sign and submit — no login.</p>}
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
