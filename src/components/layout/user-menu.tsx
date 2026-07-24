"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";

export function UserMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const initial = userName.trim().charAt(0).toUpperCase() || "?";
  const firstName = userName.trim().split(" ")[0] || userName;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-white/5 light:hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/20 text-xs font-semibold text-amber-400">
          {initial}
        </span>
        <span className="hidden text-sm text-slate-300 sm:inline light:text-slate-600">{firstName}</span>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-slate-500 transition-transform duration-150 sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-md border border-white/10 bg-[#0a0a0a] py-1 shadow-xl light:border-slate-200 light:bg-white">
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-50 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
