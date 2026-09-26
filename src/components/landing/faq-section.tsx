import Link from "next/link";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { FAQ_GROUPS, type FaqItem } from "@/components/landing/faq-data";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/reveal";

/** schema.org FAQPage markup, built from the same data as the visible rows so
 * the two can never disagree. `<` is escaped as the Next.js JSON-LD guide
 * recommends, so no string can close the script tag early. */
const faqJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }))
  ),
}).replace(/</g, "\\u003c");

/* Two columns on desktop: the heading and a help card stay pinned on the
   left while the grouped questions scroll on the right. Rows are native
   <details> sharing one `name`, so only one answer is open at a time and it
   all works with the keyboard and screen readers without JavaScript. The
   smooth open and close lives in globals.css (.faq-item). */
export function FaqSection() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
      <Reveal>
        <div className="lg:sticky lg:top-28">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">FAQ</p>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Questions, answered</h2>
          <p className="mt-4 leading-relaxed text-slate-400">
            The short version of what people ask before they start their free trial.
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <p className="mt-3 text-sm font-semibold text-slate-100">How we handle your data</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              Every detail on storage, sharing and the AI provider is in our policy.
            </p>
            <Link
              href="/privacy"
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Read the Privacy Policy
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </Reveal>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      <div className="space-y-10">
        {FAQ_GROUPS.map((group, g) => (
          <Reveal key={group.title} delay={g * 90}>
            <h3 className="text-sm font-semibold text-slate-400">{group.title}</h3>
            <FaqRows items={group.items} name="landing-faq" className="mt-3" />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/** Divider line question rows, shared with the pricing page. Rows with the
 * same `name` form one group where only one answer is open at a time. */
export function FaqRows({ items, name, className }: { items: FaqItem[]; name: string; className?: string }) {
  return (
    <div className={cn("border-t border-white/10", className)}>
      {items.map((item) => (
        <details key={item.q} name={name} className="faq-item group border-b border-white/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-medium text-slate-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-slate-300 transition-all duration-300 group-open:rotate-45 group-open:border-blue-400/50 group-open:bg-blue-500/15 group-open:text-blue-300">
              <Plus className="h-3.5 w-3.5" />
            </span>
          </summary>
          <p className="max-w-2xl pb-6 pr-12 text-[15px] leading-relaxed text-slate-400">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
