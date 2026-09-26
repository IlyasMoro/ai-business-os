"use client";

import { useState, useSyncExternalStore, type MouseEvent } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups, type NavItem, type Role } from "./nav-config";

const STORAGE_KEY = "aibos:nav-open-groups";

function isActive(href: string, pathname: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

/** Tiny pulsing dot on a link whose page is still loading. It only shows when
 * the route was not prefetched yet; prefetched routes switch instantly. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto h-1.5 w-1.5 rounded-full bg-blue-400 transition-opacity duration-200",
        pending ? "animate-pulse opacity-100" : "opacity-0"
      )}
    />
  );
}

function isPlainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function parseGroups(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function readStoredRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function storeGroups(groups: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Private windows or blocked storage: the menu still works, it just won't remember.
  }
}

export function NavLinks({
  role,
  isPlatformAdmin = false,
  hiddenHrefs = [],
  onNavigate,
}: {
  role: Role;
  isPlatformAdmin?: boolean;
  /** Modules this company has switched off, e.g. Returns for a service business. */
  hiddenHrefs?: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  // Move the highlight the moment a link is clicked instead of waiting for
  // the new page to arrive, so navigation feels instant. It resets as soon
  // as the real pathname changes.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (pathname !== seenPathname) {
    setSeenPathname(pathname);
    setPendingHref(null);
  }
  const currentPath = pendingHref ?? pathname;

  const visible = (item: NavItem) => {
    if (hiddenHrefs.includes(item.href)) return false;
    if (item.platformAdminOnly) return isPlatformAdmin;
    return !item.roles || item.roles.includes(role);
  };

  const groups = navGroups
    .map((group) => ({ ...group, items: group.items.filter(visible) }))
    .filter((group) => group.items.length > 0);

  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href, currentPath)))?.label;

  // Groups the user left open are remembered in localStorage. The server
  // snapshot is null, so the first render only opens the active group and
  // hydration stays consistent; the saved groups are merged in right after.
  const storedRaw = useSyncExternalStore(subscribeToStorage, readStoredRaw, () => null);
  const [chosenGroups, setChosenGroups] = useState<string[] | null>(null);

  const withActive = (list: string[]) => {
    const merged = activeGroup && !list.includes(activeGroup) ? [...list, activeGroup] : list;
    return merged.length > 0 ? merged : [navGroups[0].label];
  };
  const openGroups = chosenGroups ?? withActive(parseGroups(storedRaw));

  // Navigating to a page in a closed group opens that group.
  const [lastActiveGroup, setLastActiveGroup] = useState(activeGroup);
  if (activeGroup !== lastActiveGroup) {
    setLastActiveGroup(activeGroup);
    if (chosenGroups) setChosenGroups(withActive(chosenGroups));
  }

  const toggle = (label: string) => {
    const next = openGroups.includes(label)
      ? openGroups.filter((g) => g !== label)
      : [...openGroups, label];
    setChosenGroups(next);
    storeGroups(next);
  };

  return (
    <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 antialiased">
      {groups.map((group) => {
        const open = openGroups.includes(group.label);
        const containsActive = group.label === activeGroup;
        const panelId = `nav-group-${group.label.toLowerCase().replace(/[^a-z]+/g, "_")}`;

        return (
          <div key={group.label}>
            {/* Group headings are the main menu while groups are collapsed, so
                they read as items: icon, name, a count of what's inside, and
                an arrow that turns down when open. */}
            <button
              type="button"
              onClick={() => toggle(group.label)}
              aria-expanded={open}
              aria-controls={panelId}
              className={cn(
                "group/heading flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[14px] font-semibold leading-5 transition-colors duration-150",
                containsActive
                  ? "text-white light:text-slate-950"
                  : "text-slate-200 hover:bg-white/[0.07] hover:text-white light:text-slate-700 light:hover:bg-slate-900/5 light:hover:text-slate-950"
              )}
            >
              <group.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  containsActive
                    ? "text-blue-400 light:text-blue-600"
                    : "text-slate-400 group-hover/heading:text-white light:text-slate-500 light:group-hover/heading:text-slate-800"
                )}
              />
              <span className="flex-1 truncate text-left">{group.label}</span>
              {!open && (
                <span aria-hidden className="text-[11px] font-medium tabular-nums text-slate-500">
                  {group.items.length}
                </span>
              )}
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ease-out",
                  open && "rotate-90"
                )}
              />
            </button>

            <div
              id={panelId}
              inert={!open}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                {/* Guide line ties the pages to their group; the active page
                    lights up its own segment of it. */}
                <div className="my-0.5 ml-5 space-y-0.5 border-l border-white/10 pl-2 light:border-slate-900/10">
                  {group.items.map((item) => {
                    const active = isActive(item.href, currentPath);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={(e) => {
                          if (isPlainClick(e) && !isActive(item.href, pathname)) setPendingHref(item.href);
                          onNavigate?.();
                        }}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center rounded-md px-3 py-1.5 text-[13.5px] font-medium leading-5 transition-colors duration-150",
                          active
                            ? "bg-blue-500/15 text-white light:bg-blue-500/10 light:text-blue-700"
                            : "text-slate-300 hover:bg-white/[0.07] hover:text-white light:text-slate-600 light:hover:bg-slate-900/5 light:hover:text-slate-950"
                        )}
                      >
                        {active && (
                          <span className="absolute -left-[9px] top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
                        )}
                        {item.label}
                        <PendingDot />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
