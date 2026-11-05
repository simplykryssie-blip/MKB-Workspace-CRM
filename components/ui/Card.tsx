import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-2xl border border-line bg-surface shadow-soft ${className}`}>{children}</section>;
}

export function CardHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  href,
  hrefLabel,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5 sm:px-6">
      {Icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon size={18} strokeWidth={2} />
        </span>
      )}
      <div className="min-w-[150px] flex-1">
        <h2 className="text-[16px] leading-snug font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      {action}
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-accent hover:bg-accent-soft">
          {hrefLabel ?? "View all"} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
