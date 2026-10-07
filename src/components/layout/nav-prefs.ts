"use client";

import { useMemo, useSyncExternalStore } from "react";

/* Per person menu conveniences kept in this browser: favourite pages and
   recently opened pages. Nothing here must persist reliably; reads and
   writes never throw, so the menu works the same with storage blocked. */

const FAVOURITES = "aibos:favourites";
const RECENT = "aibos:recent";
/** Same tab updates (the storage event only fires in other tabs). */
const CHANGED = "aibos:prefs-changed";
const MAX_RECENT = 6;

export type RecentPage = { href: string; title: string; detail?: string };

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the change lasts until the page reloads.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function parse<T>(raw: string, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function useStored<T>(key: string, fallback: T): T {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => "");
  // Parsed once per change of the stored text, so the value stays stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => parse(raw, fallback), [raw]);
}

/** Favourite page hrefs, in the order they were added, and a toggle. */
export function useFavourites(): [string[], (href: string) => void] {
  const favourites = useStored<string[]>(FAVOURITES, []);
  const toggle = (href: string) => {
    const now = parse<string[]>(read(FAVOURITES), []);
    write(FAVOURITES, now.includes(href) ? now.filter((h) => h !== href) : [...now, href]);
  };
  return [favourites, toggle];
}

/** Pages opened lately, newest first. */
export function useRecent(): RecentPage[] {
  return useStored<RecentPage[]>(RECENT, []);
}

/** Puts a page at the top of the recent list. */
export function rememberRecent(page: RecentPage) {
  const now = parse<RecentPage[]>(read(RECENT), []).filter((p) => p.href !== page.href);
  write(RECENT, [page, ...now].slice(0, MAX_RECENT));
}
