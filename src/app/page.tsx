import { Download, Lock, ShieldCheck, UserCog } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SiteHeader } from "@/components/landing/site-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { AiTerminalPreview } from "@/components/landing/ai-terminal-preview";
import { ProductPreview } from "@/components/landing/product-preview";
import { ModuleConstellation } from "@/components/landing/module-constellation";
import { FeatureSlider } from "@/components/landing/feature-slider";
import { FaqSection } from "@/components/landing/faq-section";
import { STARTING_PRICE } from "@/lib/plans";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

/* A white page with dark glass accents: a black glass hero over the
   blurred dashboard, the product shot overlapping it, then How it works,
   Features, the trust panel and the FAQ, closing on a dark glass
   footer. Styles live in components/landing/landing.module.css. */

// Each point restates an answer in faq-data.ts, so the two never disagree.
const TRUST = [
  {
    icon: ShieldCheck,
    title: "AI that asks first",
    text: "Every action the AI Copilot proposes waits for an owner or admin to approve it.",
  },
  {
    icon: Lock,
    title: "Your data stays private",
    text: "Kept separate from every other company, never sold, and never used to train AI for other customers.",
  },
  {
    icon: UserCog,
    title: "Roles for every user",
    text: "Employees see the modules they work in, while HR, payroll and accounting stay with owners and admins.",
  },
  {
    icon: Download,
    title: "Export anytime",
    text: "Export any list as a CSV file or download a full backup, and cancel from the Billing page.",
  },
];

const STATS = [
  [`From $${STARTING_PRICE}`, "Per month"],
  ["14 days", "Free trial"],
  ["24/7", "Always on"],
];

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.title}>{title}</h2>
      {sub && <p className={styles.sub}>{sub}</p>}
    </Reveal>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <SiteHeader light />

      <main>
        {/* Hero: black glass over the dashboard, blurred the way a photo would sit */}
        <section className={styles.hero}>
          <div
            aria-hidden
            className={styles.heroBg}
            style={{ backgroundImage: "url(/screenshots/dashboard-overview.png)" }}
          />
          <div className={styles.heroIn}>
            <h1 className={cn(styles.heroH, "animate-fade-up animate-fade-up-2")}>
              <span className={styles.heroLine}>Run your business. Let AI handle the busywork,</span>{" "}
              <span className={styles.heroLine}>with your approval on everything that matters.</span>
            </h1>
            <p className={cn(styles.heroSub, "animate-fade-up animate-fade-up-3")}>
              CRM, sales, inventory, accounting, HR, payroll, invoicing, projects, and support, all unified, with an
              AI assistant that looks up real data, proposes actions, and executes them once you approve.
            </p>
            <p className={cn(styles.heroNote, "animate-fade-up animate-fade-up-4")}>
              14 day free trial &nbsp;·&nbsp; No credit card required
            </p>
          </div>
        </section>

        {/* Product shot overlapping the hero, with the AI Copilot shown as a
            live widget on top of it. */}
        <section id="copilot" className="scroll-mt-24">
          <div className={styles.shot}>
            <ProductPreview />
            <div className="relative mt-6 sm:absolute sm:-bottom-12 sm:-right-6 sm:mt-0 sm:w-80 md:-bottom-16 md:-right-10 md:w-[26rem]">
              <AiTerminalPreview />
            </div>
          </div>
        </section>

        <div className={styles.stats}>
          {STATS.map(([value, label], i) => (
            <Reveal key={label} delay={i * 75}>
              <div className={cn(styles.stat, i === 0 && cn(styles.glass, styles.statFeat))}>
                <p className={styles.statValue}>{value}</p>
                <p className={styles.statLabel}>{label}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* The AIBOS mark as a map of the product: eight departments around one AI */}
        <section id="how" className={styles.section}>
          <SectionHead
            eyebrow="How it works"
            title="Eight departments, one AI at the center"
            sub="Every point of the AIBOS logo is a part of your business. They all feed the AI Copilot in the middle, so it sees the whole picture and can act across all of them."
          />
          <Reveal className={cn(styles.glass, styles.constellationPanel)}>
            <ModuleConstellation />
          </Reveal>
        </section>

        <section id="features" className={styles.section}>
          <SectionHead
            eyebrow="Features"
            title="Every department, one workspace"
            sub="Purpose built modules that share the same customers, data, and AI assistant."
          />
          <FeatureSlider />
        </section>

        <section className={styles.section}>
          <Reveal className={cn(styles.glass, styles.trustbox)}>
            <p className={styles.trustEyebrow}>What you can count on</p>
            <div className={styles.trustGrid}>
              {TRUST.map((item) => (
                <div key={item.title} className={styles.trust}>
                  <span className={styles.trustIc} aria-hidden>
                    <item.icon />
                  </span>
                  <p className={styles.trustT}>{item.title}</p>
                  <p className={styles.trustD}>{item.text}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="faq" className={styles.section}>
          <FaqSection light />
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
