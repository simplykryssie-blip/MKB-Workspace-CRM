"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, FileSignature, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { BACKEND, call } from "@/lib/sync/remote";
import type { StaffOnboarding } from "@/lib/staff/onboarding-docs";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** A team member's onboarding documents (signed PDFs, uploaded tax form) and the identity confirmation that opens their access. */
export function StaffDocsCard({ id, name, canConfirm }: { id: string; name: string; canConfirm: boolean }) {
  const toast = useToast();
  const [s, setS] = useState<StaffOnboarding | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `/api/team/members/${id}/documents`;
  useEffect(() => { if (BACKEND) call<StaffOnboarding>("GET", path).then(setS).catch(() => setS(null)); }, [path]);
  if (!BACKEND || !s) return null;
  const signed = s.docs.filter((d) => d.done).length;
  const setIdentity = async (verified: boolean) => {
    setBusy(true);
    try { setS(await call<StaffOnboarding>("POST", path, { verified, note })); setNote(""); toast(verified ? "Identity confirmed" : "Confirmation removed"); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  return (
    <Card>
      <CardHeader icon={FileSignature} title="Onboarding documents" subtitle={!s.required ? "Not required for the Owner" : s.complete ? "Complete — access is open" : `${signed} of ${s.docs.length} done · access blocked until complete`} />
      <ul className="border-t border-line">
        {s.docs.map((d) => (
          <li key={d.key} className="flex items-center gap-3 border-b border-line px-5 py-2.5 text-[13.5px] last:border-0 sm:px-6">
            {d.done ? <CheckCircle2 size={16} className="shrink-0 text-success" /> : <Circle size={16} className="shrink-0 text-faint" />}
            <span className="min-w-0 flex-1"><span className="block text-ink">{d.title}</span><span className="block text-[12px] text-muted">{d.done ? `${d.kind === "upload" ? "Uploaded" : `Signed as "${d.done.name}"`} ${day(d.done.at)} · version ${d.done.version}` : d.required ? "Not done yet" : "Optional"}</span></span>
            {d.done && <a href={`/api/staff-onboarding/file/${d.done.id}`} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-accent hover:underline">Open</a>}
          </li>
        ))}
      </ul>
      {s.required && (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><ShieldCheck size={15} /> Identity {s.identity.verifiedAt ? <Badge tone="success">Confirmed</Badge> : <Badge tone="warning">Not confirmed</Badge>}</p>
          {s.identity.verifiedAt ? (
            <>
              <p className="mt-1 text-[12.5px] text-muted">Confirmed {day(s.identity.verifiedAt)} by {s.identity.verifiedBy}: {s.identity.note}</p>
              {canConfirm && <Button size="sm" className="mt-2" disabled={busy} onClick={() => { if (window.confirm(`Remove ${name}'s identity confirmation? Their access is blocked until it's confirmed again.`)) void setIdentity(false); }}>Remove confirmation</Button>}
            </>
          ) : canConfirm ? (
            <div className="mt-2 space-y-2">
              <p className="text-[12.5px] text-muted">Meet {name} on a live video call and check their government photo ID against their face and name. Then confirm here — this opens their access once their documents are signed.</p>
              <TextField label="How you confirmed it" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Video call Nov 20, checked passport" />
              <Button size="sm" variant="primary" disabled={busy || note.trim().length < 5} onClick={() => void setIdentity(true)}>Confirm identity</Button>
            </div>
          ) : <p className="mt-1 text-[12.5px] text-muted">Waiting for a manager to confirm.</p>}
        </div>
      )}
    </Card>
  );
}
