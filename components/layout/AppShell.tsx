"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ThemeToggle } from "./ThemeToggle";
import { ClientsProvider } from "@/lib/store/clients-store";
import { LeadsProvider } from "@/lib/store/leads-store";
import { TaxProvider } from "@/lib/store/tax-store";
import { BooksProvider } from "@/lib/store/books-store";
import { BizProvider } from "@/lib/store/biz-store";
import { ExpProvider } from "@/lib/store/exp-store";
import { ToastProvider } from "@/components/ui/Toast";

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
    <TaxProvider>
    <BooksProvider>
    <BizProvider>
    <ExpProvider>
    <ToastProvider>
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <div className="flex items-center gap-2 border-b border-warning/25 bg-warning-soft px-4 py-1.5 text-[12px] font-medium text-warning-ink sm:px-6 lg:px-8">
          <FlaskConical size={14} className="shrink-0" />
          <span className="truncate">Design preview — all names, amounts and dates are fictional sample data.</span>
          <span className="ml-auto sm:hidden">
            <ThemeToggle />
          </span>
        </div>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
    </ToastProvider>
    </ExpProvider>
    </BizProvider>
    </BooksProvider>
    </TaxProvider>
    </LeadsProvider>
    </ClientsProvider>
  );
}
