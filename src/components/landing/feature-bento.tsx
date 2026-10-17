import { BarChart3, Boxes, Receipt, Users, Wallet, Zap, type LucideIcon } from "lucide-react";

/* The landing page features, shown one at a time by FeatureSlider. Each
   pairs a real screenshot of the module (taken from the demo company) with
   the pitch and three things it does. The points only claim what the
   screenshot or the product actually shows. */

export type Feature = {
  name: string;
  /** Short eyebrow above the slide title. */
  label: string;
  description: string;
  icon: LucideIcon;
  /** A real screenshot of the module, taken from the demo company. */
  shot: { src: string; alt: string };
  /** Three short points, each true of the screenshot or the product. */
  points: [string, string, string];
};

export const FEATURES: Feature[] = [
  {
    name: "CRM and Sales",
    shot: { src: "/screenshots/feature-crm.png", alt: "The CRM deals board with open pipeline, weighted forecast and win rate" },
    label: "Sales",
    description: "Track deals from first contact to signed, send quotes that become orders, and see your forecast and win rate in one report.",
    icon: Users,
    points: ["Drag deals between stages", "Weighted forecast in rand", "Quotes become orders in one click"],
  },
  {
    name: "Inventory",
    shot: { src: "/screenshots/feature-inventory.png", alt: "The inventory page with stock value, low stock items and stock health" },
    label: "Stock",
    description: "Set a reorder point once. Get flagged the moment stock dips below it, before you run out.",
    icon: Boxes,
    points: ["Reorder points for every product", "Low stock flagged before you run out", "Stock value at cost, always current"],
  },
  {
    name: "Invoicing",
    shot: { src: "/screenshots/feature-invoicing.png", alt: "The invoices page with outstanding, overdue and paid invoices" },
    label: "Invoices",
    description: "Line items, tax, and totals calculated automatically. Send a professional invoice in one click.",
    icon: Receipt,
    points: ["Tax and totals worked out for you", "Overdue invoices flagged on their own", "Who owes you most, at a glance"],
  },
  {
    name: "Accounting and Payroll",
    shot: { src: "/screenshots/feature-accounting.png", alt: "The accounting page with income, expenses and net profit" },
    label: "Finance",
    description: "Income and expenses linked back to the invoice or project that created them, so the books reconcile themselves.",
    icon: Wallet,
    points: ["Paid invoices recorded as income", "Spending sorted by category", "Net profit always up to date"],
  },
  {
    name: "Reports",
    shot: { src: "/screenshots/feature-reports.png", alt: "The reports page with six month income, expenses and an AI revenue forecast" },
    label: "Insights",
    description: "Trends over six months and the numbers at risk, plus an AI summary of what actually needs your attention this week.",
    icon: BarChart3,
    points: ["Six month trends side by side", "Profit and margin for every branch", "AI forecast for next month"],
  },
  {
    name: "Automation",
    shot: { src: "/screenshots/feature-automation.png", alt: "The automation rules page with reminders, restocking and cleanup switched on" },
    label: "Automation",
    description: "Overdue invoice reminders, low stock reorders, escalating stale tickets, and clearing out dead leads, running every day without you lifting a finger.",
    icon: Zap,
    points: ["Switch each rule on or off", "Drafts wait for your approval", "Runs every day on its own"],
  },
];
