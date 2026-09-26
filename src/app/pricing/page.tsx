import { LinkButton } from "@/components/ui/button";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { Reveal } from "@/components/landing/reveal";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { FaqRows } from "@/components/landing/faq-section";
import { PricingCompare, PLAN_DEPARTMENTS } from "@/components/landing/pricing-compare";
import { AuroraBackdrop } from "@/components/landing/aurora-backdrop";
import { PRICING_FAQ } from "@/components/landing/faq-data";

export const metadata = {
  title: "Pricing",
};

// The promises that decide a purchase, strongest first.
const INCLUDED = [
  "AI Copilot that asks before it acts",
  "Unlimited users, with owner, admin and employee roles",
  "Email for invoices, reminders and notifications",
  "Export your data anytime, cancel anytime",
];

const FAQ = PRICING_FAQ;

export default function PricingPage() {
  return (
    <div className="relative isolate min-h-screen overflow-x-clip text-slate-50">
      <AuroraBackdrop />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-blue-700/10 blur-[140px]" />
      </div>

      <SiteHeader />

      <main className="relative">
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center sm:pt-28">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            One plan. Every module. No surprises.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            A single flat price for your whole company, whether it&apos;s just you or your entire
            team.
          </p>
        </section>

        {/* One compact card, read top to bottom: price, button, promises, then
            a link down to the full comparison table. */}
        <section className="mx-auto max-w-md px-6 pb-24">
          <Reveal className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl sm:p-10">
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-80 -translate-x-1/2 rounded-full bg-blue-600/20 blur-[90px]" />

            <div className="relative text-center">
              <p className="text-sm font-semibold text-slate-300">AIBOS</p>
              <p className="mt-3 flex items-baseline justify-center gap-1.5">
                <span className="text-6xl font-semibold tracking-tight">$49</span>
                <span className="text-slate-400">/ month</span>
              </p>
              <p className="mt-2 text-sm text-slate-400">One flat price for your whole company</p>

              <LinkButton
                href="/register"
                variant="glass"
                size="lg"
                className="mt-8 w-full rounded-full border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl"
              >
                Start your free trial
              </LinkButton>
              <p className="mt-3 text-xs text-slate-400">14 days free · No credit card needed</p>
            </div>

            <div className="relative mt-8 border-t border-white/10 pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Everything included</p>
              <p className="mt-2 text-base font-semibold text-slate-100">
                All {PLAN_DEPARTMENTS.length} departments, every module, one AI.
              </p>
              <ul className="mt-5 space-y-3.5">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-medium text-slate-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                      <Check className="h-3 w-3 text-emerald-300" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#compare"
                className="group mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300"
              >
                See everything that&apos;s included
                <ArrowRight className="h-3.5 w-3.5 rotate-90 transition-transform group-hover:translate-y-0.5" />
              </a>
            </div>
          </Reveal>
        </section>

        <section id="compare" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-24 sm:pb-32">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">Compare</p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              One plan instead of a stack of apps
            </h2>
            <p className="mt-3 text-slate-400">
              Everything a growing business runs on, in one place and priced once.
            </p>
          </Reveal>
          <Reveal className="mt-10">
            <PricingCompare />
          </Reveal>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-24">
          <Reveal className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">Billing</p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Common questions</h2>
          </Reveal>

          <Reveal className="mt-10">
            <FaqRows items={FAQ} name="pricing-faq" />
          </Reveal>

          <p className="mt-8 text-center text-sm text-slate-400">
            Questions about the product or your data?{" "}
            <Link href="/#faq" className="group inline-flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300">
              See the full FAQ
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
