import type { LucideIcon } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

export type SplitPoint = { icon: LucideIcon; title: string; text: string };

/* The public pages built around one card (contact, sign in, sign up): the
   landing nav and footer, a centred heading, then a square card with a dark
   glass panel on the left and the form on the right. On phones the form
   comes first, so nobody scrolls past the panel to reach it. */
export function SplitCardPage({
  eyebrow,
  title,
  sub,
  panelEyebrow,
  points,
  panelFoot,
  children,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  panelEyebrow: string;
  points: SplitPoint[];
  panelFoot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <SiteHeader light />
      <main>
        <section className={cn(styles.section, styles.pricingTop)}>
          <div className="text-center">
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={cn(styles.sub, "mx-auto")}>{sub}</p>
          </div>

          <div className={styles.contactCard}>
            <aside className={cn(styles.glass, styles.contactSide, "order-2 lg:order-none")}>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">{panelEyebrow}</p>
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
              {panelFoot && <div className="mt-auto border-t border-white/10 pt-5 text-sm text-white/70">{panelFoot}</div>}
            </aside>
            <div className="order-1 flex flex-col justify-center p-6 sm:p-10 lg:order-none">{children}</div>
          </div>
        </section>
      </main>
      <LandingFooter className={styles.footNear} />
    </div>
  );
}
