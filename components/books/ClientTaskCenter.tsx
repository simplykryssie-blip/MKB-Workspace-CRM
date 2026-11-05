"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Download, ExternalLink, FileText, MessageSquare, Send, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { downloadPlaceholder } from "@/components/crm/dialogs";
import { staffById } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import { currentMonth, openTasks, useBooks, workspaceMessages } from "@/lib/store/books-store";
import { TASK_TYPE, periodLabel, type BooksMonth, type BooksWorkspace } from "@/lib/books/config";
import { fmtDate, fmtDateTime, relTime } from "@/lib/format";
import { CompleteTaskDialog } from "./BooksDialogs";

/** Plain-language month status for the client — no internal detail. */
function clientStatus(m: BooksMonth): { text: string; tone: "warning" | "info" | "success" } {
  switch (m.stage) {
    case "Client Entry in Progress":
      return { text: "Your turn — enter & submit", tone: "warning" };
    case "Client Follow-up Needed":
      return { text: "MKB has questions for you", tone: "warning" };
    case "Reports Ready":
      return { text: "Your reports are ready", tone: "success" };
    case "Month Closed":
      return { text: "Month closed", tone: "success" };
    default:
      return { text: "MKB is reviewing and reconciling", tone: "info" };
  }
}

export function ClientTaskCenter({ id }: { id: string }) {
  const books = useBooks();
  const clientStore = useClients();
  const toast = useToast();
  const w = books.workspaces.find((x) => x.id === id);
  const c = clientStore.clients.find((x) => x.id === w?.clientId);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  if (!w || !c) return <p className="py-20 text-center text-muted">Workspace not found.</p>;

  // Only this client's businesses — never another client's data.
  const mine = books.workspaces.filter((x) => x.clientId === c.id);
  const months = [...w.months].sort((a, b) => b.period.localeCompare(a.period));
  const tasks = openTasks(w).sort((a, b) => (a.type === "submit" ? 1 : 0) - (b.type === "submit" ? 1 : 0) || a.period.localeCompare(b.period));
  const done = w.tasks.filter((t) => t.status === "done").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 5);
  const reports = w.months.flatMap((m) => m.reports.filter((r) => r.delivery !== "not_delivered")).sort((a, b) => b.period.localeCompare(a.period));
  const msgs = workspaceMessages(w, c);
  const task = w.tasks.find((t) => t.id === taskId) ?? null;
  const entryMonths = w.months.filter((m) => m.stage === "Client Entry in Progress");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/60 px-4 py-2.5 text-[13px] text-accent-ink">
        <span className="font-semibold">Client portal preview</span> — what {c.contactName ?? c.name} sees for {w.businessName}. Internal MKB notes and review details are not shown.
        <Link href={`/services/bookkeeping/${w.id}#tasks`} className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline"><ArrowLeft size={14} /> Back to MKB workspace</Link>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <p className="text-[13px] text-muted">Hi {(c.contactName ?? c.name).split(" ")[0]},</p>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">{w.businessName} bookkeeping</h1>
        {mine.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Your businesses">
            {mine.map((x) => <Link key={x.id} href={`/services/bookkeeping/${x.id}/client`} aria-current={x.id === w.id ? "page" : undefined} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${x.id === w.id ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>{x.businessName}</Link>)}
          </div>
        )}
        <p className="mt-2 text-[13.5px] text-ink-2">You keep your books in QuickBooks; MKB reviews them, reconciles your accounts and sends your reports. Your bookkeeper is {staffById(w.bookkeeperId).name}.</p>
        <a href="https://qbo.intuit.com/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-[14px] font-semibold text-ink-2 hover:bg-surface-hover"><ExternalLink size={16} /> Open my QuickBooks</a>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {months.slice(0, 4).map((m) => {
            const s = clientStatus(m);
            return (
              <li key={m.id} className="rounded-xl border border-line p-3">
                <div className="text-[13.5px] font-semibold text-ink">{periodLabel(m.period)}</div>
                <div className="mt-1 [&>span]:whitespace-normal"><Badge tone={s.tone}>{s.text}</Badge></div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="What MKB needs from you" subtitle={tasks.length ? `${tasks.length} to do` : "You're all caught up"} />
            <ul className="divide-y divide-line border-t border-line">
              {tasks.length === 0 && <li className="flex items-center gap-2 px-6 py-6 text-[14px] text-success-ink"><CheckCircle2 size={18} /> Nothing to do right now.</li>}
              {tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                  <Circle size={20} className="shrink-0 text-line-strong" />
                  <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
                    <div className="text-[14.5px] font-medium text-ink">{t.title}</div>
                    {t.detail && <div className="text-[13px] text-ink-2">{t.detail}</div>}
                    <div className="text-[12px] text-muted">{periodLabel(t.period)} · {TASK_TYPE[t.type]}</div>
                  </div>
                  {t.type === "submit" ? (
                    <Button variant="primary" icon={Send} onClick={() => { books.completeTask(w.id, t.id, { by: "client" }); toast(`${periodLabel(t.period)} submitted to MKB`); }}>Submit month</Button>
                  ) : t.type === "entry" || t.type === "categorize" ? (
                    <Button onClick={() => { books.completeTask(w.id, t.id, { by: "client" }); toast("Marked done"); }}>Mark done</Button>
                  ) : (
                    <Button variant="primary" icon={t.type === "receipts" || t.type === "statement" ? UploadCloud : Send} onClick={() => setTaskId(t.id)}>{t.type === "receipts" || t.type === "statement" ? "Upload" : "Respond"}</Button>
                  )}
                </li>
              ))}
            </ul>
            {entryMonths.length > 0 && <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted sm:px-6">Submitting a month tells MKB your entries are complete. You can keep using QuickBooks as usual.</p>}
          </Card>
          {done.length > 0 && (
            <Card>
              <CardHeader title="Recently completed" />
              <ul className="px-5 pb-4 sm:px-6">
                {done.map((t) => <li key={t.id} className="flex items-center gap-2 py-1.5 text-[13.5px] text-muted"><CheckCircle2 size={15} className="text-success" /> <span className="flex-1">{t.title}</span><span className="text-[12px]">{t.completedAt ? relTime(t.completedAt) : ""}</span></li>)}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={FileText} title="Your reports" />
            <ul className="divide-y divide-line border-t border-line">
              {reports.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">Reports appear here when MKB delivers them.</li>}
              {reports.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{r.type}</span><span className="block text-[12px] text-muted">{periodLabel(r.period)}{r.deliveredAt ? ` · ${fmtDate(r.deliveredAt)}` : ""}</span></span>
                  <Button size="sm" variant="ghost" icon={Download} aria-label={`Download ${r.type} ${periodLabel(r.period)}`} onClick={() => downloadPlaceholder(`${w.businessName} ${r.type} ${r.period}`, "Placeholder — in Phase 3 this is the report from your QuickBooks company. No financial figures in the preview.\n")} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={MessageSquare} title="Messages with MKB" />
            <div className="scrollbar-thin max-h-[320px] space-y-2.5 overflow-y-auto border-y border-line bg-surface-2 px-4 py-3 sm:px-5">
              {msgs.length === 0 && <p className="py-4 text-center text-[13px] text-muted">No messages yet.</p>}
              {msgs.map((x) => (
                <div key={x.id} className={`flex ${x.from === "client" ? "justify-end" : ""}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13.5px] ${x.from === "client" ? "rounded-tr-md bg-accent text-white" : "rounded-tl-md border border-line bg-surface text-ink"}`}>
                    {x.body}
                    <div className={`mt-0.5 text-[11px] ${x.from === "client" ? "text-white/80" : "text-muted"}`}>{x.from === "client" ? "You" : x.author} · {fmtDateTime(x.at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-4 sm:px-5">
              <input aria-label="Message MKB" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message your bookkeeper…" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink" />
              <Button variant="primary" icon={Send} disabled={!msg.trim()} onClick={() => { clientStore.sendMessage(c.id, msg.trim(), "books", { from: "client", workspaceId: w.id }); setMsg(""); toast("Sent to MKB"); }}>Send</Button>
            </div>
          </Card>
        </div>
      </div>
      <CompleteTaskDialog w={w} task={task} by="client" onClose={() => setTaskId(null)} />
    </>
  );
}

