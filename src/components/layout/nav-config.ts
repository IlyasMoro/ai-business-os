import {
  LayoutDashboard,
  Users,
  Boxes,
  Truck,
  ShoppingCart,
  Receipt,
  Wallet,
  UserSquare2,
  Banknote,
  FolderKanban,
  LifeBuoy,
  Sparkles,
  BarChart3,
  Zap,
  Plug,
  Megaphone,
  Calendar,
} from "lucide-react";

export type Role = "OWNER" | "ADMIN" | "EMPLOYEE";

/** Modules with no `roles` are visible to everyone; HR/Payroll/Accounting
 * are back-office modules restricted to OWNER/ADMIN. */
export const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
}[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/assistant", label: "AI Copilot", icon: Sparkles },
  { href: "/dashboard/crm", label: "CRM", icon: Users },
  { href: "/dashboard/marketing", label: "Marketing", icon: Megaphone },
  { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/procurement", label: "Procurement", icon: Truck },
  { href: "/dashboard/invoicing", label: "Invoicing", icon: Receipt },
  { href: "/dashboard/accounting", label: "Accounting", icon: Wallet, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/hr", label: "HR", icon: UserSquare2, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/automation", label: "Automation", icon: Zap, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug, roles: ["OWNER", "ADMIN"] },
];
