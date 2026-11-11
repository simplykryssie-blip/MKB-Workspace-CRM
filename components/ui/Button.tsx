import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost";
const V: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-[0_4px_14px_rgba(11,127,224,0.25)] hover:bg-accent-hover",
  secondary: "border border-line bg-surface text-ink-2 hover:bg-surface-hover",
  ghost: "text-ink-2 hover:bg-surface-hover",
};

type Props = {
  variant?: Variant;
  icon?: LucideIcon;
  href?: string;
  /** Opens the link in a new browser tab (e.g. the website or a public form). */
  newTab?: boolean;
  size?: "sm" | "md";
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({ variant = "secondary", icon: Icon, href, newTab, size = "md", className = "", children, ...rest }: Props) {
  const cls = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors disabled:opacity-50 ${
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14px]"
  } ${V[variant]} ${className}`;
  const inner = (
    <>
      {Icon && <Icon size={size === "sm" ? 15 : 17} />}
      {children}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {inner}
      </Link>
    );
  return (
    <button type="button" className={cls} {...rest}>
      {inner}
    </button>
  );
}
