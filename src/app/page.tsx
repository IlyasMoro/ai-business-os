import { LinkButton } from "@/components/ui/button";
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
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold text-slate-900">AI Business OS</span>
        <nav className="flex items-center gap-3">
          <LinkButton href="/login" variant="ghost" size="sm">
            Sign in
          </LinkButton>
          <LinkButton href="/register" size="sm">
            Get started
          </LinkButton>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Run your whole business from one AI-powered platform.
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
              className="rounded-xl border border-slate-200 p-6 transition-shadow hover:shadow-md"
            >
              <mod.icon className="h-6 w-6 text-indigo-600" />
              <h3 className="mt-4 font-semibold text-slate-900">{mod.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{mod.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
