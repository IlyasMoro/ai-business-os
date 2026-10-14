"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { statusLine, type CompanyCard } from "./company-status";
import { Menu, X } from "lucide-react";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import type { Role, NavBadges } from "./nav-config";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MobileNav({
  role,
  userName,
  email,
  companyName,
  isPlatformAdmin = false,
  hiddenHrefs,
  lockedHrefs,
  badges,
  company,
}: {
  role: Role;
  userName: string;
  email: string;
  companyName: string;
  isPlatformAdmin?: boolean;
  hiddenHrefs?: string[];
  lockedHrefs?: string[];
  badges?: NavBadges;
  company: CompanyCard;
}) {
  // Two steps so the menu can animate: `mounted` puts it on the page, then
  // `shown` (a frame later) slides it in; closing slides it out first and
  // takes it off the page once the slide has finished.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const openMenu = () => {
    window.clearTimeout(closeTimer.current);
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  };
  const close = () => {
    setShown(false);
    closeTimer.current = window.setTimeout(() => setMounted(false), 260);
  };

  // Escape closes it, and the page behind doesn't scroll while it's open.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-50 sm:hidden light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Portaled to <body>: the glass top bar uses backdrop-filter, which would
          otherwise trap this fixed overlay inside the bar's own box. */}
      {mounted && createPortal(
        <div className="app-text fixed inset-0 z-50 sm:hidden">
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
            onClick={close}
            aria-hidden
          />
          {/* The slide is set inline: .glass-strong has its own `transition`
              rule (for its colours) that would otherwise cancel this one. */}
          <div
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-white/[0.09] shadow-xl will-change-transform light:border-white/80 glass-strong"
            style={{
              transform: shown ? "translateX(0)" : "translateX(-100%)",
              transition: reducedMotion() ? "none" : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <Link
                href="/dashboard"
                className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                onClick={close}
              >
                <Logo />
              </Link>
              <button
                type="button"
                onClick={close}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-white/5 light:text-slate-500 light:hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks role={role} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} lockedHrefs={lockedHrefs} badges={badges} onNavigate={close} />
            <div className="border-t border-white/[0.06] p-3 light:border-slate-200">
              <UserMenu userName={userName} email={email} role={role} companyName={companyName} status={statusLine(company.subscription)} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
