"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronsLeft, ChevronsRight, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { NAV, type NavItem } from "./nav";

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: Props) {
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
            <Logo collapsed={collapsed} />
          </div>
          {!collapsed && (
            <div className="hidden md:block lg:hidden">
              <Logo collapsed />
            </div>
          )}
          <button onClick={onCloseMobile} className="ml-auto grid h-9 w-9 self-start place-items-center rounded-lg text-rail-muted hover:bg-rail-hover md:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="rail-scroll flex-1 overflow-y-auto px-3 pb-1.5 pt-3">
          {NAV.map((group, gi) => (
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
          <Link
            href="/portal"
            onClick={onCloseMobile}
            className={`flex flex-1 items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-rail-muted hover:bg-rail-hover hover:text-rail-ink ${collapsed ? "md:justify-center md:px-0" : "md:justify-center md:px-0 lg:justify-start lg:px-3"}`}
            title="Client portal preview"
          >
            <ExternalLink size={17} />
            <span className={collapsed ? "md:hidden" : "md:hidden lg:inline"}>Client portal preview</span>
          </Link>
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
  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
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
      <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={item.label} className={`${base} ${look}`}>
        {active && <span aria-hidden="true" className="absolute -left-3 bottom-1.5 top-1.5 w-[3px] rounded-r bg-rail-indicator" />}
        <Icon size={19} strokeWidth={active ? 2.2 : 1.9} />
        <span className={`flex-1 ${hideLabel}`}>{item.label}</span>
        {item.badge ? (
          <span
            className={`grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white ${
              collapsed ? "md:absolute md:right-2 md:top-1" : "md:absolute md:right-2 md:top-1 lg:static"
            }`}
          >
            {item.badge}
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
