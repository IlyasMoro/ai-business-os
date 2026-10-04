import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Reveal } from "@/components/landing/reveal";
import { FaqRows } from "@/components/landing/faq-section";
import { PricingCompare } from "@/components/landing/pricing-compare";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { PRICING_FAQ } from "@/components/landing/faq-data";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

export const metadata = {
  title: "Pricing",
};

/* The pricing page in the landing page's language: white page, capital
   headings, white cards with one dark glass highlight, the same footer.
   This is the only place the plans are shown in full. */

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="text-center">
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.title}>{title}</h2>
      {sub && <p className={cn(styles.sub, "mx-auto")}>{sub}</p>}
    </Reveal>
  );
}

export default function PricingPage() {
  return (
    <div className={styles.page}>
      <SiteHeader light />

      <main>
        <section className={cn(styles.section, styles.pricingTop)}>
          <div className="text-center">
            <p className={styles.eyebrow}>Pricing</p>
            <h1 className={styles.title}>Simple plans that grow with you</h1>
            <p className={cn(styles.sub, "mx-auto")}>
              Every plan includes a team of users and a 14 day free trial. Pick a plan by how many branches you run
              and how big your team is.
            </p>
          </div>
          {/* No Reveal here: the cards sit above the fold and are taller than a phone screen,
              so a scroll reveal would leave them hidden until the visitor scrolls. */}
          <div className="mt-12">
            <PricingPlans />
          </div>
        </section>

        <section id="compare" className={styles.section}>
          <SectionHead
            eyebrow="Compare"
            title="Every plan, side by side"
            sub="Everything each plan includes, from users and branches to modules, AI and support."
          />
          <Reveal className="mx-auto mt-10 max-w-5xl">
            <PricingCompare />
          </Reveal>
        </section>

        <section className={styles.section}>
          <SectionHead eyebrow="Billing" title="Common questions" />
          <Reveal className="mx-auto mt-10 max-w-3xl">
            <FaqRows items={PRICING_FAQ} name="pricing-faq" light />
          </Reveal>
          <p className={styles.pricingMore}>
            Questions about the product or your data?{" "}
            <Link href="/#faq" className="group inline-flex items-center gap-1">
              See the full FAQ
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </p>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
