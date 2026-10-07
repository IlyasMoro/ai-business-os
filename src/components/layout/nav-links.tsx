"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_MIN_PLAN, planById, type PlanFeature } from "@/lib/plans";
import { navItems, navPinned, visibleNav, type NavGroup, type Role } from "./nav-config";

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
  flyout = false,
}: {
  role: Role;
  isPlatformAdmin?: boolean;
  /** Modules this company has switched off, e.g. Returns for a service business. */
  hiddenHrefs?: string[];
  /** Modules the company's plan doesn't include; they open an upgrade page. */
  lockedHrefs?: string[];
  onNavigate?: () => void;
  /** Desktop sidebar: hovering a closed group shows its pages beside the
   * menu, so a page is one move away. Off in the phone menu (no hover). */
  flyout?: boolean;
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

  const { pinned, groups } = visibleNav({ role, isPlatformAdmin, hiddenHrefs });
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
    setFly(null);
    onNavigate?.();
  };

  // ---- Hover flyout ----
  // A short delay before opening so the menu doesn't flash while the mouse
  // passes by, and a grace period before closing so it can travel into the
  // panel. Only on devices that really hover (mouse or trackpad).
  const [fly, setFly] = useState<{ label: string; top: number; left: number } | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!fly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFly(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fly]);
  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    []
  );
  const hoverable = flyout && canHover;
  const enterHeading = (label: string, el: HTMLElement) => {
    if (!hoverable) return;
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    // The open group already shows its pages in the menu.
    if (openGroup === label) {
      setFly(null);
      return;
    }
    openTimer.current = window.setTimeout(
      () => {
        // Just outside the sidebar's edge, level with the heading.
        const r = el.getBoundingClientRect();
        const edge = el.closest("aside")?.getBoundingClientRect().right ?? r.right;
        setFly({ label, top: r.top, left: edge + 8 });
      },
      fly ? 60 : 160
    );
  };
  const leave = () => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setFly(null), 220);
  };
  const stay = () => window.clearTimeout(closeTimer.current);
  const flyGroup = fly ? groups.find((g) => g.label === fly.label) : undefined;

  return (
    <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 antialiased" onScroll={() => setFly(null)}>
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
              onClick={() => {
                setFly(null);
                toggle(group.label);
              }}
              onMouseEnter={(e) => enterHeading(group.label, e.currentTarget)}
              onMouseLeave={leave}
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
              {/* Small and faint now that hovering shows the pages; brighter on
                  hover, blue and turned down while the group is open. */}
              <ChevronRight
                strokeWidth={2.25}
                aria-hidden
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-[transform,color,opacity] duration-200 ease-out",
                  open
                    ? "rotate-90 text-blue-400 opacity-100 light:text-blue-600"
                    : "text-slate-500 opacity-60 group-hover/heading:text-slate-200 group-hover/heading:opacity-100 light:text-slate-400 light:group-hover/heading:text-slate-700"
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

      {flyGroup && fly && (
        <Flyout
          group={flyGroup}
          top={fly.top}
          left={fly.left}
          currentPath={currentPath}
          lockedHrefs={lockedHrefs}
          onEnter={stay}
          onLeave={leave}
          onPick={linkClick}
        />
      )}
    </nav>
  );
}

/** The pages of a hovered group, floating beside the menu: icon, name and a
 * one line description each. Fixed position, so the scrolling menu never
 * clips it; nudged up when it would run off the bottom of the screen. */
function Flyout({
  group,
  top,
  left,
  currentPath,
  lockedHrefs,
  onEnter,
  onLeave,
  onPick,
}: {
  group: NavGroup;
  top: number;
  left: number;
  currentPath: string;
  lockedHrefs: string[];
  onEnter: () => void;
  onLeave: () => void;
  onPick: (href: string) => (e: MouseEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [y, setY] = useState(top);
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    setY(Math.max(8, Math.min(top - 8, window.innerHeight - h - 12)));
  }, [top, group.label]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={group.label}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="glass-strong fixed z-50 w-80 rounded-xl border border-white/10 p-2 shadow-2xl light:border-slate-200 light:bg-white"
      style={{ top: y, left }}
    >
      <p className="flex items-center gap-2 px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 light:text-slate-500">
        <group.icon className="h-3.5 w-3.5" />
        {group.label}
      </p>
      {group.items.map((item) => {
        const active = isActive(item.href, currentPath);
        const locked = lockedHrefs.includes(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            onClick={onPick(item.href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group/fly flex items-start gap-3 rounded-lg px-2.5 py-2 transition-colors",
              FOCUS,
              active ? "bg-blue-500/15 light:bg-blue-500/10" : "hover:bg-white/[0.06] light:hover:bg-slate-900/5"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                active
                  ? "border-blue-400/30 bg-blue-500/15 text-blue-300 light:text-blue-700"
                  : "border-white/[0.08] bg-white/[0.04] text-slate-300 group-hover/fly:text-white light:border-slate-200 light:bg-slate-50 light:text-slate-600"
              )}
            >
              <item.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-100 light:text-slate-900">
                {item.label}
                {locked && (
                  <span className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-px text-[11px] font-medium text-slate-400 light:border-slate-300 light:text-slate-500">
                    <Lock aria-hidden className="h-2.5 w-2.5" />
                    {lockedPlanName(item.href)}
                  </span>
                )}
              </span>
              {item.description && <span className="mt-0.5 block text-xs leading-4 text-slate-400 light:text-slate-500">{item.description}</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
