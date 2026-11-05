import Link from "next/link";
import { Construction } from "lucide-react";
import { findNavLabel } from "@/components/layout/nav";

export default async function PlannedSection({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params;
  const path = "/" + section.join("/");
  const label = findNavLabel(path) ?? section[section.length - 1].replace(/-/g, " ");
  const isPortal = path === "/portal";
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Construction size={22} />
        </span>
        <h1 className="mt-4 text-[20px] font-bold capitalize tracking-tight text-ink">{isPortal ? "Client portal" : label}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          This screen is planned for <strong className="text-ink-2">Phase 2 — Frontend</strong>, after the dashboard design is approved.
          It will use the same layout, colors and components you see on the dashboard.
        </p>
        <Link href="/dashboard" className="mt-5 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
