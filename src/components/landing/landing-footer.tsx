import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

/* The closing band of the landing, pricing and 404 pages, in two parts:
   the closing pitch with the trial and a quieter way to talk to us, then
   a footer with the brand badge (as in the nav bar) and the site links in
   titled columns. Other public pages keep SiteFooter. */

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#copilot", label: "AI Copilot" },
      { href: "/#how", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Start free trial" },
    ],
  },
];

export function LandingFooter({ className }: { className?: string }) {
  return (
    <footer className={cn(styles.glass, styles.foot, className)}>
      <div className={styles.footIn}>
        {/* The closing pitch. */}
        <div className={styles.footPitch}>
          <h2 className={styles.footH}>Your whole business, one AI that asks first.</h2>
          <p className={styles.footP}>
            Start with every module and the AI Copilot included. 14 days free, no credit card needed.
          </p>
          <div className={styles.footCta}>
            <Link href="/register" className={styles.btn}>
              Start free trial
            </Link>
            <Link href="/contact" className={styles.footGhost}>
              Talk to us
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>

        {/* The footer proper: brand, then the links in titled columns. */}
        <div className={styles.footMain}>
          <div>
            <Link
              href="/"
              aria-label="AIBOS home"
              className="inline-flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span className={styles.navBadge} aria-hidden>
                <Image src="/logo-mark.png" alt="" width={64} height={64} />
              </span>
              <span className="font-display text-[15px] font-extrabold tracking-[0.18em] text-white">AIBOS</span>
            </Link>
            <p className={styles.footTag}>Every department of your business in one place, with an AI that asks before it acts.</p>
          </div>

          <nav aria-label="Footer" className={styles.footCols}>
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className={styles.footColH}>{col.title}</p>
                <ul className={styles.footColList}>
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={styles.footLink}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.footBottom}>
          <p>© {new Date().getFullYear()} AIBOS. All rights reserved.</p>
          <p className={styles.footBottomLinks}>
            <Link href="/privacy">Privacy</Link>
            <span aria-hidden>·</span>
            <Link href="/terms">Terms</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
