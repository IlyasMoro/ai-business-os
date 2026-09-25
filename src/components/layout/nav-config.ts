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
  Settings,
  SlidersHorizontal,
  Building2,
  CreditCard,
  UserPlus,
  Undo2,
  Factory,
  ArrowLeftRight,
  Target,
} from "lucide-react";

export type Role = "OWNER" | "ADMIN" | "EMPLOYEE";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  platformAdminOnly?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

/** Modules with no `roles` are visible to everyone; HR/Payroll/Accounting
 * are back-office modules restricted to OWNER/ADMIN. Items with
 * `platformAdminOnly` are hidden from every regular company user, including
 * OWNERs — shown only to the platform operator (see lib/platform-admin.ts).
 * A group whose items are all hidden for the current user is hidden too. */
export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/assistant", label: "AI Copilot", icon: Sparkles },
      { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Customers & Sales",
    items: [
      { href: "/dashboard/crm", label: "CRM", icon: Users },
      { href: "/dashboard/marketing", label: "Marketing", icon: Megaphone },
      { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart },
      { href: "/dashboard/returns", label: "Returns", icon: Undo2 },
      { href: "/dashboard/invoicing", label: "Invoicing", icon: Receipt },
      { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
      { href: "/dashboard/procurement", label: "Procurement", icon: Truck },
      { href: "/dashboard/mrp", label: "Planning / MRP", icon: Factory },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/accounting", label: "Accounting", icon: Wallet, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/controlling", label: "Controlling", icon: Target, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/dashboard/hr", label: "HR", icon: UserSquare2, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/team", label: "Team", icon: UserPlus, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "Work Management",
    items: [
      { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
      { href: "/dashboard/automation", label: "Automation", icon: Zap, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "Connectivity",
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/edi", label: "EDI", icon: ArrowLeftRight, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard, roles: ["OWNER"] },
      { href: "/dashboard/settings", label: "Settings", icon: SlidersHorizontal, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/admin", label: "Companies", icon: Building2, platformAdminOnly: true },
      { href: "/dashboard/platform-settings", label: "Platform Settings", icon: Settings, platformAdminOnly: true },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
