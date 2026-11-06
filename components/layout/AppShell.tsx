"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ThemeToggle } from "./ThemeToggle";
import { ClientsProvider } from "@/lib/store/clients-store";
import { LeadsProvider } from "@/lib/store/leads-store";
import { FormsProvider } from "@/lib/store/forms-store";
import { TaxProvider } from "@/lib/store/tax-store";
import { BooksProvider } from "@/lib/store/books-store";
import { BizProvider } from "@/lib/store/biz-store";
import { ExpProvider } from "@/lib/store/exp-store";
import { TeamProvider } from "@/lib/store/team-store";
import { AccessGuard, PreviewSwitcher } from "@/components/team/AccessGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionGate } from "@/components/auth/SessionGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("mkb-rail") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("mkb-rail", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });

  return (
    <ClientsProvider>
    <LeadsProvider>
    <FormsProvider>
    <TaxProvider>
    <BooksProvider>
    <BizProvider>
    <ExpProvider>
    <TeamProvider>
    <ToastProvider>
    <SessionGate />
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <div className="flex items-center gap-2 border-b border-warning/25 bg-warning-soft px-4 py-1.5 text-[12px] font-medium text-warning-ink sm:px-6 lg:px-8">
          <FlaskConical size={14} className="shrink-0" />
          <span className="hidden truncate md:inline">Design preview — all names, amounts and dates are fictional sample data.</span>
          <span className="sr-only sm:not-sr-only sm:truncate md:hidden">Fictional sample data</span>
          <span className="ml-auto min-w-0"><PreviewSwitcher /></span>
          <span className="sm:hidden">
            <ThemeToggle />
          </span>
        </div>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><AccessGuard>{children}</AccessGuard></main>
      </div>
    </div>
    </ToastProvider>
    </TeamProvider>
    </ExpProvider>
    </BizProvider>
    </BooksProvider>
    </TaxProvider>
    </FormsProvider>
    </LeadsProvider>
    </ClientsProvider>
  );
}
