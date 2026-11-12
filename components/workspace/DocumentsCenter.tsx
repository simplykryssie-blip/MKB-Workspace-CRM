"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Download, FolderOpen, Lock, Search, Send, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { SERVICES } from "@/lib/sample-data";
import { docStatus } from "@/lib/status";
import { useClients } from "@/lib/store/clients-store";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND } from "@/lib/sync/remote";
import { fmtDate } from "@/lib/format";
import type { Client, ClientDocument, DocStatus, ServiceKey } from "@/lib/types";

type Row = { c: Client; d: ClientDocument };
const nowIso = () => new Date().toISOString();
const outstanding = (d: ClientDocument) => d.status === "requested" || d.status === "rejected";
/** The client's service for this document is marked urgent (and still open). */
const isUrgent = (r: Row) => r.c.enrollments.some((e) => e.urgent && e.service === r.d.service && e.status !== "complete" && e.status !== "cancelled");
const isOverdue = (r: Row) => outstanding(r.d) && !!r.d.dueAt && r.d.dueAt < nowIso();
/**
 * Most important first: urgent services, then overdue requests, then the
 * soonest due date, then everything else (newest first).
 */
function byImportance(a: Row, b: Row) {
  const rank = (r: Row) => (isUrgent(r) ? 0 : isOverdue(r) ? 1 : outstanding(r.d) && r.d.dueAt ? 2 : 3);
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (outstanding(a.d) && outstanding(b.d) && a.d.dueAt && b.d.dueAt && a.d.dueAt !== b.d.dueAt) return a.d.dueAt.localeCompare(b.d.dueAt);
  return (b.d.uploadedAt ?? b.d.requestedAt).localeCompare(a.d.uploadedAt ?? a.d.requestedAt);
}
type View = "review" | "requested" | "rejected" | "all";
const VIEWS: { key: View; label: string; test: (d: ClientDocument) => boolean }[] = [
  { key: "review", label: "To review", test: (d) => d.status === "received" },
  { key: "requested", label: "Waiting on clients", test: (d) => d.status === "requested" },
  { key: "rejected", label: "Needs re-upload", test: (d) => d.status === "rejected" },
  { key: "all", label: "All documents", test: () => true },
];

/**
 * Firm-wide Documents: every document for the clients this person can open
 * (the same list each client's Documents tab shows — the server decides which
 * clients load and checks every download). Review, send back or remind from here.
 */
export function DocumentsCenter() {
  const store = useClients();
  const team = useTeam();
  const toast = useToast();
  const [view, setView] = useState<View>("review");
  const [svc, setSvc] = useState<ServiceKey | "all">("all");
  const [q, setQ] = useState("");
  const canEdit = team.can("documents", "edit");

  const rows = useMemo<Row[]>(() => store.clients.flatMap((c) => (c.documents ?? []).map((d) => ({ c, d }))), [store.clients]);
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, rows.filter((r) => v.test(r.d)).length])) as Record<View, number>;
  const shown = rows
    .filter((r) => VIEWS.find((v) => v.key === view)!.test(r.d))
    .filter((r) => svc === "all" || r.d.service === svc)
    .filter((r) => !q.trim() || `${r.c.name} ${r.c.contactName ?? ""} ${r.d.name} ${r.d.category}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort(byImportance);

  const open = (r: Row) => {
    if (BACKEND && r.d.hasFile) { store.logDocumentAccess(r.c.id, r.d.id, "Viewed"); window.open(`/api/clients/${r.c.id}/files/${r.d.id}?inline=1`, "_blank", "noopener"); }
  };
  const setStatus = (r: Row, s: DocStatus, msg: string) => { store.setDocStatus(r.c.id, r.d.id, s); toast(msg); };

  return (
    <div>
      <PageHeader title="Documents" subtitle="Every client document in one place. Urgent services come first, then overdue requests, then the soonest due." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Document views">
        {VIEWS.map((v) => (
          <button key={v.key} role="tab" aria-selected={view === v.key} onClick={() => setView(v.key)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${view === v.key ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
            {v.label}<span className="rounded-full bg-surface-2 px-1.5 text-[11.5px] text-muted">{counts[v.key]}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search documents</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by client or document" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
        </label>
        <select aria-label="Service" value={svc} onChange={(e) => setSvc(e.target.value as ServiceKey | "all")} className="h-10 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">
          <option value="all">All services</option>
          {(Object.keys(SERVICES) as ServiceKey[]).map((k) => <option key={k} value={k}>{SERVICES[k].label}</option>)}
        </select>
      </div>

      {!store.ready ? <Card className="p-10 text-center text-muted">Loading…</Card> : shown.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderOpen size={26} className="mx-auto text-faint" />
          <p className="mt-2 text-[14px] text-muted">{view === "review" ? "Nothing waiting for review." : view === "requested" ? "No documents outstanding." : "No documents here."}</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {shown.slice(0, 300).map((r) => {
              const st = docStatus[r.d.status];
              return (
                <li key={`${r.c.id}-${r.d.id}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-ink">{r.d.name}</span>
                      {isUrgent(r) && <Badge tone="danger">Urgent</Badge>}
                      {r.d.sensitive && <Badge tone="neutral" icon={Lock}>Sensitive</Badge>}
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {outstanding(r.d) && r.d.dueAt && <Badge tone={isOverdue(r) ? "danger" : "neutral"}>{isOverdue(r) ? "Overdue · was due" : "Due"} {fmtDate(r.d.dueAt)}</Badge>}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-muted">
                      <Link href={`/clients/${r.c.id}#documents`} className="font-medium text-accent hover:underline">{r.c.name}</Link>
                      {" · "}{SERVICES[r.d.service]?.short ?? r.d.service}{r.d.taxYear ? ` ${r.d.taxYear}` : ""}{" · "}{r.d.category}
                      {" · "}{r.d.uploadedAt ? `uploaded ${fmtDate(r.d.uploadedAt)}${r.d.uploadedBy === "client" ? " by the client" : ""}` : `requested ${fmtDate(r.d.requestedAt)}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.d.hasFile && <Button size="sm" variant="ghost" icon={Download} onClick={() => open(r)}>Open</Button>}
                    {canEdit && r.d.status === "received" && <Button size="sm" variant="ghost" icon={CheckCircle2} onClick={() => setStatus(r, "reviewed", "Marked reviewed")}>Reviewed</Button>}
                    {canEdit && r.d.status === "received" && <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setStatus(r, "rejected", "Sent back — the client will be asked to upload it again")}>Send back</Button>}
                    {canEdit && outstanding(r.d) && (
                      <label className="inline-flex items-center gap-1 text-[12px] text-muted">
                        <span className="sr-only">Due date for {r.d.name}</span>
                        <input type="date" value={r.d.dueAt ? r.d.dueAt.slice(0, 10) : ""} onChange={(e) => { store.setDocDue(r.c.id, r.d.id, e.target.value ? new Date(`${e.target.value}T17:00:00`).toISOString() : undefined); toast(e.target.value ? "Due date changed" : "Due date removed"); }} className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink" />
                      </label>
                    )}
                    {canEdit && (r.d.status === "requested" || r.d.status === "rejected") && <Button size="sm" variant="ghost" icon={Send} onClick={() => void store.remindDocument(r.c.id, r.d.id).then((ok) => ok && toast(`Reminder emailed to ${r.c.contactName ?? r.c.name}`))}>Remind</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
          {shown.length > 300 && <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Showing the newest 300 — search or filter to narrow it down.</p>}
        </Card>
      )}
    </div>
  );
}
