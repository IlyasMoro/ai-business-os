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
} from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/crm", label: "CRM", icon: Users },
  { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/invoicing", label: "Invoicing", icon: Receipt },
  { href: "/dashboard/accounting", label: "Accounting", icon: Wallet },
  { href: "/dashboard/hr", label: "HR", icon: UserSquare2 },
  { href: "/dashboard/payroll", label: "Payroll", icon: Banknote },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/assistant", label: "AI Assistant", icon: Sparkles },
];
