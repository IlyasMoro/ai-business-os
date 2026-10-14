"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, CircleHelp, CreditCard, LogOut, Monitor, Moon, Settings, Sun, UserRound } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "ADMIN" | "EMPLOYEE";
type Theme = "light" | "dark" | "system";

const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", EMPLOYEE: "Employee" };

// ---------- Theme ----------
// Stored in localStorage as "light", "dark" (the default) or "system";
// app/layout.tsx applies it before the first paint.

function readTheme(): Theme {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  const light = theme === "light" || (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.classList.toggle("light", light);
}

function subscribeTheme(callback: () => void) {
  window.addEventListener("theme-change", callback);
  return () => window.removeEventListener("theme-change", callback);
}

function setTheme(theme: Theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Private windows: it still applies for this visit, it just won't be remembered.
  }
  applyTheme(theme);
  window.dispatchEvent(new Event("theme-change"));
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const itemClass =
  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-50 focus-visible:bg-white/5 focus-visible:outline-none light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-900 light:focus-visible:bg-slate-100";

/** The account menu at the bottom of the sidebar: who is signed in, their
 * account, company settings and billing (by role), appearance, help, and
 * sign out. */
export function UserMenu({
  userName,
  email,
  role,
  companyName,
  status,
  compact = false,
}: {
  userName: string;
  email: string;
  role: Role;
  companyName: string;
  /** The trial countdown or a billing problem, shown under the name. */
  status?: { text: string | null; short?: string; tone: "ok" | "warn" | "bad" };
  /** Icons only menu: just the initial; the menu opens wider to the right. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);

  const initial = userName.trim().charAt(0).toUpperCase() || "?";
  const firstName = userName.trim().split(" ")[0] || userName;

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // "System" follows the device when its light or dark setting changes.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const follow = () => applyTheme("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [theme]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 light:hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/15 text-xs font-semibold text-cyan-200 backdrop-blur-md light:border-cyan-600/30 light:bg-cyan-500/10 light:text-cyan-800">
          {initial}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1 text-left leading-tight">
            <span className="block truncate text-sm text-slate-300 light:text-slate-600">{firstName}</span>
            {status?.text && (
              <span
                title={status.text}
                className={`block truncate text-[11px] tabular-nums ${
                  status.tone === "bad"
                    ? "text-red-300 light:text-red-700"
                    : status.tone === "warn"
                      ? "text-amber-300 light:text-amber-700"
                      : "text-slate-500 light:text-slate-500"
                }`}
              >
                {status.short ?? status.text}
              </span>
            )}
          </span>
        )}
        {!compact && <ChevronDown
          strokeWidth={3}
          aria-hidden
          className={`h-4 w-4 shrink-0 transition-transform duration-150 ${open ? "rotate-180 text-blue-400 light:text-blue-600" : "text-slate-300 light:text-slate-600"}`}
        />}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute bottom-full z-50 mb-2 min-w-[15rem] overflow-hidden rounded-lg border border-white/[0.1] shadow-xl glass-strong light:border-white/80 ${compact ? "left-0" : "inset-x-0"}`}
        >
          {/* Who is signed in */}
          <div className="border-b border-white/[0.08] px-3 py-3 light:border-slate-200">
            <p className="truncate text-sm font-semibold text-slate-50 light:text-slate-900">{userName}</p>
            <p className="truncate text-xs text-slate-400 light:text-slate-500">{email}</p>
            <p className="mt-1.5 truncate text-xs text-slate-500">
              {ROLE_LABEL[role]} · {companyName}
            </p>
          </div>

          <div className="py-1">
            <Link href="/dashboard/account" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <UserRound className="h-4 w-4" />
              My account
            </Link>
            {(role === "OWNER" || role === "ADMIN") && (
              <Link href="/dashboard/settings" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            )}
            {role === "OWNER" && (
              <Link href="/dashboard/billing" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <CreditCard className="h-4 w-4" />
                Plan and billing
              </Link>
            )}
          </div>

          {/* Appearance */}
          <div className="border-t border-white/[0.08] px-3 py-2.5 light:border-slate-200">
            <p className="mb-1.5 text-xs font-medium text-slate-400 light:text-slate-500">Appearance</p>
            <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-md bg-white/[0.04] p-0.5 light:bg-slate-100">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded px-1.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
                    theme === value
                      ? "bg-cyan-400 font-semibold text-[#0a1428]"
                      : "text-slate-300 hover:text-white light:text-slate-600 light:hover:text-slate-900"
                  )}
                >
                  <Icon aria-hidden className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.08] py-1 light:border-slate-200">
            <Link href="/#faq" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <CircleHelp className="h-4 w-4" />
              Help and FAQ
            </Link>
            <form action={logout}>
              <button type="submit" role="menuitem" className={itemClass}>
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
