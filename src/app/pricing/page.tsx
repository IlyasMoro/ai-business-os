import { LinkButton } from "@/components/ui/button";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { Reveal } from "@/components/landing/reveal";
import { Check } from "lucide-react";

export const metadata = {
  title: "Pricing",
};

const INCLUDED = [
  "Every module: CRM, Marketing, Sales, Inventory, Procurement, Invoicing, Accounting, HR, Payroll, Projects, Calendar, Support, and Automation",
  "Unlimited users on your team, no per seat charges",
  "The AI Copilot, included at no extra cost",
  "Email sending for invoices, reminders, and notifications",
  "14 day free trial, no credit card required to start",
];

const FAQ = [
  {
    q: "Is there really no credit card required for the trial?",
    a: "Correct. You can create a company workspace and use every module for 14 days without entering any payment details at all.",
  },
  {
    q: "What happens when the trial ends?",
    a: "If you haven't subscribed, access to the dashboard pauses until you do. Nothing is deleted, and everything is exactly as you left it once you subscribe.",
  },
  {
    q: "Do you charge per user?",
    a: "No. The $49 per month price covers your whole company, however many people you invite.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, directly from the Billing page in your dashboard, no need to contact anyone.",
  },
];

export default function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-slate-50">
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

        <section className="mx-auto max-w-md px-6 pb-24">
          <Reveal className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
            <p className="text-sm font-medium text-slate-400">AIBOS</p>
            <p className="mt-3 flex items-baseline justify-center gap-1">
              <span className="text-5xl font-semibold tracking-tight">$49</span>
              <span className="text-slate-400">/ month</span>
            </p>
            <p className="mt-2 text-sm text-slate-400">Per company, unlimited users</p>

            <LinkButton
              href="/register"
              variant="glass"
              size="lg"
              className="mt-8 w-full border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl"
            >
              Start your free trial
            </LinkButton>

            <ul className="mt-8 space-y-3 text-left">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-24">
          <Reveal className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Common questions</h2>
          </Reveal>

          <div className="mt-10 space-y-5">
            {FAQ.map((item, i) => (
              <Reveal
                key={item.q}
                delay={i * 75}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-xl"
              >
                <h3 className="font-semibold text-slate-50">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.a}</p>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
