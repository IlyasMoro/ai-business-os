"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NavLinks } from "./nav-links";
import type { Role } from "./nav-config";

export function MobileNav({ role, isPlatformAdmin = false }: { role: Role; isPlatformAdmin?: boolean }) {
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

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-white/[0.06] bg-black shadow-xl light:border-slate-200 light:bg-white">
            <div className="flex h-16 items-center justify-between px-5">
              <Link
                href="/dashboard"
                className="flex items-center"
                onClick={() => setOpen(false)}
              >
                <span className="bg-gradient-to-br from-amber-400 to-amber-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
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
            <NavLinks role={role} isPlatformAdmin={isPlatformAdmin} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
