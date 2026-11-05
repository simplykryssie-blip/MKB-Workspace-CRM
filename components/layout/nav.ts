import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckSquare,
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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  /** CSS var for a small service-color dot */
  dot?: string;
  children?: NavItem[];
};

export const NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Leads", href: "/leads", icon: UserPlus },
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
      { label: "Invoices & Payments", href: "/invoices", icon: Receipt },
      { label: "Messages", href: "/messages", icon: Mail, badge: 3 },
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

export function findNavLabel(path: string): string | undefined {
  for (const g of NAV)
    for (const i of g.items) {
      if (i.href === path) return i.label;
      for (const c of i.children ?? []) if (c.href === path) return c.label;
    }
}
