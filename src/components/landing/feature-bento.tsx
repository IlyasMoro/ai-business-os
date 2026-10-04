import type { ReactNode } from "react";
import { BarChart3, Boxes, Check, Receipt, Sparkles, Users, Wallet, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* The landing page features, shown one at a time by FeatureSlider. Each
   pairs the pitch with a small, static preview of the feature so visitors
   see what it does, not just read it. Accent colors match the department
   colors in ModuleConstellation. */

export type Feature = {
  name: string;
  /** Short eyebrow above the slide title. */
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  preview: ReactNode;
};

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-xl border border-white/[0.07] bg-black/30 p-4 text-xs text-slate-300", className)}
    >
      {children}
    </div>
  );
}

const pipeline = [
  { stage: "New", count: 48, width: "100%" },
  { stage: "Qualified", count: 21, width: "62%" },
  { stage: "Proposal", count: 9, width: "38%" },
  { stage: "Won", count: 5, width: "22%" },
];

const salesFigures = [
  { label: "Quotes accepted", value: "12" },
  { label: "Forecast", value: "$18.4k" },
  { label: "Win rate", value: "42%" },
];

const automations = ["Overdue invoice reminders", "Low stock reorders", "Stale ticket escalation", "Dead lead cleanup"];

export const FEATURES: Feature[] = [
  {
    name: "CRM and Sales",
    label: "Sales",
    description: "Track deals from first contact to signed, send quotes that become orders, and see your forecast and win rate in one report.",
    icon: Users,
    color: "#60a5fa",
    preview: (
      <Panel className="space-y-2.5">
        {pipeline.map((row) => (
          <div key={row.stage} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-slate-400">{row.stage}</span>
            <div className="h-2 flex-1 rounded-full bg-white/[0.05]">
              <div className="h-2 rounded-full bg-(color:--accent)/70" style={{ width: row.width }} />
            </div>
            <span className="w-6 text-right font-mono tabular-nums text-slate-200">{row.count}</span>
          </div>
        ))}
        {/* The quote and sales report figures under the pipeline. */}
        <div className="grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-2.5">
          {salesFigures.map((f) => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-500">{f.label}</p>
              <p className="font-mono font-semibold tabular-nums text-slate-100">{f.value}</p>
            </div>
          ))}
        </div>
      </Panel>
    ),
  },
  {
    name: "Inventory",
    label: "Stock",
    description: "Set a reorder point once. Get flagged the moment stock dips below it, before you run out.",
    icon: Boxes,
    color: "#fbbf24",
    preview: (
      <Panel>
        <div className="flex items-center justify-between">
          <span className="text-slate-200">Printer paper A4</span>
          <span className="rounded-full border border-(color:--accent)/40 bg-(color:--accent)/10 px-2 py-0.5 text-[10px] font-semibold text-(--accent)">
            Reorder now
          </span>
        </div>
        <div className="relative mt-3 h-2 rounded-full bg-white/[0.05]">
          <div className="h-2 w-[18%] rounded-full bg-(color:--accent)" />
          <div className="absolute -top-1 left-[25%] h-4 w-px bg-slate-300/70" />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-500">
          <span>9 in stock</span>
          <span>Reorder at 12</span>
        </div>
      </Panel>
    ),
  },
  {
    name: "Invoicing",
    label: "Invoices",
    description: "Line items, tax, and totals calculated automatically. Send a professional invoice in one click.",
    icon: Receipt,
    color: "#38bdf8",
    preview: (
      <Panel className="space-y-1.5">
        <div className="flex justify-between"><span>Website redesign</span><span className="font-mono tabular-nums">$800.00</span></div>
        <div className="flex justify-between"><span>Hosting, 12 months</span><span className="font-mono tabular-nums">$200.00</span></div>
        <div className="flex justify-between text-slate-500"><span>Tax 15%</span><span className="font-mono tabular-nums">$150.00</span></div>
        <div className="flex items-center justify-between border-t border-white/[0.07] pt-2">
          <span className="font-semibold text-slate-100">Total</span>
          <span className="font-mono font-semibold tabular-nums text-(--accent)">$1,150.00</span>
        </div>
      </Panel>
    ),
  },
  {
    name: "Accounting and Payroll",
    label: "Finance",
    description: "Income and expenses linked back to the invoice or project that created them, so the books reconcile themselves.",
    icon: Wallet,
    color: "#34d399",
    preview: (
      <Panel className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px]">INV 0042</span>
          <span className="text-slate-500">paid, recorded as</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-(color:--accent)/10 px-3 py-2">
          <span className="text-slate-100">Income, Client work</span>
          <span className="font-mono tabular-nums text-(--accent)">+$1,150</span>
        </div>
        <div className="flex items-center gap-1.5 text-(--accent)">
          <Check className="h-3.5 w-3.5" />
          <span>Reconciled automatically</span>
        </div>
      </Panel>
    ),
  },
  {
    name: "Reports",
    label: "Insights",
    description: "Trends over six months and the numbers at risk, plus an AI summary of what actually needs your attention this week.",
    icon: BarChart3,
    color: "#22d3ee",
    preview: (
      <Panel>
        <svg viewBox="0 0 200 48" className="h-12 w-full" preserveAspectRatio="none">
          <polyline
            points="0,40 33,34 66,36 100,24 133,27 166,14 200,8"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--accent)" />
          <span>Revenue up 18%. Two invoices are close to overdue.</span>
        </div>
      </Panel>
    ),
  },
  {
    name: "Automation",
    label: "Automation",
    description: "Overdue invoice reminders, low stock reorders, escalating stale tickets, and clearing out dead leads, running every day without you lifting a finger.",
    icon: Zap,
    color: "#a78bfa",
    preview: (
      <Panel className="grid gap-2 sm:grid-cols-2">
        {automations.map((name) => (
          <div key={name} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5">
            <span className="text-slate-200">{name}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Daily
            </span>
          </div>
        ))}
      </Panel>
    ),
  },
];
