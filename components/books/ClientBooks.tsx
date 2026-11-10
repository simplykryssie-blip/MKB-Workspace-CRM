"use client";

import { booksStage, STAGE_LABEL } from "@/lib/books/proposal";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ClipboardList, Mail, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useBooks } from "@/lib/store/books-store";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { BOOKS_SECTIONS } from "@/lib/books/intake";
import { missingIn, sectionVisible } from "@/lib/tax/interview/engine";
import { relTime, usd } from "@/lib/format";
import type { BooksIntake } from "@/lib/server/books-intake";
import type { Client } from "@/lib/types";
import { intakeHref } from "./BooksIntake";
import { StartWorkspace } from "./StartWorkspace";

/**
 * Bookkeeping from the client's own profile — the same steps as the Bookkeeping
 * center: start the intake (with the client, or by emailing them a private
 * link), then set up their bookkeeping workspace.
 */
function useClientBooks(c: Client) {
  const team = useTeam();
  const toast = useToast();
  const workspaces = useBooks().workspaces.filter((w) => w.clientId === c.id);
  const [intakes, setIntakes] = useState<BooksIntake[] | null>(BACKEND ? null : []);
  useEffect(() => {
    if (!BACKEND) return;
    let live = true;
    call<{ intakes: BooksIntake[] }>("GET", "/api/books/intakes").then((r) => live && setIntakes(r.intakes.filter((i) => i.clientId === c.id))).catch(() => live && setIntakes([]));
    return () => { live = false; };
  }, [c.id]);
  const [busy, setBusy] = useState(false);
  const can = team.can("books", "edit");
  const open = intakes?.find((i) => i.status === "in_progress");
  // A submitted intake that hasn't been turned into a workspace yet — setup starts from its reviewed price.
  const ready = intakes?.find((i) => i.status === "submitted" && !i.workspaceId);
  const signed = ready?.proposal?.status === "signed";
  /** Starts (or reopens) the client's intake and opens it; `send` opens the Send intake link window. */
  const startIntake = async (send = false) => {
    setBusy(true);
    try {
      const r = await call<{ intake: BooksIntake }>("POST", "/api/books/intakes", { clientId: c.id });
      window.location.assign(intakeHref(r.intake.id) + (send ? "?send=1" : ""));
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't start the intake", "info"); setBusy(false); }
  };
  return { workspaces, intakes, open, ready, signed, can, busy, startIntake };
}

const intakeBadge = (i: BooksIntake) => {
  const st = booksStage(i);
  if (st === "in_progress") return i.link?.state === "active" ? <Badge tone="info">{i.link.openedAt ? "Client filling in" : "Link sent"}</Badge> : i.link?.state === "expired" ? <Badge tone="warning">Link expired</Badge> : <Badge tone="warning">In progress</Badge>;
  return <Badge tone={st === "started" || st === "signed" ? "success" : st === "in_review" ? "warning" : "info"}>{STAGE_LABEL[st]}</Badge>;
};

const progressOf = (i: BooksIntake) => { const v = BOOKS_SECTIONS.filter((s) => sectionVisible(s, i.answers)); return `${v.filter((s) => !missingIn(s, i.answers).length).length} of ${v.length} sections`; };

/** The setup buttons: continue/start the intake, email the link, set up bookkeeping. */
function Actions({ c, b, onSetup, size = "sm" }: { c: Client; b: ReturnType<typeof useClientBooks>; onSetup: () => void; size?: "sm" }) {
  if (!b.can) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {BACKEND && (b.open ? (
        <Button size={size} icon={ClipboardList} href={intakeHref(b.open.id)}>Continue intake</Button>
      ) : !b.workspaces.length && !b.ready && (
        <>
          <Button size={size} icon={ClipboardList} disabled={b.busy} onClick={() => b.startIntake(false)}>Start intake</Button>
          <Button size={size} icon={Mail} disabled={b.busy || !c.email} title={c.email ? undefined : "Add the client's email first"} onClick={() => b.startIntake(true)}>Send intake link</Button>
        </>
      ))}
      {b.ready && !b.signed && <Button size={size} variant="primary" icon={ClipboardList} href={intakeHref(b.ready.id)}>{b.ready.proposal?.status === "sent" ? "View proposal" : "Review price & send proposal"}</Button>}
      {!b.workspaces.length && <Button size={size} variant={b.signed ? "primary" : "secondary"} icon={Plus} onClick={onSetup}>{b.signed ? "Set up bookkeeping (signed)" : "Set up bookkeeping"}</Button>}
    </div>
  );
}

function Setup({ c, b, open, onClose }: { c: Client; b: ReturnType<typeof useClientBooks>; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <StartWorkspace open intake={b.ready} clientId={c.id} onClose={onClose} onCreated={async (wsId) => {
      onClose();
      if (b.ready) await call("PUT", `/api/books/intakes/${b.ready.id}`, { workspaceId: wsId, rev: b.ready.rev }).catch(() => {});
      window.location.assign(`/services/bookkeeping/${wsId}`);
    }} />
  );
}

/** Overview card: shown once the client has bookkeeping (enrolled, an intake or a workspace). */
export function ClientBooksCard({ c }: { c: Client }) {
  const b = useClientBooks(c);
  const [setup, setSetup] = useState(false);
  const enrolled = c.enrollments.some((e) => e.service === "books");
  if (!enrolled && !b.workspaces.length && !b.intakes?.length) return null;
  return (
    <Card>
      <CardHeader icon={BookOpen} title="Bookkeeping" subtitle="Intake, then monthly bookkeeping" />
      <ul className="px-3 sm:px-4">
        {b.workspaces.map((w) => (
          <li key={w.id}>
            <Link href={`/services/bookkeeping/${w.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink">{w.businessName}</span><span className="block text-[12px] text-muted">{w.service.plan} · {usd(w.service.monthlyFee)}/mo</span></span>
              <Badge tone="success">Workspace</Badge>
            </Link>
          </li>
        ))}
        {(b.intakes ?? []).map((i) => (
          <li key={i.id}>
            <Link href={intakeHref(i.id)} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-hover">
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-ink">Intake{typeof i.answers.legalName === "string" && i.answers.legalName ? ` — ${i.answers.legalName}` : ""}</span><span className="block text-[12px] text-muted">{i.status === "submitted" ? `Submitted ${relTime(i.submittedAt!)}` : `${progressOf(i)} · updated ${relTime(i.updatedAt)}`}</span></span>
              {intakeBadge(i)}
            </Link>
          </li>
        ))}
        {b.intakes === null && <li className="px-2 py-2.5 text-[13px] text-muted">Loading…</li>}
        {b.intakes !== null && !b.workspaces.length && !b.intakes.length && <li className="px-2 py-2.5 text-[13px] text-muted">Not set up yet. Start with the intake — fill it in with the client, or email them a private link to do it themselves.</li>}
      </ul>
      <div className="px-5 pb-4 pt-1 sm:px-6"><Actions c={c} b={b} onSetup={() => setSetup(true)} /></div>
      <Setup c={c} b={b} open={setup} onClose={() => setSetup(false)} />
    </Card>
  );
}

/** For the Bookkeeping row on the Services tab, before the workspace exists. */
export function BooksEnrollmentActions({ c }: { c: Client }) {
  const b = useClientBooks(c);
  const [setup, setSetup] = useState(false);
  return (
    <>
      <span className="mr-auto text-[12px] text-muted">{b.signed ? "Proposal signed — set up their bookkeeping." : b.ready ? (b.ready.proposal?.status === "sent" ? "Proposal sent — waiting for the client's signature." : "Intake submitted — review the price and send the proposal.") : b.open ? "Intake in progress." : "Start with the intake, then review the price and send the proposal."}</span>
      <Actions c={c} b={b} onSetup={() => setSetup(true)} />
      <Setup c={c} b={b} open={setup} onClose={() => setSetup(false)} />
    </>
  );
}

/** Where the client is before their bookkeeping workspace exists (shown instead of a monthly-close stage). */
export function BooksOnboardingStage({ c }: { c: Client }) {
  const b = useClientBooks(c);
  if (b.intakes === null) return <>…</>;
  const latest = b.intakes.find((i) => !i.workspaceId) ?? null;
  if (!latest) return <>Not started — intake needed</>;
  const st = booksStage(latest);
  return <>{st === "in_progress" ? (latest.link?.state === "active" ? "Intake link sent" : "Intake in progress") : STAGE_LABEL[st]}</>;
}
