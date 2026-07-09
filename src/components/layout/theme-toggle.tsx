"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("theme-toggle", callback);
  return () => window.removeEventListener("theme-toggle", callback);
}

function getSnapshot() {
  return document.documentElement.classList.contains("light");
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isLight = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isLight;
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {
      // Ignore storage errors (e.g. private browsing) — the toggle still
      // works for the rest of this page load, it just won't persist.
    }
    // Force a re-read of the DOM class we just changed, since nothing else
    // notifies this store of the change.
    window.dispatchEvent(new Event("theme-toggle"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-50 light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
