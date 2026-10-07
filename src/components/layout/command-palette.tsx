"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Boxes, Clock, CornerDownLeft, FileText, Loader2, Plus, Receipt, Search, ShoppingCart, Truck, UserSquare2, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchRecords, type SearchHit } from "@/lib/actions/search";
import { navGroups, navPinned, navSettings, visibleNav, type NavIcon, type Role } from "./nav-config";
import { isActive } from "./nav-links";
import { rememberRecent, useRecent } from "./nav-prefs";

/** Opens the search from anywhere (the top bar button sends it). */
export const OPEN_SEARCH_EVENT = "aibos:open-search";

type Row = { key: string; group: string; title: string; detail?: string; href: string; icon: NavIcon; color?: string };

/** The section colour of the menu page an href belongs to. */
function sectionColor(href: string): string | undefined {
  return navGroups.find((g) => g.items.some((i) => href === i.href || href.startsWith(`${i.href}/`)))?.color;
}

const KIND_HREF: Record<SearchHit["kind"], string> = {
  Customer: "/dashboard/crm",
  Product: "/dashboard/inventory",
  Order: "/dashboard/sales",
  Invoice: "/dashboard/invoicing",
  Supplier: "/dashboard/procurement",
  Employee: "/dashboard/hr",
};

/** Things to create from anywhere: "new" lists them all. Each shows only
 * when its module is in the menu for this user and on the company's plan. */
const ACTIONS: { title: string; href: string; module: string; icon: LucideIcon; words: string }[] = [
  { title: "New order", href: "/dashboard/sales/new", module: "/dashboard/sales", icon: ShoppingCart, words: "sale create" },
  { title: "New invoice", href: "/dashboard/invoicing/new", module: "/dashboard/invoicing", icon: Receipt, words: "bill create" },
  { title: "New quote", href: "/dashboard/quotes/new", module: "/dashboard/quotes", icon: FileText, words: "offer price create" },
  { title: "New customer", href: "/dashboard/crm/new", module: "/dashboard/crm", icon: Users, words: "client lead create" },
  { title: "New product", href: "/dashboard/inventory/new", module: "/dashboard/inventory", icon: Boxes, words: "stock item create" },
  { title: "New purchase order", href: "/dashboard/procurement/new", module: "/dashboard/procurement", icon: Truck, words: "buy supplier create" },
  { title: "New stock transfer", href: "/dashboard/transfers/new", module: "/dashboard/transfers", icon: Truck, words: "move branch create" },
  { title: "New return", href: "/dashboard/returns/new", module: "/dashboard/returns", icon: Receipt, words: "refund create" },
  { title: "New support ticket", href: "/dashboard/support/new", module: "/dashboard/support", icon: Users, words: "help create" },
  { title: "New project", href: "/dashboard/projects/new", module: "/dashboard/projects", icon: FileText, words: "create" },
  { title: "New employee", href: "/dashboard/hr/new", module: "/dashboard/hr", icon: UserSquare2, words: "staff hire create" },
  { title: "New transaction", href: "/dashboard/accounting/new", module: "/dashboard/accounting", icon: Receipt, words: "income expense create" },
];

const KIND_ICON: Record<SearchHit["kind"], NavIcon> = {
  Customer: Users,
  Product: Boxes,
  Order: ShoppingCart,
  Invoice: Receipt,
  Supplier: Truck,
  Employee: UserSquare2,
};

/** Words a person might type that don't appear in a page name. */
const ALSO_KNOWN_AS: Record<string, string> = {
  "/dashboard/inventory": "stock products kg expiry",
  "/dashboard/sales": "orders",
  "/dashboard/invoicing": "invoices bills payments",
  "/dashboard/procurement": "purchase orders suppliers buying",
  "/dashboard/hr": "employees staff",
  "/dashboard/crm": "customers leads deals",
  "/dashboard/reports/branches": "compare branches ranking",
  "/dashboard/accounting": "transactions income expenses books",
  "/dashboard/mrp": "planning work orders",
};

/**
 * Ctrl K (Cmd K on a Mac) search over every page this user can open and
 * the company's records: customers, products, orders, invoices, suppliers
 * and staff. Arrow keys move, Enter opens, Escape closes.
 */
export function CommandPalette({
  role,
  isPlatformAdmin = false,
  hiddenHrefs = [],
  lockedHrefs = [],
}: {
  role: Role;
  isPlatformAdmin?: boolean;
  hiddenHrefs?: string[];
  lockedHrefs?: string[];
}) {
  const [open, setOpen] = useState(false);

  // Menu pages opened lately, for "Recent" in the empty search. Records
  // join the list when they are opened from the search.
  const pathname = usePathname();
  useEffect(() => {
    const page = [...navPinned, ...navGroups.flatMap((g) => g.items), ...navSettings].find((i) => i.href === pathname && isActive(i.href, pathname));
    if (page) rememberRecent({ href: page.href, title: page.label, detail: page.description });
  }, [pathname]);

  // Ctrl K / Cmd K toggles it; the top bar button opens it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  // Mounted only while open, so every opening starts from an empty search.
  return open ? <SearchDialog role={role} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} lockedHrefs={lockedHrefs} onClose={() => setOpen(false)} /> : null;
}

function SearchDialog({
  role,
  isPlatformAdmin,
  hiddenHrefs,
  lockedHrefs,
  onClose,
}: {
  role: Role;
  isPlatformAdmin: boolean;
  hiddenHrefs: string[];
  lockedHrefs: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const recent = useRecent();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, startSearch] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);

  // Records, a moment after typing stops. Under two letters there is
  // nothing to look up, so earlier results are simply not shown.
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const timer = window.setTimeout(() => {
      startSearch(async () => {
        let found: SearchHit[] = [];
        try {
          found = await searchRecords(term);
        } catch {
          found = [];
        }
        setHits(found);
        setSelected(0);
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [term]);

  const pages = useMemo(() => {
    const { pinned, groups, settings } = visibleNav({ role, isPlatformAdmin, hiddenHrefs });
    return [
      ...pinned.map((i) => ({ ...i, group: "Pages" })),
      ...groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))),
      ...settings.map((i) => ({ ...i, group: "Settings" })),
    ];
  }, [role, isPlatformAdmin, hiddenHrefs]);

  const actions = useMemo(() => {
    const open = new Set(pages.map((p) => p.href));
    return ACTIONS.filter((a) => open.has(a.module) && !lockedHrefs.includes(a.module));
  }, [pages, lockedHrefs]);

  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    // Each typed word must start a word of the text, so "min" finds nothing
    // in "Administration".
    const fits = (text: string) => {
      const t = ` ${text}`.toLowerCase().replace(/[^a-z0-9]+/g, " ");
      return words.every((w) => t.includes(` ${w}`));
    };

    const pageRows = pages
      .filter((p) => words.length === 0 || fits(`${p.label} ${p.description ?? ""} ${ALSO_KNOWN_AS[p.href] ?? ""}`))
      // Name matches before description matches.
      .sort((a, b) => Number(!a.label.toLowerCase().includes(q)) - Number(!b.label.toLowerCase().includes(q)))
      .slice(0, words.length === 0 ? 8 : 6)
      .map((p) => ({ key: p.href, group: "Pages", title: p.label, detail: p.description, href: p.href, icon: p.icon, color: sectionColor(p.href) }));

    const actionRows = actions
      .filter((a) => words.length > 0 && fits(`${a.title} ${a.words}`))
      .slice(0, 6)
      .map((a) => ({ key: a.href, group: "Create", title: a.title, href: a.href, icon: a.icon, color: sectionColor(a.module) }));

    const recordRows = (term.length < 2 ? [] : hits).map((h) => ({
      key: h.href,
      group: `${h.kind}s`,
      title: h.title,
      detail: h.detail,
      href: h.href,
      icon: KIND_ICON[h.kind],
      color: sectionColor(KIND_HREF[h.kind]),
    }));

    if (words.length === 0) {
      // Empty search: where you were lately, then the things people create most.
      const recentRows = recent
        .filter((r) => r.href !== pathname)
        .slice(0, 5)
        .map((r) => ({ key: r.href, group: "Recent", title: r.title, detail: r.detail, href: r.href, icon: Clock, color: sectionColor(r.href) }));
      const quick = actions.slice(0, 4).map((a) => ({ key: a.href, group: "Create", title: a.title, href: a.href, icon: a.icon, color: sectionColor(a.module) }));
      return [...recentRows, ...quick, ...pageRows];
    }
    return [...actionRows, ...pageRows, ...recordRows];
  }, [pages, actions, hits, term, query, recent, pathname]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);


  const go = (row: Row | undefined) => {
    if (!row) return;
    if (row.group !== "Create" && row.group !== "Pages" && row.group !== "Recent") rememberRecent({ href: row.href, title: row.title, detail: row.detail });
    onClose();
    router.push(row.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(rows.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div className="app-text fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/50 backdrop-blur-sm light:bg-slate-900/20" onClick={onClose} />
      <div className="glass-strong relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl light:border-slate-200 light:bg-white">
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 light:border-slate-200">
          {searching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" /> : <Search className="h-4 w-4 shrink-0 text-slate-400" />}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            autoFocus
            onKeyDown={onKeyDown}
            placeholder="Search, or type new to create something..."
            aria-label="Search"
            aria-controls="search-results"
            aria-activedescendant={rows[selected] ? `search-row-${selected}` : undefined}
            className="h-14 w-full bg-transparent text-[15px] text-slate-50 outline-none placeholder:text-slate-500 light:text-slate-900"
          />
          <kbd className="hidden shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-slate-400 sm:block light:border-slate-300">Esc</kbd>
        </div>

        <ul ref={listRef} id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-slate-400 light:text-slate-500">
              {searching ? "Searching..." : query.trim().length < 2 ? "Type to search." : `Nothing found for "${query.trim()}".`}
            </li>
          ) : (
            rows.map((row, i) => {
              const heading = row.group !== lastGroup ? row.group : null;
              lastGroup = row.group;
              const on = i === selected;
              return (
                <li key={`${row.group}-${row.key}`} role="presentation">
                  {heading && <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{heading}</p>}
                  <div
                    id={`search-row-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => setSelected(i)}
                    onClick={() => go(row)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                      on ? "bg-blue-500/15 light:bg-blue-500/10" : "hover:bg-white/[0.04] light:hover:bg-slate-900/[0.03]"
                    )}
                  >
                    {/* The icon in its section's colour, brighter when selected. */}
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-shadow",
                        !row.color && "border-white/[0.08] bg-white/[0.04] text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-600"
                      )}
                      style={
                        row.color
                          ? {
                              color: row.color,
                              backgroundColor: `${row.color}${on ? "33" : "1f"}`,
                              borderColor: `${row.color}${on ? "80" : "4d"}`,
                              boxShadow: on ? `0 0 18px -4px ${row.color}` : undefined,
                            }
                          : undefined
                      }
                    >
                      {row.group === "Create" ? <Plus className="h-4 w-4" /> : <row.icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-100 light:text-slate-900">{row.title}</span>
                      {row.detail && <span className="block truncate text-xs text-slate-400 light:text-slate-500">{row.detail}</span>}
                    </span>
                    {on ? (
                      <CornerDownLeft className="h-4 w-4 shrink-0 text-blue-300 light:text-blue-700" aria-hidden />
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center gap-4 border-t border-white/[0.08] px-4 py-2 text-[11px] text-slate-500 light:border-slate-200">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" /> Pages, records and actions you can open
          </span>
          <span className="ml-auto">↑ ↓ to move · Enter to open · Esc to close</span>
        </div>
      </div>
    </div>
  );
}

/** The top bar's search box: opens the search, shows the shortcut. */
const noSubscribe = () => () => {};

export function SearchButton() {
  // Read once in the browser; the server render assumes Ctrl.
  const mac = useSyncExternalStore(noSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      className="glass-chip flex items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-2 text-sm text-slate-400 hover:border-white/[0.16] hover:text-slate-200 light:border-slate-200 light:text-slate-500 light:hover:text-slate-800"
      aria-label="Search (Ctrl K)"
    >
      <Search className="h-4 w-4" />
      <span className="hidden md:inline">Search</span>
      <kbd className="hidden rounded border border-white/10 px-1.5 py-px text-[11px] text-slate-400 md:inline light:border-slate-300">{mac ? "⌘ K" : "Ctrl K"}</kbd>
    </button>
  );
}
