"use client";

import { booksStage, STAGE_LABEL } from "@/lib/books/proposal";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { BOOKS_SECTIONS } from "@/lib/books/intake";
import { missingIn, sectionVisible } from "@/lib/tax/interview/engine";
import { relTime } from "@/lib/format";
import type { BooksIntake } from "@/lib/server/books-intake";
import { intakeHref } from "./BooksIntake";

/** Bookkeeping → Client intakes: start one for a client, continue, or set up their books from it. */
export function IntakesCard() {
  const toast = useToast();
  const team = useTeam();
  const { clients } = useClients();
  const [list, setList] = useState<BooksIntake[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (BACKEND) call<{ intakes: BooksIntake[] }>("GET", "/api/books/intakes").then((r) => setList(r.intakes)).catch(() => setList([])); }, []);
  const can = team.can("books", "edit");
  const options = useMemo(() => [...clients].sort((x, y) => Number(!!y.enrollments.some((e) => e.service === "books")) - Number(!!x.enrollments.some((e) => e.service === "books")) || x.name.localeCompare(y.name)), [clients]);
  if (!BACKEND) return null;
  const start = async () => {
    setBusy(true);
    try { const r = await call<{ intake: BooksIntake }>("POST", "/api/books/intakes", { clientId }); window.location.assign(intakeHref(r.intake.id)); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't start", "info"); setBusy(false); }
  };
  const progressOf = (i: BooksIntake) => { const v = BOOKS_SECTIONS.filter((s) => sectionVisible(s, i.answers)); return `${v.filter((s) => !missingIn(s, i.answers).length).length}/${v.length} sections`; };
  return (
    <div id="intakes" className="mb-5"><Card>
      <CardHeader icon={ClipboardList} title="Client intakes" subtitle="New bookkeeping clients: the intake (with them, or by private link), then your price review, then the proposal and engagement letter they sign." action={can ? <Button size="sm" variant="primary" icon={Plus} onClick={() => setPicking(true)}>New intake</Button> : undefined} />
      {!list ? <p className="border-t border-line px-6 py-4 text-[13px] text-muted">Loading…</p> : list.length === 0 ? <p className="border-t border-line px-6 py-4 text-[13.5px] text-muted">No intakes yet. Start one when a new bookkeeping client signs on.</p> : (
        <ul className="divide-y divide-line border-t border-line">
          {list.map((i) => (
            <li key={i.id}>
              <Link href={intakeHref(i.id)} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6">
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink">{(i.answers.legalName as string) || i.clientName}</span><span className="block text-[12px] text-muted">{i.status === "submitted" ? `Submitted ${relTime(i.submittedAt!)}` : `${progressOf(i)} · updated ${relTime(i.updatedAt)}`}</span></span>
                {(() => { const st = booksStage(i); return <Badge tone={st === "started" || st === "signed" ? "success" : st === "in_review" ? "warning" : "info"}>{st === "in_progress" ? (i.link?.state === "active" ? (i.link.openedAt ? "Client filling in" : "Link sent") : i.link?.state === "expired" ? "Link expired" : "In progress") : STAGE_LABEL[st]}</Badge>; })()}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Modal open={picking} onClose={() => setPicking(false)} title="New bookkeeping intake" description="Choose the client. Add them in Clients first if they're new." footer={<><Button onClick={() => setPicking(false)}>Cancel</Button><Button variant="primary" disabled={!clientId || busy} onClick={start}>Start intake</Button></>}>
        <label htmlFor="bi-client" className="mb-1 block text-[13px] font-medium text-ink-2">Client</label>
        <select id="bi-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">
          <option value="">Choose a client…</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}{c.enrollments.some((e) => e.service === "books") ? " (bookkeeping)" : ""}</option>)}
        </select>
      </Modal>
    </Card></div>
  );
}
