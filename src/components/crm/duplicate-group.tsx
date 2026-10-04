"use client";

import Link from "next/link";
import { useState } from "react";
import { Merge } from "lucide-react";
import { Button } from "@/components/ui-dark/button";
import { cn } from "@/lib/utils";

export type DuplicateRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  owner: string | null;
  createdAt: string;
  deals: number;
  orders: number;
  activities: number;
  quotes: number;
};

/** One group of likely duplicates: pick the record to keep, then merge the
 * rest into it, or say they aren't duplicates. */
export function DuplicateGroup({
  records,
  reasons,
  suggestedKeepId,
  merge,
  dismiss,
}: {
  records: DuplicateRecord[];
  reasons: string[];
  suggestedKeepId: string;
  merge: (formData: FormData) => Promise<void>;
  dismiss: (formData: FormData) => Promise<void>;
}) {
  const [keepId, setKeepId] = useState(suggestedKeepId);
  const keep = records.find((r) => r.id === keepId)!;
  const others = records.length - 1;

  return (
    <div className="rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
      <div className="flex flex-wrap items-center gap-2">
        {reasons.map((r) => (
          <span key={r} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 light:text-amber-700">
            {r}
          </span>
        ))}
        <span className="text-xs text-slate-500">Choose the record to keep</span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {records.map((r) => {
          const on = r.id === keepId;
          return (
            <label
              key={r.id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500",
                on ? "border-blue-500/60 bg-blue-500/10" : "border-white/[0.08] hover:border-white/20 light:border-slate-200 light:hover:border-slate-300"
              )}
            >
              <input type="radio" name={`keep-${suggestedKeepId}`} checked={on} onChange={() => setKeepId(r.id)} className="mt-1 h-4 w-4 accent-blue-500" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <Link href={`/dashboard/crm/${r.id}`} target="_blank" className="truncate font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                    {r.name}
                  </Link>
                  {on && <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10.5px] font-medium text-white">Keep</span>}
                </span>
                <span className="mt-1 block truncate text-slate-400 light:text-slate-500">{r.email ?? "No email"}</span>
                <span className="block truncate text-slate-400 light:text-slate-500">
                  {[r.phone, r.company].filter(Boolean).join(" · ") || "No phone or company"}
                </span>
                <span className="mt-2 block text-xs text-slate-500">
                  {r.deals} deals · {r.quotes} quotes · {r.orders} orders · {r.activities} activities
                </span>
                <span className="block text-xs text-slate-500">
                  Added {r.createdAt}
                  {r.owner ? ` · ${r.owner}` : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400 light:text-slate-500">
          Everything from the other {others === 1 ? "record" : `${others} records`} moves to <span className="font-medium text-slate-200 light:text-slate-800">{keep.name}</span>. Blank details are filled in from them.
        </p>
        <div className="flex items-center gap-2">
          <form action={dismiss}>
            {records.map((r) => (
              <input key={r.id} type="hidden" name="ids" value={r.id} />
            ))}
            <Button type="submit" variant="ghost">
              Not duplicates
            </Button>
          </form>
          <form
            action={merge}
            onSubmit={(e) => {
              if (!confirm(`Merge ${others === 1 ? "1 record" : `${others} records`} into ${keep.name}? This can't be undone.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="keepId" value={keepId} />
            {records.map((r) => (
              <input key={r.id} type="hidden" name="ids" value={r.id} />
            ))}
            <Button type="submit">
              <Merge className="h-4 w-4" />
              Merge
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
