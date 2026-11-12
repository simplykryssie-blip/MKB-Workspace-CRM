"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mail, MessageSquareText, PenSquare, Search, Send, ShieldCheck } from "lucide-react";
import { Conversation } from "@/components/campaigns/TextInbox";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { fmtDateTime, relTime } from "@/lib/format";
import type { Client } from "@/lib/types";

type TextThread = { phone: string; name: string; contact: { type: string; id: string; href: string | null } | null; last: { body: string; direction: "in" | "out"; at: string; status: string }; unread: number };
type Row = { key: string; name: string; clientId?: string; phone?: string; lastAt: string; lastText: string; lastMine: boolean; unread: number; channels: Set<"portal" | "text"> };
type Item = { id: string; channel: "portal" | "text" | "email"; mine: boolean; body: string; at: string; by?: string; note?: string };
const phone10 = (p?: string) => (p ?? "").replace(/\D/g, "").slice(-10);
const CH = { portal: { label: "Portal", icon: ShieldCheck }, text: { label: "Text", icon: MessageSquareText }, email: { label: "Email", icon: Mail } } as const;

/**
 * One inbox for every way clients talk to MKB: secure portal messages, texts
 * and the emails the CRM sends. Client conversations combine all three;
 * texts from people who aren't clients (leads, unknown numbers) appear on
 * their own. Only clients this person can open are listed (server-checked).
 */
export function MessagesCenter() {
  const store = useClients();
  const team = useTeam();
  const canText = team.can("communication", "view");
  const [texts, setTexts] = useState<{ threads: TextThread[]; configured: boolean } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [q, setQ] = useState("");
  const [composing, setComposing] = useState(false);
  const loadTexts = useCallback(() => { if (BACKEND && canText) call<{ threads: TextThread[]; configured: boolean }>("GET", "/api/texts?brand=mkb").then(setTexts).catch(() => setTexts({ threads: [], configured: false })); }, [canText]);
  useEffect(() => { loadTexts(); const t = setInterval(loadTexts, 20_000); return () => clearInterval(t); }, [loadTexts]);
  useEffect(() => { const sp = new URLSearchParams(window.location.search); const c = sp.get("c"); const p = sp.get("phone"); if (c) setSel(`c:${c}`); else if (p) setSel(`p:${phone10(p)}`); }, []);

  const rows = useMemo<Row[]>(() => {
    const byClient = new Map<string, Row>();
    for (const c of store.clients) {
      const m = c.messages ?? [];
      if (!m.length) continue;
      const last = m[m.length - 1];
      byClient.set(c.id, { key: `c:${c.id}`, name: c.name, clientId: c.id, phone: phone10(c.phone), lastAt: last.at, lastText: last.body, lastMine: last.from === "staff", unread: m.filter((x) => x.from === "client" && !x.read).length, channels: new Set(["portal"]) });
    }
    const others: Row[] = [];
    for (const t of texts?.threads ?? []) {
      const cid = t.contact?.type === "client" ? t.contact.id : undefined;
      const client = cid ? store.clients.find((c) => c.id === cid) : undefined;
      if (client) {
        const cur = byClient.get(client.id) ?? { key: `c:${client.id}`, name: client.name, clientId: client.id, phone: t.phone, lastAt: "", lastText: "", lastMine: false, unread: 0, channels: new Set<"portal" | "text">() };
        cur.channels.add("text"); cur.unread += t.unread; cur.phone = t.phone;
        if (t.last.at > cur.lastAt) { cur.lastAt = t.last.at; cur.lastText = t.last.body; cur.lastMine = t.last.direction === "out"; }
        byClient.set(client.id, cur);
      } else if (!cid) {
        others.push({ key: `p:${t.phone}`, name: t.name, phone: t.phone, lastAt: t.last.at, lastText: t.last.body, lastMine: t.last.direction === "out", unread: t.unread, channels: new Set(["text"]) });
      }
    }
    return [...byClient.values(), ...others].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [store.clients, texts]);
  const unreadTotal = rows.reduce((s, r) => s + r.unread, 0);
  const shown = rows.filter((r) => filter === "all" || r.unread > 0).filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const selClient = sel?.startsWith("c:") ? store.clients.find((c) => c.id === sel.slice(2)) : undefined;
  const selPhone = sel?.startsWith("p:") ? sel.slice(2) : undefined;
  const pick = (key: string) => { setSel(key); setComposing(false); window.history.replaceState(null, "", key.startsWith("c:") ? `/messages?c=${encodeURIComponent(key.slice(2))}` : `/messages?phone=${key.slice(2)}`); };
  const back = () => { setSel(null); setComposing(false); window.history.replaceState(null, "", "/messages"); };
  const open = !!(selClient || selPhone || composing);

  return (
    <div>
      <PageHeader title="Messages" subtitle={unreadTotal ? `${unreadTotal} unread · portal messages, texts and emails in one place` : "Portal messages, texts and emails with clients — all in one place."} actions={<Button variant="primary" icon={PenSquare} onClick={() => { setSel(null); setComposing(true); }}>New message</Button>} />
      {texts && !texts.configured && <p className="mb-4 rounded-xl bg-warning-soft/60 px-4 py-2.5 text-[13px] text-warning-ink">Texting isn&rsquo;t connected yet — past texts still show here, but new texts can&rsquo;t be sent until Twilio is connected in Campaigns → Settings.</p>}
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className={open ? "hidden lg:block" : ""}>
          <Card>
            <div className="space-y-2 border-b border-line p-3">
              <label className="relative block">
                <span className="sr-only">Search conversations</span>
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
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
                {shown.map((r) => (
                  <li key={r.key}>
                    <button onClick={() => pick(r.key)} className={`flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-surface-2 ${sel === r.key ? "bg-accent-soft/50" : ""}`}>
                      <Avatar name={r.name} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-[14px] ${r.unread ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>{r.name}</span>
                          <span className="ml-auto shrink-0 text-[11.5px] text-muted">{r.lastAt ? relTime(r.lastAt) : ""}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          {[...r.channels].map((ch) => { const I = CH[ch].icon; return <I key={ch} size={12} className="shrink-0 text-faint" aria-label={CH[ch].label} />; })}
                          <span className="truncate text-[12.5px] text-muted">{r.lastMine ? "You: " : ""}{r.lastText}</span>
                          {!r.clientId && <span className="shrink-0 rounded bg-surface-2 px-1 text-[10.5px] text-muted">not a client</span>}
                          {r.unread > 0 && <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{r.unread}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className={open ? "" : "hidden lg:block"}>
          {open && <button onClick={back} className="mb-3 inline-flex items-center gap-1 text-[13.5px] font-medium text-accent lg:hidden"><ArrowLeft size={15} /> All conversations</button>}
          {selClient ? <ClientConversation key={selClient.id} c={selClient} canReadTexts={canText} canText={canText && !!texts?.configured} onTextChange={loadTexts} />
            : selPhone ? <Conversation key={selPhone} brand="mkb" phone={selPhone} base="/messages" canSend={team.can("communication", "edit")} onChange={loadTexts} />
            : composing ? (
              <Card className="p-5">
                <label className="block text-[13px] font-medium text-ink-2">Who are you writing to?
                  <select defaultValue="" onChange={(e) => e.target.value && pick(`c:${e.target.value}`)} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">
                    <option value="">Choose a client…</option>
                    {store.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <p className="mt-2 text-[12.5px] text-muted">To text someone who isn&rsquo;t a client yet, open them from Leads.</p>
              </Card>
            ) : <Card className="grid min-h-[300px] place-items-center p-10 text-center"><div><Mail size={26} className="mx-auto text-faint" /><p className="mt-2 text-[14px] text-muted">Choose a conversation.</p></div></Card>}
        </div>
      </div>
    </div>
  );
}

/** One client's portal messages, texts and emails in a single timeline; reply by portal or text. */
function ClientConversation({ c, canReadTexts, canText, onTextChange }: { c: Client; canReadTexts: boolean; canText: boolean; onTextChange: () => void }) {
  const store = useClients();
  const team = useTeam();
  const toast = useToast();
  const phone = phone10(c.phone);
  const [texts, setTexts] = useState<{ messages: { id: string; direction: "in" | "out"; body: string; status: string; at: string; by?: string }[]; optedOut: boolean } | null>(null);
  const [emails, setEmails] = useState<{ id: string; subject: string; at: string; status: string }[]>([]);
  const [channel, setChannel] = useState<"portal" | "text">("portal");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const canSend = team.can("communication", "edit") || team.can("crm", "edit");
  const loadTexts = useCallback(() => { if (BACKEND && canReadTexts && phone.length === 10) call<NonNullable<typeof texts>>("GET", `/api/texts/thread?brand=mkb&phone=${phone}`).then((r) => { setTexts(r); onTextChange(); }).catch(() => setTexts(null)); }, [canReadTexts, phone, onTextChange]);
  useEffect(() => { loadTexts(); if (BACKEND) call<{ emails: typeof emails }>("GET", `/api/clients/${c.id}/emails`).then((r) => setEmails(r.emails)).catch(() => setEmails([])); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const unread = (c.messages ?? []).some((m) => !m.read);
  useEffect(() => { if (unread) store.markMessagesRead(c.id); }, [unread, c.id, store]);

  const items = useMemo<Item[]>(() => [
    ...(c.messages ?? []).map((m): Item => ({ id: `p-${m.id}`, channel: "portal", mine: m.from === "staff", body: m.body, at: m.at, by: m.author })),
    ...(texts?.messages ?? []).map((m): Item => ({ id: `t-${m.id}`, channel: "text", mine: m.direction === "out", body: m.body, at: m.at, by: m.by, note: m.direction === "out" ? m.status : undefined })),
    ...emails.map((e): Item => ({ id: `e-${e.id}`, channel: "email", mine: true, body: e.subject, at: e.at, note: e.status === "sent" ? undefined : e.status })),
  ].sort((a, b) => a.at.localeCompare(b.at)), [c.messages, texts, emails]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [items.length]);

  const textBlocked = channel === "text" && (!canText || phone.length !== 10 || texts?.optedOut);
  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    if (channel === "portal") { store.sendMessage(c.id, body); setDraft(""); return; }
    setBusy(true);
    try { await call("POST", "/api/texts", { brand: "mkb", phone, body }); setDraft(""); loadTexts(); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't send the text", "info"); }
    setBusy(false);
  };

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className="min-w-0 flex-1"><Link href={`/clients/${c.id}`} className="block truncate text-[15px] font-semibold text-ink hover:text-accent">{c.name}</Link><span className="block text-[12.5px] text-muted">{[c.email, c.phone].filter(Boolean).join(" · ")}</span></span>
        {texts?.optedOut && <Badge tone="warning">Texts blocked (STOP)</Badge>}
        <Button size="sm" href={`/clients/${c.id}`}>Open profile</Button>
      </div>
      <div className="scrollbar-thin max-h-[60vh] min-h-[280px] space-y-3 overflow-y-auto bg-surface-2 px-4 py-4">
        {items.length === 0 && <p className="py-6 text-center text-[13.5px] text-muted">No messages yet. Start the conversation below.</p>}
        {items.map((m) => {
          const I = CH[m.channel].icon;
          if (m.channel === "email") return (
            <div key={m.id} className="flex justify-center"><span className="inline-flex max-w-[90%] items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted"><Mail size={12} /> Email sent: <span className="truncate text-ink-2">{m.body}</span> · {fmtDateTime(m.at)}{m.note ? ` · ${m.note}` : ""}</span></div>
          );
          return (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${m.mine ? "rounded-br-sm bg-accent text-white" : "rounded-bl-sm border border-line bg-surface text-ink"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 flex items-center gap-1 text-[11px] ${m.mine ? "text-white/75" : "text-faint"}`}><I size={11} /> {CH[m.channel].label} · {fmtDateTime(m.at)}{m.by ? ` · ${m.by}` : ""}{m.note && m.note !== "received" ? ` · ${m.note}` : ""}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {canSend && (
        <div className="space-y-2 border-t border-line p-3">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Send as">
            {(["portal", "text"] as const).map((ch) => { const I = CH[ch].icon; return <button key={ch} role="radio" aria-checked={channel === ch} onClick={() => setChannel(ch)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium ${channel === ch ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2"}`}><I size={13} /> {ch === "portal" ? "Portal message" : "Text"}</button>; })}
          </div>
          {textBlocked ? <p className="text-[12.5px] text-muted">{!canText ? "Texting isn't connected yet." : phone.length !== 10 ? "This client has no mobile number on file." : "They replied STOP, so texts are blocked until they text START."}</p> : (
            <div className="flex items-end gap-2">
              <textarea aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }} rows={2} placeholder={channel === "portal" ? `Portal message to ${c.contactName ?? c.name}…` : `Text to ${c.phone}…`} className="flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
              <Button variant="primary" icon={Send} disabled={!draft.trim() || busy} onClick={() => void send()}>Send</Button>
            </div>
          )}
          <p className="text-[11.5px] text-muted">{channel === "portal" ? "They're emailed that a new message is waiting in their secure portal." : "Sent from MKB's texting number. Don't text personal or financial details."}</p>
        </div>
      )}
    </Card>
  );
}
