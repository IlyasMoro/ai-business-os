import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { Reveal } from "@/components/landing/reveal";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { FaqRows } from "@/components/landing/faq-section";
import { PricingCompare } from "@/components/landing/pricing-compare";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { AuroraBackdrop } from "@/components/landing/aurora-backdrop";
import { PRICING_FAQ } from "@/components/landing/faq-data";
import { ON_EVERY_PLAN } from "@/lib/plans";

export const metadata = {
  title: "Pricing",
};

// The promises that decide a purchase, strongest first.
const INCLUDED = ON_EVERY_PLAN;

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
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-12 text-center sm:pt-28">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Simple plans that grow with you. No surprises.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-300">
            Every plan includes a team of users, and adding more is simple. Pick a plan by how many
            branches you run and how big your team is.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <Reveal>
            <PricingPlans />
          </Reveal>
        </section>

        {/* The promises every plan keeps, then a link down to the full comparison. */}
        <section className="mx-auto max-w-4xl px-6 pb-24 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">On every plan</p>
          <ul className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                  <Check className="h-3 w-3 text-emerald-300" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <a
            href="#compare"
            className="group mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            See everything that&apos;s included
            <ArrowRight className="h-3.5 w-3.5 rotate-90 transition-transform group-hover:translate-y-0.5" />
          </a>
        </section>

        <section id="compare" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-24 sm:pb-32">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">Compare</p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              One system instead of a stack of apps
            </h2>
            <p className="mt-3 text-slate-400">
              Everything a growing business runs on, in one place. Modules marked Growth or Scale come with those plans.
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
