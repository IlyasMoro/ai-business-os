"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import type { Role } from "./nav-config";

export function MobileNav({
  role,
  userName,
  isPlatformAdmin = false,
  hiddenHrefs,
}: {
  role: Role;
  userName: string;
  isPlatformAdmin?: boolean;
  hiddenHrefs?: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-50 sm:hidden light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Portaled to <body>: the glass top bar uses backdrop-filter, which would
          otherwise trap this fixed overlay inside the bar's own box. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-white/[0.09] shadow-xl light:border-white/80 glass-strong">
            <div className="flex h-16 items-center justify-between px-5">
              <Link
                href="/dashboard"
                className="flex items-center gap-1"
                onClick={() => setOpen(false)}
              >
                <Image src="/logo-mark.png" alt="" width={48} height={48} className="-my-2 -ml-2.5 -mr-1.5 shrink-0" />
                <span className="font-display text-lg font-extrabold tracking-tight text-white light:text-slate-900">
                  AIBOS
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-white/5 light:text-slate-500 light:hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks role={role} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} onNavigate={() => setOpen(false)} />
            <div className="border-t border-white/[0.06] p-3 light:border-slate-200">
              <UserMenu userName={userName} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
