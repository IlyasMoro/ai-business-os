import Link from "next/link";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { FAQ_GROUPS, type FaqItem } from "@/components/landing/faq-data";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/reveal";
import styles from "@/components/landing/landing.module.css";

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
export function FaqSection({ light = false }: { light?: boolean }) {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
      <Reveal>
        <div className="lg:sticky lg:top-28">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.14em]",
              light ? "font-extrabold tracking-[0.01em] text-[#0b1f5e]" : "text-blue-400"
            )}
          >
            FAQ
          </p>
          <h2
            className={cn(
              "font-display mt-3 text-3xl tracking-tight sm:text-4xl",
              light ? "font-extrabold uppercase leading-[1.05] text-[#0b1f5e]" : "font-semibold"
            )}
          >
            Questions, answered
          </h2>
          <p className={cn("mt-4 leading-relaxed", light ? "text-[#3b4a63]" : "text-slate-400")}>
            The short version of what people ask before they start their free trial.
          </p>

          {/* Light page: the help card is the dark glass panel, like the
              rest of the landing page's dark surfaces. */}
          <div
            className={cn(
              "mt-8 p-5",
              light ? cn(styles.glass, "rounded-xl") : "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
            )}
          >
            <ShieldCheck className={cn("h-5 w-5", light ? "text-cyan-400" : "text-emerald-400")} />
            <p className="mt-3 text-sm font-semibold text-slate-100">How we handle your data</p>
            <p className={cn("mt-1 text-sm leading-relaxed", light ? "text-white/70" : "text-slate-400")}>
              Every detail on storage, sharing and the AI provider is in our policy.
            </p>
            <Link
              href="/privacy"
              className={cn(
                "group mt-4 inline-flex items-center gap-1.5 text-sm font-medium",
                light ? "font-bold text-cyan-400 hover:text-white" : "text-blue-400 hover:text-blue-300"
              )}
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
            <h3
              className={cn(
                "text-sm font-semibold",
                light ? "font-extrabold uppercase tracking-[0.05em] text-[#8a93a3]" : "text-slate-400"
              )}
            >
              {group.title}
            </h3>
            <FaqRows items={group.items} name="landing-faq" className="mt-3" light={light} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/** Divider line question rows, shared with the pricing page. Rows with the
 * same `name` form one group where only one answer is open at a time.
 * `light` renders them for the white landing page; the pricing page keeps
 * the dark rows. */
export function FaqRows({
  items,
  name,
  className,
  light = false,
}: {
  items: FaqItem[];
  name: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={cn("border-t", light ? "border-[#d5dce5]" : "border-white/10", className)}>
      {items.map((item) => (
        <details
          key={item.q}
          name={name}
          className={cn("faq-item group border-b", light ? "border-[#d5dce5]" : "border-white/10")}
        >
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden",
              light
                ? "font-bold text-[#0b1f5e] hover:text-[#1848d8] focus-visible:ring-cyan-400"
                : "font-medium text-slate-100 hover:text-white focus-visible:ring-blue-500"
            )}
          >
            {item.q}
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 group-open:rotate-45",
                light
                  ? "border-transparent bg-[linear-gradient(180deg,#161d2c,#0b0f17)] text-cyan-400 group-open:bg-cyan-400 group-open:bg-none group-open:text-[#0a1428]"
                  : "border-white/15 text-slate-300 group-open:border-blue-400/50 group-open:bg-blue-500/15 group-open:text-blue-300"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </span>
          </summary>
          <p
            className={cn(
              "max-w-2xl pb-6 pr-12 text-[15px] leading-relaxed",
              light ? "text-[#3b4a63]" : "text-slate-400"
            )}
          >
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
