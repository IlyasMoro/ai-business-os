import Link from "next/link";
import { Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

/* The closing band of the landing and pricing pages: full width dark glass
   carrying the brand lockup, the final call to action and the site links.
   Other public pages keep SiteFooter. */

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#faq", label: "FAQ" },
  { href: "/pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/login", label: "Sign in" },
];

export function LandingFooter() {
  return (
    <footer className={cn(styles.glass, styles.foot)}>
      <div className={styles.footIn}>
        <div className={styles.footTop}>
          <div>
            <Link href="/" className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
              {/* The mark's deep blue would vanish into the glass, so a thin
                  light outline and a faint cyan glow trace it. */}
              <Logo alwaysDark className={styles.footMark} />
            </Link>

            <h2 className={styles.footH}>Your whole business, one AI that asks first.</h2>
            <p className={styles.footP}>
              Start with every module and the AI Copilot included. 14 days free, no credit card needed.
            </p>
            <div className={styles.footCta}>
              <Link href="/register" className={styles.btn}>
                Start free trial
              </Link>
            </div>
          </div>

          {/* The site links in a grid, Contact centred below a thin line. */}
          <nav aria-label="Footer" className={styles.footNav}>
            <div className={styles.footLinks}>
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={styles.footLink}>
                  {link.label}
                </Link>
              ))}
            </div>
            <div className={styles.footContactRow}>
              <Link href="/contact" className={styles.footContact}>
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Contact us
              </Link>
            </div>
          </nav>
        </div>

        <p className={styles.footBottom}>© {new Date().getFullYear()} AIBOS. All rights reserved.</p>
      </div>
    </footer>
  );
}
