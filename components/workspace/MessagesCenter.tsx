"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, PenSquare, Search } from "lucide-react";
import { MessagesTab } from "@/components/crm/ProfileTabs";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useClients } from "@/lib/store/clients-store";
import { relTime } from "@/lib/format";
import type { Client } from "@/lib/types";

type Thread = { c: Client; last?: Client["messages"][number]; unread: number };

/**
 * Firm-wide Messages: one inbox of the secure portal conversations for the
 * clients this person can open (the server decides which clients load).
 * Opening a conversation shows the same thread as the client's Messages tab.
 */
export function MessagesCenter() {
  const store = useClients();
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [q, setQ] = useState("");
  const [composing, setComposing] = useState(false);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("c"); if (id) setSel(id); }, []);

  const threads = useMemo<Thread[]>(() => store.clients
    .filter((c) => (c.messages ?? []).length)
    .map((c) => { const msgs = c.messages; return { c, last: msgs[msgs.length - 1], unread: msgs.filter((m) => m.from === "client" && !m.read).length }; })
    .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? "")), [store.clients]);
  const unreadTotal = threads.reduce((s, t) => s + t.unread, 0);
  const shown = threads
    .filter((t) => filter === "all" || t.unread > 0)
    .filter((t) => !q.trim() || `${t.c.name} ${t.c.contactName ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const selected = store.clients.find((c) => c.id === sel);
  const pick = (id: string) => { setSel(id); setComposing(false); window.history.replaceState(null, "", `/messages?c=${encodeURIComponent(id)}`); };
  const back = () => { setSel(null); window.history.replaceState(null, "", "/messages"); };

  return (
    <div>
      <PageHeader title="Messages" subtitle={unreadTotal ? `${unreadTotal} unread from clients` : "Secure messages with clients — they see these in their portal."} actions={<Button variant="primary" icon={PenSquare} onClick={() => { setComposing(true); setSel(null); }}>New message</Button>} />
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className={selected || composing ? "hidden lg:block" : ""}>
          <Card>
            <div className="space-y-2 border-b border-line p-3">
              <label className="relative block">
                <span className="sr-only">Search conversations</span>
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
              </label>
              <div className="flex gap-1.5">
                {(["all", "unread"] as const).map((f) => (
                  <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${filter === f ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2"}`}>{f === "all" ? "All" : `Unread (${unreadTotal})`}</button>
                ))}
              </div>
            </div>
            {!store.ready ? <p className="p-6 text-center text-[13.5px] text-muted">Loading…</p> : shown.length === 0 ? (
              <p className="p-6 text-center text-[13.5px] text-muted">{filter === "unread" ? "You're all caught up." : "No conversations yet."}</p>
            ) : (
              <ul className="scrollbar-thin max-h-[70vh] divide-y divide-line overflow-y-auto">
                {shown.map((t) => (
                  <li key={t.c.id}>
                    <button onClick={() => pick(t.c.id)} className={`flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-surface-2 ${sel === t.c.id ? "bg-accent-soft/50" : ""}`}>
                      <Avatar name={t.c.name} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-[14px] ${t.unread ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>{t.c.name}</span>
                          <span className="ml-auto shrink-0 text-[11.5px] text-muted">{t.last ? relTime(t.last.at) : ""}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="truncate text-[12.5px] text-muted">{t.last ? `${t.last.from === "staff" ? "You: " : ""}${t.last.body}` : ""}</span>
                          {t.unread > 0 && <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{t.unread}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className={selected || composing ? "" : "hidden lg:block"}>
          {(selected || composing) && <button onClick={() => { back(); setComposing(false); }} className="mb-3 inline-flex items-center gap-1 text-[13.5px] font-medium text-accent lg:hidden"><ArrowLeft size={15} /> All conversations</button>}
          {selected ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Link href={`/clients/${selected.id}`} className="text-[15px] font-semibold text-ink hover:text-accent">{selected.name}</Link><Link href={`/clients/${selected.id}`} className="text-[13px] text-accent">Open profile</Link></div>
              <MessagesTab key={selected.id} c={selected} />
            </div>
          ) : composing ? (
            <Card className="p-5">
              <label className="block text-[13px] font-medium text-ink-2">Who are you writing to?
                <select defaultValue="" onChange={(e) => e.target.value && pick(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">
                  <option value="">Choose a client…</option>
                  {store.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </Card>
          ) : (
            <Card className="grid min-h-[300px] place-items-center p-10 text-center"><div><Mail size={26} className="mx-auto text-faint" /><p className="mt-2 text-[14px] text-muted">Choose a conversation.</p></div></Card>
          )}
        </div>
      </div>
    </div>
  );
}
