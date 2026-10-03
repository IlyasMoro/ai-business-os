"use client";

import { useState, type MouseEvent } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups, navPinned, type NavItem, type Role } from "./nav-config";

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

export function NavLinks({
  role,
  isPlatformAdmin = false,
  hiddenHrefs = [],
  lockedHrefs = [],
  onNavigate,
}: {
  role: Role;
  isPlatformAdmin?: boolean;
  /** Modules this company has switched off, e.g. Returns for a service business. */
  hiddenHrefs?: string[];
  /** Modules the company's plan doesn't include; they open an upgrade page. */
  lockedHrefs?: string[];
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

  const pinned = navPinned.filter(visible);
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href, currentPath)))?.label;

  // One group open at a time. Until the visitor picks one, the group of the
  // current page is open; moving to another page resets to its group.
  const [chosenGroup, setChosenGroup] = useState<string | null | undefined>(undefined);
  const [lastActiveGroup, setLastActiveGroup] = useState(activeGroup);
  if (activeGroup !== lastActiveGroup) {
    setLastActiveGroup(activeGroup);
    setChosenGroup(undefined);
  }
  const openGroup = chosenGroup === undefined ? activeGroup : chosenGroup;
  const toggle = (label: string) => setChosenGroup(openGroup === label ? null : label);

  const linkClick = (href: string) => (e: MouseEvent) => {
    if (isPlainClick(e) && !isActive(href, pathname)) setPendingHref(href);
    onNavigate?.();
  };

  return (
    <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 antialiased">
      {/* The everyday pages, always one click away. */}
      {pinned.map((item) => {
        const active = isActive(item.href, currentPath);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={linkClick(item.href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group/pin flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] leading-5 transition-colors duration-150",
              active
                ? "bg-blue-500/15 font-medium text-white light:bg-blue-500/10 light:text-blue-700"
                : "text-slate-200 hover:bg-white/[0.07] hover:text-white light:text-slate-700 light:hover:bg-slate-900/5 light:hover:text-slate-950"
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active
                  ? "text-blue-400 light:text-blue-600"
                  : "text-slate-400 group-hover/pin:text-white light:text-slate-500 light:group-hover/pin:text-slate-800"
              )}
            />
            {item.label}
            <PendingDot />
          </Link>
        );
      })}

      {pinned.length > 0 && groups.length > 0 && (
        <div aria-hidden className="mx-3 !my-2.5 border-t border-white/[0.08] light:border-slate-900/10" />
      )}

      {groups.map((group) => {
        const open = openGroup === group.label;
        const containsActive = group.label === activeGroup;
        const panelId = `nav-group-${group.label.toLowerCase().replace(/[^a-z]+/g, "_")}`;

        return (
          <div key={group.label}>
            {/* Group headings read as items: icon, name, and an arrow that
                turns down when open. */}
            <button
              type="button"
              onClick={() => toggle(group.label)}
              aria-expanded={open}
              aria-controls={panelId}
              className={cn(
                "group/heading flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[14px] font-medium leading-5 transition-colors duration-150",
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
                        onClick={linkClick(item.href)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center rounded-md px-3 py-1.5 text-[13.5px] leading-5 transition-colors duration-150",
                          // Only the open page is medium weight; the rest stay regular.
                          active
                            ? "bg-blue-500/15 font-medium text-white light:bg-blue-500/10 light:text-blue-700"
                            : "text-slate-300 hover:bg-white/[0.07] hover:text-white light:text-slate-600 light:hover:bg-slate-900/5 light:hover:text-slate-950"
                        )}
                      >
                        {active && (
                          <span className="absolute -left-[9px] top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
                        )}
                        {item.label}
                        {lockedHrefs.includes(item.href) && (
                          <Lock aria-label="Not on your plan" className="ml-auto h-3 w-3 shrink-0 text-slate-500" />
                        )}
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
