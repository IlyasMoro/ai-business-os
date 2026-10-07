import {
  Store,
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
  Inbox,
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
  /** One short line for the hover menu and the search, no hyphens. */
  description?: string;
};

/** `icon` marks the group heading; it matches the department icons in the
 * landing page constellation (components/landing/module-constellation.tsx). */
export type NavGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  /** The section's own colour for its icons in the hover menu and when
   * open (validated categorical palette, dark surface steps). */
  color: string;
  items: NavItem[];
};

/** Count shown beside a page in the menu, by href: work waiting there. */
export type NavBadge = { count: number; tone: "red" | "amber" | "blue" };
export type NavBadges = Record<string, NavBadge>;

/** The everyday pages, always visible at the top of the menu above the
 * department groups. Reports is here rather than in a group of its own. */
export const navPinned: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Your business at a glance" },
  // The AIBOS logo's centre point, the Copilot's own mark.
  { href: "/dashboard/assistant", label: "AI Copilot", icon: CopilotMark, description: "Ask questions, get suggested next steps" },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar, description: "Due dates, tasks and follow ups" },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "ADMIN"], description: "Revenue, costs and profit over time" },
  { href: "/dashboard/reports/branches", label: "Branch performance", icon: Store, roles: ["OWNER", "ADMIN"], description: "Rank and compare every branch" },
];

/** Modules with no `roles` are visible to everyone; HR/Payroll/Accounting
 * are back-office modules restricted to OWNER/ADMIN. Items with
 * `platformAdminOnly` are hidden from every regular company user, including
 * OWNERs — shown only to the platform operator (see lib/platform-admin.ts).
 * A group whose items are all hidden for the current user is hidden too. */
export const navGroups: NavGroup[] = [
  {
    label: "Customers and Sales",
    color: "#3987e5",
    icon: Users,
    items: [
      { href: "/dashboard/crm", label: "CRM", icon: Users, description: "Customers, leads, deals and follow ups" },
      { href: "/dashboard/marketing", label: "Marketing", icon: Megaphone, description: "Campaigns, budgets and the leads they bring" },
      { href: "/dashboard/quotes", label: "Quotes", icon: FileText, description: "Price offers customers accept online" },
      { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart, description: "Customer orders from pending to fulfilled" },
      { href: "/dashboard/returns", label: "Returns", icon: Undo2, description: "Returned goods, refunds and credit" },
      { href: "/dashboard/invoicing", label: "Invoicing", icon: Receipt, description: "Invoices, payments and overdue reminders" },
      { href: "/dashboard/support", label: "Support", icon: LifeBuoy, description: "Customer tickets and their status" },
    ],
  },
  {
    label: "Operations",
    color: "#d95926",
    icon: Boxes,
    items: [
      { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, description: "Products, stock per branch, kg and expiry" },
      { href: "/dashboard/transfers", label: "Transfers", icon: ArrowRightLeft, description: "Move stock between branches" },
      { href: "/dashboard/procurement", label: "Procurement", icon: Truck, description: "Purchase orders, suppliers and deliveries" },
      { href: "/dashboard/mrp", label: "Planning / MRP", icon: Factory, description: "What to buy or make, and work orders" },
    ],
  },
  {
    label: "Finance",
    color: "#199e70",
    icon: Wallet,
    items: [
      { href: "/dashboard/accounting", label: "Accounting", icon: Wallet, roles: ["OWNER", "ADMIN"], description: "Income, expenses and the books" },
      { href: "/dashboard/controlling", label: "Controlling", icon: Target, roles: ["OWNER", "ADMIN"], description: "Cost centres, budgets and profitability" },
    ],
  },
  {
    label: "People",
    color: "#c98500",
    icon: UserSquare2,
    items: [
      { href: "/dashboard/hr", label: "HR", icon: UserSquare2, roles: ["OWNER", "ADMIN"], description: "Employees, roles and departments" },
      { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, roles: ["OWNER", "ADMIN"], description: "Pay runs and payslips" },
      { href: "/dashboard/team", label: "Team", icon: UserPlus, roles: ["OWNER", "ADMIN"], description: "Who can sign in, and their access" },
    ],
  },
  {
    label: "Work Management",
    color: "#d55181",
    icon: FolderKanban,
    items: [
      { href: "/dashboard/projects", label: "Projects", icon: FolderKanban, description: "Projects, tasks, budgets and progress" },
      { href: "/dashboard/automation", label: "Automation", icon: Zap, roles: ["OWNER", "ADMIN"], description: "Rules that run tasks for you" },
    ],
  },
  {
    label: "Connectivity",
    color: "#9085e9",
    icon: Plug,
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug, roles: ["OWNER", "ADMIN"], description: "Google, email and other connected apps" },
      { href: "/dashboard/edi", label: "EDI", icon: ArrowLeftRight, roles: ["OWNER", "ADMIN"], description: "Orders and invoices exchanged with partners" },
    ],
  },
  {
    label: "Administration",
    color: "#94a3b8",
    icon: SlidersHorizontal,
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard, roles: ["OWNER"], description: "Your plan, payments and invoices" },
      { href: "/dashboard/branches", label: "Branches", icon: MapPin, roles: ["OWNER", "ADMIN"], description: "Add and manage your branches" },
      { href: "/dashboard/settings", label: "Settings", icon: SlidersHorizontal, roles: ["OWNER", "ADMIN"], description: "Company details, modules and preferences" },
      { href: "/dashboard/admin", label: "Companies", icon: Building2, platformAdminOnly: true, description: "Every company on the platform" },
      { href: "/dashboard/admin/messages", label: "Messages", icon: Inbox, platformAdminOnly: true, description: "Messages sent through the contact form" },
      { href: "/dashboard/platform-settings", label: "Platform Settings", icon: Settings, platformAdminOnly: true, description: "Keys and settings for the whole platform" },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);

/** The pinned pages and groups this user may see: role, platform admin and
 * the modules the company switched off. Shared by the sidebar and search. */
export function visibleNav({ role, isPlatformAdmin = false, hiddenHrefs = [] }: { role: Role; isPlatformAdmin?: boolean; hiddenHrefs?: string[] }) {
  const visible = (item: NavItem) => {
    if (hiddenHrefs.includes(item.href)) return false;
    if (item.platformAdminOnly) return isPlatformAdmin;
    return !item.roles || item.roles.includes(role);
  };
  return {
    pinned: navPinned.filter(visible),
    groups: navGroups.map((group) => ({ ...group, items: group.items.filter(visible) })).filter((group) => group.items.length > 0),
  };
}
