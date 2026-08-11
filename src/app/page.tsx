import { LinkButton } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { AiTerminalPreview } from "@/components/landing/ai-terminal-preview";
import { ProductPreview } from "@/components/landing/product-preview";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Receipt,
  Zap,
  Users,
  Wallet,
} from "lucide-react";

const modules = [
  { icon: Users, name: "CRM & Sales", description: "Every lead, quote, and customer conversation in one pipeline, from first contact to signed deal." },
  { icon: Boxes, name: "Inventory", description: "Set a reorder point once. Get flagged the moment stock dips below it, before you run out." },
  { icon: Receipt, name: "Invoicing", description: "Line items, tax, and totals calculated automatically. Send a professional invoice in one click." },
  { icon: Wallet, name: "Accounting & Payroll", description: "Income and expenses linked back to the invoice or project that created them, so the books reconcile themselves." },
  { icon: BarChart3, name: "Reports", description: "Six-month trends and at-risk numbers, plus an AI summary of what actually needs your attention this week." },
  { icon: Zap, name: "Automation", description: "Overdue invoice reminders, low-stock reorders, stale-ticket escalation, and dead-lead cleanup, running every day without you lifting a finger." },
];

const alsoIncluded = [
  "Marketing",
  "Procurement",
  "HR",
  "Projects",
  "Calendar",
  "Support",
  "Integrations",
  "Documents",
];

const CTA_CLASS =
  "border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-slate-50">
      {/* Ambient background: a single, static, understated glow for depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-blue-700/10 blur-[140px]" />
      </div>

      <SiteHeader />

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center sm:pt-28">
          <h1 className="animate-fade-up animate-fade-up-2 mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Run your business. Let AI handle the busywork,{" "}
            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              with your approval on everything that matters.
            </span>
          </h1>

          <p className="animate-fade-up animate-fade-up-3 mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300">
            CRM, sales, inventory, accounting, HR, payroll, invoicing, projects, and support, all
            unified, with an AI assistant that looks up real data, proposes actions, and executes
            them once you approve.
          </p>

          <div className="animate-fade-up animate-fade-up-4 mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/register" variant="glass" size="lg" className={`${CTA_CLASS} rounded-full`}>
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>

          <div className="animate-fade-up animate-fade-up-5 mt-16 flex w-full items-start justify-between border-t border-white/10 pt-12">
            {[
              ["$49/mo", "Flat pricing"],
              ["14 days", "Free trial"],
              ["24/7", "Always on"],
            ].map(([value, label]) => (
              <div key={label} className="px-4 py-5">
                <p className="font-mono text-2xl font-semibold text-slate-50">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Product screenshot, with the AI Copilot shown as a live widget on top of it */}
        <section className="px-6 pb-24 sm:pb-32">
          <Reveal className="relative mx-auto max-w-4xl">
            <ProductPreview />
            <div className="relative mt-6 sm:absolute sm:-bottom-12 sm:-right-6 sm:mt-0 sm:w-80 md:-bottom-16 md:-right-10 md:w-[26rem]">
              <AiTerminalPreview />
            </div>
          </Reveal>
        </section>

        {/* Feature grid */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Every department, one workspace
            </h2>
            <p className="mt-3 text-slate-400">
              Purpose built modules that share the same customers, data, and AI assistant.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod, i) => (
              <Reveal key={mod.name} delay={i * 75}>
                <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/30">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-slate-50 transition-colors duration-300 group-hover:border-white/25 group-hover:bg-white/15">
                    <mod.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-50">{mod.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{mod.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-8">
            <span className="text-sm text-slate-500">Plus every other department:</span>
            {alsoIncluded.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400 backdrop-blur-md"
              >
                {name}
              </span>
            ))}
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
