"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, CornerDownLeft, FileText, Loader2, Receipt, Search, ShoppingCart, Truck, UserSquare2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchRecords, type SearchHit } from "@/lib/actions/search";
import { visibleNav, type NavIcon, type Role } from "./nav-config";

/** Opens the search from anywhere (the top bar button sends it). */
export const OPEN_SEARCH_EVENT = "aibos:open-search";

type Row = { key: string; group: string; title: string; detail?: string; href: string; icon: NavIcon };

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
}: {
  role: Role;
  isPlatformAdmin?: boolean;
  hiddenHrefs?: string[];
}) {
  const [open, setOpen] = useState(false);

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
  return open ? <SearchDialog role={role} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} onClose={() => setOpen(false)} /> : null;
}

function SearchDialog({
  role,
  isPlatformAdmin,
  hiddenHrefs,
  onClose,
}: {
  role: Role;
  isPlatformAdmin: boolean;
  hiddenHrefs: string[];
  onClose: () => void;
}) {
  const router = useRouter();
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
    const { pinned, groups } = visibleNav({ role, isPlatformAdmin, hiddenHrefs });
    return [
      ...pinned.map((i) => ({ ...i, group: "Pages" })),
      ...groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))),
    ];
  }, [role, isPlatformAdmin, hiddenHrefs]);

  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const pageRows = pages
      .filter((p) => {
        if (words.length === 0) return true;
        // Each typed word must start a word of the page's name, description
        // or other names, so "min" finds nothing in "Administration".
        const text = ` ${p.label} ${p.description ?? ""} ${ALSO_KNOWN_AS[p.href] ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ");
        return words.every((w) => text.includes(` ${w}`));
      })
      // Name matches before description matches.
      .sort((a, b) => Number(!a.label.toLowerCase().includes(q)) - Number(!b.label.toLowerCase().includes(q)))
      .slice(0, words.length === 0 ? 8 : 6)
      .map((p) => ({ key: p.href, group: "Pages", title: p.label, detail: p.description, href: p.href, icon: p.icon }));
    const recordRows = (term.length < 2 ? [] : hits).map((h) => ({ key: h.href, group: `${h.kind}s`, title: h.title, detail: h.detail, href: h.href, icon: KIND_ICON[h.kind] }));
    return [...pageRows, ...recordRows];
  }, [pages, hits, term, query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);


  const go = (row: Row | undefined) => {
    if (!row) return;
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
            placeholder="Search pages, customers, products, orders, invoices..."
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
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        on
                          ? "border-blue-400/30 bg-blue-500/15 text-blue-300 light:text-blue-700"
                          : "border-white/[0.08] bg-white/[0.04] text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-600"
                      )}
                    >
                      <row.icon className="h-4 w-4" />
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
            <FileText className="h-3 w-3" /> Pages and records you can open
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
