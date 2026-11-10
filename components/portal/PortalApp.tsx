"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, ChevronRight, ClipboardList, CreditCard, Download, Eye, FileText, Home, Inbox, Loader2, Lock, LogOut, MessageSquare, PenLine, Receipt, Send, Upload,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/* The client portal: the client's own services, to-dos, documents, invoices and messages. The server checks everything. */

class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  const r = await fetch(path, { method, credentials: "same-origin", headers: method === "GET" ? undefined : { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
  const data = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (r.status === 401) { window.location.assign("/portal/login"); throw new ApiError("Please sign in.", 401); }
  if (!r.ok) throw new ApiError(data.error ?? "Something went wrong. Please try again.", r.status);
  return data;
}
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" }) : "");
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

type Me = { client: { name: string; firstName: string; type: string; email: string }; unread: number };
type Todo = { id: string; kind: "tax_interview" | "books_intake" | "proposal" | "upload" | "books_task" | "pay"; title: string; detail?: string; service: string; ref: string; extra?: { taskId?: string; type?: string; period?: string } };
type Home = Me & { services: { service: string; name: string; title: string; status: string; detail?: string }[]; todos: Todo[] };
type Doc = { id: string; name: string; service: string; serviceName: string; category?: string; taxYear?: number; requestedAt?: string; uploadedAt?: string; uploadedBy?: string; status: string; hasFile: boolean };
type Invoice = { id: string; number: string; description: string; service: string; issuedAt: string; dueAt: string; amount: number; paid: number; owed: number; status: string; bankProduct: boolean };
type Msg = { id: string; from: "staff" | "client"; author: string; body: string; at: string; service?: string };

const TABS = [
  { key: "home", label: "Home", icon: Home },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "messages", label: "Messages", icon: MessageSquare },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const tabFromHash = (): TabKey => { const h = window.location.hash.slice(1); return (TABS.some((t) => t.key === h) ? h : "home") as TabKey; };

export function PortalApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTabState] = useState<TabKey>("home");
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const refreshMe = useCallback(() => api<Me>("/api/portal/me").then(setMe).catch((e) => { if (!(e instanceof ApiError && e.status === 401)) setErr(errMsg(e)); }), []);
  useEffect(() => {
    setTabState(tabFromHash());
    void refreshMe();
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onHash);
    const t = setInterval(() => { if (document.visibilityState === "visible") void refreshMe(); }, 60_000);
    // Back from Stripe Checkout.
    const q = new URLSearchParams(window.location.search);
    if (q.get("paid")) { toast(`Thank you! Your payment for invoice ${q.get("paid")} is being processed.`); window.history.replaceState(null, "", `/portal${window.location.hash}`); }
    return () => { window.removeEventListener("hashchange", onHash); clearInterval(t); };
  }, [refreshMe, toast]);
  const go = (k: TabKey) => { window.history.replaceState(null, "", k === "home" ? "/portal" : `/portal#${k}`); setTabState(k); window.scrollTo({ top: 0 }); };
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {}); window.location.assign("/portal/login"); };

  if (err) return <Center><AlertCircle className="mx-auto text-danger" /><p className="mt-2 text-[14px] text-ink-2">{err}</p><Button className="mt-4" onClick={() => window.location.reload()}>Try again</Button></Center>;
  if (!me) return <Center><Loader2 className="mx-auto animate-spin text-muted" /><p className="sr-only">Loading</p></Center>;

  return (
    <div className="min-h-screen bg-bg pb-24 sm:pb-10">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mkb-monogram.webp" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-ink">MKB Financial Group</p>
            <p className="truncate text-[12px] text-muted">Client portal · {me.client.name}</p>
          </div>
          <Button size="sm" variant="ghost" icon={LogOut} onClick={signOut}>Sign out</Button>
        </div>
        <nav aria-label="Portal" className="mx-auto hidden max-w-4xl gap-1 px-4 sm:flex">
          {TABS.map((t) => <TabButton key={t.key} t={t} active={tab === t.key} badge={t.key === "messages" ? me.unread : 0} onClick={() => go(t.key)} />)}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {tab === "home" && <HomeTab go={go} onChange={refreshMe} />}
        {tab === "documents" && <DocumentsTab />}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "messages" && <MessagesTab onRead={refreshMe} />}
        <p className="mt-10 text-center text-[12px] text-muted"><Lock size={11} className="mr-1 inline" />Your information is encrypted and private. Questions? Send us a message or call MKB Financial Group.</p>
      </main>
      {/* Phone: bottom tab bar */}
      <nav aria-label="Portal" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => go(t.key)} aria-current={tab === t.key ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${tab === t.key ? "text-accent" : "text-muted"}`}>
            <t.icon size={20} />{t.label}
            {t.key === "messages" && me.unread > 0 && <span className="absolute right-[calc(50%-20px)] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">{me.unread}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TabButton({ t, active, badge, onClick }: { t: (typeof TABS)[number]; active: boolean; badge: number; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] font-semibold ${active ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
      <t.icon size={16} />{t.label}
      {badge > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] text-white">{badge}</span>}
    </button>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => <div className="grid min-h-screen place-items-center bg-bg px-4 text-center"><div>{children}</div></div>;
const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="mb-6">
    <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">{title}</h2>{action}</div>
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">{children}</div>
  </section>
);
const Row = ({ children }: { children: React.ReactNode }) => <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-nowrap">{children}</div>;
const Empty = ({ icon: Icon, children }: { icon: typeof Inbox; children: React.ReactNode }) => <div className="px-4 py-8 text-center text-[14px] text-muted"><Icon size={24} className="mx-auto mb-2 text-muted" />{children}</div>;
function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api<T>(path).then((d) => { setData(d); setErr(null); }).catch((e) => setErr(errMsg(e))), [path]);
  useEffect(() => { void load(); }, [load]);
  return { data, err, load };
}
const Loading = ({ err }: { err: string | null }) => <div className="py-16 text-center text-[14px] text-muted">{err ? <><AlertCircle className="mx-auto mb-2 text-danger" />{err}</> : <Loader2 className="mx-auto animate-spin" />}</div>;

/* ---------------------------------------------------------------- home */
function HomeTab({ go, onChange }: { go: (k: TabKey) => void; onChange: () => void }) {
  const { data, err, load } = useLoad<Home>("/api/portal/home");
  if (!data) return <Loading err={err} />;
  const reload = () => { void load(); onChange(); };
  return (
    <>
      <h1 className="text-[24px] font-bold tracking-tight text-ink">Hi, {data.client.firstName}</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">{data.todos.length ? `You have ${data.todos.length} item${data.todos.length === 1 ? "" : "s"} to take care of.` : "You're all caught up — nothing needs your attention right now."}</p>
      {data.unread > 0 && (
        <button onClick={() => go("messages")} className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-left">
          <MessageSquare size={18} className="shrink-0 text-accent" /><span className="flex-1 text-[14px] font-semibold text-accent-ink">You have {data.unread} new message{data.unread === 1 ? "" : "s"} from MKB</span><ChevronRight size={18} className="text-accent" />
        </button>
      )}
      <Section title="Your to-do list">
        {data.todos.length ? data.todos.map((t) => <TodoRow key={t.id} t={t} onDone={reload} />) : <Empty icon={CheckCircle2}>Nothing to do right now. We&rsquo;ll email you when we need something.</Empty>}
      </Section>
      <Section title="Your services">
        {data.services.length ? data.services.map((s, i) => (
          <Row key={i}>
            <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-semibold text-ink">{s.title}</span><span className="block text-[12.5px] text-muted">{s.name}{s.detail ? ` · ${s.detail}` : ""}</span></span>
            <Badge tone={statusTone(s.status)}>{s.status}</Badge>
          </Row>
        )) : <Empty icon={ClipboardList}>Your services will show here once MKB sets them up.</Empty>}
      </Section>
    </>
  );
}
const statusTone = (s: string): Tone => (/complete|accepted|closed|ready$|reports ready/i.test(s) ? "success" : /your|need|waiting on your|signature|attention|questions/i.test(s) ? "warning" : "info");

const TODO_ICON = { tax_interview: ClipboardList, books_intake: ClipboardList, proposal: PenLine, upload: Upload, books_task: ClipboardList, pay: CreditCard } as const;

function TodoRow({ t, onDone }: { t: Todo; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const Icon = TODO_ICON[t.kind];
  const start = async () => {
    setBusy(true);
    try { const r = await api<{ url: string }>("/api/portal/start", "POST", { kind: t.kind, id: t.ref }); window.location.assign(r.url); }
    catch (e) { toast(errMsg(e), "info"); setBusy(false); }
  };
  const pay = async () => {
    setBusy(true);
    try { const r = await api<{ url: string }>(`/api/portal/invoices/${t.ref}/pay`, "POST"); window.location.assign(r.url); }
    catch (e) { toast(errMsg(e), "info"); setBusy(false); }
  };
  const complete = async () => {
    setBusy(true);
    try { await api(`/api/portal/tasks/${t.ref}/${t.extra?.taskId}`, "POST", { response: note }); toast("Thank you — MKB has been notified."); onDone(); }
    catch (e) { toast(errMsg(e), "info"); setBusy(false); }
  };
  const confirm = t.extra?.type === "confirm" || t.extra?.type === "question";
  return (
    <div className="border-b border-line px-4 py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning-ink"><Icon size={17} /></span>
        <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-semibold text-ink">{t.title}</span>{t.detail && <span className="block text-[12.5px] text-muted">{t.detail}</span>}</span>
        <span className="ml-12 sm:ml-0">
          {(t.kind === "tax_interview" || t.kind === "books_intake") && <Button size="sm" variant="primary" disabled={busy} onClick={start}>{busy ? "Opening…" : "Start"}</Button>}
          {t.kind === "proposal" && <Button size="sm" variant="primary" icon={PenLine} disabled={busy} onClick={start}>{busy ? "Opening…" : "Review & sign"}</Button>}
          {t.kind === "pay" && <Button size="sm" variant="primary" icon={CreditCard} disabled={busy} onClick={pay}>{busy ? "Opening…" : "Pay now"}</Button>}
          {t.kind === "upload" && <UploadButton doc={t.ref} label="Upload" onDone={onDone} />}
          {t.kind === "books_task" && !open && <Button size="sm" variant="primary" onClick={() => (t.extra?.type === "submit" && !confirm ? complete() : setOpen(true))} disabled={busy}>{t.extra?.type === "submit" ? "My items are in" : confirm ? "Answer" : "Mark done"}</Button>}
        </span>
      </div>
      {open && (
        <div className="ml-12 mt-3 space-y-2">
          <label htmlFor={`n-${t.id}`} className="block text-[13px] font-medium text-ink-2">{confirm ? "Your answer" : "Add a note for MKB (optional)"}</label>
          <textarea id={`n-${t.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={confirm ? "For example: nothing this month." : ""} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" />
          <div className="flex gap-2"><Button size="sm" variant="primary" disabled={busy || (confirm && !note.trim())} onClick={complete}>{busy ? "Saving…" : "Send"}</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- uploads */
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt";
function UploadButton({ doc, service, note, label = "Upload", onDone, variant = "primary" }: { doc?: string; service?: string; note?: string; label?: string; onDone: () => void; variant?: "primary" | "secondary" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = doc ? [files[0]] : Array.from(files);
    let ok = 0;
    for (const f of list) {
      if (f.size > 20 * 1024 * 1024) { toast(`${f.name} is larger than 20 MB. Try a smaller scan or photo.`, "info"); continue; }
      setBusy(list.length > 1 ? `Uploading ${ok + 1} of ${list.length}…` : "Uploading…");
      const q = new URLSearchParams();
      if (doc) q.set("doc", doc);
      if (service) q.set("service", service);
      if (note && list.length === 1) q.set("note", note);
      try {
        const r = await fetch(`/api/portal/upload?${q}`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(f.name) }, body: f });
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        if (r.status === 401) { window.location.assign("/portal/login"); return; }
        if (!r.ok) throw new Error(d.error ?? "Upload failed.");
        ok++;
      } catch (e) { toast(`${f.name}: ${errMsg(e)}`, "info"); }
    }
    setBusy(null);
    if (ref.current) ref.current.value = "";
    if (ok) { toast(ok === 1 ? "Uploaded — thank you! MKB has been notified." : `${ok} files uploaded — thank you!`); onDone(); }
  };
  return (
    <>
      <input ref={ref} type="file" accept={ACCEPT} multiple={!doc} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void upload(e.target.files)} />
      <Button size="sm" variant={variant} icon={busy ? Loader2 : Upload} disabled={!!busy} onClick={() => ref.current?.click()}>{busy ?? label}</Button>
    </>
  );
}

/* ---------------------------------------------------------------- documents */
const SERVICES = [{ v: "tax", l: "Tax preparation" }, { v: "books", l: "Bookkeeping" }, { v: "biz", l: "Business services" }, { v: "expunge", l: "Record expungement" }];

function DocumentsTab() {
  const { data, err, load } = useLoad<{ requested: Doc[]; files: Doc[] }>("/api/portal/documents");
  const [service, setService] = useState("tax");
  const [name, setName] = useState("");
  if (!data) return <Loading err={err} />;
  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold tracking-tight text-ink">Documents</h1>
      <p className="mb-6 text-[14px] text-muted">Upload what we asked for, or send us anything else. Photos from your phone work fine — make sure the whole page is in the picture.</p>
      <Section title="We need from you">
        {data.requested.length ? data.requested.map((d) => (
          <Row key={d.id}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning-ink"><Upload size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-semibold text-ink">{d.name}</span><span className="block text-[12.5px] text-muted">{d.taxYear ? `${d.taxYear} · ` : ""}{d.serviceName}{d.requestedAt ? ` · requested ${date(d.requestedAt)}` : ""}</span></span>
            <span className="ml-12 sm:ml-0"><UploadButton doc={d.id} onDone={load} /></span>
          </Row>
        )) : <Empty icon={CheckCircle2}>Nothing requested right now.</Empty>}
      </Section>
      <Section title="Send another document">
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div><label htmlFor="up-name" className="mb-1 block text-[13px] font-medium text-ink-2">What is it? (optional)</label><input id="up-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2025 W-2 from my second job" className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" /></div>
          <div><label htmlFor="up-svc" className="mb-1 block text-[13px] font-medium text-ink-2">For</label><select id="up-svc" value={service} onChange={(e) => setService(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink">{SERVICES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
          <UploadButton service={service} note={name} label="Choose files" onDone={() => { setName(""); void load(); }} />
        </div>
      </Section>
      <Section title="Your files">
        {data.files.length ? data.files.map((d) => (
          <Row key={d.id}>
            <FileText size={18} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-ink">{d.name}</span><span className="block text-[12.5px] text-muted">{d.serviceName}{d.uploadedAt ? ` · ${d.uploadedBy === "client" ? "you uploaded" : "shared"} ${date(d.uploadedAt)}` : ""}</span></span>
            {d.status === "received" && d.uploadedBy === "client" && <Badge tone="info">Received</Badge>}
            <a href={`/api/portal/files/${d.id}?view=1`} target="_blank" rel="noopener" className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold text-ink-2 hover:bg-surface-hover"><Eye size={15} />View</a>
            <a href={`/api/portal/files/${d.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold text-ink-2 hover:bg-surface-hover"><Download size={15} />Download</a>
          </Row>
        )) : <Empty icon={Inbox}>No files yet.</Empty>}
      </Section>
    </>
  );
}

/* ---------------------------------------------------------------- invoices */
const INV: Record<string, { label: string; tone: Tone }> = { open: { label: "Due", tone: "warning" }, partial: { label: "Partly paid", tone: "warning" }, paid: { label: "Paid", tone: "success" }, void: { label: "Cancelled", tone: "neutral" }, overdue: { label: "Past due", tone: "danger" } };

function InvoicesTab() {
  const { data, err } = useLoad<{ stripe: boolean; invoices: Invoice[] }>("/api/portal/invoices");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  if (!data) return <Loading err={err} />;
  const pay = async (i: Invoice) => {
    setBusy(i.id);
    try { const r = await api<{ url: string }>(`/api/portal/invoices/${i.id}/pay`, "POST"); window.location.assign(r.url); }
    catch (e) { toast(errMsg(e), "info"); setBusy(null); }
  };
  const owed = data.invoices.filter((i) => !i.bankProduct && i.status !== "void").reduce((s, i) => s + i.owed, 0);
  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold tracking-tight text-ink">Invoices</h1>
      <p className="mb-6 text-[14px] text-muted">{owed > 0 ? `You owe ${money(owed)}.` : "You're paid up — thank you!"} {data.stripe ? "Pay securely online by card or bank account." : ""}</p>
      <Section title="All invoices">
        {data.invoices.length ? data.invoices.map((i) => {
          const pastDue = (i.status === "open" || i.status === "partial") && !i.bankProduct && new Date(i.dueAt) < new Date();
          const st = pastDue ? INV.overdue : INV[i.status] ?? { label: i.status, tone: "neutral" as Tone };
          return (
            <Row key={i.id}>
              <Receipt size={18} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-ink">Invoice {i.number} · {money(i.amount)}</span>
                <span className="block text-[12.5px] text-muted">{i.description || i.service} · issued {date(i.issuedAt)}{i.owed > 0 && !i.bankProduct && i.status !== "void" ? ` · ${money(i.owed)} due ${date(i.dueAt)}` : ""}{i.bankProduct ? " · paid from your refund" : ""}</span>
              </span>
              <Badge tone={i.bankProduct && i.status !== "paid" ? "info" : st.tone}>{i.bankProduct && i.status !== "paid" ? "From refund" : st.label}</Badge>
              <a href={`/api/portal/invoices/${i.id}/pdf`} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold text-ink-2 hover:bg-surface-hover"><Download size={15} />PDF</a>
              {data.stripe && i.owed > 0 && !i.bankProduct && i.status !== "void" && <Button size="sm" variant="primary" icon={CreditCard} disabled={busy === i.id} onClick={() => pay(i)}>{busy === i.id ? "Opening…" : "Pay"}</Button>}
            </Row>
          );
        }) : <Empty icon={Receipt}>No invoices yet.</Empty>}
      </Section>
    </>
  );
}

/* ---------------------------------------------------------------- messages */
function MessagesTab({ onRead }: { onRead: () => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const toast = useToast();
  useEffect(() => { api<{ messages: Msg[] }>("/api/portal/messages").then((r) => { setMsgs(r.messages); onRead(); }).catch((e) => setErr(errMsg(e))); }, [onRead]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  if (!msgs) return <Loading err={err} />;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try { const r = await api<{ messages: Msg[] }>("/api/portal/messages", "POST", { body, service: service || undefined }); setMsgs(r.messages); setBody(""); toast("Message sent"); }
    catch (e2) { toast(errMsg(e2), "info"); }
    setBusy(false);
  };
  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold tracking-tight text-ink">Messages</h1>
      <p className="mb-6 text-[14px] text-muted">A private conversation with your MKB team. We usually reply within one business day.</p>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {msgs.length ? msgs.map((m) => (
            <div key={m.id} className={`flex ${m.from === "client" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${m.from === "client" ? "bg-accent text-white" : "bg-surface-2 text-ink"}`}>
                <p className="whitespace-pre-wrap break-words text-[14px]">{m.body}</p>
                <p className={`mt-1 text-[11px] ${m.from === "client" ? "text-white/80" : "text-muted"}`}>{m.from === "staff" ? `${m.author} · ` : ""}{when(m.at)}{m.service ? ` · ${m.service}` : ""}</p>
              </div>
            </div>
          )) : <Empty icon={MessageSquare}>No messages yet. Ask us anything below.</Empty>}
          <div ref={end} />
        </div>
        <form onSubmit={send} className="mt-4 space-y-2 border-t border-line pt-4">
          <label htmlFor="msg-body" className="sr-only">Your message</label>
          <textarea id="msg-body" rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" />
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="msg-svc" className="sr-only">About</label>
            <select id="msg-svc" value={service} onChange={(e) => setService(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-2 text-[13px] text-ink-2"><option value="">About: general</option>{SERVICES.map((s) => <option key={s.v} value={s.v}>About: {s.l}</option>)}</select>
            <span className="flex-1" />
            <Button type="submit" size="sm" variant="primary" icon={Send} disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send"}</Button>
          </div>
          <p className="text-[12px] text-muted">Please don&rsquo;t type full Social Security or bank account numbers here — upload a document instead.</p>
        </form>
      </div>
    </>
  );
}
