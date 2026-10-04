import {
  ArrowRightLeft,
  MapPin,
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
  FileText,
} from "lucide-react";
import { CopilotMark } from "@/components/brand/copilot-mark";

export type Role = "OWNER" | "ADMIN" | "EMPLOYEE";

/** A menu icon: a lucide icon, or a brand mark such as CopilotMark. */
export type NavIcon = React.ComponentType<{ className?: string }>;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  roles?: Role[];
  platformAdminOnly?: boolean;
};

/** `icon` marks the group heading; it matches the department icons in the
 * landing page constellation (components/landing/module-constellation.tsx). */
export type NavGroup = { label: string; icon: typeof LayoutDashboard; items: NavItem[] };

/** The everyday pages, always visible at the top of the menu above the
 * department groups. Reports is here rather than in a group of its own. */
export const navPinned: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  // The AIBOS logo's centre point, the Copilot's own mark.
  { href: "/dashboard/assistant", label: "AI Copilot", icon: CopilotMark },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
];

/** Modules with no `roles` are visible to everyone; HR/Payroll/Accounting
 * are back-office modules restricted to OWNER/ADMIN. Items with
 * `platformAdminOnly` are hidden from every regular company user, including
 * OWNERs — shown only to the platform operator (see lib/platform-admin.ts).
 * A group whose items are all hidden for the current user is hidden too. */
export const navGroups: NavGroup[] = [
  {
    label: "Customers and Sales",
    icon: Users,
    items: [
      { href: "/dashboard/crm", label: "CRM", icon: Users },
      { href: "/dashboard/marketing", label: "Marketing", icon: Megaphone },
      { href: "/dashboard/quotes", label: "Quotes", icon: FileText },
      { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart },
      { href: "/dashboard/returns", label: "Returns", icon: Undo2 },
      { href: "/dashboard/invoicing", label: "Invoicing", icon: Receipt },
      { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
    ],
  },
  {
    label: "Operations",
    icon: Boxes,
    items: [
      { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
      { href: "/dashboard/transfers", label: "Transfers", icon: ArrowRightLeft },
      { href: "/dashboard/procurement", label: "Procurement", icon: Truck },
      { href: "/dashboard/mrp", label: "Planning / MRP", icon: Factory },
    ],
  },
  {
    label: "Finance",
    icon: Wallet,
    items: [
      { href: "/dashboard/accounting", label: "Accounting", icon: Wallet, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/controlling", label: "Controlling", icon: Target, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "People",
    icon: UserSquare2,
    items: [
      { href: "/dashboard/hr", label: "HR", icon: UserSquare2, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/team", label: "Team", icon: UserPlus, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "Work Management",
    icon: FolderKanban,
    items: [
      { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
      { href: "/dashboard/automation", label: "Automation", icon: Zap, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "Connectivity",
    icon: Plug,
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/edi", label: "EDI", icon: ArrowLeftRight, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    label: "Administration",
    icon: SlidersHorizontal,
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard, roles: ["OWNER"] },
      { href: "/dashboard/branches", label: "Branches", icon: MapPin, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/settings", label: "Settings", icon: SlidersHorizontal, roles: ["OWNER", "ADMIN"] },
      { href: "/dashboard/admin", label: "Companies", icon: Building2, platformAdminOnly: true },
      { href: "/dashboard/platform-settings", label: "Platform Settings", icon: Settings, platformAdminOnly: true },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
