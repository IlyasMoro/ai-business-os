"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NavLinks } from "./nav-links";
import type { Role } from "./nav-config";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-900 hover:text-white sm:hidden"
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
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-slate-800 bg-slate-950 shadow-xl">
            <div className="flex h-16 items-center justify-between px-5">
              <Link
                href="/dashboard"
                className="flex items-center gap-2"
                onClick={() => setOpen(false)}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/20 text-xs font-bold text-amber-400">
                  AI
                </span>
                <span className="text-base font-semibold tracking-tight text-white">
                  Business OS
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks role={role} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
