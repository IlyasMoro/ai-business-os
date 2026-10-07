"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Lock, Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_MIN_PLAN, planById, type PlanFeature } from "@/lib/plans";
import { navItems, navPinned, visibleNav, type NavBadge, type NavBadges, type NavGroup, type NavItem, type Role } from "./nav-config";
import { useFavourites } from "./nav-prefs";

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
export function isActive(href: string, pathname: string) {
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
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400 transition-opacity duration-200", pending ? "animate-pulse opacity-100" : "opacity-0")}
    />
  );
}

function isPlainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

const BADGE_TONE: Record<NavBadge["tone"], string> = {
  red: "bg-red-500/15 text-red-300 ring-red-400/30 light:bg-red-50 light:text-red-700 light:ring-red-200",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-400/30 light:bg-amber-50 light:text-amber-800 light:ring-amber-200",
  blue: "bg-blue-500/15 text-blue-300 ring-blue-400/30 light:bg-blue-50 light:text-blue-700 light:ring-blue-200",
};

/** Work waiting on a page: a small count pill in the badge's tone. */
function CountBadge({ badge, label }: { badge: NavBadge; label: string }) {
  return (
    <span
      title={`${badge.count} waiting in ${label}`}
      className={cn(
        "inline-flex min-w-5 shrink-0 justify-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ring-1 ring-inset",
        BADGE_TONE[badge.tone],
      )}
    >
      {badge.count > 99 ? "99+" : badge.count}
    </span>
  );
}

/** Star to add or remove a favourite; shown on hover, always when set. */
function FavouriteStar({ on, label, onToggle, className }: { on: boolean; label: string; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={on}
      aria-label={on ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
      title={on ? "Remove from favourites" : "Add to favourites"}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity",
        FOCUS,
        on
          ? "text-amber-400 opacity-100 light:text-amber-500"
          : "text-slate-400 opacity-0 hover:text-amber-300 focus-visible:opacity-100 group-hover/row:opacity-100",
        className,
      )}
    >
      <Star className="h-3.5 w-3.5" fill={on ? "currentColor" : "none"} />
    </button>
  );
}

/** Coloured icon tile in the section's colour, glowing on hover. */
function IconTile({ icon: Icon, color, active, size = "md" }: { icon: NavItem["icon"]; color: string; active?: boolean; size?: "md" | "sm" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border transition-[box-shadow,background-color] duration-200 group-hover/fly:shadow-[0_0_18px_-4px_var(--c)]",
        size === "md" ? "h-8 w-8" : "h-7 w-7",
      )}
      style={
        {
          "--c": color,
          color,
          backgroundColor: `${color}${active ? "33" : "1f"}`,
          borderColor: `${color}${active ? "80" : "4d"}`,
        } as CSSProperties
      }
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

const noSubscribe = () => () => {};
const hoverQuery = "(hover: hover) and (pointer: fine)";

export function NavLinks({
  role,
  isPlatformAdmin = false,
  hiddenHrefs = [],
  lockedHrefs = [],
  badges = {},
  onNavigate,
  flyout = false,
  collapsed = false,
}: {
  role: Role;
  isPlatformAdmin?: boolean;
  /** Modules this company has switched off, e.g. Returns for a service business. */
  hiddenHrefs?: string[];
  /** Modules the company's plan doesn't include; they open an upgrade page. */
  lockedHrefs?: string[];
  /** Work waiting per page, shown as count badges. */
  badges?: NavBadges;
  onNavigate?: () => void;
  /** Desktop sidebar: hovering a closed group shows its pages beside the
   * menu, so a page is one move away. Off in the phone menu (no hover). */
  flyout?: boolean;
  /** Icons only; groups open their pages beside the menu. */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [favourites, toggleFavourite] = useFavourites();

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

  const { pinned, groups, settings } = visibleNav({ role, isPlatformAdmin, hiddenHrefs });
  const settingsActive = settings.some((i) => matches(i.href, currentPath));
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href, currentPath)))?.label;
  const allVisible = [...pinned.map((i) => ({ item: i, color: "#3987e5" })), ...groups.flatMap((g) => g.items.map((i) => ({ item: i, color: g.color })))];
  const favouriteItems = favourites.map((href) => allVisible.find((v) => v.item.href === href)).filter((v): v is (typeof allVisible)[number] => Boolean(v));

  // One group open at a time. Until the visitor picks one, the group of the
  // current page is open; moving to another page resets to its group.
  const [chosenGroup, setChosenGroup] = useState<string | null | undefined>(undefined);
  const [lastActiveGroup, setLastActiveGroup] = useState(activeGroup);
  if (activeGroup !== lastActiveGroup) {
    setLastActiveGroup(activeGroup);
    setChosenGroup(undefined);
  }
  const openGroup = collapsed ? null : chosenGroup === undefined ? activeGroup : chosenGroup;
  const toggle = (label: string) => setChosenGroup(openGroup === label ? null : label);

  // ---- Hover flyout ----
  // A short delay before opening so the menu doesn't flash while the mouse
  // passes by, and a grace period before closing so it can travel into the
  // panel. Only on devices that really hover (mouse or trackpad); in the
  // icons only menu a click opens it too.
  const [fly, setFly] = useState<{
    label: string;
    top: number;
    left: number;
  } | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const canHover = useSyncExternalStore(
    noSubscribe,
    () => window.matchMedia(hoverQuery).matches,
    () => false,
  );
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
    [],
  );
  const place = (label: string, el: HTMLElement) => {
    // Just outside the sidebar's edge, level with the heading.
    const r = el.getBoundingClientRect();
    const edge = el.closest("aside")?.getBoundingClientRect().right ?? r.right;
    setFly({ label, top: r.top, left: edge + 8 });
  };
  const enterHeading = (label: string, el: HTMLElement) => {
    if (!flyout || !canHover) return;
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    // The open group already shows its pages in the menu.
    if (openGroup === label) {
      setFly(null);
      return;
    }
    openTimer.current = window.setTimeout(() => place(label, el), fly ? 60 : 160);
  };
  const leave = () => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setFly(null), 220);
  };
  const stay = () => window.clearTimeout(closeTimer.current);
  const flyGroup = fly ? groups.find((g) => g.label === fly.label) : undefined;

  const linkClick = (href: string) => (e: MouseEvent) => {
    if (isPlainClick(e) && !isActive(href, pathname)) setPendingHref(href);
    setFly(null);
    onNavigate?.();
  };

  /** A top level page (pinned or favourite): icon and name, or just the icon. */
  const topLink = (item: NavItem, opts: { color?: string; favourite?: boolean } = {}) => {
    const active = isActive(item.href, currentPath);
    const badge = badges[item.href];
    const link = (
      <Link
        key={`${opts.favourite ? "fav" : "pin"}-${item.href}`}
        href={item.href}
        onClick={linkClick(item.href)}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group/link relative flex items-center rounded-md text-[14px] leading-5 transition-colors duration-150",
          collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2",
          FOCUS,
          active
            ? "bg-blue-500/15 font-medium text-white light:bg-blue-500/10 light:text-blue-700"
            : "text-slate-100 hover:bg-white/[0.07] hover:text-white light:text-slate-800 light:hover:bg-slate-900/5 light:hover:text-slate-950",
        )}
      >
        {active && <ActiveBar className="left-0" />}
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            active
              ? "text-blue-400 light:text-blue-600"
              : "text-slate-300 group-hover/link:text-white light:text-slate-600 light:group-hover/link:text-slate-800",
          )}
        />
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {badge && <CountBadge badge={badge} label={item.label} />}
            <PendingDot />
          </>
        )}
      </Link>
    );
    if (!opts.favourite || collapsed) return link;
    return (
      <div key={`fav-${item.href}`} className="group/row relative flex items-center">
        <div className="min-w-0 flex-1 [&>a]:pr-9">{link}</div>
        <FavouriteStar on label={item.label} onToggle={() => toggleFavourite(item.href)} className="absolute right-1.5" />
      </div>
    );
  };

  return (
    <nav className={cn("min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-3 antialiased", collapsed ? "px-2" : "px-3")} onScroll={() => setFly(null)}>
      {/* The everyday pages, always one click away. */}
      {pinned.map((item) => topLink(item))}

      {favouriteItems.length > 0 && (
        <>
          <div aria-hidden className="mx-3 !my-2.5 border-t border-white/[0.08] light:border-slate-900/10" />
          {!collapsed && (
            <p className="flex items-center gap-1.5 px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Star className="h-3 w-3 text-amber-400" fill="currentColor" /> Favourites
            </p>
          )}
          {favouriteItems.map((v) => topLink(v.item, { color: v.color, favourite: true }))}
        </>
      )}

      {pinned.length > 0 && groups.length > 0 && <div aria-hidden className="mx-3 !my-2.5 border-t border-white/[0.08] light:border-slate-900/10" />}

      {groups.map((group) => {
        const open = openGroup === group.label;
        const containsActive = group.label === activeGroup;
        const panelId = `nav-group-${group.label.toLowerCase().replace(/[^a-z]+/g, "_")}`;
        const lit = containsActive || open || fly?.label === group.label;

        return (
          <div key={group.label}>
            {/* Group headings read as items: icon, name, and an
                arrow that turns down when open. The icon takes the section's
                colour on hover and while it is open or holds this page. */}
            <button
              type="button"
              onClick={(e) => {
                if (collapsed) {
                  if (fly?.label === group.label) setFly(null);
                  else place(group.label, e.currentTarget);
                  return;
                }
                setFly(null);
                toggle(group.label);
              }}
              onMouseEnter={(e) => enterHeading(group.label, e.currentTarget)}
              onMouseLeave={leave}
              aria-expanded={collapsed ? fly?.label === group.label : open}
              aria-controls={collapsed ? undefined : panelId}
              aria-label={collapsed ? group.label : undefined}
              title={collapsed ? group.label : undefined}
              style={{ "--c": group.color } as CSSProperties}
              className={cn(
                // Quieter than the pinned pages above: these open, they don't navigate.
                "group/heading relative flex w-full items-center rounded-md text-[13.5px] font-medium leading-5 transition-colors duration-150",
                collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2",
                FOCUS,
                containsActive
                  ? "text-slate-100 light:text-slate-900"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100 light:text-slate-500 light:hover:bg-slate-900/5 light:hover:text-slate-900",
              )}
            >
              <group.icon
                className={cn("h-4 w-4 shrink-0 transition-colors", lit ? "text-(--c)" : "text-slate-500 group-hover/heading:text-(--c) light:text-slate-400")}
              />
              {collapsed ? null : (
                <>
                  <span className="flex-1 truncate text-left">{group.label}</span>
                  {/* Small and faint now that hovering shows the pages; brighter
                      on hover, blue and turned down while the group is open. */}
                  <ChevronRight
                    strokeWidth={2.25}
                    aria-hidden
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-[transform,color,opacity] duration-200 ease-out",
                      open
                        ? "rotate-90 text-blue-400 opacity-100 light:text-blue-600"
                        : "text-slate-500 opacity-60 group-hover/heading:text-slate-200 group-hover/heading:opacity-100 light:text-slate-400 light:group-hover/heading:text-slate-700",
                    )}
                  />
                </>
              )}
            </button>

            {!collapsed && (
              <div
                id={panelId}
                inert={!open}
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  {/* Guide line ties the pages to their group; the active page
                      lights up its own segment of it. */}
                  <div className="my-0.5 ml-5 space-y-0.5 border-l border-white/10 pl-2 light:border-slate-900/10">
                    {group.items.map((item) => {
                      const active = isActive(item.href, currentPath);
                      const badge = badges[item.href];
                      const fav = favourites.includes(item.href);
                      return (
                        <div key={item.href} className="group/row relative flex items-center">
                          <Link
                            href={item.href}
                            onClick={linkClick(item.href)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "relative flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pl-3 pr-9 text-[13.5px] leading-5 transition-colors duration-150",
                              FOCUS,
                              // Only the open page is medium weight; the rest stay regular.
                              active
                                ? "bg-blue-500/15 font-medium text-white light:bg-blue-500/10 light:text-blue-700"
                                : "text-slate-300 hover:bg-white/[0.07] hover:text-white light:text-slate-600 light:hover:bg-slate-900/5 light:hover:text-slate-950",
                            )}
                          >
                            {active && <ActiveBar className="-left-[9px]" />}
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {lockedHrefs.includes(item.href) && (
                              <span
                                title={lockedPlanName(item.href) ? `Comes with the ${lockedPlanName(item.href)} plan` : "Not on your plan"}
                                className="inline-flex shrink-0 items-center gap-1 rounded border border-white/10 px-1.5 py-px text-[11px] font-medium text-slate-400 light:border-slate-300 light:text-slate-500"
                              >
                                <Lock aria-hidden className="h-2.5 w-2.5" />
                                {lockedPlanName(item.href)}
                              </span>
                            )}
                            {badge && <CountBadge badge={badge} label={item.label} />}
                            <PendingDot />
                          </Link>
                          <FavouriteStar on={fav} label={item.label} onToggle={() => toggleFavourite(item.href)} className="absolute right-1.5" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Company settings sit apart from the everyday modules: one link
          that opens them, with tabs across the top of each settings page. */}
      {settings.length > 0 && (
        <>
          <div aria-hidden className="mx-3 !my-2.5 border-t border-white/[0.08] light:border-slate-900/10" />
          <Link
            href={settings[0].href}
            onClick={linkClick(settings[0].href)}
            aria-current={settingsActive ? "page" : undefined}
            aria-label={collapsed ? "Settings" : undefined}
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "group/link relative flex items-center rounded-md text-[13.5px] leading-5 transition-colors duration-150",
              collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2",
              FOCUS,
              settingsActive
                ? "bg-blue-500/15 font-medium text-white light:bg-blue-500/10 light:text-blue-700"
                : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100 light:text-slate-500 light:hover:bg-slate-900/5 light:hover:text-slate-900",
            )}
          >
            {settingsActive && <ActiveBar className="left-0" />}
            <Settings className={cn("h-4 w-4 shrink-0", settingsActive ? "text-blue-400 light:text-blue-600" : "text-slate-500 group-hover/link:text-slate-200 light:text-slate-400")} />
            {!collapsed && <span className="flex-1 truncate">Settings</span>}
          </Link>
        </>
      )}

      {flyGroup && fly && (
        <Flyout
          group={flyGroup}
          top={fly.top}
          left={fly.left}
          currentPath={currentPath}
          lockedHrefs={lockedHrefs}
          badges={badges}
          favourites={favourites}
          onToggleFavourite={toggleFavourite}
          onEnter={stay}
          onLeave={leave}
          onPick={linkClick}
        />
      )}
    </nav>
  );
}

/** The pages of a hovered group, floating beside the menu: a coloured icon
 * tile in the section's colour, name, one line description, waiting work and
 * a favourite star each. Fixed position, so the scrolling menu never clips
 * it; nudged up when it would run off the bottom of the screen. */
function Flyout({
  group,
  top,
  left,
  currentPath,
  lockedHrefs,
  badges,
  favourites,
  onToggleFavourite,
  onEnter,
  onLeave,
  onPick,
}: {
  group: NavGroup;
  top: number;
  left: number;
  currentPath: string;
  lockedHrefs: string[];
  badges: NavBadges;
  favourites: string[];
  onToggleFavourite: (href: string) => void;
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
      className="glass-strong fixed z-50 w-[24rem] overflow-hidden rounded-xl border border-white/10 p-2 shadow-2xl light:border-slate-200 light:bg-white"
      style={{ top: y, left }}
    >
      {/* A thin line of the section's colour along the top. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${group.color}, transparent)`,
        }}
      />
      <p className="flex items-center gap-2 px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 light:text-slate-500">
        {group.label}
      </p>
      {group.items.map((item) => {
        const active = isActive(item.href, currentPath);
        const locked = lockedHrefs.includes(item.href);
        const badge = badges[item.href];
        return (
          <div key={item.href} role="none" className="group/row relative flex items-center">
            <Link
              href={item.href}
              role="menuitem"
              onClick={onPick(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group/fly flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pl-2.5 pr-10 transition-colors",
                FOCUS,
                active ? "bg-white/[0.06] light:bg-slate-900/[0.04]" : "hover:bg-white/[0.05] light:hover:bg-slate-900/[0.03]",
              )}
            >
              <IconTile icon={item.icon} color={group.color} active={active} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-100 light:text-slate-900">
                  <span className="truncate">{item.label}</span>
                  {locked && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-white/10 px-1.5 py-px text-[11px] font-medium text-slate-400 light:border-slate-300 light:text-slate-500">
                      <Lock aria-hidden className="h-2.5 w-2.5" />
                      {lockedPlanName(item.href)}
                    </span>
                  )}
                </span>
                {item.description && <span className="mt-0.5 block text-xs leading-4 text-slate-400 light:text-slate-500">{item.description}</span>}
              </span>
              {badge && <CountBadge badge={badge} label={item.label} />}
            </Link>
            <FavouriteStar on={favourites.includes(item.href)} label={item.label} onToggle={() => onToggleFavourite(item.href)} className="absolute right-2" />
          </div>
        );
      })}
    </div>
  );
}
