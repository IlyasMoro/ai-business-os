import { LinkButton } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { AiTerminalPreview } from "@/components/landing/ai-terminal-preview";
import { ProductPreview } from "@/components/landing/product-preview";
import { ModuleConstellation } from "@/components/landing/module-constellation";
import { FeatureBento } from "@/components/landing/feature-bento";
import { ArrowRight } from "lucide-react";
import { AuroraBackdrop } from "@/components/landing/aurora-backdrop";

const CTA_CLASS =
  "border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl";

export default function Home() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden text-slate-50">
      <AuroraBackdrop />
      {/* Ambient background: a single, static, understated glow for depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-blue-700/10 blur-[140px]" />
      </div>

      <SiteHeader />

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center sm:pt-28">
          {/* Exactly two lines from lg up: each half is its own line, kept on one
              line and sized to the viewport so it always fits. Smaller screens
              let each half wrap naturally. */}
          <h1 className="animate-fade-up animate-fade-up-2 mx-auto text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-[clamp(2.25rem,3.3vw,3.2rem)]">
            <span className="block lg:whitespace-nowrap">Run your business. Let AI handle the busywork,</span>
            <span className="block bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent lg:whitespace-nowrap">
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

          <div className="animate-fade-up animate-fade-up-5 mx-auto mt-16 flex w-full max-w-4xl items-start justify-between border-t border-white/10 pt-12">
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

        {/* Product screenshot, with the AI Copilot shown as a live widget on top of it.
            From sm up the widget hangs 3rem (md: 4rem) below the screenshot, so the
            bottom padding adds that overhang back to keep the usual 8rem gap. */}
        <section className="px-6 pb-24 sm:pb-44 md:pb-48">
          <Reveal className="relative mx-auto max-w-4xl">
            <ProductPreview />
            <div className="relative mt-6 sm:absolute sm:-bottom-12 sm:-right-6 sm:mt-0 sm:w-80 md:-bottom-16 md:-right-10 md:w-[26rem]">
              <AiTerminalPreview />
            </div>
          </Reveal>
        </section>

        {/* The AIBOS mark as a map of the product: eight departments around one AI */}
        <section className="mx-auto max-w-6xl px-6 pb-24 sm:pb-32">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Eight departments, one AI at the center
            </h2>
            <p className="mt-3 text-slate-400">
              Every point of the AIBOS logo is a part of your business. They all feed the AI Copilot in the
              middle, so it sees the whole picture and can act across all of them.
            </p>
          </Reveal>
          <Reveal className="mt-12">
            <ModuleConstellation />
          </Reveal>
        </section>

        {/* Feature grid */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Every department, one workspace
            </h2>
            <p className="mt-3 text-slate-400">
              Purpose built modules that share the same customers, data, and AI assistant.
            </p>
          </Reveal>

          <FeatureBento />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
