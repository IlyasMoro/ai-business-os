import {
  LayoutDashboard,
  Users,
  Boxes,
  ShoppingCart,
  Receipt,
  Wallet,
  UserSquare2,
  Banknote,
  FolderKanban,
  LifeBuoy,
  Sparkles,
  BarChart3,
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
  { href: "/dashboard/crm", label: "CRM", icon: Users },
  { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/invoicing", label: "Invoicing", icon: Receipt },
  { href: "/dashboard/accounting", label: "Accounting", icon: Wallet, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/hr", label: "HR", icon: UserSquare2, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, roles: ["OWNER", "ADMIN"] },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/assistant", label: "AI Assistant", icon: Sparkles },
];
