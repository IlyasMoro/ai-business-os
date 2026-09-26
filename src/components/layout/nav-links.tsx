"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups, type NavItem, type Role } from "./nav-config";

const STORAGE_KEY = "aibos:nav-open-groups";

function isActive(href: string, pathname: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
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

  const visible = (item: NavItem) => {
    if (hiddenHrefs.includes(item.href)) return false;
    if (item.platformAdminOnly) return isPlatformAdmin;
    return !item.roles || item.roles.includes(role);
  };

  const groups = navGroups
    .map((group) => ({ ...group, items: group.items.filter(visible) }))
    .filter((group) => group.items.length > 0);

  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href, pathname)))?.label;

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
    <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3 antialiased">
      {groups.map((group) => {
        const open = openGroups.includes(group.label);
        const containsActive = group.label === activeGroup;
        const panelId = `nav-group-${group.label.toLowerCase().replace(/[^a-z]+/g, "_")}`;

        return (
          <div key={group.label}>
            <button
              type="button"
              onClick={() => toggle(group.label)}
              aria-expanded={open}
              aria-controls={panelId}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 pb-1.5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors",
                containsActive && !open
                  ? "text-blue-400 light:text-blue-600"
                  : "text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-800"
              )}
            >
              {group.label}
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200 ease-out",
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
              <div className="space-y-0.5 overflow-hidden">
                {group.items.map((item) => {
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-semibold leading-5 transition-colors duration-150",
                        active
                          ? "bg-blue-500/15 text-white light:bg-blue-500/10 light:text-blue-700"
                          : "text-slate-100 hover:bg-white/[0.07] hover:text-white light:text-slate-800 light:hover:bg-slate-900/5 light:hover:text-slate-950"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
                      )}
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-blue-400 light:text-blue-600" : "text-slate-300 group-hover:text-white light:text-slate-500 light:group-hover:text-slate-800"
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
