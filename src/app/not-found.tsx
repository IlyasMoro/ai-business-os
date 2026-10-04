import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

export const metadata = {
  title: "Page not found",
};

/* The public 404 for addresses that don't exist, in the landing page's
   language: white page, capital heading, the same header and footer.
   Missing records inside the app use app/dashboard/not-found.tsx. */
export default function NotFound() {
  return (
    <div className={styles.page}>
      <SiteHeader light />

      <main>
        <section className={cn(styles.section, styles.pricingTop, "text-center")}>
          <p className={styles.eyebrow}>404</p>
          <h1 className={styles.title}>Page not found</h1>
          <p className={cn(styles.sub, "mx-auto")}>
            The page you&apos;re looking for doesn&apos;t exist or has moved. Try one of these instead.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <span>
              <Link href="/" className={cn(styles.btnDark, "px-[30px] py-3 text-[0.86rem]")}>
                Back to home
              </Link>
            </span>
            <span>
              <Link href="/pricing" className={cn(styles.btn, "px-[30px] py-3 text-[0.86rem]")}>
                See pricing
              </Link>
            </span>
          </div>
          <p className={styles.pricingMore}>
            Already have an account?{" "}
            <Link href="/login" className="group inline-flex items-center gap-1">
              Sign in
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </p>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
