import { LinkButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  BarChart3,
  Boxes,
  Receipt,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const modules = [
  { icon: Users, name: "CRM & Sales", description: "Track customers, leads, and deals in one place." },
  { icon: Boxes, name: "Inventory", description: "Stay on top of stock levels and reorder points." },
  { icon: Receipt, name: "Invoicing", description: "Generate and send professional invoices in seconds." },
  { icon: Wallet, name: "Accounting & Payroll", description: "Keep the books balanced and pay your team on time." },
  { icon: BarChart3, name: "Reports", description: "Understand what's driving — or hurting — your business." },
  { icon: Sparkles, name: "AI Assistant", description: "Ask questions and get answers backed by your real data." },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white shadow-sm">
            AI
          </span>
          Business OS
        </span>
        <nav className="flex items-center gap-1">
          <ThemeToggle />
          <LinkButton href="/login" variant="ghost" size="sm">
            Sign in
          </LinkButton>
          <LinkButton href="/register" size="sm">
            Get started
          </LinkButton>
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Run your whole business from{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">
              one AI-powered platform
            </span>
            .
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            CRM, sales, inventory, accounting, HR, payroll, invoicing, projects, and support —
            unified, with an AI assistant that predicts sales, forecasts cash flow, and answers
            questions about your business.
          </p>
          <div className="mt-8 flex gap-4">
            <LinkButton href="/register" size="lg">
              Start free
            </LinkButton>
            <LinkButton href="/login" variant="secondary" size="lg">
              Sign in
            </LinkButton>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <div
              key={mod.name}
              className="group rounded-xl border border-slate-200 bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 transition-colors group-hover:bg-indigo-100">
                <mod.icon className="h-5 w-5 text-indigo-600" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{mod.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{mod.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
