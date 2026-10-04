import { Mail, MessageSquare, Clock } from "lucide-react";
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

/* The public contact page, in the landing page's look. Messages go to the
   platform admin inbox (/dashboard/admin/messages) and to the operator by
   email when email is set up. ?topic=enterprise comes from "Talk to us". */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const points = [
    { icon: MessageSquare, title: "Plans and pricing", text: "Not sure which plan fits? Tell us your team size and branches." },
    { icon: Mail, title: "Enterprise", text: "Contracts, invoicing instead of a card, or a very large team." },
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

          <div className="mx-auto mt-12 grid max-w-5xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <ul className="space-y-5">
              {points.map((p) => (
                <li key={p.title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0b1f5e] text-cyan-300" aria-hidden>
                    <p.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-semibold text-[#0b1f5e]">{p.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(11,31,94,0.35)] sm:p-8">
              <ContactForm topic={topicFromQuery(topic)} />
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
