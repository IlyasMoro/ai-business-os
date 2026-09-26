"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/* Landing page sections, in page order so the scroll highlight moves left
   to right as you read. Each id is set on its <section> in app/page.tsx. */
const SECTIONS = [
  { id: "copilot", label: "AI Copilot" },
  { id: "how", label: "How it works" },
  { id: "features", label: "Features" },
  { id: "faq", label: "FAQ" },
];

const CTA_CLASS =
  "rounded-full border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl";

export function SiteHeader() {
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
  const links = [
    ...SECTIONS.map((s) => ({ href: sectionHref(s.id), label: s.label, active: onLanding && activeSection === s.id })),
    { href: "/pricing", label: "Pricing", active: pathname.startsWith("/pricing") },
  ];

  const linkClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      active ? "text-white" : "text-slate-400 hover:text-slate-50"
    );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:block"
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
          {[...links, { href: "/login", label: "Sign in", active: false }].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "block rounded-md px-3 py-2.5 text-base font-medium",
                link.active ? "text-white" : "text-slate-300 hover:bg-white/5 hover:text-slate-50"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
