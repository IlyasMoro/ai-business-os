"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoBadge } from "@/components/brand/logo-badge";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles, Workflow, LayoutGrid, CircleHelp, Tag, Mail, LogIn, type LucideIcon } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

/* Landing page sections, in page order. Each id is set on its <section> in
   app/page.tsx. The desktop bar keeps the main ones (AI Copilot, How it
   works, Features, Pricing); FAQ and Contact live in the footer and the
   phone menu. */
const SECTIONS = [
  { id: "copilot", label: "AI Copilot", icon: Sparkles, inBar: true, highlights: "copilot" },
  { id: "how", label: "How it works", icon: Workflow, inBar: true, highlights: "how" },
  { id: "features", label: "Features", icon: LayoutGrid, inBar: true, highlights: "features" },
  { id: "faq", label: "FAQ", icon: CircleHelp, inBar: false, highlights: "faq" },
];

const CTA_CLASS =
  "rounded-full border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl";

/** `light`: the landing page's floating white pill bar with a glossy black
 * call to action. Other public pages keep the dark header. */
export function SiteHeader({ light = false }: { light?: boolean }) {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Highlight the section in the reading band, the upper third of the screen.
  useEffect(() => {
    if (!onLanding) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          // Leaving a section clears it, so the hero above the first
          // section shows no highlight.
          setActiveSection((current) => (entry.isIntersecting ? id : current === id ? null : current));
        }
      },
      { rootMargin: "-30% 0px -65% 0px" }
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [onLanding]);

  // On the landing page the links scroll in place; elsewhere they go home first.
  const sectionHref = (id: string) => (onLanding ? `#${id}` : `/#${id}`);
  const highlighted = SECTIONS.find((sec) => sec.id === activeSection)?.highlights ?? null;
  type NavLink = { href: string; label: string; icon: LucideIcon; active: boolean; inBar: boolean };
  // Every link, in order: the phone menu shows them all, the desktop bar only the main ones.
  const allLinks: NavLink[] = [
    ...SECTIONS.map((sec) => ({
      href: sectionHref(sec.id),
      label: sec.label,
      icon: sec.icon,
      inBar: sec.inBar,
      active: onLanding && (sec.inBar ? highlighted === sec.id : activeSection === sec.id),
    })),
    { href: "/pricing", label: "Pricing", icon: Tag, inBar: true, active: pathname.startsWith("/pricing") },
    { href: "/contact", label: "Contact", icon: Mail, inBar: false, active: pathname.startsWith("/contact") },
  ];
  const links = allLinks.filter((l) => l.inBar);
  const menuLinks: NavLink[] = [...allLinks, { href: "/login", label: "Sign in", icon: LogIn, inBar: false, active: false }];

  const linkClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
      active ? "text-white" : "text-slate-400 hover:text-slate-50"
    );

  if (light) {
    return (
      <header className="sticky top-0 z-50 h-0 px-3 sm:px-[4vw] xl:px-0">
        {/* One floating white pill: the mark in a dark badge, the links in
            the middle, the trial as a glossy black pill on the right. The
            header takes no height, so the page runs up behind it. */}
        <div className={cn(styles.navBar, "mx-auto max-w-[1180px] translate-y-3")}>
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            aria-label="AIBOS home"
            className="flex shrink-0 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <LogoBadge className="[&>span:last-child]:text-[#0b0f17]" />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? "true" : undefined}
                className={cn(styles.navLink, link.active && styles.navLinkActive)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link href="/login" className={cn(styles.navLink, "hidden sm:block")}>
              Sign in
            </Link>
            <Link href="/register" className={cn(styles.navCta, "whitespace-nowrap")}>
              Start free trial
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#0b0f17] transition-colors hover:bg-slate-100 lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="site-menu"
            aria-label="Main"
            className="mx-auto mt-2 max-w-[1180px] translate-y-3 rounded-3xl border border-[#e6e9ee] bg-white p-2 shadow-[0_18px_40px_-20px_rgba(11,15,23,0.45)] lg:hidden"
          >
            {menuLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-[0.95rem] font-medium",
                  link.active ? "bg-cyan-50 text-cyan-700" : "text-[#0b0f17] hover:bg-slate-100"
                )}
              >
                <link.icon className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} />
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <Logo alwaysDark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={link.active ? "true" : undefined} className={linkClass(link.active)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:block"
          >
            Sign in
          </Link>
          <LinkButton href="/register" variant="glass" size="sm" className={CTA_CLASS}>
            Start free trial
          </LinkButton>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-50 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Phone menu: drops down inside the header instead of overlaying the
          page, because the header's backdrop filter would trap a fixed panel. */}
      {menuOpen && (
        <nav id="site-menu" aria-label="Main" className="border-t border-white/10 px-6 pb-4 pt-2 md:hidden">
          {menuLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium",
                link.active ? "bg-white/5 text-white" : "text-slate-300 hover:bg-white/5 hover:text-slate-50"
              )}
            >
              <link.icon className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} />
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
