"use client";

import { useEffect, useState } from "react";
import { FileSignature } from "lucide-react";
import { LetterView } from "@/components/engagement/LetterView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TextField } from "@/components/ui/Field";
import { staffById } from "@/lib/sample/clients";
import { BACKEND, call } from "@/lib/sync/remote";
import { fmtDate } from "@/lib/format";

type Part = { version: number; title: string; body: string };
const METHOD = { in_office: "in the office", paper: "on a signed paper copy", online: "online" } as const;

export type Engagement = { version: number; termsVersion: number; acceptedName: string; acceptedAt: string; method: "in_office" | "paper" | "online"; recordedBy?: string };
export type Accept = { name: string; version: number; termsVersion: number; method: "in_office" | "paper" };

/** A service engagement letter: shown to the client and accepted (once) before MKB starts work. */
export function ServiceEngagementCard({ e, letterName, letterUrl, when, canRecord = true, onAccept }: { e?: Engagement; letterName: string; letterUrl: string; when: string; canRecord?: boolean; onAccept: (a: Accept) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader icon={FileSignature} title="Engagement letter" subtitle={e ? `Accepted by ${e.acceptedName} on ${fmtDate(e.acceptedAt)} ${METHOD[e.method]}` : when} action={e ? <Badge tone="success">Accepted</Badge> : <Button size="sm" variant="primary" disabled={!canRecord} onClick={() => setOpen(true)}>Record acceptance</Button>} />
      {e && <p className="px-5 pb-5 text-[12.5px] text-muted sm:px-6">{letterName} v{e.version} and standard terms v{e.termsVersion}{e.recordedBy ? ` · recorded by ${staffById(e.recordedBy).name}` : ""}. A signed copy is saved in the client's Documents.</p>}
      {open && <AcceptDialog letterUrl={letterUrl} onAccept={onAccept} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function AcceptDialog({ letterUrl, onAccept, onClose }: { letterUrl: string; onAccept: (a: Accept) => void; onClose: () => void }) {
  const toast = useToast();
  const [L, setL] = useState<{ letter: Part; terms: Part } | null>(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"in_office" | "paper">("in_office");
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    if (!BACKEND) { setL({ letter: { version: 1, title: "Business services engagement letter", body: "Sample letter — the live CRM shows the current wording from Settings." }, terms: { version: 1, title: "Standard terms", body: "Sample terms." } }); return; }
    call<{ letter: Part; terms: Part }>("GET", letterUrl).then(setL).catch(() => setErr("Couldn't load the engagement letter. It may still be saving — try again in a moment."));
  }, [letterUrl]);
  const ok = !!L && agreed && name.trim().length >= 2;
  return (
    <Modal open onClose={onClose} title="Engagement letter" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={() => { onAccept({ name: name.trim(), version: L!.letter.version, termsVersion: L!.terms.version, method }); toast("Engagement letter accepted"); onClose(); }}>Record acceptance</Button></>}>
      <div className="space-y-3">
        <p className="text-[13px] text-muted">Go over the letter with the client. Their typed name below is their acceptance; a signed copy is saved to their Documents.</p>
        {err && <p className="text-[13px] text-danger">{err}</p>}
        {!L && !err && <p className="text-[13px] text-muted">Loading…</p>}
        {L && (
          <div tabIndex={0} aria-label="Engagement letter text" className="scrollbar-thin max-h-[320px] space-y-6 overflow-y-auto rounded-xl border border-line bg-bg p-4">
            <LetterView title={L.letter.title} body={L.letter.body} version={L.letter.version} vars={{}} />
            <LetterView title={L.terms.title} body={L.terms.body} version={L.terms.version} vars={{}} />
          </div>
        )}
        <fieldset className="flex flex-wrap gap-4 text-[13.5px] text-ink">
          <legend className="sr-only">How the client accepted</legend>
          <label className="flex items-center gap-2"><input type="radio" checked={method === "in_office"} onChange={() => setMethod("in_office")} className="accent-[var(--accent)]" />In the office</label>
          <label className="flex items-center gap-2"><input type="radio" checked={method === "paper"} onChange={() => setMethod("paper")} className="accent-[var(--accent)]" />Signed paper copy</label>
        </fieldset>
        <label className="flex items-start gap-2 text-[13.5px] text-ink"><input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />The client read the engagement letter and standard terms and agreed to them.</label>
        <div className="max-w-sm"><TextField label="Client's full name (printed)" value={name} onChange={(e) => setName(e.target.value)} /></div>
      </div>
    </Modal>
  );
}
