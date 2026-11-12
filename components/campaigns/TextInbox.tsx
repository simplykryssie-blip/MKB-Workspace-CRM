"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageSquareText, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { fmtDateTime, relTime } from "@/lib/format";
import { BRANDS, fmtPhone, smsSegments, type Brand } from "@/lib/campaigns/config";

type Thread = { phone: string; name: string; contact: { type: string; id: string; href: string | null } | null; last: { body: string; direction: "in" | "out"; at: string; status: string }; unread: number };
type Convo = { phone: string; name: string; contact: Thread["contact"]; optedOut: boolean; consent: { status: string; source: string; at: string } | null; messages: { id: string; direction: "in" | "out"; body: string; status: string; error: string | null; at: string; by?: string }[] };
const STATUS: Record<string, string> = { queued: "Sending", sending: "Sending", sent: "Sent", delivered: "Delivered", undelivered: "Not delivered", failed: "Failed", received: "" };

/** Two-way texting for one brand's number. */
export function TextInbox({ brand }: { brand: Brand }) {
  const team = useTeam();
  const router = useRouter();
  const sp = useSearchParams();
  const phone = sp.get("phone") ?? "";
  const base = brand === "monarch" ? "/monarch/texts" : "/texts";
  const [list, setList] = useState<{ threads: Thread[]; unread: number; configured: boolean; simulated: boolean } | null>(null);
  const [starting, setStarting] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const load = useCallback(() => { if (BACKEND) call<NonNullable<typeof list>>("GET", `/api/texts?brand=${brand}`).then(setList).catch(() => {}); }, [brand]);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);
  if (!BACKEND) return <PageHeader title="Text inbox" subtitle="Texting works with the live backend only." />;
  const canSend = team.can(brand === "monarch" ? "monarch" : "communication", "edit");
  const open = (p: string) => router.push(`${base}?phone=${p}`);

  return (
    <>
      <PageHeader title={brand === "monarch" ? "Monarch text inbox" : "Text inbox"} subtitle={`Texts to and from ${BRANDS[brand].label}'s number. Replies show here and on the person's record.`}
        actions={canSend && <Button variant="primary" icon={Plus} onClick={() => { setNewPhone(""); setStarting(true); }}>New text</Button>} />
      {list && !list.configured && <p className="mb-4 rounded-xl bg-warning-soft/60 px-4 py-2.5 text-[13px] text-warning-ink">{list.simulated ? "Test mode: texts are recorded here but not really sent. " : ""}Texting isn't connected yet — add your Twilio account and this brand's number in {brand === "monarch" ? "Monarch " : ""}Campaigns → Settings.</p>}
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className={phone ? "hidden lg:block" : ""}>
          {!list ? <p className="p-6 text-center text-[13px] text-muted">Loading…</p> : !list.threads.length ? (
            <div className="p-8 text-center"><MessageSquareText className="mx-auto text-faint" size={28} /><p className="mt-2 text-[14px] font-semibold text-ink">No texts yet</p><p className="text-[13px] text-muted">When someone texts your number, the conversation shows up here.</p></div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-line overflow-auto">
              {list.threads.map((t) => (
                <li key={t.phone}>
                  <button onClick={() => open(t.phone)} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover ${t.phone === phone ? "bg-accent-soft/50" : ""}`}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className={`truncate text-[14px] ${t.unread ? "font-bold text-ink" : "font-medium text-ink"}`}>{t.name}</span>{t.unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{t.unread}</span>}</span>
                      <span className="block truncate text-[12.5px] text-muted">{t.last.direction === "out" ? "You: " : ""}{t.last.body}</span>
                    </span>
                    <span className="shrink-0 text-[11.5px] text-faint">{relTime(t.last.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {phone ? <Conversation key={phone} brand={brand} phone={phone} base={base} canSend={canSend} onChange={load} /> : <Card className="hidden place-items-center p-10 text-center text-[13.5px] text-muted lg:grid">Choose a conversation.</Card>}
      </div>
      <Modal open={starting} onClose={() => setStarting(false)} title="New text" description="Start a conversation with someone you already work with. For marketing to many people at once, use a text campaign instead."
        footer={<><Button onClick={() => setStarting(false)}>Cancel</Button><Button variant="primary" disabled={newPhone.replace(/\D/g, "").length < 10} onClick={() => { setStarting(false); open(newPhone.replace(/\D/g, "").slice(-10)); }}>Continue</Button></>}>
        <TextField label="Mobile number" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(318) 555-0123" />
      </Modal>
    </>
  );
}

export function Conversation({ brand, phone, base, canSend, onChange }: { brand: Brand; phone: string; base: string; canSend: boolean; onChange: () => void }) {
  const toast = useToast();
  const [c, setC] = useState<Convo | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(() => call<Convo>("GET", `/api/texts/thread?brand=${brand}&phone=${phone}`).then((r) => { setC(r); onChange(); }).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load", "info")), [brand, phone, onChange, toast]);
  useEffect(() => { void load(); const t = setInterval(() => void call<Convo>("GET", `/api/texts/thread?brand=${brand}&phone=${phone}`).then(setC).catch(() => {}), 15_000); return () => clearInterval(t); }, [load, brand, phone]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [c?.messages.length]);
  const send = async () => {
    setBusy(true);
    try { const r = await call<Convo>("POST", "/api/texts", { brand, phone, body }); setC(r); setBody(""); onChange(); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't send", "info"); }
    setBusy(false);
  };
  const seg = smsSegments(body);
  if (!c) return <Card className="p-8 text-center text-[13px] text-muted">Loading…</Card>;
  return (
    <Card className="flex min-h-[60vh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Link href={base} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-hover lg:hidden" aria-label="Back to conversations"><ArrowLeft size={18} /></Link>
        <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold text-ink">{c.name}</span><span className="block text-[12.5px] text-muted">{fmtPhone(c.phone)}{c.contact ? ` · ${c.contact.type === "office" ? "Firm" : c.contact.type[0].toUpperCase() + c.contact.type.slice(1)}` : ""}</span></span>
        {c.optedOut ? <Badge tone="warning">Opted out (STOP)</Badge> : c.consent?.status === "subscribed" ? <Badge tone="success">Opted in to marketing texts</Badge> : null}
        {c.contact?.href && <Button size="sm" href={c.contact.href}>Open record</Button>}
      </div>
      <div className="flex-1 space-y-2 overflow-auto bg-surface-2 px-4 py-4" style={{ maxHeight: "60vh" }}>
        {!c.messages.length && <p className="text-center text-[13px] text-muted">No messages yet — say hello below.</p>}
        {c.messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${m.direction === "out" ? "rounded-br-sm bg-accent text-white" : "rounded-bl-sm border border-line bg-surface text-ink"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[11px] ${m.direction === "out" ? "text-white/75" : "text-faint"}`} title={m.error ?? ""}>{fmtDateTime(m.at)}{m.by ? ` · ${m.by}` : ""}{m.direction === "out" && STATUS[m.status] ? ` · ${STATUS[m.status]}` : ""}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {canSend && (c.optedOut ? <p className="border-t border-line px-4 py-3 text-[13px] text-muted">They replied STOP, so texts to this number are blocked. If they text START, you can reply again.</p> : (
        <div className="border-t border-line p-3">
          <textarea aria-label="Reply" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) void send(); }} rows={3} placeholder="Write a reply…" className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" />
          <div className="mt-2 flex items-center gap-2"><span className="mr-auto text-[12px] text-muted">{seg.length} characters · {seg.segments} text{seg.segments > 1 ? "s" : ""} billed{!seg.plain ? " (emoji/special characters use more)" : ""}</span><Button variant="primary" icon={Send} disabled={busy || !body.trim()} onClick={() => void send()}>{busy ? "Sending…" : "Send"}</Button></div>
        </div>
      ))}
    </Card>
  );
}
