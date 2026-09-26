"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Lock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectBranch } from "@/lib/actions/branches";

type Option = { id: string; name: string; code: string };

/**
 * Top bar branch picker. "All branches" or one branch; the choice filters
 * lists and dashboard counts across the app. Locked employees see a fixed
 * label instead. Hidden entirely for companies with a single branch.
 */
export function BranchSwitcher({
  branches,
  currentId,
  locked,
}: {
  branches: Option[];
  currentId: string | null;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const current = branches.find((b) => b.id === currentId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (locked && current) {
    return (
      <span
        title="Your access is limited to this branch"
        className="hidden items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-1.5 text-sm font-medium text-slate-200 sm:inline-flex light:border-slate-300 light:text-slate-700"
      >
        <Lock className="h-3.5 w-3.5 text-slate-400" />
        {current.name}
      </span>
    );
  }
  if (branches.length < 2) return null;

  const choose = (id: string) => {
    setOpen(false);
    startTransition(() => selectBranch(id));
  };

  const items: { id: string; label: string; code?: string }[] = [
    { id: "", label: "All branches" },
    ...branches.map((b) => ({ id: b.id, label: b.name, code: b.code })),
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.06] light:border-slate-300 light:text-slate-800 light:hover:bg-slate-900/5",
          pending && "opacity-60"
        )}
      >
        <MapPin className="h-3.5 w-3.5 text-blue-400 light:text-blue-600" />
        <span className="max-w-[9rem] truncate">{current?.name ?? "All branches"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choose a branch"
          className="absolute left-0 top-full z-50 mt-2 max-h-80 w-60 overflow-y-auto rounded-xl border border-white/[0.09] p-1 shadow-xl glass-strong light:border-white/80"
        >
          {items.map((item) => {
            const selected = (currentId ?? "") === item.id;
            return (
              <li key={item.id || "all"} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => choose(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "bg-blue-500/15 text-white light:text-blue-700"
                      : "text-slate-200 hover:bg-white/[0.07] light:text-slate-700 light:hover:bg-slate-900/5"
                  )}
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.code && <span className="font-mono text-[11px] text-slate-500">{item.code}</span>}
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
