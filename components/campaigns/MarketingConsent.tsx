"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { fmtDateTime } from "@/lib/format";
import type { Brand } from "@/lib/campaigns/config";

type Choice = { status: string; source: string; at?: string };
type Consent = { email: Choice; sms: Choice };
const LABEL: Record<string, [string, "success" | "warning" | "neutral" | "info"]> = {
  subscribed: ["Subscribed", "success"], unsubscribed: ["Unsubscribed", "warning"], allowed: ["Can receive (no opt-out)", "info"], none: ["Not subscribed", "neutral"],
};

/** A person's marketing email and text choices, on lead and client pages. */
export function MarketingConsentCard({ email, phone, brand = "mkb" }: { email?: string; phone?: string; brand?: Brand }) {
  const toast = useToast();
  const team = useTeam();
  const [c, setC] = useState<Consent | null>(null);
  const [rec, setRec] = useState<null | { channel: "email" | "sms"; status: "subscribed" | "unsubscribed" }>(null);
  const [note, setNote] = useState("");
  const load = useCallback(() => { if (BACKEND) call<Consent>("GET", `/api/marketing/consent?brand=${brand}&email=${encodeURIComponent(email ?? "")}&phone=${encodeURIComponent(phone ?? "")}`).then(setC).catch(() => {}); }, [brand, email, phone]);
  useEffect(() => { load(); }, [load]);
  if (!BACKEND || (!email && !phone)) return null;
  const can = team.can("leads", "edit");
  const save = async () => {
    if (!rec) return;
    try { await call("PUT", "/api/marketing/consent", { brand, channel: rec.channel, address: rec.channel === "email" ? email : phone, status: rec.status, note }); toast("Saved"); setRec(null); load(); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
  };
  const row = (channel: "email" | "sms", label: string, ch?: Choice, addr?: string) => {
    if (!addr || !ch) return null;
    const [l, tone] = LABEL[ch.status] ?? LABEL.none;
    return (
      <li className="flex flex-wrap items-center gap-2 px-5 py-3 sm:px-6">
        <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium text-ink">{label}</span><span className="block text-[12px] text-muted">{ch.source}{ch.at ? ` · ${fmtDateTime(ch.at)}` : ""}</span></span>
        <Badge tone={tone}>{l}</Badge>
        {can && (ch.status === "unsubscribed" || ch.status === "none"
          ? <Button size="sm" variant="ghost" onClick={() => { setNote(""); setRec({ channel, status: "subscribed" }); }}>Record consent</Button>
          : <Button size="sm" variant="ghost" onClick={() => { setNote(""); setRec({ channel, status: "unsubscribed" }); }}>Unsubscribe</Button>)}
      </li>
    );
  };
  return (
    <Card>
      <CardHeader icon={Megaphone} title="Marketing" subtitle="Campaign emails and texts. Service emails (intake links, receipts) aren't affected."
        action={phone && phone.replace(/\D/g, "").length >= 10 && team.can(brand === "monarch" ? "monarch" : "communication", "edit") ? <Button size="sm" href={`${brand === "monarch" ? "/monarch/texts" : "/texts"}?phone=${phone.replace(/\D/g, "").slice(-10)}`}>Text them</Button> : undefined} />
      {!c ? <p className="border-t border-line px-6 py-3 text-[13px] text-muted">Loading…</p> : <ul className="divide-y divide-line border-t border-line">{row("email", "Marketing emails", c.email, email)}{row("sms", "Marketing texts", c.sms, phone)}</ul>}
      <Modal open={!!rec} onClose={() => setRec(null)} title={rec?.status === "subscribed" ? "Record their consent" : "Unsubscribe them"}
        description={rec?.status === "subscribed" ? "Only when they agreed to hear from you — say how and when. Texts need clear permission to send marketing texts." : "They won't get campaign emails or texts on this channel."}
        footer={<><Button onClick={() => setRec(null)}>Cancel</Button><Button variant="primary" disabled={rec?.status === "subscribed" && note.trim().length < 4} onClick={() => void save()}>Save</Button></>}>
        <TextField label={rec?.status === "subscribed" ? "How did they agree?" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} placeholder={rec?.status === "subscribed" ? "e.g. Asked in person on Nov 12 to get tax tips" : "e.g. Asked by phone"} />
      </Modal>
    </Card>
  );
}
