import Link from "next/link";
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
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const modules = [
  { icon: Users, name: "CRM & Sales", description: "Track customers, leads, and deals in one place." },
  { icon: Boxes, name: "Inventory", description: "Stay on top of stock levels and reorder points." },
  { icon: Receipt, name: "Invoicing", description: "Generate and send professional invoices in seconds." },
  { icon: Wallet, name: "Accounting & Payroll", description: "Keep the books balanced and pay your team on time." },
  { icon: BarChart3, name: "Reports", description: "Understand what's driving or hurting your business." },
  { icon: Sparkles, name: "AI Copilot", description: "Ask questions, get answers, and approve actions backed by your real data." },
];

const alsoIncluded = [
  "Marketing",
  "Procurement",
  "HR",
  "Payroll",
  "Projects",
  "Calendar",
  "Support",
  "Automation",
  "Integrations",
  "Documents",
];

const CTA_CLASS =
  "border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050b1e] via-[#060a18] to-[#03050d] text-slate-50">
      {/* Ambient background: a single, static, understated glow for depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-blue-700/10 blur-[140px]" />
      </div>

      <SiteHeader />

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center sm:pt-28">
          <p className="animate-fade-up animate-fade-up-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            AI Powered Business Operating System
          </p>

          <h1 className="animate-fade-up animate-fade-up-2 mx-auto mt-8 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Run your whole business from{" "}
            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              one AI powered platform
            </span>
          </h1>

          <p className="animate-fade-up animate-fade-up-3 mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-300">
            CRM, sales, inventory, accounting, HR, payroll, invoicing, projects, and support, all
            unified, with an AI assistant that looks up real data, proposes actions, and executes
            them once you approve.
          </p>

          <div className="animate-fade-up animate-fade-up-4 mt-10 flex flex-col items-center justify-center gap-4">
            <LinkButton href="/register" variant="glass" size="lg" className={`${CTA_CLASS} group`}>
              Start free trial
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </LinkButton>
            <p className="text-sm text-slate-500">
              No credit card required.{" "}
              <Link href="/login" className="font-medium text-slate-300 hover:text-slate-50">
                Sign in
              </Link>
            </p>
          </div>

          <div className="animate-fade-up animate-fade-up-4 mx-auto mt-16 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {[
              ["$49/mo", "Flat pricing"],
              ["14 days", "Free trial"],
              ["24/7", "Always on"],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="font-mono text-2xl font-semibold text-slate-50">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Product screenshot */}
        <section className="px-6 pb-20">
          <Reveal>
            <ProductPreview />
          </Reveal>
        </section>

        {/* AI preview */}
        <section className="px-6 pb-24">
          <Reveal>
            <AiTerminalPreview />
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
            <span className="text-sm text-slate-500">Also included:</span>
            {alsoIncluded.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400"
              >
                {name}
              </span>
            ))}
          </Reveal>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <Reveal className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-8 py-16 text-center backdrop-blur-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-[100px]"
            />
            <h2 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">
              One flat price. Every module. No setup fees.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-slate-400">
              Create your workspace in minutes and try everything free for 14 days.
            </p>
            <div className="relative mt-8 flex justify-center">
              <LinkButton href="/register" variant="glass" size="lg" className={CTA_CLASS}>
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
