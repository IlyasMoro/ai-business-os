/* The modules a company can switch off on Settings > Modules. Pure, so the
   page, the menu and the access check share one list. User facing text has
   no hyphens. */
import type { ModuleKey } from "@/lib/role-access";

/** Every switch writes the company's own list. Returns, Planning, EDI and
 * Controlling also had a switch on their own settings page before this one
 * existed; `store` names that row so both stay in step. */
export type ModuleStore = "company" | "returns" | "mrp" | "edi" | "controlling";

export type SwitchableModule = {
  key: ModuleKey;
  label: string;
  description: string;
  section: string;
  store: ModuleStore;
};

/** Everyday core modules (Dashboard, CRM, Sales, Invoicing, Inventory and
 * the settings pages) can't be switched off; everything else can. */
export const SWITCHABLE_MODULES: SwitchableModule[] = [
  { key: "assistant", label: "AI Copilot", description: "Ask questions and get suggested next steps", section: "Everyday", store: "company" },
  { key: "calendar", label: "Calendar", description: "Due dates, tasks and follow ups in one place", section: "Everyday", store: "company" },
  { key: "marketing", label: "Marketing", description: "Campaigns, budgets and the leads they bring", section: "Customers and Sales", store: "company" },
  { key: "quotes", label: "Quotes", description: "Price offers customers accept online", section: "Customers and Sales", store: "company" },
  { key: "returns", label: "Returns", description: "Returned goods, refunds and credit", section: "Customers and Sales", store: "returns" },
  { key: "support", label: "Support", description: "Customer tickets and their status", section: "Customers and Sales", store: "company" },
  { key: "procurement", label: "Procurement", description: "Purchase orders, suppliers and deliveries", section: "Operations", store: "company" },
  { key: "mrp", label: "Planning", description: "What to buy or make, and work orders", section: "Operations", store: "mrp" },
  { key: "accounting", label: "Accounting", description: "Income, expenses and the books", section: "Finance", store: "company" },
  { key: "controlling", label: "Controlling", description: "Cost centres, budgets and profitability", section: "Finance", store: "controlling" },
  { key: "hr", label: "HR", description: "Employees, roles and departments", section: "People", store: "company" },
  { key: "payroll", label: "Payroll", description: "Pay runs and payslips", section: "People", store: "company" },
  { key: "projects", label: "Projects", description: "Projects, tasks and progress", section: "Work Management", store: "company" },
  { key: "automation", label: "Automation", description: "Rules that run tasks for you", section: "Work Management", store: "company" },
  { key: "edi", label: "EDI", description: "Orders and invoices exchanged with trading partners", section: "Connectivity", store: "edi" },
];

const COMPANY_KEYS = new Set<string>(SWITCHABLE_MODULES.map((m) => m.key));

/** Keeps only modules that can be switched off. */
export function cleanDisabledModules(raw: readonly string[] | null | undefined): ModuleKey[] {
  return [...new Set((raw ?? []).filter((key) => COMPANY_KEYS.has(key)))] as ModuleKey[];
}

/** True when `path` belongs to a module the company switched off. */
export function isModuleOff(disabled: readonly string[], path: string | null | undefined): boolean {
  if (!path?.startsWith("/dashboard/")) return false;
  const segment = path.split("/")[2] ?? "";
  return disabled.includes(segment);
}
