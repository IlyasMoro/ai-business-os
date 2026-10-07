/* What a company role may open. Pure (no database) so the rules can be
   unit tested; lib/company-roles.ts stores them and lib/dal.ts enforces
   them on every page and save. User facing text has no hyphens. */

export type AccessLevel = "view" | "full";
/** Module key to level; a module that is missing cannot be opened. */
export type RoleAccess = Partial<Record<ModuleKey, AccessLevel>>;

/** Everything a role can be given, by section, in menu order. The key is
 * the first part of the page address after /dashboard/ (crm, sales...).
 * Billing stays with owners and is never given through a role. */
export const MODULES = [
  { key: "assistant", label: "AI Copilot", section: "Everyday" },
  { key: "calendar", label: "Calendar", section: "Everyday" },
  { key: "reports", label: "Reports and branch performance", section: "Everyday" },
  { key: "crm", label: "CRM", section: "Customers and Sales" },
  { key: "marketing", label: "Marketing", section: "Customers and Sales" },
  { key: "quotes", label: "Quotes", section: "Customers and Sales" },
  { key: "sales", label: "Sales orders", section: "Customers and Sales" },
  { key: "returns", label: "Returns", section: "Customers and Sales" },
  { key: "invoicing", label: "Invoicing", section: "Customers and Sales" },
  { key: "support", label: "Support", section: "Customers and Sales" },
  { key: "inventory", label: "Inventory", section: "Operations" },
  { key: "transfers", label: "Transfers", section: "Operations" },
  { key: "procurement", label: "Procurement", section: "Operations" },
  { key: "mrp", label: "Planning", section: "Operations" },
  { key: "accounting", label: "Accounting", section: "Finance" },
  { key: "controlling", label: "Controlling", section: "Finance" },
  { key: "hr", label: "HR", section: "People" },
  { key: "payroll", label: "Payroll", section: "People" },
  { key: "projects", label: "Projects", section: "Work Management" },
  { key: "automation", label: "Automation", section: "Work Management" },
  { key: "integrations", label: "Integrations", section: "Connectivity" },
  { key: "edi", label: "EDI", section: "Connectivity" },
  { key: "team", label: "Team and roles", section: "Administration" },
  { key: "branches", label: "Branches", section: "Administration" },
  { key: "settings", label: "Settings", section: "Administration" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
const MODULE_KEYS = new Set<string>(MODULES.map((m) => m.key));

/** Modules that are manager pages: only roles built on Admin can be given them. */
export const MANAGER_MODULES = new Set<ModuleKey>([
  "reports",
  "accounting",
  "controlling",
  "hr",
  "payroll",
  "automation",
  "integrations",
  "edi",
  "team",
  "branches",
  "settings",
]);

/** The module a dashboard address belongs to, or null for pages every
 * member may open (the dashboard itself, their own account, billing). */
export function moduleOfPath(path: string | null | undefined): ModuleKey | null {
  if (!path || !path.startsWith("/dashboard/")) return null;
  const segment = path.split("/")[2] ?? "";
  return MODULE_KEYS.has(segment) ? (segment as ModuleKey) : null;
}

/** The menu address of a module, for hiding it in the menu and search. */
export function moduleHref(key: ModuleKey): string {
  return `/dashboard/${key}`;
}

/** Keeps only known modules and levels, and drops manager modules from a
 * role built on Employee, so a stored role can never grant more than its
 * level allows. */
export function cleanAccess(raw: unknown, baseRole: "ADMIN" | "EMPLOYEE"): RoleAccess {
  const out: RoleAccess = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, level] of Object.entries(raw as Record<string, unknown>)) {
    if (!MODULE_KEYS.has(key) || (level !== "view" && level !== "full")) continue;
    if (baseRole === "EMPLOYEE" && MANAGER_MODULES.has(key as ModuleKey)) continue;
    out[key as ModuleKey] = level;
  }
  return out;
}

export type AccessDecision = "allow" | "no-access" | "view-only";

/**
 * Whether a member with this role's access may open `path`, or (when
 * `saving`) change something from it. Pages outside any module are always
 * allowed; a missing module means no access; "view" allows looking only.
 */
export function decideAccess(access: RoleAccess, path: string | null | undefined, saving: boolean): AccessDecision {
  const key = moduleOfPath(path);
  if (!key) return "allow";
  const level = access[key];
  if (!level) return "no-access";
  if (saving && level === "view") return "view-only";
  return "allow";
}

/** The ready made roles every company gets. They can be edited. */
export const PRESET_ROLES: { preset: string; name: string; description: string; baseRole: "ADMIN" | "EMPLOYEE"; access: RoleAccess }[] = [
  {
    preset: "BRANCH_MANAGER",
    name: "Branch manager",
    description: "Runs a branch: sales, customers, stock, buying and staff, without the company books or settings.",
    baseRole: "ADMIN",
    access: {
      assistant: "full",
      calendar: "full",
      reports: "view",
      crm: "full",
      quotes: "full",
      sales: "full",
      returns: "full",
      invoicing: "full",
      support: "full",
      inventory: "full",
      transfers: "full",
      procurement: "full",
      mrp: "full",
      hr: "view",
      projects: "full",
    },
  },
  {
    preset: "ACCOUNTANT",
    name: "Accountant",
    description: "Keeps the books: invoices, payments, accounting, payroll and reports. Can look at sales and stock without changing them.",
    baseRole: "ADMIN",
    access: {
      assistant: "full",
      calendar: "full",
      reports: "view",
      invoicing: "full",
      accounting: "full",
      controlling: "full",
      payroll: "full",
      hr: "view",
      crm: "view",
      sales: "view",
      inventory: "view",
      procurement: "view",
    },
  },
  {
    preset: "CASHIER",
    name: "Cashier",
    description: "Sells and serves customers: orders, returns and support. Can look up customers and stock.",
    baseRole: "EMPLOYEE",
    access: {
      calendar: "full",
      sales: "full",
      returns: "full",
      support: "full",
      crm: "view",
      inventory: "view",
    },
  },
  {
    preset: "STOCK_CONTROLLER",
    name: "Stock controller",
    description: "Looks after stock: counts, deliveries, transfers between branches and purchase orders.",
    baseRole: "EMPLOYEE",
    access: {
      calendar: "full",
      inventory: "full",
      transfers: "full",
      procurement: "full",
      mrp: "full",
      sales: "view",
    },
  },
];
