"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Check, ChevronDown, ChevronsLeft, ChevronsRight, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo, MonarchLogo } from "@/components/brand/Logo";
import { MONARCH_NAV, NAV, type NavItem } from "./nav";
import { useLeads } from "@/lib/store/leads-store";
import { followUpBucket } from "@/lib/sample/leads";
import { useTeam } from "@/lib/store/team-store";
import { useTax } from "@/lib/store/tax-store";
import { useBooks } from "@/lib/store/books-store";
import { clientPortalLinks, moduleForPath } from "@/components/team/AccessGuard";
import { UserRound } from "lucide-react";

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: Props) {
  const team = useTeam();
  const tax = useTax();
  const books = useBooks();
  // Navigation follows permissions: hidden modules aren't offered (the route guard still blocks direct links).
  const allowed = (href: string) => { const mod = moduleForPath(href); return !mod || team.can(mod); };
  const pathname = usePathname();
  const monarch = pathname === "/monarch" || pathname.startsWith("/monarch/");
  const canMonarch = team.acting.kind === "member" && team.can("monarch");
  const Brand = monarch ? MonarchLogo : Logo;
  const nav = team.acting.kind === "client"
    ? [{ section: "My portal", items: clientPortalLinks(team.acting.clientId, books.workspaces, tax.returns).map((l) => ({ label: l.label, href: l.href, icon: UserRound })) }]
    : (monarch ? MONARCH_NAV : NAV).map((g) => ({ ...g, items: g.items.map((i) => (i.children ? { ...i, children: i.children.filter((c) => allowed(c.href)) } : i)).filter((i) => (i.children ? i.children.length > 0 : allowed(i.href))) })).filter((g) => g.items.length > 0);
  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-label="Primary"
        className={`fixed inset-y-0 left-0 z-50 border-r border-rail-line bg-rail text-rail-ink transition-[width,transform] duration-200
          w-[280px] ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:shrink-0 md:self-stretch md:translate-x-0
          ${collapsed ? "md:w-[76px]" : "md:w-[76px] lg:w-[264px]"}`}
      >
        {/* The sidebar stretches the full page height; the menu itself stays pinned in view while scrolling. */}
        <div className="flex h-full flex-col md:sticky md:top-0 md:h-screen">
        <div className={`flex min-h-[76px] shrink-0 items-center border-b py-3 border-rail-line ${collapsed ? "justify-center px-2" : "px-5 md:justify-center md:px-2 lg:justify-start lg:px-5"}`}>
          <div className={collapsed ? "" : "md:hidden lg:block"}>
            <Brand collapsed={collapsed} />
          </div>
          {!collapsed && (
            <div className="hidden md:block lg:hidden">
              <Brand collapsed />
            </div>
          )}
          <button onClick={onCloseMobile} className="ml-auto grid h-9 w-9 self-start place-items-center rounded-lg text-rail-muted hover:bg-rail-hover md:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {canMonarch && <WorkspaceSwitch monarch={monarch} collapsed={collapsed} onNavigate={onCloseMobile} />}

        <nav className="rail-scroll flex-1 overflow-y-auto px-3 pb-1.5 pt-3">
          {nav.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-3" : ""}>
              {group.section && (
                <div className={`mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-rail-section ${collapsed ? "md:hidden" : "md:hidden lg:block"}`}>
                  {group.section}
                </div>
              )}
              {group.section && (
                <div className={`mx-3 mb-2 h-px bg-rail-line ${collapsed ? "hidden md:block" : "hidden md:block lg:hidden"}`} />
              )}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <NavRow key={item.href} item={item} collapsed={collapsed} onNavigate={onCloseMobile} />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer: portal link + collapse toggle share one row when expanded, stack as icons in the rail */}
        <div className={`flex shrink-0 gap-1 border-t border-rail-line p-2.5 ${collapsed ? "md:flex-col" : "md:flex-col lg:flex-row"}`}>
          {process.env.NEXT_PUBLIC_BACKEND !== "1" && <Link
            href="/portal"
            onClick={onCloseMobile}
            className={`flex flex-1 items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-rail-muted hover:bg-rail-hover hover:text-rail-ink ${collapsed ? "md:justify-center md:px-0" : "md:justify-center md:px-0 lg:justify-start lg:px-3"}`}
            title="Client portal preview"
          >
            <ExternalLink size={17} />
            <span className={collapsed ? "md:hidden" : "md:hidden lg:inline"}>Client portal preview</span>
          </Link>}
          <button
            onClick={onToggleCollapsed}
            className="hidden h-9 w-full shrink-0 place-items-center rounded-xl text-rail-muted hover:bg-rail-hover hover:text-rail-ink lg:grid lg:w-9"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>
        </div>
      </aside>
    </>
  );
}

function NavRow({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { leads } = useLeads();
  const liveBadge = item.badgeKey === "leadsDue" ? leads.filter((l) => l.status === "open" && ["overdue", "today"].includes(followUpBucket(l))).length : undefined;
  const badge = liveBadge ?? item.badge;
  const active = pathname === item.href || (!item.exact && item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
  const hasChildren = !!item.children?.length;
  const childActive = item.children?.some((c) => pathname.startsWith(c.href)) ?? false;
  const [open, setOpen] = useState(true);
  const Icon = item.icon;
  const hideLabel = collapsed ? "md:hidden" : "md:hidden lg:inline";
  const rowLayout = collapsed ? "md:justify-center md:px-0" : "md:justify-center md:px-0 lg:justify-start lg:px-3";

  const base = `group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors ${rowLayout}`;
  const look = active
    ? "bg-[image:var(--rail-active)] font-semibold text-rail-active-ink shadow-[0_6px_18px_rgba(11,127,224,0.22)]"
    : childActive
      ? "text-rail-ink"
      : "text-rail-muted hover:bg-rail-hover hover:text-rail-ink";

  if (hasChildren) {
    return (
      <li>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`${base} ${look} ${collapsed ? "md:hidden" : "md:hidden lg:flex"}`}
        >
          <Icon size={19} strokeWidth={1.9} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown size={16} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        <ul
          className={[
            "space-y-0.5",
            open ? "mt-1 ml-[22px] border-l border-rail-line pl-2" : "hidden",
            "md:mt-0 md:ml-0 md:block md:border-0 md:pl-0",
            collapsed ? "" : open ? "lg:mt-1 lg:ml-[22px] lg:border-l lg:pl-2" : "lg:hidden",
          ].join(" ")}
        >
          {item.children!.map((c) => (
            <ChildRow key={c.href} item={c} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li>
      <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={badge && item.badgeKey ? `${item.label} — ${badge} follow-up(s) due` : item.label} className={`${base} ${look}`}>
        {active && <span aria-hidden="true" className="absolute -left-3 bottom-1.5 top-1.5 w-[3px] rounded-r bg-rail-indicator" />}
        <Icon size={19} strokeWidth={active ? 2.2 : 1.9} />
        <span className={`flex-1 ${hideLabel}`}>{item.label}</span>
        {badge ? (
          <span
            className={`grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white ${
              collapsed ? "md:absolute md:right-2 md:top-1" : "md:absolute md:right-2 md:top-1 lg:static"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function ChildRow({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13.5px] transition-colors ${
          collapsed ? "md:justify-center md:px-0 md:py-2.5" : "md:justify-center md:px-0 md:py-2 lg:justify-start lg:px-3 lg:py-1.5"
        } ${active ? "bg-accent-soft font-semibold text-accent-ink" : "text-rail-muted hover:bg-rail-hover hover:text-rail-ink"}`}
      >
        <span className="relative">
          <Icon size={17} strokeWidth={1.9} />
          <span className="absolute -bottom-0.5 -right-1 h-2 w-2 rounded-full ring-2 ring-rail" style={{ background: item.dot }} />
        </span>
        <span className={collapsed ? "md:hidden" : "md:hidden lg:inline"}>{item.label}</span>
      </Link>
    </li>
  );
}

/** Switches between the MKB workspace and Monarch Tax Suite (same app, same sign-in). */
function WorkspaceSwitch({ monarch, collapsed, onNavigate }: { monarch: boolean; collapsed: boolean; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const label = monarch ? "Monarch Tax Suite" : "MKB Financial Group";
  const options = [
    { href: "/dashboard", label: "MKB Financial Group", on: !monarch },
    { href: "/monarch", label: "Monarch Tax Suite", on: monarch },
  ];
  return (
    <div className="relative shrink-0 border-b border-rail-line px-3 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Workspace: ${label} — switch`}
        className={`flex w-full items-center gap-2.5 rounded-xl border border-rail-line px-3 py-2 text-left text-rail-ink hover:bg-rail-hover ${collapsed ? "md:justify-center md:px-0" : "md:justify-center md:px-0 lg:justify-start lg:px-3"}`}
      >
        <ArrowLeftRight size={16} className="shrink-0 text-rail-muted" />
        <span className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : "md:hidden lg:block"}`}>
          <span className="block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-rail-section">Workspace</span>
          <span className="block truncate text-[13.5px] font-semibold">{label}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-rail-muted transition-transform ${open ? "rotate-180" : ""} ${collapsed ? "md:hidden" : "md:hidden lg:block"}`} />
      </button>
      {open && (
        <ul role="menu" className="absolute left-3 right-3 top-full z-20 mt-1 min-w-[220px] rounded-xl border border-line bg-surface p-1 shadow-soft">
          {options.map((o) => (
            <li key={o.href} role="none">
              <Link role="menuitem" href={o.href} onClick={() => { setOpen(false); onNavigate(); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink hover:bg-surface-hover">
                <span className="flex-1">{o.label}</span>
                {o.on && <Check size={15} className="text-accent" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
