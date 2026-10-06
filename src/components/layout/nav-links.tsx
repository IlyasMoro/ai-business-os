"use client";

import { useState, type MouseEvent } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_MIN_PLAN, planById, type PlanFeature } from "@/lib/plans";
import { navGroups, navItems, navPinned, type NavItem, type Role } from "./nav-config";

// One focus outline for every menu control, drawn inside so the scrolling
// menu never clips it.
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500";

/** Name of the plan a locked module needs, from its href (/dashboard/mrp). */
function lockedPlanName(href: string): string | null {
  const feature = href.replace("/dashboard/", "") as PlanFeature;
  return feature in FEATURE_MIN_PLAN ? planById(FEATURE_MIN_PLAN[feature]).name : null;
}

/** The page you're on: tinted background and a short blue bar on its left. */
function ActiveBar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-500", className)} />;
}

function matches(href: string, pathname: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

/** The menu link for this page: the longest one that matches, so a page
 * under another link (Messages under Companies) lights up only itself. */
function isActive(href: string, pathname: string) {
  if (!matches(href, pathname)) return false;
  return ![...navPinned, ...navItems].some((i) => i.href.length > href.length && i.href.startsWith(href) && matches(i.href, pathname));
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
              "group/pin relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] leading-5 transition-colors duration-150",
              FOCUS,
              active
                ? "bg-blue-500/15 font-medium text-white light:bg-blue-500/10 light:text-blue-700"
                : "text-slate-100 hover:bg-white/[0.07] hover:text-white light:text-slate-800 light:hover:bg-slate-900/5 light:hover:text-slate-950"
            )}
          >
            {active && <ActiveBar className="left-0" />}
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active
                  ? "text-blue-400 light:text-blue-600"
                  : "text-slate-300 group-hover/pin:text-white light:text-slate-600 light:group-hover/pin:text-slate-800"
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
                // Quieter than the pinned pages above: these open, they don't navigate.
                "group/heading flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium leading-5 transition-colors duration-150",
                FOCUS,
                containsActive
                  ? "text-slate-100 light:text-slate-900"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100 light:text-slate-500 light:hover:bg-slate-900/5 light:hover:text-slate-900"
              )}
            >
              <group.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  containsActive
                    ? "text-blue-400 light:text-blue-600"
                    : "text-slate-500 group-hover/heading:text-slate-200 light:text-slate-400 light:group-hover/heading:text-slate-700"
                )}
              />
              <span className="flex-1 truncate text-left">{group.label}</span>
              {/* Bold and high contrast so it reads as a control; blue while open. */}
              <ChevronRight
                strokeWidth={3}
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 transition-[transform,color] duration-200 ease-out",
                  open
                    ? "rotate-90 text-blue-400 light:text-blue-600"
                    : "text-slate-300 group-hover/heading:text-white light:text-slate-600 light:group-hover/heading:text-slate-900"
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
                          FOCUS,
                          // Only the open page is medium weight; the rest stay regular.
                          active
                            ? "bg-blue-500/15 font-medium text-white light:bg-blue-500/10 light:text-blue-700"
                            : "text-slate-300 hover:bg-white/[0.07] hover:text-white light:text-slate-600 light:hover:bg-slate-900/5 light:hover:text-slate-950"
                        )}
                      >
                        {active && <ActiveBar className="-left-[9px]" />}
                        {item.label}
                        {lockedHrefs.includes(item.href) && (
                          <span
                            title={lockedPlanName(item.href) ? `Comes with the ${lockedPlanName(item.href)} plan` : "Not on your plan"}
                            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-white/10 px-1.5 py-px text-[11px] font-medium text-slate-400 light:border-slate-300 light:text-slate-500"
                          >
                            <Lock aria-hidden className="h-2.5 w-2.5" />
                            {lockedPlanName(item.href)}
                          </span>
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
