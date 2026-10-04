import Link from "next/link";
import { Building2, Clock, MessageSquare } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ContactForm } from "@/components/landing/contact-form";
import { topicFromQuery } from "@/lib/contact";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

export const metadata = {
  title: "Contact us",
  description: "Questions about AIBOS, plans or the Enterprise plan? Send us a message.",
};

/* The public contact page, in the landing page's look: one card with the
   ways we help in dark glass on the left and the form on the right.
   Messages go to the platform admin inbox (/dashboard/admin/messages) and to
   the operator by email when email is set up. ?topic=enterprise comes from
   "Talk to us". */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const points = [
    { icon: MessageSquare, title: "Plans and pricing", text: "Not sure which plan fits? Tell us your team size and branches." },
    { icon: Building2, title: "Enterprise", text: "Contracts, invoicing instead of a card, or a very large team." },
    { icon: Clock, title: "Quick replies", text: "We reply by email, usually within one working day." },
  ];

  return (
    <div className={styles.page}>
      <SiteHeader light />
      <main>
        <section className={cn(styles.section, styles.pricingTop)}>
          <div className="text-center">
            <p className={styles.eyebrow}>Contact</p>
            <h1 className={styles.title}>Talk to us</h1>
            <p className={cn(styles.sub, "mx-auto")}>Questions about AIBOS, your plan or your data? Send a message and a person will reply.</p>
          </div>

          <div className={styles.contactCard}>
            <aside className={cn(styles.glass, styles.contactSide)}>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">How we can help</p>
                <ul className="mt-6 space-y-6">
                  {points.map((p) => (
                    <li key={p.title} className="flex gap-4">
                      <span className={styles.contactIcon} aria-hidden>
                        <p.icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-semibold text-white">{p.title}</span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-white/70">{p.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-auto border-t border-white/10 pt-5 text-sm text-white/70">
                Already using AIBOS?{" "}
                <Link href="/login" className="font-semibold text-cyan-300 hover:text-white">
                  Sign in
                </Link>{" "}
                and open Help and FAQ from your account menu.
              </p>
            </aside>
            <div className="p-6 sm:p-10">
              <ContactForm topic={topicFromQuery(topic)} />
            </div>
          </div>
        </section>
      </main>
      <LandingFooter className={styles.footNear} />
    </div>
  );
}
