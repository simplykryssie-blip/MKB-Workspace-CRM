import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Mail,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Layers,
  Globe,
  Building,
  ClipboardCheck,
  Handshake,
  Landmark,
  Package,
  SlidersHorizontal,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  /** Live badge computed in the sidebar (e.g. follow-ups due). */
  badgeKey?: "leadsDue";
  /** Active only on this exact address (not its sub-pages). */
  exact?: boolean;
  /** CSS var for a small service-color dot */
  dot?: string;
  children?: NavItem[];
};

export const NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Leads", href: "/leads", icon: UserPlus, badgeKey: "leadsDue" },
      { label: "Forms", href: "/forms", icon: ClipboardList },
      { label: "Website", href: "/website", icon: Globe },
    ],
  },
  {
    section: "Service divisions",
    items: [
      {
        label: "Services",
        href: "/services",
        icon: Layers,
        children: [
          { label: "Tax Preparation", href: "/services/tax-preparation", icon: FileText, dot: "var(--svc-tax)" },
          { label: "Bookkeeping", href: "/services/bookkeeping", icon: BarChart3, dot: "var(--svc-books)" },
          { label: "Business Services", href: "/services/business-services", icon: Briefcase, dot: "var(--svc-biz)" },
          { label: "Record Expungement", href: "/services/record-expungement", icon: Scale, dot: "var(--svc-expunge)" },
        ],
      },
    ],
  },
  {
    section: "Workspace",
    items: [
      { label: "Appointments", href: "/appointments", icon: CalendarDays },
      { label: "Documents", href: "/documents", icon: FolderOpen },
      { label: "Billing", href: "/billing", icon: Receipt },
      { label: "Messages", href: "/messages", icon: Mail, badge: process.env.NEXT_PUBLIC_BACKEND === "1" ? undefined : 3 },
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    section: "Administration",
    items: [
      { label: "Team & Permissions", href: "/team", icon: ShieldCheck },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Monarch Tax Suite — the service bureau workspace. */
export const MONARCH_NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: "Onboarding", href: "/monarch", icon: ClipboardCheck, exact: true },
      { label: "Offices", href: "/monarch/offices", icon: Building },
      { label: "Sales & Payments", href: "/monarch/sales", icon: Wallet },
      { label: "Resellers & Commissions", href: "/monarch/resellers", icon: Handshake },
      { label: "Bank reports", href: "/monarch/bank-reports", icon: Landmark },
    ],
  },
  {
    section: "Administration",
    items: [
      { label: "Packages", href: "/monarch/packages", icon: Package },
      { label: "Setup", href: "/monarch/setup", icon: SlidersHorizontal },
    ],
  },
];

export function findNavLabel(path: string): string | undefined {
  for (const g of NAV)
    for (const i of g.items) {
      if (i.href === path) return i.label;
      for (const c of i.children ?? []) if (c.href === path) return c.label;
    }
}
