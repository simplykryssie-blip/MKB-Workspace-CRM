"use client";

import { Bell, ChevronDown, HelpCircle, Menu, Plus, Search } from "lucide-react";
import { currentUser } from "@/lib/sample-data";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-[72px] lg:px-8">
        <button
          onClick={onOpenMenu}
          className="grid h-10 w-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-hover md:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <label className="relative flex min-w-0 flex-1 items-center md:max-w-[520px]">
          <span className="sr-only">Search</span>
          <Search size={17} className="pointer-events-none absolute left-3.5 text-faint" />
          <input
            type="search"
            placeholder="Search clients, documents, invoices…"
            className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
          <kbd className="pointer-events-none absolute right-3 hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-faint lg:block">
            ⌘K
          </kbd>
        </label>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button className="hidden h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(11,127,224,0.3)] hover:bg-accent-hover xl:flex">
            <Plus size={17} /> New client
          </button>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <IconBtn label="Help">
            <HelpCircle size={20} />
          </IconBtn>
          <IconBtn label="Notifications (4 unread)">
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-warning ring-2 ring-surface" />
          </IconBtn>
          <button className="ml-1 flex items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-surface-hover sm:pr-2" aria-label="Account menu">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#1592ef] to-[#0b6fd0] text-[13px] font-bold text-white">
              {currentUser.initials}
            </span>
            <span className="hidden text-left leading-tight lg:block">
              <span className="block text-[13px] font-semibold text-ink">{currentUser.fullName}</span>
              <span className="block text-[11.5px] text-muted">{currentUser.role}</span>
            </span>
            <ChevronDown size={15} className="hidden text-muted sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}

function IconBtn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-hover">
      {children}
    </button>
  );
}
