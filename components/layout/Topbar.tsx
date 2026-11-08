"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, CircleHelp, HelpCircle, Keyboard, LogOut, Menu as MenuIcon, Plus, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Menu } from "@/components/ui/Menu";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { useClients } from "@/lib/store/clients-store";
import { relTime } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const team = useTeam();
  const { clients } = useClients();
  const client = team.acting.kind === "client" ? clients.find((c) => c.id === (team.acting as { clientId: string }).clientId) : undefined;
  const currentUser = client
    ? { initials: client.name.split(" ").map((w) => w[0]).join("").slice(0, 2), fullName: client.name, role: "Client (portal)" }
    : { initials: team.me?.initials ?? "—", fullName: team.me?.name ?? "Unknown", role: team.myRole?.name ?? "" };
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-[72px] lg:px-8">
        <button onClick={onOpenMenu} className="grid h-10 w-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-hover md:hidden" aria-label="Open menu">
          <MenuIcon size={20} />
        </button>

        <GlobalSearch />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {team.can("crm", "create") && <Link href="/clients/new" className="hidden h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(11,127,224,0.3)] hover:bg-accent-hover xl:flex">
            <Plus size={17} /> New client
          </Link>}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <Menu
            label="Help"
            trigger={({ toggle }) => (
              <IconBtn label="Help" onClick={toggle}>
                <HelpCircle size={20} />
              </IconBtn>
            )}
            items={[
              { label: "Keyboard shortcuts: ⌘K / Ctrl+K search", icon: Keyboard, onSelect: () => document.getElementById("global-search")?.focus() },
              ...(process.env.NEXT_PUBLIC_BACKEND === "1" ? [] : [{ label: "About this design preview", icon: CircleHelp, onSelect: () => toast("Design preview: all data is fictional and resets on reload. No backend is connected.", "info") }]),
            ]}
          />
          <Notifications />
          <Menu
            label="Account"
            trigger={({ toggle }) => (
              <button onClick={toggle} className="ml-1 flex items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-surface-hover sm:pr-2" aria-label="Account menu">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#1592ef] to-[#0b6fd0] text-[13px] font-bold text-white">{currentUser.initials}</span>
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block text-[13px] font-semibold text-ink">{currentUser.fullName}</span>
                  <span className="block text-[11.5px] text-muted">{currentUser.role}</span>
                </span>
                <ChevronDown size={15} className="hidden text-muted sm:block" />
              </button>
            )}
            items={[
              { label: "My profile", icon: UserRound, onSelect: () => router.push("/settings") },
              { label: "Team & permissions", icon: ShieldCheck, onSelect: () => router.push("/team") },
              { label: "Settings", icon: Settings, onSelect: () => router.push("/settings") },
              "divider",
              { label: "Sign out", icon: LogOut, onSelect: async () => { if (process.env.NEXT_PUBLIC_BACKEND !== "1") return toast("Sign-out works once the backend is switched on.", "info"); await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); window.location.assign("/login"); } },
            ]}
          />
        </div>
      </div>
    </header>
  );
}

function IconBtn({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-hover">
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function GlobalSearch() {
  const { clients: all } = useClients();
  const team = useTeam();
  // Search only covers records this person may open — results never reveal other clients.
  const clients = useMemo(() => all.filter((c) => team.clientAccess(c)), [all, team]);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", k);
    document.addEventListener("mousedown", off);
    return () => {
      document.removeEventListener("keydown", k);
      document.removeEventListener("mousedown", off);
    };
  }, []);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    const digits = n.replace(/\D/g, "");
    return clients
      .filter((c) => [c.name, c.email, c.contactName ?? "", c.id, ...c.documents.map((d) => d.name), ...c.invoices.map((i) => i.number)].some((f) => f.toLowerCase().includes(n)) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 6)
      .map((c) => {
        const inv = c.invoices.find((i) => i.number.toLowerCase().includes(n));
        const doc = c.documents.find((d) => d.name.toLowerCase().includes(n));
        const match = c.name.toLowerCase().includes(n) ? null : inv ? { text: `Invoice ${inv.number}`, hash: "invoices" } : doc ? { text: `Document: ${doc.name}`, hash: "documents" } : null;
        return { c, match };
      });
  }, [q, clients]);

  const go = (i: number) => {
    const r = results[i];
    if (!r) return;
    router.push(`/clients/${r.c.id}${r.match ? `#${r.match.hash}` : ""}`);
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
  };

  return (
    <div ref={ref} className="relative min-w-0 flex-1 md:max-w-[520px]">
      <label className="relative flex items-center">
        <span className="sr-only">Search clients, documents, invoices</span>
        <Search size={17} className="pointer-events-none absolute left-3.5 text-faint" />
        <input
          id="global-search"
          ref={inputRef}
          type="search"
          value={q}
          role="combobox"
          aria-expanded={open && q.trim() !== ""}
          aria-controls="global-search-results"
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            if (e.key === "Enter") go(hi);
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          }}
          placeholder="Search clients, documents, invoices…"
          className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15"
        />
        <kbd className="pointer-events-none absolute right-3 hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-faint lg:block">⌘K</kbd>
      </label>
      {open && q.trim() && (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-pop sm:right-auto sm:min-w-[420px]">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[13.5px] text-muted">No matches for &ldquo;{q}&rdquo;.</p>
          ) : (
            results.map(({ c, match }, i) => (
              <button
                key={c.id}
                role="option"
                aria-selected={i === hi}
                onMouseEnter={() => setHi(i)}
                onClick={() => go(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${i === hi ? "bg-surface-hover" : ""}`}
              >
                <Avatar name={c.name} size={32} square={c.type === "business"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{c.name}</span>
                  <span className="block truncate text-[12px] text-muted">{match ? match.text : c.email}</span>
                </span>
                <span className="hidden gap-1 sm:flex">
                  {[...new Set(c.enrollments.map((e) => e.service))].slice(0, 2).map((s) => <ServiceTag key={s} service={s} short />)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Notifications() {
  const { clients } = useClients();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", off);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // Client-originated activity across all clients, newest first.
  const items = useMemo(
    () =>
      clients
        .flatMap((c) => c.activity.filter((a) => a.actor === "client").map((a) => ({ ...a, client: c })))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 8),
    [clients],
  );
  const unread = items.filter((i) => !seen.includes(i.id)).length;

  return (
    <div ref={ref} className="relative">
      <IconBtn label={`Notifications${unread ? ` (${unread} unread)` : ""}`} onClick={() => setOpen((o) => !o)}>
        <Bell size={20} />
        {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-warning ring-2 ring-surface" />}
      </IconBtn>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-[min(92vw,380px)] rounded-xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-semibold text-ink">Client activity</span>
            <button onClick={() => setSeen(items.map((i) => i.id))} disabled={!unread} className="text-[12.5px] font-semibold text-accent disabled:text-faint">
              Mark all read
            </button>
          </div>
          <ul className="scrollbar-thin max-h-[60vh] overflow-y-auto p-1.5">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={`/clients/${n.client.id}#activity`} onClick={() => { setSeen((s) => [...s, n.id]); setOpen(false); }} className="flex gap-3 rounded-lg px-2.5 py-2 hover:bg-surface-hover">
                  <Avatar name={n.client.name} size={30} square={n.client.type === "business"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-ink-2">
                      <span className="font-semibold text-ink">{n.client.name}</span> — {n.text}
                    </span>
                    <span className="block text-[11.5px] text-muted">{relTime(n.at)}</span>
                  </span>
                  {!seen.includes(n.id) && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
